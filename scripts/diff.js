var SCROLL_MARGIN = 75;

function diff(url, src, dest) {
  var src = html2list(src.replace(/\s+/g, ' '));
  var dest = html2list(dest.replace(/\s+/g, ' '));
  var matcher = new difflib.SequenceMatcher(src, dest);
  var opcodes = matcher.get_opcodes();
  var out = [];
  
  for (var i = 0; i < opcodes.length; i++) {
    var opcode = opcodes[i][0];
    var src_start = opcodes[i][1];
    var src_end = opcodes[i][2];
    var dest_start = opcodes[i][3];
    var dest_end = opcodes[i][4];
    
    switch (opcode) {
      case 'replace':
        out = out.concat(wrapText(src.slice(src_start, src_end), '<del>', '</del>'));
        out = out.concat(wrapText(dest.slice(dest_start, dest_end), '<ins>', '</ins>'));
        break;
      case 'delete':
        out = out.concat(wrapText(src.slice(src_start, src_end), '<del>', '</del>'));
        break;
      case 'insert':
        out = out.concat(wrapText(dest.slice(dest_start, dest_end), '<ins>', '</ins>'));
        break;
      case 'equal':
        out = out.concat(dest.slice(dest_start, dest_end));
        break;
      default:
        alert(chrome.i18n.getMessage('diff_error'));
        return;
    }
  }
  
  var compiled_html = out.join('');
  
  $('body').html(compiled_html);
  
  
  var link = '<a href="' + url + '" title="' + chrome.i18n.getMessage('diff_original_title') + '">' + chrome.i18n.getMessage('diff_original') + '</a>';
  var toggler = '<a href="#">' + chrome.i18n.getMessage('diff_hide_deletions') + '</a>';
  var ui = '<div id="chrome_page_monitor_ext_orig_link">' + link + '<br />' + toggler + '</div>';
  var $ui = $(ui);
  $('a[href="#"]', $ui).click(toggleDel);
  $ui.appendTo('body');
}

function toggleDel() {
  var hide_message = chrome.i18n.getMessage('diff_hide_deletions');
  var show_message = chrome.i18n.getMessage('diff_show_deletions');
  
  if ($(this).text() == hide_message) {
    $('del').hide();
    $(this).text(show_message);
  } else {
    $('del').show();
    $(this).text(hide_message);
  }
  return false;
}

function wrapText(list, prefix, suffix) {
  var out = [];
  var buffer = [];
  
  for (var i=0; i < list.length; i++) {
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

function html2list(x) {
  var CHAR = 0;
  var TAG = 1;
  var mode = CHAR;
  var cur = '';
  var out = [];
  
  for (var i = 0; i < x.length; i++) {
    var c = x[i];
    
    if (mode == TAG) {
      cur += c;
      if (c == '>') {
        out.push(cur);
        cur = '';
        mode = CHAR;
      }
    } else if (mode == CHAR) {
      if (c == '<') {
        out.push(cur);
        cur = c;
        mode = TAG;
      } else if (x.slice(i, i + 2).match(/^.\b.$/)) {
        out.push(cur + c);
        cur = '';
      } else {
        cur += c;
      }
    }
  }
  out.push(cur);
  
  var filtered = [];
  
  for (var i = 0; i < out.length; i++) {
    if (out[i] != '') filtered.push(out[i]);
  }
  
  return filtered;
}

function startDiff(url, src, dest) {
  // Get base.
  var base = url;
  var src_base = src.match(/<base[^>]*href=['"]?([^>'"]+)[^>]*>/i);
  var dest_base = src.match(/<base[^>]*href=['"]?([^>'"]+)[^>]*>/i);

  if (src_base && src_base.length > 0) {
    base = src_base[src_base.length - 1];
  } else if (dest_base && dest_base.length > 0) {
    base = dest_base[dest_base.length - 1];
  }
  
  var base_element = document.createElement('base');
  base_element.href = base;
  document.head.appendChild(base_element);
  
  // Get inline styles.
  var styles = src.match(/<style[^>]*>(.*?)<\/style>/ig);
  
  if (styles) {
    for (var i = 0; i < styles.length; i++) {
      styles[i] = styles[i].replace(/<\/?style[^>]*>/ig, '');
      style = document.createElement('style');
      style.type = 'text/css';
      style.innerText = styles[i];
      document.head.appendChild(style);
    }
  }
  
  // Get referenced styles.
  var ref_styles = src.match(/<link[^>]*rel\s*=\s*["']?stylesheet["']?[^>]*href=["']?[^>'"]+["']?[^>]*>/ig);
  
  if (ref_styles) {
    for (var i = 0; i < ref_styles.length; i++) {
      ref_styles[i] = ref_styles[i].match(/href=["']?([^>'"]+)["']?/i)[1];
      ref_style = document.createElement('link');
      ref_style.rel = 'stylesheet';
      ref_style.type = 'text/css';
      ref_style.href = ref_styles[i];
      document.head.appendChild(ref_style);
    }
  }
  
  // Generate and insert diffed body.
  diff(url, getStrippedBody(src), getStrippedBody(dest));
  
  // Scroll to the first change.
  var insertions = document.getElementsByTagName('ins');
  var first_insertion = insertions.length ? insertions[0] : null;
  var deletions = document.getElementsByTagName('del');
  var first_deletion = deletions.length ? deletions[0] : null;
  var first_change = null;
  if (first_insertion && first_deletion) {
    var insertion_pos = findPos(first_insertion);
    var deletion_pos = findPos(first_deletion);
    first_change = (insertion_pos[1] < deletion_pos[1]) ? first_insertion : first_deletion;
  } else if (first_insertion || first_deletion) {
    first_change = first_insertion || first_deletion;
  } else {
    return;
  }
  var pos = findPos(first_change);
  window.scrollTo(pos[0], pos[1] - SCROLL_MARGIN);
}

function findPos(obj) {
  var curleft = curtop = 0;
  
  do {
      curleft += obj.offsetLeft;
      curtop += obj.offsetTop;
  } while (obj = obj.offsetParent);
  
  return [curleft, curtop];
}
