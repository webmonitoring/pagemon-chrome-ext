/*
  The code behind the popup HTML page. Manages filling the notifications,
  animating them, and responding to button clicks on both the main and
  per-notification controls.
*/

// Sizing constants. Must be kept in sync with base.css and popup.css.
var RECORD_HEIGHT = '2.7em';

// Returns the URL of the page referenced by a .notification record given any
// element inside it. Returns null if not found.
function getNotificationUrl(context) {
  return $(context).closest('.notification').find('.page_link').attr('href');
}

// Marks an updated page as visited and hides its .notification record. Expects
// this to point to an element inside the .notification. Calls
// fillNotifications() once done marking and hiding.
function markPageVisited() {
  var url = getNotificationUrl(this);
  var that = this;

  BG.setPageSettings(url, { updated: false }, function() {
    BG.updateBadge();
    BG.takeSnapshot(url, BG.scheduleCheck);

    $(that).closest('.notification td').slideUp('slow', function() {
      if ($('#notifications .notification').length == 1) {
        $('#notifications').animate(
          { height: '2.7em', opacity: 1 }, 'slow', fillNotifications
        );
      } else {
        fillNotifications();
      }
    });
  });
}

// Adds the page in the currently selected tab to the monitored list.
function monitorCurrentPage() {
  $('#monitor_page').addClass('inprogress');
  chrome.tabs.getSelected(null, function(tab) {
    addPage({ url: tab.url, name: tab.title }, function() {
      BG.takeSnapshot(tab.url);
      $('#monitor_page').removeClass('inprogress');
      updateButtonsState();
      // Refresh options page if it's opened.
      var tabs = chrome.extension.getViews({ type: 'tab' });
      for (var i = 0; i < tabs.length; i++) {
        if (tabs[i].fillPagesList) tabs[i].fillPagesList();
      }
    });
  });
}

// Clamps a page name to 60 characters.
function trimPageName(page) {
  var name = page.name || chrome.i18n.getMessage('untitled', page.url);
  if (name.length > 60) {
    name = name.replace(/([^]{20,60})(\w)\b.*$/, '$1$2...');
  }
  return name;
}

// Fill the notifications list with notifications for each updated page. If
// no pages are updated, set the appropriate message. Calls updateButtonsState()
// when done constructing the table.
function fillNotifications(callback) {
  getAllUpdatedPages(function(pages) {
    $('#notifications').html('');

    if (pages.length > 0) {
      $.each(pages, function(i, page) {
        var notification = $('#templates .notification').clone();
        var name = trimPageName(page);

        notification.find('.page_link').attr('href', page.url).text(name);
        notification.find('.favicon').attr({ src: getFavicon(page.url) });
        notification.find('.view_diff').attr({
          href: 'diff.htm#' + btoa(page.url)
        });

        notification.appendTo('#notifications');
      });
    } else {
      $('#templates .empty').clone().appendTo('#notifications');
    }

    updateButtonsState();

    (callback || $.noop)();
  });
}

// Updates the state of the three main buttons of the popup.
// 1. If the page in the currently selected tab is being monitored, disables the
//    Monitor This Page button and replaces its text with a localized variant of
//    "Page is Monitored". If the current page is not an HTTP(S) one, disables
//    the button and set the text to the localized variant of "Monitor This
//    Page". Otherwise enables it and sets the text to a localized variant of
//    "Monitor This Page".
// 2. If there are any notifications displayed, enabled the View All button.
//    Otherwise disables it.
// 3. If there are any pages monitored at all, enabled the Check All button.
//    Otherwise disables it.
function updateButtonsState() {
  // Enable/Disable the Monitor This Page button.
  chrome.tabs.getSelected(null, function(tab) {
    isPageMonitored(tab.url, function(monitored) {
      if (monitored || !tab.url.match(/^https?:/)) {
        $('#monitor_page').unbind('click').addClass('inactive');
        $('#monitor_page img').attr('src', 'img/monitor_inactive.png');
        var message = monitored ? 'page_monitored' : 'monitor';
        $('#monitor_page span').text(chrome.i18n.getMessage(message));
      } else {
        $('#monitor_page').click(monitorCurrentPage).removeClass('inactive');
        $('#monitor_page img').attr('src', 'img/monitor.png');
        $('#monitor_page span').text(chrome.i18n.getMessage('monitor'));
      }
    });
  });

  // Enable/Disable the View All button.
  if ($('#notifications .notification').length) {
    $('#view_all').removeClass('inactive');
    $('#view_all img').attr('src', 'img/view_all.png');
  } else {
    $('#view_all').addClass('inactive');
    $('#view_all img').attr('src', 'img/view_all_inactive.png');
  }

  // Enable/disable the Check All Now button.
  getAllPageURLs(function(urls) {
    getAllUpdatedPages(function(updated_urls) {
      if (urls.length == updated_urls.length) {
        $('#check_now').addClass('inactive');
        $('#check_now img').attr('src', 'img/refresh_inactive.png');
      } else {
        $('#check_now').removeClass('inactive');
        $('#check_now img').attr('src', 'img/refresh.png');
      }
    });
  });
}

// Force a check on all pages that are being monitored. Does some complex
// animation to smoothly slide in the current notifications or the "no changes"
// message, display a loading bar while checking, then slide out the new
// notifications or the "no changes" message.
function checkAllPages() {
  getAllPageURLs(function(urls) {
    var records_displayed = $('#notifications .notification').length;
    var fadeout_target;

    // If there are no pages to check, return.
    if (urls.length - records_displayed <= 0) {
      return;
    }

    // Disable this event handler.
    $('#check_now').unbind('click');

    // Slide in the notifications list.
    // NOTE: Setting opacity to 0 leads to jumpiness (maybe setting
    //       display: none), so using 0.01 as a workaround.
    if (records_displayed > 0) {
      fadeout_target = { height: '2.7em', opacity: 0.01 };
    } else {
      fadeout_target = { opacity: 0.01 };
    }

    $('#notifications').animate(fadeout_target, 'slow', function() {
      // Once the list has slid into its minimal state, remove all contents
      // and fade in the loader.
      $(this).html('').addClass('loading');
      $('#templates .loading_spacer').clone().appendTo($(this));
      $(this).show().animate({ opacity: 1.0 }, 400);
    });

    // Run the actual check.
    BG.check(true, function() {
      // Fade out the loader.
      $('#notifications').animate({ opacity: 0 }, 400, function() {
        var that = $(this);
        // Fill the table - done at this point to get the final height.
        fillNotifications(function() {
          // Remember the height and content of the table.
          var height = that.height();
          var html = that.html();

          // Remove the loader, empty the table, and reset its height back to
          // 2.7em. The user does not see any change from the time the fade-out
          // finished.
          that.removeClass('loading').html('').css('height', '2.7em');
          // Slide the table to our pre-calculated height.
          that.animate({ height: height + 'px' }, 'slow', function() {
            // Put the table contents back and fade it in.
            that.css('height', 'auto').html(html).animate({ opacity: 1 }, 400);
            $('#check_now').click(checkAllPages);
          });
        });
      });
    });
  });
}

// Triggers a click() event on either all the view_diff links or all the
// page_link links, depending on the value of SETTINGS.view_all_action ("diff"
// or "original").
function openAllPages() {
  var action = getSetting(SETTINGS.view_all_action);
  var target = (action == 'diff') ? 'view_diff' : 'page_link';
  $('#notifications .' + target).click();
}

// Opens the <a> link on which it is called (i.e. the this object) in a new
// unfocused tab and returns false.
function openLinkInNewTab(event) {
  chrome.tabs.create({ url: this.href, selected: false });
  event.preventDefault();
}

// Open a diff page in a new unfocused tab. Expects to be called on an element
// within a notification record. The opened diff page will be for the URL of the
// notification record.
function openDiffPage() {
  var diff_url = 'diff.htm#' + btoa(getNotificationUrl(this));
  chrome.tabs.create({ url: diff_url, selected: false });
}

// Remove the page from the monitoring registry. Expects to be called on an
// element within a notification record. The removed page will be for the URL
// of the notification record.
function stopMonitoring() {
  BG.removePage(getNotificationUrl(this));
}

// Sets up handlers for the various interactive parts of the popup, both the
// three global button and the three per-notification buttons.
function setUpHandlers() {
  // Handlers for the main buttons.
  $('#monitor_page').click(monitorCurrentPage);
  $('#check_now').click(checkAllPages);
  $('#view_all').click(openAllPages);

  // Live handlers for the per-notifications buttons.
  var buttons = $('.page_link,.mark_visited,.view_diff,.stop_monitoring');
  buttons.live('click', markPageVisited);
  $('.page_link').live('click', openLinkInNewTab);
  $('.view_diff').live('click', openDiffPage);
  $('.stop_monitoring').live('click', stopMonitoring);

  // Add a margin when there's a scrollbar, after the popup is resized.
  $(window).resize(function() {
    var html = $('html').get(0);
    var margin = (html.scrollHeight > html.clientHeight) ? '1em' : '0';
    $('body').css('margin-right', margin);
  });
}
