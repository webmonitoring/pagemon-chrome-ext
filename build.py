import re
import os
import shutil
import glob
from BeautifulSoup import BeautifulSoup

def compileJS(text):
    import httplib, urllib, sys

    params = urllib.urlencode([('js_code', text),
                               ('compilation_level', 'SIMPLE_OPTIMIZATIONS'),
                               ('output_format', 'text'),
                               ('output_info', 'compiled_code')])
    headers = { 'Content-type': 'application/x-www-form-urlencoded' }

    conn = httplib.HTTPConnection('closure-compiler.appspot.com')
    conn.request('POST', '/compile', params, headers)
    response = conn.getresponse()
    data = response.read()
    conn.close()
    
    return data.replace('<!--', r'\<\!\-\-')

def compileCSS(text):
    return re.sub(r'/\*.*?\*/|(?<!\w)\s+|\s(?=\{)', '', text.strip())

def compileHTML(text):
    doc = BeautifulSoup(text)
    
    for script in doc.findAll('script'):
        if script.contents:
            script.setString(compileJS(''.join(script.contents)))
    
    for style in doc.findAll('style'):
        if style.contents:
            style.setString(compileCSS(''.join(style.contents)))
    
    return doc.renderContents()

def stripSVN(src, names):
    return [i for i in names if i.startswith('.')]

# Remove old build folder.
if os.path.exists('build'):
    print 'Cleaning old folder'
    shutil.rmtree('build')

# Copy all files.
print 'Copying files'
shutil.copytree('.', 'build', ignore=stripSVN)

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

# Compress stylesheets.
for f in glob.glob('build/*.css'):
    print 'Compiling CSS:', f
    data = open(f).read()
    open(f, 'w').write(compileCSS(data))

# Compress javascript.
for f in glob.glob('build/*.js'):
    print 'Compiling JS:', f
    data = open(f).read()
    open(f, 'w').write(compileJS(data))

# Compress HTML.
for f in glob.glob('build/*.htm*'):
    print 'Compiling HTML:', f
    data = open(f).read()
    open(f, 'w').write(compileHTML(data))
