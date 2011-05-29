/*
  Renders the desktop notification window.
*/

// A refernce to the background page of the extension.
var BG = chrome.extension.getBackgroundPage();

// Makes am <a href="...">...</a> link to the diff of a given page, limiting the
// length of the link text to name_max.
function makeLink(page, name_max) {
  var diff_url = 'diff.htm#' + btoa(page.url);
  var buffer = [];

  buffer.push('<a href="' + diff_url + '" \
                  onclick="markPageVisited(\'' + page.url + '\');" \
                  target="_blank">');

  var name = page.name;
  if (name.length > name_max) {
    var num = '{' + Math.floor(name_max * 0.6) + ',' + name_max + '}';
    var regex = RegExp('^([^]' + num + '\b(?!\w)|[^]' + num + ')[^]*$');
    name = name.replace(regex, '$1...');
  }

  buffer.push(name);
  buffer.push('</a>');

  return buffer.join('');
}

// Marks an updated page as visited given its URL and reloads the notification.
function markPageVisited(url) {
  BG.setPageSettings(url, { updated: false }, function() {
    BG.updateBadge();
    BG.takeSnapshot(url, BG.scheduleCheck);
    initialize();
  });
}

// Renders the notification as a list of diff links to updated pages.
function initialize() {
  BG.getAllUpdatedPages(function(pages) {
    if (pages.length == 0) {
      setTimeout(BG.hideDesktopNotification, 1);
      return;
    }

    var title;
    if (pages.length == 1) {
      title = chrome.i18n.getMessage('page_updated_single');
    } else {
      title = chrome.i18n.getMessage('page_updated_multi',
                                     pages.length.toString());
    }
    document.getElementsByTagName('h1')[0].innerHTML = title;

    var buffer = [];
    if (pages.length == 1) {
      buffer.push('<span>');
      buffer.push(makeLink(pages[0], 25));
      buffer.push('<span>');
    } else {
      buffer.push('<ul>');
      pages.forEach(function(page) {
        buffer.push('<li>');
        buffer.push(makeLink(page, 23));
        buffer.push('</li>');
      });
      buffer.push('</ul>');
    }
    document.getElementById('content').innerHTML = buffer.join('');
  });
}
