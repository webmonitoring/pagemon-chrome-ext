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

/*******************************************************************************
*                                   Diffing                                    *
*******************************************************************************/

// Calculates the diff between two HTML strings, src and dst, and returns a
// compiled version with <del> and <ins> tags added in the appropriate places.
// Returns null if there's an error in the diff library. Called recursively to
// diff each subtree. Uses difflib for calculating the diff.
// TODO: Refactor this dinosaur.
function calculateHtmlDiff(src, dst) {
  function tokenize(str) {
    var parts = [];
    $('<html/>').append(str).contents().each(function() {
      if (this.data) {
        parts = parts.concat(this.data.match(/\S+|\s+/g));
      } else {
        parts.push(this.outerHTML);
      }
    });
    return parts;
  }

  // Split the HTML strings into nodes, tags or text.
  src = tokenize(src);
  dst = tokenize(dst);

  // Diff the two token lists.
  var opcodes = new difflib.SequenceMatcher(src, dst, false).get_opcodes();

  // Merge del-ins-del-ins runs of plain text into {del-del}-{ins-ins}. Does not
  // touch 'replace' runs containing tags.
  var opcodes_merged = [];
  var del_run = [];
  var ins_run = [];
  for (var i = 0; i < opcodes.length; i++) {
    switch (opcodes[i][0]) {
      case 'replace':
        var opcode = opcodes[i][0];
        var src_start = opcodes[i][1];
        var src_end = opcodes[i][2];
        var dst_start = opcodes[i][3];
        var dst_end = opcodes[i][4];
        var haystack = src.slice(src_start, src_end) +
                       dst.slice(dst_start, dst_end);
        if (haystack.match(/<|>/)) {
          opcodes_merged = opcodes_merged.concat(del_run);
          opcodes_merged = opcodes_merged.concat(ins_run);
          del_run = [];
          ins_run = [];
          // Split off text prefixes and suffixes.
          var src_body_start = src_start, src_body_end = src_end;
          for (var i = src_start; i < src_end && !src[i].match(/^</); i++) {
            src_body_start++;
          }
          for (var i = src_end - 1; i > src_start && !src[i].match(/>$/); i--) {
            src_body_end--;
          }

          var dst_body_start = dst_start, dst_body_end = dst_end;
          for (var i = dst_start; i < dst_end && !dst[i].match(/^</); i++) {
            dst_body_start++;
          }
          for (var i = dst_end - 1; i > dst_start && !dst[i].match(/>$/); i--) {
            dst_body_end--;
          }

          if (src_body_start != src_start || dst_body_start != dst_start) {
            opcodes_merged.push(['replace',
                                 src_body_start, src_start,
                                 dst_body_start, dst_start]);
          }
          opcodes_merged.push(['replace',
                               src_body_start, src_body_end,
                               dst_body_start, dst_body_end]);
          if (src_body_end != src_end || dst_body_end != dst_end) {
            opcodes_merged.push(['replace',
                                 src_body_end, src_end,
                                 dst_body_end, dst_end]);
          }
        } else {
          del_run.push(['delete', src_start, src_end, dst_start, dst_end]);
          ins_run.push(['insert', src_start, src_end, dst_start, dst_end]);
        }
        break;
      case 'delete':
        del_run.push(opcodes[i]);
        break;
      case 'insert':
        ins_run.push(opcodes[i]);
        break;
      case 'equal':
        opcodes_merged = opcodes_merged.concat(del_run);
        opcodes_merged = opcodes_merged.concat(ins_run);
        del_run = [];
        ins_run = [];
        opcodes_merged.push(opcodes[i]);
        break;
    }
  }
  opcodes_merged = opcodes_merged.concat(del_run);
  opcodes_merged = opcodes_merged.concat(ins_run);
  opcodes = opcodes_merged;

  // Assemble the diff by surrounding deletions and insertions with <del> and
  // <ins>, respectively. Recurses when tags are being replaced.
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

        if (!deleted.join('').match(/<|>/) || !inserted.join('').match(/<|>/)) {
          // If either of the replacement parts has no HTML tags, trying to
          // recursively diff them one-by-one will produce a long
          // del-ins-del-ins sequence, which is ugly. We merge them normally in
          // this case.
          buffer.push('<del>');
          buffer = buffer.concat(deleted);
          buffer.push('</del>');
          buffer.push('<ins>');
          buffer = buffer.concat(inserted);
          buffer.push('</ins>');
        } else {
          // It is often the case that minor changes in the last item of a run
          // produce an overly greedy replace subsequence. Here we chop off the
          // beginning of either the deleted or the inserted array to make sure
          // both are of the same size before recursing.
          if (deleted.length != inserted.length) {
            var sharedLength = Math.min(deleted.length, inserted.length);
            var deletedPrefix = deleted.slice(0, -sharedLength);
            var insertedPrefix = inserted.slice(0, -sharedLength);

            if (deletedPrefix.length) {
              buffer.push('<del>');
              buffer = buffer.concat(deletedPrefix);
              buffer.push('</del>');
            }
            if (insertedPrefix.length) {
              buffer.push('<ins>');
              buffer = buffer.concat(insertedPrefix);
              buffer.push('</ins>');
            }

            deleted = deleted.slice(-sharedLength);
            inserted = inserted.slice(-sharedLength);
          }

          // Recursively diff each respective pair of deleted/inserted items if
          // their top level tags match.
          for (var j = 0; j < deleted.length; j++) {
            var deletedTag = deleted[j].match(/^\s*<(\w+)[^>]*>/);
            var insertedTag = inserted[j].match(/^\s*<(\w+)[^>]*>/);
            if (deletedTag && insertedTag && deletedTag[0] == insertedTag[0]) {
              var diff = calculateHtmlDiff($(deleted[j]).html(), 
                                           $(inserted[j]).html());
              buffer.push(insertedTag[0]);
              buffer.push(diff);
              buffer.push('</' + insertedTag[1] + '>');
            } else {
              buffer.push('<del>');
              buffer.push(deleted[j]);
              buffer.push('</del>');
              buffer.push('<ins>');
              buffer.push(inserted[j]);
              buffer.push('</ins>');
            }
          }
        }
        break;
      case 'delete':
        var deleted = src.slice(src_start, src_end);
        if (deleted.join('') != '') {
          buffer.push('<del>');
          buffer = buffer.concat(deleted);
          buffer.push('</del>');
        }
        break;
      case 'insert':
        var inserted = dst.slice(dst_start, dst_end);
        if (inserted.join('') != '') {
          buffer.push('<ins>');
          buffer = buffer.concat(inserted);
          buffer.push('</ins>');
        }
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
                    <a class="pm_original" href="%url%" \
                       title="%title%">%original%</a> \
                    <br /> \
                    <a class="pm_textize" href="#">%textize%</a> \
                    <br /> \
                    <a class="pm_hide" href="#">%hide%</a> \
                  </div>';

  var title = chrome.i18n.getMessage('diff_original_title');
  var original = chrome.i18n.getMessage('diff_original');
  var textize = chrome.i18n.getMessage('diff_textize');
  var untextize = chrome.i18n.getMessage('diff_untextize');
  var hide = chrome.i18n.getMessage('diff_hide_deletions');
  var show = chrome.i18n.getMessage('diff_show_deletions');
  var controls = template.replace('%url%', url)
                         .replace('%title%', title)
                         .replace('%original%', original)
                         .replace('%textize%', textize)
                         .replace('%hide%', hide);

  var $controls = $(controls);

  // Deletion visibility switcher.
  var deletions_shown = true;
  $('.pm_hide', $controls).click(function() {
    $(this).text($(this).text() == show ? hide : show);
    $('del').toggle(deletions_shown = !deletions_shown);
    return false;
  });

  // Text-only switcher.
  var links = $('link[rel=stylesheet]:not([href=styles/diff.css]),style');
  var print = $('<link rel="stylesheet" type="text/css" href="diff_txt.css"/>');
  var inline_styles = $('body *[style]').each(function() {
    $(this).data('style', $(this).attr('style'));
  });
  var objs = $('img:visible,object:visible,applet:visible,video:visible');
  var is_textized = false;

  $('.pm_textize', $controls).click(function() {
    $(this).text($(this).text() == untextize ? textize : untextize);
    if (is_textized) {
      links.appendTo('head');
      print.detach();
      inline_styles.each(function() {
        $(this).attr('style', $(this).data('style'));
      });
      objs.show();
    } else {
      links.detach();
      print.appendTo('head');
      inline_styles.each(function() {
        $(this).attr('style', '');
      });
      objs.hide();
    }
    is_textized = !is_textized;
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

  var dst_clean = dst.replace(/<!--.*?-->/g, '');
  $('<style type="text/css">').text(getInlineStyles(dst_clean)).appendTo('head');
  getReferencedStyles(dst_clean).appendTo('head');

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
// runs a diff between them using applyDiff(). The content-type header of the
// live version is used to select whether to run a text or an html diff. If no
// saved snapshot is available, displays a diff_coruption error message in the
// first div of the page.
function initiateDiff(url) {
  getPage(url, function(page) {
    $.ajax({
      url: url,
      dataType: 'text',
      success: function(new_html, _, xhr) {
        var type = xhr.getResponseHeader('Content-type');

        if (page.html) {
          applyDiff(url, page.html, canonizePage(new_html, type), type);
          // Undo diff highlights outside of selector for selector-mode pages.
          if (page.mode == 'selector' && page.selector) {
            $('del,ins', page.selector).addClass('preserve');
            $(page.selector).each(function() {
              var parent = $(this).parent();
              if (parent.is('del,ins')) {
                parent.addClass('preserve');
              }
            });

            $('del:not(.preserve)').remove();
            $('ins:not(.preserve)').each(function() {
              $(this).replaceWith($(this).contents());
            });
          }
        } else {
          setPageSettings(url, { html: new_html });
          $('img').hide();
          $('div:first').html(chrome.i18n.getMessage('diff_corruption'));
        }
      }
    });
  });
}
