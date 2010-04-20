/***************************************************************************
                                  Constants
***************************************************************************/

// The address to check when testing for network availability.
var RELIABLE_CHECKPOINT = 'http://www.google.com/';

// Maximum request timeout (in milliseconds).
var REQUEST_TIMEOUT = 10000;

// Maximum request timeout (in milliseconds).
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
// actual before the watchdog is alerted.
var WATCHDOG_TOLERANCE = 2 * 60 * 1000;

/***************************************************************************
                             Global Monitoring Check
***************************************************************************/

var check_timeout_id = 0;
var projected_check_time = 0;

// Check each page then update the badge and call scheduleCheck().
function actualCheck(force, callback, page_callback) {
  DB.readTransaction(function(transaction) {
    transaction.executeSql('SELECT url, last_check, check_interval FROM pages', [], function(_, result) {
      console.log('Performing actual check.');
      var pages = [];
      for (var i = 0; i < result.rows.length; i++) {
        pages.push(result.rows.item(i));
      }
      
      var current_time = new Date().getTime();
      var pages_to_check;
      
      if (force) {
        pages_to_check = pages;
      } else {
        pages_to_check = $.grep(pages, function(page) {
          var projected_check = page.last_check + (page.check_interval || getSetting(SETTINGS.check_interval));
          //console.log(url + ': ' + page.last_check + (page.check_interval || getSetting(SETTINGS.check_interval)) + ' <= ' + current_time);
          return projected_check <= current_time + EPSILON;
        });
      }
      
      console.log('Pages to check:');
      console.log(pages_to_check);
      
      var pages_checked = 0;
      var notifyCheckFinished = function(url) {
        (page_callback || $.noop)(url);
        pages_checked++;
        //console.log('notifyCheckFinished - ' + pages_checked + ' of ' + pages_to_check.length);
        if (pages_checked >= pages_to_check.length) {
          updateBadge();
          scheduleCheck();
          (callback || $.noop)();
        }
      };
      
      if (pages_to_check.length) {
        $.each(pages_to_check, function(i, page) {
          checkPage(page.url, notifyCheckFinished);
        });
      } else {
        notifyCheckFinished();
      }
    });
  });
}

// Check whether a network connection is available and if so, run an
// actualCheck(), otherwise reschedule a check after RESCHEDULE_DELAY.
function check(force, callback, page_callback) {
  console.log('Performing check.');
  // Make sure the network is up.
  $.ajax({
    type: 'HEAD',
    url: RELIABLE_CHECKPOINT,
    complete: function(xhr) {
      console.log('Checkpoint successful.');
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
}

// Schedule the next check.
function scheduleCheck() {
  console.log('Initiating scheduling.');
  
  var current_time = new Date().getTime();
  
  DB.readTransaction(function(transaction) {
    transaction.executeSql('SELECT url, updated, last_check, check_interval FROM pages', [], function(_, result) {
      if (result.rows.length == 0) return;
      
      var pages = [];
      for (var i = 0; i < result.rows.length; i++) {
        pages.push(result.rows.item(i));
      }
  
      // Get time-until-next-check for each page.
      var times = $.map(pages, function(page) {
        if (page.updated || !page.last_check) {
          return current_time;
        } else {
          var check_interval = (page.check_interval || getSetting(SETTINGS.check_interval));
          return page.last_check + check_interval - current_time;
        }
      });
  
      console.log('Times:');
      console.log(pages);
      console.log(times);
      var min_time = Math.min.apply(Math, times);
      
      if (min_time < 0) {
        min_time = 1;
      } else if (min_time < MINIMUM_CHECK_SPACING) {
        min_time = MINIMUM_CHECK_SPACING;
      } else if (min_time == current_time) {
        min_time = DEFAULT_CHECK_INTERVAL;
      }
      
      applySchedule(min_time);
    });
  });
}

function applySchedule(after) {
  var current_time = new Date().getTime();
  
  console.log('Scheduling in: ' + describeTimeSince(current_time - after).slice(0,-4));
  
  projected_check_time = current_time + after;
  
  clearTimeout(check_timeout_id);
  check_timeout_id = setTimeout(check, after);
}

/***************************************************************************
                                Badge Updating
***************************************************************************/

(function() {
  // The previous text on the badge, kept to detect cases where the
  // updateBadge() function is called when no change to the badge has
  // actually occurred.
  var last_badge_text = '';
  
  // Checks if any pages are marked as updated, and if so, displays their count
  // on the browser action badge. If no pages are updated and the badge is
  // displayed, removes it. This also triggers sound alerts and/or desktop
  // notifications if applicable.
  updateBadge = function() {
    console.log('Updating badge...');
    getAllUpdatedPages(function(updated_pages) {
      var updated_count = updated_pages.length;
      var updated_message = (updated_count > 0) ? updated_count.toString() : '';
      var old_count = last_badge_text ? parseInt(last_badge_text) : 0;

      chrome.browserAction.setBadgeBackgroundColor({
        color: getSetting(SETTINGS.badge_color)
      });
      chrome.browserAction.setBadgeText({ text: updated_message });
      chrome.browserAction.setIcon({ path: BROWSER_ICON });
    
      console.log('Badge message: ' + old_count + ' -> ' + updated_count);
      // If a new update has just occurred.
      if (updated_count > old_count) {
        var sound_alert = getSetting(SETTINGS.sound_alert);
        if (sound_alert) {
          new Audio(sound_alert).addEventListener('canplaythrough', function() {
            this.play();
          });
        }
        
        var notifications_enabled = getSetting(SETTINGS.notifications_enabled);
        if (notifications_enabled) {
          try {
            var content = $.map(updated_pages, function(page) {
              return page.name;
            }).join(', ');
            if (content.length > 150) {
              content = content.replace(/^([^]{50,150}\b(?!\w)|[^]{50,150})[^]*$/, '$1...')
            }
            
            var title;
            if (updated_pages.length == 1) {
              title = chrome.i18n.getMessage('page_updated_single');
            } else {
              title = chrome.i18n.getMessage('page_updated_multi', updated_pages.length);
            }
            var notifications_timeout = getSetting(SETTINGS.notifications_timeout) || 30000;
            var notification = webkitNotifications.createNotification(NOTIFICATION_ICON, title, content);

            notification.show();
            
            setTimeout(function() {
              notification.cancel();
            }, notifications_timeout);
          } catch(e) {
            console.log(e);
          }
        }
      }
      
      last_badge_text = updated_message;
    });
  }
})();

/***************************************************************************
                                 Watchdog
***************************************************************************/

// Makes sure that we haven't lost the check timeout. If we have, restarts
// it. If everything goes well, this should never be needed, but better safe
// than sorry.
function watchdog() {
  if (new Date().getTime() - projected_check_time > WATCHDOG_TOLERANCE) {
    console.log('WARNING: Watchdog recovered a lost timeout.');
    scheduleCheck();
  }
}

/***************************************************************************
                                 Initialization
***************************************************************************/

// Initializations to perform when the extension is updated from a 1.x
// version. Includes importing and converting the pages list.
function updateFromVersionOne() {
  var pages = getSetting('pages_to_check') || {};
  
  try {
    $.each(pages, function(url, vals) {
      addPage({ url: url,
                name: vals.name,
                icon: vals.icon,
                mode: vals.regex ? 'regex' : 'text',
                regex: vals.regex || null });
    });
    
    delete localStorage['pages_to_check'];
  } catch(e) {
    // Import failed. Make sure we don't lose the pages list.
    setSetting('pages_to_check', pages);
  }
  
  delete localStorage['last_check'];
}

// Initializations to perform when the extension is updated from a 2.x
// version. Imports pages from localStorage into an SQL database.
function migrateToDatabase(callback) {
  DB.transaction(function(transaction) {
    transaction.executeSql("CREATE TABLE pages (`url` TEXT NOT NULL UNIQUE, `name` TEXT NOT NULL, `mode` TEXT NOT NULL DEFAULT 'text', `regex` TEXT, `selector` TEXT, `check_interval` INTEGER, `html` TEXT NOT NULL, `crc` INTEGER NOT NULL, `icon` TEXT, `updated` INTEGER, `last_check` INTEGER, `last_changed` INTEGER);", []);
    
    var pages = getSetting('pages');
    for (var i in pages) {
      var url = pages[i];
      transaction.executeSql('INSERT INTO pages VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [
        url,
        getSetting(url + ' name'),
        getSetting(url + ' mode'),
        getSetting(url + ' regex') || null,
        getSetting(url + ' selector') || null,
        getSetting(url + ' timeout'),
        getSetting(url + ' html'),
        getSetting(url + ' crc'),
        getSetting(url + ' icon'),
        getSetting(url + ' updated' ? 1 : 0),
        getSetting(url + ' last_check'),
        getSetting(url + ' last_changed')
      ]);
    }
  }, $.noop, function() {
    for (var i in localStorage) {
      if (SETTINGS[i] === undefined) {
        delete localStorage[i];
      }
    }
    (callback || $.noop)();
  });
}

function bringUpToDate(from_version, callback) {
  if (from_version == 0) {
    setSetting(SETTINGS.badge_color, [0, 180, 0, 255]);
    setSetting(SETTINGS.check_interval, DEFAULT_CHECK_INTERVAL);
    setSetting(SETTINGS.custom_sounds, []);
    setSetting(SETTINGS.sound_alert, null);
    setSetting(SETTINGS.notifications_enabled, false);
    setSetting(SETTINGS.notifications_timeout, 30 * 1000);
    setSetting(SETTINGS.animations_disabled, false);
    setSetting(SETTINGS.sort_by, 'date added');
  } else if (from_version < 2) {
    updateFromVersionOne();
  } else if (from_version < 2.6) {
    setSetting(SETTINGS.check_interval, getSetting('timeout') || DEFAULT_CHECK_INTERVAL);
  }
  
  setSetting(SETTINGS.version, chrome.extension.getVersion());

  if (from_version < 2.6) {
    migrateToDatabase(callback);
  } else {
    callback();
  }
}
