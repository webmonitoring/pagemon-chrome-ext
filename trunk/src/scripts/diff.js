/*
  Contains a suit of functions used by diff.htm to create a page displaying the
  diff between two versions of an HTML page. The whole operation can be
  performed from start to finish by calling initiateDiff(url) and having a
  snapshot of the page at that URL available from getPage(), defined in base.js.
*/

/*******************************************************************************
*                                  Constants                                   *
*******************************************************************************/

// The number of pixels to leave before the first change when scrolling to it.
var SCROLL_MARGIN = 75;

// A regex that lists all HTML4/HTML5 tags that do not require a closing tag.
var EMPTY_HTML_TAGS_REGEX = /AREA|BASE|BASEFONT|BR|COL|FRAME|HR|IMG|INPUT|ISINDEX|LINK|META|PARAM|COMMAND|EMBED|KEYGEN|SOURCE|WBR/i;

/*******************************************************************************
*                                   Diffing                                    *
*******************************************************************************/

// Splits an HTML string into a list of substrings appropriate for diffing over.
// Each substring is either a tag, a string of whitespace characters or a word.
function htmlToList(html) {
  var CHAR = 0;
  var TAG = 1;
  var mode = CHAR;
  var current = '';
  var buffer = [];

  for (var pos = 0; pos < html.length; pos++) {
    var character = html[pos];

    if (mode == TAG) {
      current += character;
      if (character == '>') {
        buffer.push(current);
        current = '';
        mode = CHAR;
      }
    } else if (mode == CHAR) {
      if (character == '<') {
        buffer.push(current);
        current = character;
        mode = TAG;
      } else if (html.slice(pos, pos + 2).match(/^\s\S|\S\s$/)) {
        buffer.push(current + character);
        current = '';
      } else {
        current += character;
      }
    }
  }
  buffer.push(current);

  var filtered = [];

  for (var i = 0; i < buffer.length; i++) {
    if (buffer[i] != '') filtered.push(buffer[i]);
  }

  return filtered;
}

// Returns a boolean indicating whether the string passed represents an HTML tag
// that is either self closed using the <... /> syntax or does not require
// content (e.g. <img> or <br>). HTML attributes are ignored. If the passed
// string is not a tag, null is returned.
function isSelfClosingTag(tag) {
  if (!tag.match(/^<[^]*>$/)) return null;
  if (tag.match(/\/\s*>$/)) return true;

  var tagname = tag.substring(1).match(/^\w+\b/);
  if (tagname && tagname[0].match(EMPTY_HTML_TAGS_REGEX)) return true;

  return false;
}

// Takes a list of strings, where each string is either an HTML tag or plain
// text, then inserts the prefix before each run of plain text or self-closing
// tags (or a mix of the two), and the suffix after each run. Returns a list
// of strings with the prefixes and suffixes inserted. If the optional
// remove_unwrapped argument is true, non-self-closing tags are discarded
// completely.
function wrapText(list, prefix, suffix, remove_unwrapped) {
  var out = [];
  var buffer = [];
  remove_unwrapped = Boolean(remove_unwrapped);

  for (var i = 0; i < list.length; i++) {
    if (list[i][0] == '<' && !isSelfClosingTag(list[i])) {
      if (buffer.length > 0) {
        out.push(prefix);
        out = out.concat(buffer);
        out.push(suffix);
        buffer = [];
      }
      if (!remove_unwrapped) out.push(list[i]);
    } else {
      buffer.push(list[i]);
    }
  }

  if (buffer.length > 0) {
    out.push(prefix);
    out = out.concat(buffer);
    out.push(suffix);
    buffer = [];
  }

  return out;
}

// Calculates the diff between two HTML strings, src and dst, and returns a
// compiled version with <del> and <ins> tags added in the appropriate places.
// Returns null if there's an error in the diff library. This uses difflib for
// calculating the diff.
function calculateHtmlDiff(src, dst) {
  src = htmlToList(src);
  dst = htmlToList(dst);

  var opcodes = new difflib.SequenceMatcher(src, dst).get_opcodes();
  var buffer = [];

  for (var i = 0; i < opcodes.length; i++) {
    var opcode = opcodes[i][0];
    var src_start = opcodes[i][1];
    var src_end = opcodes[i][2];
    var dst_start = opcodes[i][3];
    var dst_end = opcodes[i][4];

    switch (opcode) {
      case 'replace':
        var deleted = src.slice(src_start, src_end);
        var inserted = dst.slice(dst_start, dst_end);
        buffer = buffer.concat(wrapText(deleted, '<del>', '</del>', true));
        buffer = buffer.concat(wrapText(inserted, '<ins>', '</ins>'));
        break;
      case 'delete':
        var deleted = src.slice(src_start, src_end);
        buffer = buffer.concat(wrapText(deleted, '<del>', '</del>', true));
        break;
      case 'insert':
        var inserted = dst.slice(dst_start, dst_end);
        buffer = buffer.concat(wrapText(inserted, '<ins>', '</ins>'));
        break;
      case 'equal':
        buffer = buffer.concat(dst.slice(dst_start, dst_end));
        break;
      default:
        // Error in the diff library - should never happen.
        console.assert(false);
        return null;
    }
  }

  return buffer.join('');
}

// Calculates the diff between two text strings, src and dst, and returns a
// compiled version with <del> and <ins> tags added in the appropriate places.
// Returns null if there's an error in the diff library. The returned string is
// valid HTML, with <, > and & escaped, as well as newlines converted to <br />.
// Uses Google's diff_match_patch library for calculating the diff.
function calculateTextDiff(src, dst) {
  var differ = new diff_match_patch();
  var opcodes = differ.diff_main(src, dst);
  differ.diff_cleanupSemantic(opcodes);
  var buffer = [];

  buffer.push('<pre>');
  for (var i = 0; i < opcodes.length; i++) {
    var mode = opcodes[i][0];
    var content = opcodes[i][1].replace(/&/g, '&amp;')
                               .replace(/</g, '&lt;')
                               .replace(/>/g, '&gt;')
                               .replace(/\r\n|\r|\n/g, '<br />');

    switch (mode) {
      case DIFF_DELETE:
        buffer.push('<del>' + content + '</del>');
        break;
      case DIFF_INSERT:
        buffer.push('<ins>' + content + '</ins>');
        break;
      case DIFF_EQUAL:
        buffer.push(content);
        break;
      default:
        // Error in the diff library - should never happen.
        console.assert(false);
        return null;
    }
  }
  buffer.push('</pre>');

  return buffer.join('');
}

/*******************************************************************************
*                               Page Generation                                *
*******************************************************************************/

// Generates the control block that is added to the diffed page. Includes a link
// to the original page, as well as a toggler to show/hide deletions. The
// returned value is a jQuery-wrapped div with the appropriate event(s) already
// attached.
function generateControls(url) {
  var template = '<div id="chrome_page_monitor_ext_orig_link"> \
                    <a href="%url%" title="%title%">%original%</a> \
                    <br /> \
                    <a href="#">%hide%</a> \
                  </div>';

  var title = chrome.i18n.getMessage('diff_original_title');
  var original = chrome.i18n.getMessage('diff_original');
  var hide = chrome.i18n.getMessage('diff_hide_deletions');
  var show = chrome.i18n.getMessage('diff_show_deletions');
  var controls = template.replace('%url%', url)
                         .replace('%title%', title)
                         .replace('%original%', original)
                         .replace('%hide%', hide);

  var $controls = $(controls);

  $('a:last', $controls).click(function() {
    if ($(this).text() == show) {
      $(this).text(hide);
    } else {
      $(this).text(show);
    }
    $('del').toggle();
    return false;
  });

  return $controls;
}

// Searches src and dst for a <base> tag, and returns the URL pointed to by the
// first one found. If none found, returns the passed URL.
function calculateBaseUrl(url, src, dst) {
  var base = url;
  var src_base = src.match(/<base[^>]*href=['"]?([^>'"]+)[^>]*>/i);
  var dst_base = dst.match(/<base[^>]*href=['"]?([^>'"]+)[^>]*>/i);

  if (src_base && src_base.length > 0) {
    base = src_base[src_base.length - 1];
  } else if (dst_base && dst_base.length > 0) {
    base = dst_base[dst_base.length - 1];
  }

  return base;
}

// Returns a concatenation of the content of all <style> tags in the HTML,
// separated by newlines.
function getInlineStyles(html) {
  var styles = html.match(/<style[^>]*>(.*?)<\/style>/ig);
  var buffer = [];

  if (styles) {
    for (var i = 0; i < styles.length; i++) {
      buffer.push(styles[i].replace(/<\/?style[^>]*>/ig, ''));
    }
  }

  return buffer.join('\n');
}

// Returns a jQuery-wrapped list of <link> elements that point to stylesheets in
// the supplied HTML string.
function getReferencedStyles(html) {
  var links = html.match(/<link[^>]*>/ig);

  return links ? $(links.join('')).filter('[rel=stylesheet]') : $([]);
}

// Returns the position of the first non-whitespace change in the page.
function findFirstChangePosition() {
  var pos = $('ins,del').filter(function() {
    return $(this).text().replace(/^\s*$/, '');
  }).first().position();

  return pos || { left: 0, top: 0 };
}

// Takes a URL, the source and destination HTML strings, and a MIME type. Diffs
// the strings either as text or as HTML depending on the type, inserts the
// result into the current page with appropriate changes and UI controls, then
// scrolls to the first change.
function applyDiff(url, src, dst, type) {
  // Get base and styles.
  $('<base />').attr('href', calculateBaseUrl(url, src, dst)).appendTo('head');
  $('<style type="text/css">').text(getInlineStyles(src)).appendTo('head');
  getReferencedStyles(src).appendTo('head');

  // Get diffed body.
  var is_type_html = type.match(/\b(x|xht|ht)ml\b/);
  var differ = is_type_html ? calculateHtmlDiff : calculateTextDiff;
  var compiled = differ(getStrippedBody(src), getStrippedBody(dst));
  if (compiled === null) alert(chrome.i18n.getMessage('diff_error'));
  $('body').html(compiled);

  // Insert controls.
  generateControls(url).appendTo('body');

  // Scroll to the first change.
  var pos = findFirstChangePosition();
  window.scrollTo(pos.left, pos.top - SCROLL_MARGIN);
}

// Retrieves a saved snapshot of the URL, then the current live version, and
// runs a diff between them using applyDiff(). If the response received is of
// the type text/plain, it's converted to HTML using textToHtml(). If no saved
// snapshot is available, displays a diff_coruption error message in the first
// div of the page.
function initiateDiff(url) {
  getPage(url, function(page) {
    $.ajax({
      url: url,
      dataType: 'text',
      success: function(new_html, _, xhr) {
        var type = xhr.getResponseHeader('Content-type');

        if (page.html) {
          applyDiff(url, page.html, canonizePage(new_html, type), type);
        } else {
          setPageSettings(url, { html: new_html });
          $('img').hide();
          $('div:first').html(chrome.i18n.getMessage('diff_corruption'));
        }
      }
    });
  });
}
