/*
  Renders the desktop notification window.
*/

// A reference to the background page of the extension.
var BG = chrome.extension.getBackgroundPage();

// Makes an <a href="...">...</a> link to the diff of a given page.
function makeLink(page) {
  var link = document.createElement('a');
  link.href = 'diff.htm#' + btoa(page.url);
  link.onclick = function() { markPageVisited(page.url) };
  link.target = '_blank';
  link.appendChild(document.createTextNode(page.name));
  return link;
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

    var contentElement = document.getElementById('content');
    contentElement.innerHTML = '';
    if (pages.length == 1) {
      var span = document.createElement('span');
      span.appendChild(makeLink(pages[0]));
      contentElement.appendChild(span);
    } else {
      var list = document.createElement('ul');
      contentElement.appendChild(list);
      pages.forEach(function(page) {
        var listItem = document.createElement('li');
        listItem.appendChild(makeLink(page));
        list.appendChild(listItem);
      });
    }
  });
}

document.addEventListener('DOMContentLoaded', initialize, false);
