/*
  Contains a suit of functions used by diff.htm to create a page displaying the
  diff between two versions of an HTML page. The whole operation can be
  performed from start to finish by calling initiateDiff(url) and having a
  snapshot of the page at that URL available from getPage(), defined in base.js.
*/

/*******************************************************************************
*                                  Constants                                   *
*******************************************************************************/

// The numver of pixels to leave before the first change when scrolling to it.
var SCROLL_MARGIN = 75;

/*******************************************************************************
*                                   Diffing                                    *
*******************************************************************************/

// Splits an HTML string into a list of substrings appropriate for diffing over.
// Each substring is either a tag, a space or a word.
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
      } else if (html.slice(pos, pos + 2).match(/^.\b.$/)) {
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

// Takes a list of strings, where each string is either an HTML tag or plain
// text, then inserts the prefix before each run of plain text, and the suffix
// after each run. Returns a list with the prefixes and suffixes inserted.
function wrapText(list, prefix, suffix) {
  var out = [];
  var buffer = [];
  
  for (var i = 0; i < list.length; i++) {
    if (list[i][0] == '<') {
      if (buffer.length > 0) {
        out.push(prefix);
        out = out.concat(buffer);
        out.push(suffix);
        buffer = [];
      }
      out.push(list[i]);
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

// Calculates the diff between two HTML string, src and dest, and returns a
// compiled version with <del> and <ins> tags added in the appropriate places.
// Returns null if there's an error in the diff library.
function calculateDiff(src, dest) {
  var src = htmlToList(src.replace(/\s+/g, ' '));
  var dest = htmlToList(dest.replace(/\s+/g, ' '));
  var opcodes = new difflib.SequenceMatcher(src, dest).get_opcodes();
  var buffer = [];
  
  for (var i = 0; i < opcodes.length; i++) {
    var opcode = opcodes[i][0];
    var src_start = opcodes[i][1];
    var src_end = opcodes[i][2];
    var dest_start = opcodes[i][3];
    var dest_end = opcodes[i][4];
    
    switch (opcode) {
      case 'replace':
        var deleted = src.slice(src_start, src_end);
        var inserted = dest.slice(dest_start, dest_end);
        buffer = buffer.concat(wrapText(deleted, '<del>', '</del>'));
        buffer = buffer.concat(wrapText(inserted, '<ins>', '</ins>'));
        break;
      case 'delete':
        var deleted = src.slice(src_start, src_end);
        buffer = buffer.concat(wrapText(deleted, '<del>', '</del>'));
        break;
      case 'insert':
        var inserted = dest.slice(dest_start, dest_end);
        buffer = buffer.concat(wrapText(inserted, '<ins>', '</ins>'));
        break;
      case 'equal':
        buffer = buffer.concat(dest.slice(dest_start, dest_end));
        break;
      default:
        // Error in the diff library - should never happen.
        console.assert(false);
        return null;
    }
  }
  
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
  var template = '<div id="chrome_page_monitor_ext_orig_link">' +
                 '<a href="%url%" title="%title%">%original%</a>' +
                 '<br /><a href="#">%hide%</a></div>';

  var title = chrome.i18n.getMessage('diff_original_title');
  var original = chrome.i18n.getMessage('diff_original');
  var hide = chrome.i18n.getMessage('diff_hide_deletions');
  var controls = template.replace('%url%', url)
                         .replace('%title%', title)
                         .replace('%original%', original)
                         .replace('%hide%', hide);
  
  var $controls = $(controls);
  
  $('a[href="#"]', $controls).click(function() {
    $('del').toggle();
    return false;
  });
  
  return $controls;
}

// Searches src and dest for a <base> tag, and returns the URL pointed to by the
// first one found. If none found, returns the passed URL.
function calculateBaseUrl(url, src, dest) {
  var base = url;
  var src_base = src.match(/<base[^>]*href=['"]?([^>'"]+)[^>]*>/i);
  var dest_base = dest.match(/<base[^>]*href=['"]?([^>'"]+)[^>]*>/i);

  if (src_base && src_base.length > 0) {
    base = src_base[src_base.length - 1];
  } else if (dest_base && dest_base.length > 0) {
    base = dest_base[dest_base.length - 1];
  }
  
  return base;
}

// Returns a concatenation of the content of all <style> tags in the HTML.
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

// Takes a URL and the source and destination HTML strings, diffs them, inserts
// them into the current page with appropriate changes and UI controls, then
// scrolls to the first change.
function applyDiff(url, src, dest) {
  // Get base and styles.
  $('<base />').attr('href', calculateBaseUrl(url, src, dest)).appendTo('head');
  $('<style type="text/css">').text(getInlineStyles(src)).appendTo('head');
  getReferencedStyles(src).appendTo('head');
  
  // Get diffed body.
  var compiled = calculateDiff(getStrippedBody(src), getStrippedBody(dest));
  if (compiled === null) alert(chrome.i18n.getMessage('diff_error'));
  $('body').html(compiled);
  
  // Insert controls.
  generateControls(url).appendTo('body');
  
  // Scroll to the first change.
  var pos = findFirstChangePosition();
  window.scrollTo(pos.left, pos.top - SCROLL_MARGIN);
}

// Retrieves a saved snapshot of the URL, then the current live version, and
// runs a diff between them using applyDiff(). If no saved snapshot is
// available, displays a diff_coruption error message in the first div of the
// page.
function initiateDiff(url) {
  getPage(url, function(page) {
    $.ajax({
      url: url,
      dataType: 'text',
      success: function(new_html) {
        if (page.html) {
          applyDiff(url, page.html, new_html);
        } else {
          setPageSettings(url, { html: new_html });
          $('img').hide();
          $('div').first().html(chrome.i18n.getMessage('diff_corruption'));
        }
      }
    });
  });
}
