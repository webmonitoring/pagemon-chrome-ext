/*
  Contains a suite of functions used by diff.htm to create a page displaying the
  diff between two versions of an HTML or text page. The whole operation can be
  performed from start to finish by calling initiateDiff(url) and having a
  snapshot of the page at that URL available from getPage(), defined in base.js.
*/

/*******************************************************************************
*                                  Constants                                   *
*******************************************************************************/

// The number of pixels to leave before the first change when scrolling to it.
var SCROLL_MARGIN = 75;

// The maximum length of matching text between "insert"/"delete" runs in an HTML
// diff that should be merged into the surrounding runs.
var SHORT_TEXT_LENGTH = 15;

// The start and end tag for sequences of insertions or deletions.
var INS_START = '<ins class="chrome_page_monitor_ins">';
var INS_END = '</ins>';
var DEL_START = '<del class="chrome_page_monitor_del">';
var DEL_END = '</del>';

/*******************************************************************************
*                                HTML Diffing                                  *
*******************************************************************************/

// Returns a rough similarity value of two strings, between 0 and 1, 0 being
// entirely different and 1 being identical. Uses difflib.
function getSimilarity(str1, str2) {
  return (new difflib.SequenceMatcher(str1.split(''), str2.split(''))).ratio();
}

// Splits an HTML string into tokens for diffing. First the HTML is split into
// nodes, then text nodes are further split into words, runs of punctuation and
// runs of whitespace. Comment nodes are discarded.
function tokenizeHtml(str) {
  var parts = [];
  $('<html/>').append(str).contents().each(function() {
    if (this.nodeType == Node.TEXT_NODE) {
      parts = parts.concat(this.data.match(/\s+|\w+|\W+/g));
    } else if (this.nodeType == Node.ELEMENT_NODE) {
      parts.push(this.outerHTML);
    }
  });
  return parts;
}

// Hashes a given token for an HTML diff. Text tokens are returned as is, while
// tag tokens are hashed using crc(). If loose_compare is true, tag tokens are
// also passed through cleanHtmlPage() before being hashed.
function hashToken(token, loose_compare) {
  if (/^</.test(token)) {
    // For HTML tag tokens, compare only the actual text content in loose mode.
    return crc(loose_compare ? cleanHtmlPage(token) : token);
  } else {
    return token;
  }
}

// Determines whether any token in a hashed tokens list is an HTML tag. Assumes
// that text tokens are unhashed.
function hasTags(hashed_tokens) {
  for (var i = 0; i < hashed_tokens.length; i++) {
    if (typeof(hashed_tokens[i]) == 'number') return true;
  }
  return false;
}

// A shortcut to iterate diff opcode lists.
function eachOpcode(opcodes, callback) {
  for (var i = 0; i < opcodes.length; i++) {
    var opcode = opcodes[i];
    callback(opcode, opcode[1], opcode[2], opcode[3], opcode[4]);
  }
}

// Splits "replace" runs so that they align at the first tag. This is necessary
// for the recursive differ to be able to match respective elements. Non-replace
// runs are left as is.
// Example run before replacement:
//   replace('abc<def>...</def><ghi />jkl ', '<mno /><pqr />stu ')
// Example run after replacement:
//   delete('abc')
//   replace('<def>...</def><ghi />', '<mno /><pqr />')
//   replace('jkl', 'stu')
//   equal(' ', ' ')
function alignTagRuns(opcodes, src, dst, src_hashed, dst_hashed) {
  var opcodes_aligned = [];

  function pushChange(src_start, src_end, dst_start, dst_end, split) {
    if (src_start == src_end && dst_start == dst_end) return;
    var type = (src_start == src_end) ? 'insert' :
               (dst_start == dst_end) ? 'delete' :
               'replace';

    // Check whether our replacements are actually equal.
    if (type == 'replace') {
      var src_run = src.slice(src_start, src_end).join('');
      var dst_run = dst.slice(dst_start, dst_end).join('');
      if (src_run == dst_run) type = 'equal';
    }

    if (split && type == 'replace') {
      opcodes_aligned.push(['delete', src_start, src_end, 0, 0]);
      opcodes_aligned.push(['insert', 0, 0, dst_start, dst_end]);
    } else {
      opcodes_aligned.push([type, src_start, src_end, dst_start, dst_end]);
    }
  }

  eachOpcode(opcodes, function(opcode, src_start, src_end, dst_start, dst_end) {
    if (opcode[0] != 'replace') {
      opcodes_aligned.push(opcode);
    } else {
      var src_has_tags = hasTags(src_hashed.slice(src_start, src_end));
      var dst_has_tags = hasTags(dst_hashed.slice(dst_start, dst_end));

      if (src_has_tags || dst_has_tags) {
        // Split off text prefixes and suffixes.
        var src_body_start = src_start, src_body_end = src_end;
        if (src_has_tags) {
          for (var i = src_start; i < src_end && !src[i].match(/^</); i++) {
            src_body_start++;
          }
        }
        for (var i = src_end - 1; i >= src_start && !src[i].match(/^</); i--) {
          src_body_end--;
        }

        var dst_body_start = dst_start, dst_body_end = dst_end;
        if (dst_has_tags) {
          for (var i = dst_start; i < dst_end && !dst[i].match(/^</); i++) {
            dst_body_start++;
          }
        }
        for (var i = dst_end - 1; i >= dst_start && !dst[i].match(/^</); i--) {
          dst_body_end--;
        }

        pushChange(src_start, src_body_start, dst_start, dst_body_start, true);
        pushChange(src_body_start, src_body_end, dst_body_start, dst_body_end);
        pushChange(src_body_end, src_end, dst_body_end, dst_end, true);
      } else {
        pushChange(src_start, src_end, dst_start, dst_end, true);
      }
    }
  });

  return opcodes_aligned;
}

// Recursively diffs "replace" runs. The contents of elements with matching tags
// are passed to calculateHtmlDiff(), the result of the diff is reinserted into
// src[_hashed] and dst[_hashed] and the run is converted to "equal". Elements
// with mismatched tags are converted into "delete"/"insert" runs. Non-replace
// runs are left as is. The returned sequence of opcodes will contain no
// "replace" runs; only "delete", "insert" or "equal".
function recurseHtmlDiff(opcodes, src, dst, src_hashed, dst_hashed, loose) {
  var opcodes_recursed = [];

  eachOpcode(opcodes, function(opcode, src_start, src_end, dst_start, dst_end) {
    if (opcode[0] != 'replace') {
      opcodes_recursed.push(opcode);
    } else {
      // It is often the case that minor changes in the first/last item of a run
      // produce an overly greedy replace subsequence. Here we chop off the
      // beginning or end of either the deleted or the inserted array to make
      // sure both are of the same size and hopefully aligned before recursing.
      var opcode_to_add = null;
      var deleted_length = src_end - src_start;
      var inserted_length = dst_end - dst_start;
      if (deleted_length != inserted_length) {
        var shared_length = Math.min(deleted_length, inserted_length);

        var start_similarity = getSimilarity(src[src_start], dst[dst_start]);
        var end_similarity = getSimilarity(src[src_end - 1], dst[dst_end - 1]);

        if (start_similarity > end_similarity) {
          // Start tags are more similar - cut from the end.
          var new_src_end = src_start + shared_length;
          var new_dst_end = dst_start + shared_length;

          if (src_end != new_src_end) {
            opcode_to_add = ['delete', new_src_end, src_end, 0, 0];
          } else if (dst_end != new_dst_end) {
            opcode_to_add = ['insert', 0, 0, new_dst_end, dst_end];
          }

          src_end = new_src_end;
          dst_end = new_dst_end;
        } else {
          // End tags are more similar - cut from the start.
          var new_src_start = src_end - shared_length;
          var new_dst_start = dst_end - shared_length;

          if (src_start != new_src_start) {
            opcodes_recursed.push(['delete', src_start, new_src_start, 0, 0]);
          } else if (dst_start != new_dst_start) {
            opcodes_recursed.push(['insert', 0, 0, dst_start, new_dst_start]);
          }

          src_start = new_src_start;
          dst_start = new_dst_start;
        }
      }

      // Recursively diff each respective pair of deleted/inserted items if
      // their top level tags match.
      for (var offset = 0; offset < src_end - src_start; offset++) {
        var src_index = src_start + offset;
        var dst_index = dst_start + offset;
        var src_tag = src[src_index].match(/^<(\w+)[^>]*>/);
        var dst_tag = dst[dst_index].match(/^<(\w+)[^>]*>/);
        if (src_tag && dst_tag && src_tag[0] == dst_tag[0]) {
          var new_item = [dst_tag[0],
                          calculateHtmlDiff($(src[src_index]).html(),
                                            $(dst[dst_index]).html(),
                                            loose),
                          '</' + dst_tag[1] + '>'].join('');
          var new_item_hashed = hashToken(new_item, loose);
          src[src_index] = dst[dst_index] = new_item;
          src_hashed[src_index] = dst_hashed[dst_index] = new_item_hashed;
          opcodes_recursed.push(['equal',
                                 src_index, src_index + 1,
                                 dst_index, dst_index + 1]);
        } else {
          opcodes_recursed.push(['delete', src_index, src_index + 1, 0, 0]);
          opcodes_recursed.push(['insert', 0, 0, dst_index, dst_index + 1]);
        }
      }

      if (opcode_to_add) opcodes_recursed.push(opcode_to_add);
    }
  });

  return opcodes_recursed;
}

// Clusters interleaved "delete" and "insert" runs into contiguous sequences of
// "delete" or "insert" runs. For example, given the following sequence:
//   del1 ins1 del2 del3 ins2 eq1 ins3
// It rearranges the runs to produce:
//   del1 del2 del3 ins1 ins2 eq1 ins3
function clusterRuns(opcodes, src, dst, src_hashed, dst_hashed) {
  var opcodes_merged = [];
  var del_run = [];
  var ins_run = [];

  eachOpcode(opcodes, function(opcode, src_start, src_end, dst_start, dst_end) {
    var src_has_tags = hasTags(src_hashed.slice(src_start, src_end));
    var dst_has_tags = hasTags(dst_hashed.slice(dst_start, dst_end));

    switch (opcode[0]) {
      case 'delete':
        del_run.push(opcode);
        break;
      case 'insert':
        ins_run.push(opcode);
        break;
      case 'equal':
        if ((del_run.length || ins_run.length) &&
            !src_has_tags && !dst_has_tags &&
            src.slice(src_start, src_end).join('').length < SHORT_TEXT_LENGTH &&
            dst.slice(dst_start, dst_end).join('').length < SHORT_TEXT_LENGTH) {
          // Short text matches can be merged into preceding runs.
          del_run.push(['delete', src_start, src_end, dst_start, dst_end]);
          ins_run.push(['insert', src_start, src_end, dst_start, dst_end]);
          break;
        }
        // Fallthrough!
      case 'replace':
        // Dump current runs and start new ones from the next opcode.
        // TODO: Separate common suffixes created by the short text merger.
        opcodes_merged = opcodes_merged.concat(del_run);
        opcodes_merged = opcodes_merged.concat(ins_run);
        del_run = [];
        ins_run = [];
        opcodes_merged.push(opcode);
        break;
    }
  });

  opcodes_merged = opcodes_merged.concat(del_run);
  opcodes_merged = opcodes_merged.concat(ins_run);

  return opcodes_merged;
}

// Assembles a diff opcode sequence into a string list whose concatenation is a
// valid HTML string, by surrounding sequences of deletion or insertion runs
// with <del> or <ins>, respectively.
function assembleHtmlDiff(opcodes, src, dst) {
  var buffer = [];
  var last_opcode = 'equal';

  eachOpcode(opcodes, function(opcode, src_start, src_end, dst_start, dst_end) {
    if (last_opcode != 'equal' && last_opcode != opcode[0]) {
      buffer.push((last_opcode == 'delete') ? DEL_END : INS_END);
    }
    switch (opcode[0]) {
      case 'delete':
        if (src_start != src_end) {
          if (last_opcode != 'delete') buffer.push(DEL_START);
          buffer = buffer.concat(src.slice(src_start, src_end));
        }
        break;
      case 'insert':
        if (dst_start != dst_end) {
          if (last_opcode != 'insert') buffer.push(INS_START);
          buffer = buffer.concat(dst.slice(dst_start, dst_end));
        }
        break;
      case 'equal':
        buffer = buffer.concat(dst.slice(dst_start, dst_end));
        break;
      default:
        // Error in the diff library or preprocessor - should never happen.
        console.assert(false);
        return null;
    }
    last_opcode = opcode[0];
  });

  if (last_opcode == 'delete') buffer.push(DEL_END);
  else if (last_opcode == 'insert') buffer.push(INS_END);

  return buffer;
}

// Walks the assembled HTML diff list and wraps the contents of all <td>s inside
// an insert or delete sequence with insert or delete tags, respectively.
// NOTE: Works on the passed list in-place.
function internalizeTableDiffs(assembled_diff) {
  var state = [];
  for (var i = 0; i < assembled_diff.length; i++) {
    var token = assembled_diff[i];
    switch (token) {
      case INS_START:
        state.push(INS_START);
        break;
      case DEL_START:
        state.push(DEL_START);
        break;
      case INS_END:
        console.assert(state.pop() == INS_START);
        break;
      case DEL_END:
        console.assert(state.pop() == DEL_START);
        break;
      default:
        var token_tag = token.match(/^<(td|tr)\b/);
        if (state.length && token_tag) {
          var $token = $(token);
          var to_wrap = (token_tag[1] == 'tr') ? $('td', $token) : $token;
          to_wrap.wrapInner(state[state.length - 1]);
          assembled_diff[i] = $token.get(0).outerHTML;
        }
    }
  }
  console.assert(state.length == 0);
}

// Calculates the diff between two HTML strings, src and dst, and returns a
// compiled version with <del> and <ins> tags added in the appropriate places.
// Returns null if there's an error in the diff library. Called recursively to
// diff each subtree. Uses difflib for calculating the diff. If loose_compare is
// true, comparisons use cleanHtmlPage(). See the documentation for that
// function for details.
function calculateHtmlDiff(src, dst, loose_compare) {
  // Split the HTML strings into nodes; tags or text.
  var src_tokenized = tokenizeHtml(src);
  var dst_tokenized = tokenizeHtml(dst);
  // Hash tags for faster (and optionally more loose) comparison.
  function hashEach(tokens) {
    return tokens.map(function(t) { return hashToken(t, loose_compare); });
  }
  var src_hashed = hashEach(src_tokenized);
  var dst_hashed = hashEach(dst_tokenized);
  // Diff the two hashed token lists.
  var differ = new difflib.SequenceMatcher(src_hashed, dst_hashed);
  var opcodes = differ.get_opcodes();
  // Align tag replaces by chopping off text prefixes and suffixes.
  var opcodes_aligned = alignTagRuns(opcodes,
                                     src_tokenized, dst_tokenized,
                                     src_hashed, dst_hashed);
  // Recursively diff child tags.
  var opcodes_recursed = recurseHtmlDiff(opcodes_aligned,
                                         src_tokenized, dst_tokenized,
                                         src_hashed, dst_hashed,
                                         loose_compare);
  // Cluster interleaved runs where possible.
  var opcodes_merged = clusterRuns(opcodes_recursed,
                                   src_tokenized, dst_tokenized,
                                   src_hashed, dst_hashed);
  // Assemble the diff by inserting <del> and <ins> tags around changes.
  var html = assembleHtmlDiff(opcodes_merged, src_tokenized, dst_tokenized);
  // Update the assembled HTML to internalize changes in <tr>s and <td>s.
  internalizeTableDiffs(html);
  // Finally return the HTML as a string.
  return html.join('');
}

/*******************************************************************************
*                                Text Diffing                                  *
*******************************************************************************/

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
        buffer.push(DEL_START);
        buffer.push(content);
        buffer.push(DEL_END);
        break;
      case DIFF_INSERT:
        buffer.push(INS_START);
        buffer.push(content);
        buffer.push(INS_END);
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

  var deletions_shown = !getSetting(SETTINGS.hide_deletions);

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
                         .replace('%hide%', deletions_shown ? hide : show);

  var $controls = $(controls);

  // Deletion visibility switcher.
  if (!deletions_shown) {
    $('del').hide();
  }
  $('.pm_hide', $controls).click(function() {
    $(this).text(deletions_shown ? hide : show);
    $('del').toggle(deletions_shown = !deletions_shown);
    return false;
  });

  // Text-only switcher.
  var links = $('link[rel="stylesheet"]:not([href="styles/diff.css"]),style');
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
  return links ? $(links.join('')).filter('[rel="stylesheet"]') : $([]);
}

// Returns the position of the first non-whitespace change in the page.
function findFirstChangePosition() {
  var min_top = Infinity;
  var min_left = Infinity;

  $('ins,del').each(function() {
    if (!/^\s*$/.test($(this).text())) {
      var offset = $(this).offset();
      if (offset.top < min_top) min_top = offset.top;
      if (offset.left < min_left) min_left = offset.left;
    }
  });

  if (min_left == Infinity) min_left = 0;
  if (min_top == Infinity) min_top = 0;

  return { left: min_left, top: min_top };
}

// Takes a URL, the source and destination HTML strings, and a MIME type. Diffs
// the strings either as text or as HTML depending on the type, inserts the
// result into the current page with appropriate changes and UI controls, then
// scrolls to the first change. If loose is true and the diff is in HTML mode,
// cleanHtmlPage() is used to ignore all but alphabetic changes.
function applyDiff(url, src, dst, type, loose) {
  // Get base and styles.
  $('<base />').attr('href', calculateBaseUrl(url, src, dst)).appendTo('head');

  var dst_clean = dst.replace(/<!--.*?-->/g, '');
  $('<style type="text/css">').text(getInlineStyles(dst_clean)).appendTo('head');
  getReferencedStyles(dst_clean).appendTo('head');

  // Get diffed body.
  var is_type_html = type.match(/\b(x|xht|ht)ml\b/);
  var differ = is_type_html ? calculateHtmlDiff : calculateTextDiff;
  // TODO: Strip all JS: tags, event handler attributes and "javascript:" hrefs.
  var compiled = differ(getStrippedBody(src), getStrippedBody(dst), loose);
  if (compiled === null) alert(chrome.i18n.getMessage('diff_error'));
  $('body').html(compiled);

  // Insert controls.
  generateControls(url).appendTo('body');

  // Scroll to the first change. Need to delay the scrolling until the layout
  // is rendered and readjusted. Otherwise the position is sometimes incorrect.
  setTimeout(function() {
    var pos = findFirstChangePosition();
    window.scrollTo(pos.left, pos.top - SCROLL_MARGIN);
  }, 10);
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
          var loose = (page.mode == 'text');
          applyDiff(url, page.html, canonizePage(new_html, type), type, loose);
          // Undo diff highlights outside of selector for selector-mode pages.
          if (page.mode == 'selector' && page.selector && !getSetting(SETTINGS.show_full_page_diff)) {
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
