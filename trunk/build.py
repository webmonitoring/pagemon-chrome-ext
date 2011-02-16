import glob
import lxml.html
import os
import re
import shutil
import sys


DEV_ONLY_REGEX = re.compile('<!--DEV_ONLY-->.*?<!--/DEV_ONLY-->', re.DOTALL)


def compileJS(text):
  import httplib, urllib, sys

  params = urllib.urlencode([('js_code', text),
                             ('compilation_level', 'SIMPLE_OPTIMIZATIONS'),
                             ('output_format', 'text'),
                             ('output_info', 'compiled_code')])
  headers = {'Content-type': 'application/x-www-form-urlencoded'}

  conn = httplib.HTTPConnection('closure-compiler.appspot.com')
  conn.request('POST', '/compile', params, headers)
  response = conn.getresponse()
  data = response.read()
  conn.close()

  return data.replace('<!--', r'\<\!\-\-')


def compileCSS(text):
  return re.sub(r'/\*.*?\*/|(?<!\w)\s+|\s(?=\{)', '', text.strip())

def compileHTML(filename):
  string = open(filename).read()
  string = DEV_ONLY_REGEX.sub('', string)
  doc = lxml.html.fromstring(string)

  for e in doc.cssselect('*'):
    if not e.tail or e.tail.isspace():
      e.tail = ' '

  for script in doc.cssselect('script'):
    if script.text:
      script.text = compileJS(script.text)

  for style in doc.cssselect('style'):
    if style.text:
      style.text = compileCSS(style.text)

  return lxml.html.tostring(doc)


def stripDotfiles(src, names):
  return [i for i in names if i.startswith('.')]


if __name__ == '__main__':
  # Remove old build folder.
  if os.path.exists('build'):
    print 'Cleaning old folder'
    shutil.rmtree('build')

  # Copy all files.
  print 'Copying files'
  shutil.copytree('.', 'build', ignore=stripDotfiles)

  # Copy over minified libs.
  print 'Applying minified libs'
  for f in glob.glob('build/lib/*.js'):
    os.remove(f)
  for f in glob.glob('build/lib/min/*.js'):
    shutil.copy(f, 'build/lib')
  shutil.rmtree('build/lib/min')

  # Remove the build script.
  print 'Removing build script'
  os.remove('build/build.py')

  # Remove the tests.
  print 'Removing tests'
  shutil.rmtree('build/tests')

  # Compile stylesheets.
  for f in glob.glob('build/styles/*.css'):
    print 'Compiling CSS:', f
    data = open(f).read()
    open(f, 'w').write(compileCSS(data))

  # Compile javascript.
  if '--compile_js' in sys.argv:
    for f in glob.glob('build/scripts/*.js'):
      print 'Compiling JS:', f
      data = open(f).read()
      open(f, 'w').write(compileJS(data))

  # Compile HTML.
  for f in glob.glob('build/*.htm*'):
    print 'Compiling HTML:', f
    data = compileHTML(f)
    open(f, 'w').write(data)

  raw_input('Done. Press enter to continue.')
