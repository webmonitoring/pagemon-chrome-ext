/*******************************************************************************
*                                  Constants                                   *
*******************************************************************************/

// The address to check when testing for network availability.
var RELIABLE_CHECKPOINT = 'http://www.google.com/';

// Maximum request timeout (in milliseconds).
var REQUEST_TIMEOUT = 10000;

// Default interval between checks.
var DEFAULT_CHECK_INTERVAL = 3 * 60 * 60 * 1000;

// The delay in milliseconds to wait after a check attempt that failed due
// to the network being down.
var RESCHEDULE_DELAY = 15 * 60 * 1000;

// The minimum time in milliseconds between checks.
var MINIMUM_CHECK_SPACING = 1000;

// Browser action and notification icons.
var BROWSER_ICON = 'img/browser_icon.png';
var NOTIFICATION_ICON = 'http://static.max99x.com/chrome/page-monitor-icon.png';

// The maximum time offset in the future in milliseconds to look for pages
// to update.
var EPSILON = 500;

// The interval in milliseconds between successive watchdog runs.
var WATCHDOG_INTERVAL = 15 * 60 * 1000;

// The maximum amount of time between the projected check time and the
// last check before the watchdog is alerted.
var WATCHDOG_TOLERANCE = 2 * 60 * 1000;

/*******************************************************************************
*                                Badge Updating                                *
*******************************************************************************/

(function() {
  // The previous text on the badge, kept to detect cases where the
  // updateBadge() function is called when no change to the badge has actually
  // occurred.
  var last_badge_text = '';
  
  // Triggers a sound alert if one is enabled.
  triggerSoundAlert = function() {
    var sound_alert = getSetting(SETTINGS.sound_alert);
    if (sound_alert) {
      new Audio(sound_alert).addEventListener('canplaythrough', function() {
        this.play();
      });
    }
  };
  
  // Triggers a desktop notification if they are enabled, notifing the user of
  // updates to the pages specified in the argument.
  triggerDesktopNotification = function(pages) {
    if (!getSetting(SETTINGS.notifications_enabled)) return;
    
    try {
      var timeout = getSetting(SETTINGS.notifications_timeout) || 30000;
      
      var title;
      if (pages.length == 1) {
        title = chrome.i18n.getMessage('page_updated_single');
      } else {
        title = chrome.i18n.getMessage('page_updated_multi', pages.length);
      }
      
      var content = $.map(pages, function(page) {
        return page.name;
      }).join(', ');
      if (content.length > 150) {
        content = content.replace(/^([^]{50,150}\b(?!\w)|[^]{50,150})[^]*$/,
                                  '$1...');
      }
      
      var notification = webkitNotifications.createNotification(
          NOTIFICATION_ICON, title, content);

      notification.show();
      setTimeout(notification.cancel, timeout);
    } catch(e) {
      console.log(e);
    }
  };
  
  // Checks if any pages are marked as updated, and if so, displays their count
  // on the browser action badge. If no pages are updated and the badge is
  // displayed, removes it. This also triggers sound alerts and/or desktop
  // notifications if applicable.
  updateBadge = function() {
    getAllUpdatedPages(function(updated_pages) {
      var old_count = last_badge_text ? parseInt(last_badge_text, 10) : 0;
      var new_count = updated_pages.length;
      var message = (new_count > 0) ? new_count.toString() : '';

      chrome.browserAction.setBadgeBackgroundColor({
        color: getSetting(SETTINGS.badge_color)
      });
      chrome.browserAction.setBadgeText({ text: message });
      chrome.browserAction.setIcon({ path: BROWSER_ICON });
    
      if (new_count > old_count) {
        triggerSoundAlert();
        triggerDesktopNotification(updated_pages);
      }
      
      last_badge_text = message;
    });
  };
})();

/*******************************************************************************
*                           Global Monitoring Check                            *
*******************************************************************************/

(function() {
  // The ID of the timeout that initiates the next check.
  var check_timeout_id = 0;
  
  // The time when the next check should be performed. Use by the watchdog to
  // make sure no check is missed.
  var projected_check_time = 0;
  
  // Performs the page checks. Called by check() to do the actual work.
  actualCheck = function(force, callback, page_callback) {
    executeSql('SELECT url, last_check, check_interval FROM pages',
               [], function(result) {
      var pages = sqlResultToArray(result);
      var current_time = new Date().getTime();
      var pages_to_check = force ? pages : $.grep(pages, function(page) {
        var interval = page.check_interval ||
                       getSetting(SETTINGS.check_interval);
        var projected_check = page.last_check + interval;
        return projected_check <= current_time + EPSILON;
      });
      var pages_checked = 0;
      
      function notifyAllChecksFinished() {
        updateBadge();
        scheduleCheck();
        (callback || $.noop)();
      }
      
      function notifyCheckFinished(url) {
        (page_callback || $.noop)(url);
        pages_checked++;
        console.assert(pages_checked <= pages_to_check.length);
        if (pages_checked == pages_to_check.length) {
          notifyAllChecksFinished();
        }
      }
      
      if (pages_to_check.length) {
        $.each(pages_to_check, function(i, page) {
          checkPage(page.url, notifyCheckFinished);
        });
      } else {
        notifyAllChecksFinished();
      }
    });
  };

  // Sets the next check to go off after the number of milliseconds specified.
  // Updates projected_check_time for the watchdog.
  applySchedule = function(after) {
    var current_time = new Date().getTime();
    
    projected_check_time = current_time + after;
    
    clearTimeout(check_timeout_id);
    
    check_timeout_id = setTimeout(check, after);
  };

  // Calculates the minimum amount of time after which at least one page needs a
  // check, then calls applySchedule() to schedule a check after this amount of
  // time.
  scheduleCheck = function() {
    var current_time = new Date().getTime();
    
    executeSql('SELECT url, updated, last_check, check_interval FROM pages',
               [], function(result) {
      if (result.rows.length == 0) return;
      
      var pages = sqlResultToArray(result);
      var times = $.map(pages, function(page) {
        if (page.updated || !page.last_check) {
          return current_time;
        } else {
          var check_interval = page.check_interval ||
                               getSetting(SETTINGS.check_interval);
          return page.last_check + check_interval - current_time;
        }
      });
  
      var min_time = Math.min.apply(Math, times);
      
      if (min_time < MINIMUM_CHECK_SPACING) {
        min_time = MINIMUM_CHECK_SPACING;
      } else if (min_time == current_time) {
        // No pages need to be checked.
        min_time = DEFAULT_CHECK_INTERVAL;
      }
      
      applySchedule(min_time);
    });
  };

  // Checks each page that has reached its projected check time, calling
  // page_callback() for each page once it's checked, then update the badge,
  // call scheduleCheck(), and finally call callback(). If force is true, all
  // pages are checked regardless of whether their projected check time has been
  // reached. If the network connection is down, reschedule a check after
  // RESCHEDULE_DELAY.
  check = function(force, callback, page_callback) {
    $.ajax({
      type: 'HEAD',
      url: RELIABLE_CHECKPOINT,
      complete: function(xhr) {
        if (xhr.status >= 200 && xhr.status < 300) {
          // Network up; do the check.
          actualCheck(force, callback, page_callback);
        } else {
          // Network down. Do a constant reschedule.
          applySchedule(RESCHEDULE_DELAY);
          callback();
        }
      }
    });
  };

  // Makes sure that we haven't lost the check timeout. If we have, restarts it.
  // If everything goes well, this should never be needed, but better be safe
  // than sorry.
  watchdog = function() {
    if (new Date().getTime() - projected_check_time > WATCHDOG_TOLERANCE) {
      console.log('WARNING: Watchdog recovered a lost timeout.');
      scheduleCheck();
    }
  };
})();

/*******************************************************************************
*                                Initialization                                *
*******************************************************************************/

// Inserts the specified page objects into the pages table in the database. The
// pages argument should be an array of pages, each an object with any of the
// standard page properties (url, name, mode, regex, selector, timeout, html,
// crc, icon, updated, last_check and last_changed). The url property is
// required. Once all pages are impoirted, the callback is called.
function insertPages(pages, callback) {
  DB.transaction(function(transaction) {
    var insert = 'INSERT INTO pages VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
    
    for (var i in pages) {
      var page = pages[i];
      if (!page.url) continue;
      
      transaction.executeSql(insert, [
        page.url,
        page.name || chrome.i18n.getMessage('untitled', page.url),
        page.mode || 'text',
        page.regex || null,
        page.selector || null,
        page.timeout || null,
        page.html || null,
        page.crc || null,
        page.icon || null,
        page.updated ? 1 : 0,
        page.last_check || 0,
        page.last_changed || null
      ]);
    }
  }, $.noop, callback);
}

// Converts pages list from the 1.x format to the 3.x format.
function importVersionOnePages(callback) {
  var pages = [];
  
  $.each(getSetting('pages_to_check') || {}, function(url, vals) {
    pages.push({
      url: url,
      name: vals.name,
      icon: vals.icon,
      mode: vals.regex ? 'regex' : 'text',
      regex: vals.regex || null
    });
  });
  
  insertPages(pages, callback);
}

// Converts pages list from the 2.x format to the 3.x format.
function importVersionTwoPages(callback) {
  var pages = getSetting('pages');
  var pages_to_import = getSetting('pages');
  
  for (var i in pages) {
    var url = pages[i];
    pages_to_import.push({
      url: url,
      name: getSetting(url + ' name'),
      mode: getSetting(url + ' mode'),
      regex: getSetting(url + ' regex'),
      selector: getSetting(url + ' selector'),
      timeout: getSetting(url + ' timeout'),
      html: getSetting(url + ' html'),
      crc: getSetting(url + ' crc'),
      icon: getSetting(url + ' icon'),
      updated: getSetting(url + ' updated'),
      last_check: getSetting(url + ' last_check'),
      last_changed: getSetting(url + ' last_changed')
    });
  }
  
  insertPages(pages_to_import, callback);
}

// Creates pages table in the database if it does not exist.
function createPagesTable(callback) {
  executeSql("CREATE TABLE IF NOT EXISTS pages ( \
                `url` TEXT NOT NULL UNIQUE, \
                `name` TEXT NOT NULL, \
                `mode` TEXT NOT NULL DEFAULT 'text', \
                `regex` TEXT, \
                `selector` TEXT, \
                `check_interval` INTEGER, \
                `html` TEXT NOT NULL, \
                `crc` INTEGER NOT NULL, \
                `icon` TEXT, \
                `updated` INTEGER, \
                `last_check` INTEGER, \
                `last_changed` INTEGER \
              );", $.noop, callback);
}

// Removes unused localStorage settings, e.g. those that were used to page
// config in versions 2.x.
function removeUnusedSettings() {
  for (var i in localStorage) {
    if (SETTINGS[i] === undefined) {
      delete localStorage[i];
    }
  }
}

// Brings up the pages list and settings format to the current version if they
// are outdated, then calls the callback.
function bringUpToDate(from_version, callback) {
  createPagesTable(function() {
    function updateDone() {
      setSetting(SETTINGS.version, chrome.extension.getVersion());
      removeUnusedSettings();
      (callback || $.noop)();
    }
  
    if (from_version < 1) {
      setSetting(SETTINGS.badge_color, [0, 180, 0, 255]);
      setSetting(SETTINGS.check_interval, DEFAULT_CHECK_INTERVAL);
      setSetting(SETTINGS.custom_sounds, []);
      setSetting(SETTINGS.sound_alert, null);
      setSetting(SETTINGS.notifications_enabled, false);
      setSetting(SETTINGS.notifications_timeout, 30 * 1000);
      setSetting(SETTINGS.animations_disabled, false);
      setSetting(SETTINGS.sort_by, 'date added');
      updateDone();
    } else if (from_version < 2) {
      delete localStorage.last_check;
      importVersionOnePages(updateDone);
    } else if (from_version < 3) {
      setSetting(SETTINGS.check_interval, getSetting('timeout') ||
                                          DEFAULT_CHECK_INTERVAL);
      delete localStorage.timeout;
      importVersionTwoPages(updateDone);
    } else {
      updateDone();
    }
  });
}
