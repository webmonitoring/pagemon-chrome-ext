/*
  Contains functions used for monitoring, badge manipulation, initialization and
  convertion between page list formats from older versions. All of these
  functions must run on the background page to avoid being interrupted.
*/

/*******************************************************************************
*                                  Constants                                   *
*******************************************************************************/

// The address to check when testing for network availability.
var RELIABLE_CHECKPOINT = 'http://www.google.com/';

// Default interval between checks.
var DEFAULT_CHECK_INTERVAL = 3 * 60 * 60 * 1000;

// The delay in milliseconds to wait after a check attempt that failed due
// to the network being down.
var RESCHEDULE_DELAY = 15 * 60 * 1000;

// The minimum time in milliseconds between checks.
var MINIMUM_CHECK_SPACING = 1000;

// Browser action icon.
var BROWSER_ICON = 'img/browser_icon.png';

// The maximum time offset in the future in milliseconds to look for pages
// to update.
var EPSILON = 500;

// The interval in milliseconds between successive watchdog runs.
var WATCHDOG_INTERVAL = 15 * 60 * 1000;

// The maximum amount of time between the projected check time and the
// last check before the watchdog is alerted.
var WATCHDOG_TOLERANCE = 2 * 60 * 1000;

/*******************************************************************************
*                             Update Notifications                             *
*******************************************************************************/

(function() {
  // The number of updated pages that has been last shown on the badge.
  var last_count = 0;
  // A handle for the last shown notification, saved so it can be hidden later.
  // On platforms that use the Rich Notifications API, this is a string ID.
  // On platforms that use the HTML API, this is a Notification object.
  var notification = null;
  // Whether the notification event listener has been added. Used only on
  // platforms that use the Rich Notifications API.
  var notificationEventAdded = false;
  // A list of pages belonging to the current notification. Used only on
  // platforms that use the Rich Notifications API.
  var currentNotificationPages = [];

  // Triggers a sound alert if it is enabled.
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
  triggerDesktopNotification = function() {
    if (!getSetting(SETTINGS.notifications_enabled)) return;
    if (chrome.extension.getViews({ type: 'popup' }).length > 0) return;
    var timeout = getSetting(SETTINGS.notifications_timeout) || 30000;

    if (webkitNotifications && webkitNotifications.createHTMLNotification) {
      // This platform uses HTML notifications.
      var url = 'notification.htm';
      notification = webkitNotifications.createHTMLNotification(url);
      notification.show();
    } else if (chrome.notifications && chrome.notifications.create) {
      // This platform uses Rich notifications.
      getAllUpdatedPages(function(pages) {
        if (pages.length == 0) return;

        if (pages.length == 1) {
          title = chrome.i18n.getMessage('page_updated_single');
        } else {
          title = chrome.i18n.getMessage('page_updated_multi',
                                         pages.length.toString());
        }
        var items = $.map(pages, function(page) {
          return {title: page.name};
        });
        var options = {
          type: 'basic',
          iconUrl: chrome.extension.getURL('img/extension_icon.png'),
          title: title,
          message: '',
          buttons: items
        };
        currentNotificationPages = pages;
        if (notification != null) {
          hideDesktopNotification();
        }
        chrome.notifications.create('', options, function(id) {
          notification = id;
        });
      });

      if (!notificationEventAdded) {
        chrome.notifications.onButtonClicked.addListener(function(id, button) {
          var page = currentNotificationPages[button];
          window.open('diff.htm#' + btoa(page.url));
          BG.setPageSettings(page.url, { updated: false }, function() {
            updateBadge();
            takeSnapshot(page.url, scheduleCheck);
            triggerDesktopNotification();
          });
        });
        notificationEventAdded = true;
      }
    } else {
      // Notifications are not supported. Oh well.
      return;
    }
    if (timeout <= 60000) setTimeout(hideDesktopNotification, timeout);
  };

  // Hides the currently shown desktop notification (if one is displayed).
  hideDesktopNotification = function() {
    if (notification != null) {
      if (typeof notification == 'string') {
        // This platform uses Rich notifications.
        chrome.notifications.clear(notification, $.noop);
      } else {
        notification.cancel();
      }
      notification = null;
    }
  };

  // Checks if any pages are marked as updated, and if so, displays their count
  // on the browser action badge. If no pages are updated and the badge is
  // displayed, removes it. This also triggers sound alerts and/or desktop
  // notifications if applicable.
  updateBadge = function() {
    getAllUpdatedPages(function(updated_pages) {
      var count = updated_pages.length;

      chrome.browserAction.setBadgeBackgroundColor({
        color: getSetting(SETTINGS.badge_color) || [0, 180, 0, 255]
      });
      chrome.browserAction.setBadgeText({ text: count ? String(count) : '' });
      chrome.browserAction.setIcon({ path: BROWSER_ICON });

      if (count > last_count) {
        triggerSoundAlert();
        triggerDesktopNotification();
      }

      last_count = count;
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
    getAllPages(function(pages) {
      var current_time = Date.now();
      var pages_to_check = force ? pages : $.grep(pages, function(page) {
        var interval = page.check_interval ||
                       getSetting(SETTINGS.check_interval);
        var projected_check = page.last_check + interval - EPSILON;
        return projected_check <= current_time;
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
    projected_check_time = Date.now() + after;
    clearTimeout(check_timeout_id);
    check_timeout_id = setTimeout(check, after);
  };

  // Calculates the minimum amount of time after which at least one page needs a
  // check, then calls applySchedule() to schedule a check after this amount of
  // time.
  scheduleCheck = function() {
    var current_time = Date.now();

    getAllPages(function(pages) {
      if (pages.length == 0) return;

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
        if (xhr && xhr.status >= 200 && xhr.status < 300) {
          // Network up; do the check.
          actualCheck(force, callback, page_callback);
        } else {
          // Network down. Do a constant reschedule.
          applySchedule(RESCHEDULE_DELAY);
          (callback || null)();
        }
      }
    });
  };

  // Makes sure that we haven't lost the check timeout. If we have, restarts it.
  // If everything goes well, this should never be needed, but better be safe
  // than sorry.
  watchdog = function() {
    if (Date.now() - projected_check_time > WATCHDOG_TOLERANCE) {
      console.log('WARNING: Watchdog recovered a lost timeout.');
      scheduleCheck();
    }
  };
})();

/*******************************************************************************
*                                Initialization                                *
*******************************************************************************/

(function() {
  var version = null;

  // A utility function that returns the extension version, as defined in the
  // manifest.
  getExtensionVersion = function() {
    if (!version) {
      var manifest = $.ajax({
        url: 'manifest.json',
        async: false
      }).responseText;
      manifest = JSON.parse(manifest || 'null');
      if (manifest) version = manifest.version;
    }

    return version;
  };
})();


// Inserts the specified page objects into the pages table in the database. The
// pages argument should be an array of pages, each an object with any of the
// standard page properties (url, name, mode, regex, selector, timeout, html,
// crc, icon, updated, last_check and last_changed). The url property is
// required. Once all pages are impoirted, the callback is called.
function insertPages(pages, callback) {
  var pages_to_insert = pages.length;

  for (var i = 0; i < pages.length; i++) {
    addPage(pages[i], function() {
      if (--pages_to_insert == 0) {
        (callback || $.noop)();
      }
    });
  }
}

// Converts pages list from the 1.x format to the 3.x format.
function importVersionOnePages(callback) {
  var pages = [];

  $.each(getSetting('pages_to_check') || {}, function(url, vals) {
    pages.push({
      url: url,
      name: vals.name,
      mode: vals.regex ? 'regex' : 'text',
      regex: vals.regex || null
    });
  });

  insertPages(pages, callback);
}

// Converts pages list from the 2.x format to the 3.x format.
function importVersionTwoPages(callback) {
  var pages = getSetting('pages');
  var pages_to_import = [];

  for (var i in pages) {
    var url = pages[i];
    pages_to_import.push({
      url: url,
      name: getSetting(url + ' name'),
      mode: getSetting(url + ' mode'),
      regex: getSetting(url + ' regex'),
      selector: getSetting(url + ' selector'),
      check_interval: getSetting(url + ' timeout'),
      html: getSetting(url + ' html'),
      crc: getSetting(url + ' crc'),
      updated: getSetting(url + ' updated'),
      last_check: getSetting(url + ' last_check'),
      last_changed: getSetting(url + ' last_changed')
    });
  }

  insertPages(pages_to_import, callback);
}

// Removes unused localStorage settings, e.g. those that were used to page
// config in versions 2.x.
function removeUnusedSettings(storage_object) {
  for (var i in storage_object) {
    if (SETTINGS[i] === undefined) {
      delete storage_object[i];
    }
  }
}

// Adds the default sound alerts and replaces deprecated values.
function fixSoundAlerts() {
  // Add defaults.
  var custom_sounds = getSetting(SETTINGS.custom_sounds) || [];
  custom_sounds.unshift({
    name: chrome.i18n.getMessage('sound_cuckoo'),
    url: chrome.extension.getURL('audio/cuckoo.ogg')
  });
  custom_sounds.unshift({
    name: chrome.i18n.getMessage('sound_chime'),
    url: chrome.extension.getURL('audio/bell.ogg')
  });
  setSetting(SETTINGS.custom_sounds, custom_sounds);

  // Remove outdated audio alert if one is enabled.
  var regex = /^http:\/\/work\.max99x\.com\/(bell.ogg|cuckoo.ogg)$/;
  var sound_alert = getSetting(SETTINGS.sound_alert);
  if (regex.test(sound_alert)) {
    var file = 'audio/' + sound_alert.match(regex)[1];
    setSetting(SETTINGS.sound_alert, chrome.extension.getURL(file));
  }
}

// Brings up the pages list and settings format to the current version if they
// are outdated, then calls the callback.
function bringUpToDate(from_version, callback) {
  initializeStorage(function() {
    function updateDone() {
      setSetting(SETTINGS.version, getExtensionVersion());
      removeUnusedSettings(localStorage);
      (callback || $.noop)();
    }

    if (from_version < 3.1) fixSoundAlerts();

    if (from_version < 1) {
      setSetting(SETTINGS.badge_color, [0, 180, 0, 255]);
      setSetting(SETTINGS.check_interval, DEFAULT_CHECK_INTERVAL);
      setSetting(SETTINGS.sound_alert, null);
      setSetting(SETTINGS.notifications_enabled, false);
      setSetting(SETTINGS.notifications_timeout, 30 * 1000);
      setSetting(SETTINGS.animations_disabled, false);
      setSetting(SETTINGS.sort_by, 'date added');
      setSetting(SETTINGS.view_all_action, 'original');

      updateDone();
    } else if (from_version < 2) {
      setSetting(SETTINGS.view_all_action, 'original');
      delSetting('last_check');

      importVersionOnePages(updateDone);
    } else if (from_version < 3) {
      setSetting(SETTINGS.check_interval, getSetting('timeout') ||
                                          DEFAULT_CHECK_INTERVAL);
      setSetting(SETTINGS.view_all_action, 'original');
      delSetting('timeout');

      importVersionTwoPages(updateDone);
    } else {
      updateDone();
    }
  });
}
