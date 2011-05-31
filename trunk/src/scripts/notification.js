/*
  Renders the desktop notification window.
*/

// A refernce to the background page of the extension.
var BG = chrome.extension.getBackgroundPage();

// Makes am <a href="...">...</a> link to the diff of a given page.
function makeLink(page) {
  var buffer = [];

  buffer.push('<a href="diff.htm#' + btoa(page.url) + '" \
                  onclick="markPageVisited(\'' + page.url + '\');" \
                  target="_blank">');
  buffer.push(page.name);
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
      buffer.push(makeLink(pages[0]));
      buffer.push('</span>');
    } else {
      buffer.push('<ul>');
      pages.forEach(function(page) {
        buffer.push('<li>');
        buffer.push(makeLink(page));
        buffer.push('</li>');
      });
      buffer.push('</ul>');
    }
    document.getElementById('content').innerHTML = buffer.join('');
  });
}
