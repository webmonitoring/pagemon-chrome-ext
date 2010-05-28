/*
  The code behind the popup HTML page. Manages filling the notifications,
  animating them, and responding to button clicks on both the main and
  per-notification controls.
*/

// Returns the URL of the page referenced by a .notification record given any
// element inside it.
function getNotificationUrl(context) {
  return $(context).closest('.notification').find('.page_link').attr('href');
}

// Marks an updated page as visited and hides its .notification record. Expects
// this to point to an element inside the .notification. Calls
// fillNotifications() once done marking and hiding.
function markPageVisited() {
  var url = getNotificationUrl(this);
  var that = this;
  
  setPageSettings(url, { updated: false }, function() {
    BG.updateBadge();
    BG.takeSnapshot(url, BG.scheduleCheck);
    
    $(that).closest('.notification td').slideUp('slow', function() {
      if ($('#notifications .notification').length == 1) {
        $('#notifications').animate(
          { height: '50px', opacity: 1 }, 'slow', fillNotifications
        );
      } else {
        fillNotifications();
      }
    });
  });
}

// Adds the page in the currently selected tab to the monitored list. While the
// page is still loading, keeps retrying every 100 milliseconds.
function monitorCurrentPage() {
  $('#monitor_page').addClass('inprogress');
  chrome.tabs.getSelected(null, function(tab) {
    // If the page is still loading, try a little while later.
    if (tab.status == 'loading') {
      setTimeout(monitorCurrentPage, 100);
    } else {
      addPage({ url: tab.url, name: tab.title, icon: tab.favIconUrl }, function() {
        $('#monitor_page').removeClass('inprogress');
        updateButtonsState();
      });
    }
  });
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
    
        var name = page.name || chrome.i18n.getMessage('untitled', page.url);
        if (name.length > 60) {
          name = name.replace(/([^]{20,60})(\w)\b.*$/, '$1$2...');
        }
        
        notification.find('.page_link').attr('href', page.url).text(name);
        
        notification.find('.favicon').attr({
          src: page.icon || 'img/page.png'
        });
        
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
    if (tab.url.match(/^https?:/)) {
      isPageMonitored(tab.url, function(monitored) {
        if (monitored || !tab.url.match(/^https?:/)) {
          $('#monitor_page').unbind('click').addClass('inactive');
          $('#monitor_page span').text(chrome.i18n.getMessage('page_monitored'));
          $('#monitor_page img').attr('src', 'img/monitor_inactive.png');
        } else {
          $('#monitor_page').click(monitorCurrentPage).removeClass('inactive');
          $('#monitor_page span').text(chrome.i18n.getMessage('monitor'));
          $('#monitor_page img').attr('src', 'img/monitor.png');
        }
      });
    } else {
      $('#monitor_page').unbind('click').addClass('inactive');
      $('#monitor_page img').attr('src', 'img/monitor_inactive.png');
    }
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
  getAllPageURLs(function(result) {
    if (result.rows.length == 0) {
      $('#check_now').addClass('inactive');
      $('#check_now img').attr('src', 'img/refresh_inactive.png');
    } else {
      $('#check_now').removeClass('inactive');
      $('#check_now img').attr('src', 'img/refresh.png');
    }
  });
}

// Force a check on all pages that are being monitored. Does some complex
// animation to smoothly slide in the current notifications or the "no changes"
// message, display a loading bar while checking, then slide out the new
// notifications or the "no changes" message.
function checkAllPages() {
  getAllPageURLs(function(pages) {
    // If there are no pages to check, return.
    if (pages.length === 0 ||
        pages.length == $('#notifications .notification').length) {
      return;
    }
    
    // Disable this event handler.
    $('#check_now').unbind('click');
    
    // Slide in the notifications list.
    // NOTE: Setting opacity to 0 leads to jumpiness (maybe setting
    //       display: none), so using 0.01 as a workaround.
    if ($('#notifications .notification').length > 0) {
      var fadeout_target = { height: '50px', opacity: 0.01 };
    } else {
      var fadeout_target = { opacity: 0.01 };
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
        var $this = $(this);
        // Fill the table - done at this point to get the final height.
        fillNotifications(function() {
          // Remember the height and content of the table.
          var height = $this.height();
          var html = $this.html();
          
          // Remove the loader, empty the table, and reset its height back to
          // 50px. The user does not see any change from the time the fade-out
          // finished.
          $this.removeClass('loading').html('').height(50);
          // Slide the table to our pre-calculated height.
          $this.animate({ height: height + 'px' }, 'slow', function() {
            // Put the table contents back and fade it in.
            $this.css({ height: 'auto' });
            $this.html(html);
            $this.animate({ opacity: 1 }, 400);
            $('#check_now').click(checkAllPages);
          });
        });
      });
    });
  });
}

// Sets up handlers for the various interactive parts of the popup, both the
// three global button and the three per-notification buttons.
function setUpHandlers() {
  // Handlers for the main buttons.
  $('#monitor_page').click(monitorCurrentPage);
  $('#check_now').click(checkAllPages);
  $('#view_all').click(function() {
    var target = getSetting(SETTINGS.view_all_action) == 'diff' ?
                 'view_diff' : 'page_link';
    $('#notifications .' + target + '').click();
  });
  
  // Live handlers for the per-notifications buttons.
  $('.page_link,.mark_visited,.view_diff,.stop_monitoring').live('click', markPageVisited);
  $('.page_link').live('click', function() {
    chrome.tabs.create({ url: this.href, selected: false });
    return false;
  });
  $('.view_diff').live('click', function() {
    var diff_url = 'diff.htm#' + btoa(getNotificationUrl(this));
    chrome.tabs.create({ url: diff_url, selected: false });
  });
  $('.stop_monitoring').live('click', function() {
    BG.removePage(getNotificationUrl(this));
  });
}
