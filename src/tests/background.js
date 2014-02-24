$(function() {
  test('Constants', function() {
    var constants = [
      'RELIABLE_CHECKPOINT', 'DEFAULT_CHECK_INTERVAL', 'RESCHEDULE_DELAY',
       'MINIMUM_CHECK_SPACING', 'BROWSER_ICON', 'EPSILON', 'WATCHDOG_INTERVAL',
       'WATCHDOG_TOLERANCE'
    ];
    for (var i = 0; i < constants.length; i++) {
      ok(window[constants[i]] !== undefined, constants[i] + ' is defined.');
    }
  });

  /****************************************************************************/
  module('Update Notifications');
  /****************************************************************************/

  test('triggerSoundAlert', function() {
    expect(4);
    var old_getSetting = getSetting;
    var old_Audio = Audio;

    getSetting = function(name) {
      equal(name, SETTINGS.sound_alert, 'Name of requested setting');
      return 'test';
    };
    Audio = function(url) {
      equal(url, 'test', 'Audio URL');

      return {
        addEventListener: function(event, handler) {
          equal(event, 'canplaythrough', 'Audio event');
          handler.call({
            play: function() {
              ok(true, 'Audio playing function called.');
            }
          });
        }
      };
    };
    triggerSoundAlert();

    Audio = old_Audio;
    getSetting = old_getSetting;
  });

  test('triggerDesktopNotification', function() {
    expect(5);
    var old_getSetting = getSetting;
    var old_createHTMLNotification = webkitNotifications.createHTMLNotification;
    var old_setTimeout = setTimeout;

    setTimeout = function(callback, timeout) {
      equal(callback, hideDesktopNotification, 'Timeout target');
      equal(timeout, 12345, 'Timeout delay');
    }

    getSetting = function(name) {
      if (name == SETTINGS.notifications_enabled) {
        ok(true, 'Valid setting requested.');
        return false;
      } else {
        ok(false, 'Invalid setting requested.');
      }
    };
    webkitNotifications.createHTMLNotification = function(setting) {
      ok(false, 'Notification created despite being disabled');
    };
    triggerDesktopNotification();

    getSetting = function(name) {
      if (name == SETTINGS.notifications_enabled) {
        return true;
      } else if (name == SETTINGS.notifications_timeout) {
        return 12345;
      } else {
        ok(false, 'Invalid setting requested.');
      }
    };
    webkitNotifications.createHTMLNotification = function(setting) {
      equal(setting, 'notification.htm', 'Notification page');
      return { show: function() { ok(true, 'Notification shown'); } };
    };
    triggerDesktopNotification();

    setTimeout = old_setTimeout;
    webkitNotifications.createHTMLNotification = old_createHTMLNotification;
    getSetting = old_getSetting;
  });

  test('updateBadge', function() {
    expect(11);
    var old_getAllUpdatedPages = getAllUpdatedPages;
    var old_browserAction = chrome.browserAction;
    var old_triggerSoundAlert = triggerSoundAlert;
    var old_triggerDesktopNotification = triggerDesktopNotification;
    var old_getSetting = getSetting;

    getAllUpdatedPages = function(callback) { callback([1, 2, 3]); };
    getSetting = function(name) {
      if (name == SETTINGS.badge_color) {
        return 'test';
      } else {
        ok(false, 'Invalid setting requested.');
      }
    };
    chrome.browserAction = {
      setBadgeBackgroundColor: function(color) {
        same(color, { color: 'test' }, 'Badge color');
      },
      setBadgeText: function(text) {
        same(text, { text: '3' }, 'Badge text');
      },
      setIcon: function(icon) {
        same(icon, { path: BROWSER_ICON }, 'Badge icon');
      }
    };
    triggerSoundAlert = function() { ok(true, 'Sound alert triggered.'); };
    triggerDesktopNotification = function() {
      ok('Desktop notification triggered');
    };
    updateBadge();

    triggerSoundAlert = function() {
      ok(false, 'Sound alert triggered on duplicate update.');
    };
    triggerDesktopNotification = function() {
      ok(false, 'Desktop notification triggered on duplicate update.');
    };
    updateBadge();

    getAllUpdatedPages = function(callback) { callback([]); };
    chrome.browserAction.setBadgeText = function(text) {
      same(text, { text: '' }, 'Badge text');
    };
    triggerSoundAlert = function() {
      ok(false, 'Sound alert triggered on empty update.');
    };
    triggerDesktopNotification = function() {
      ok(false, 'Desktop notification triggered on empty update.');
    };
    updateBadge();

    getSetting = old_getSetting;
    triggerDesktopNotification = old_triggerDesktopNotification;
    triggerSoundAlert = old_triggerSoundAlert;
    chrome.browserAction = old_browserAction;
    getAllUpdatedPages = old_getAllUpdatedPages;
  });

  /****************************************************************************/
  module('Check Scheduling');
  /****************************************************************************/

  test('actualCheck', function() {
    expect(10);
    var old_getAllPages = getAllPages;
    var old_Date_now = Date.now;
    var old_updateBadge = updateBadge;
    var old_scheduleCheck = scheduleCheck;
    var old_getSetting = getSetting;
    var old_checkPage = checkPage;
    var old_EPSILON = EPSILON;

    getAllPages = function(callback) {
      callback([{ url: 'a', check_interval: 109, last_check: 500 },
                { url: 'b', check_interval: 110, last_check: 500 },
                { url: 'd', check_interval: 111, last_check: 500 },
                { url: 'c', check_interval: 210, last_check: 500 },
                { url: 'e', check_interval: 110, last_check: 300 },
                { url: 'f', last_check: 500 },
                { url: 'g', last_check: 550 }]);
    };
    Date.now = function() { return 600; };
    updateBadge = function() { ok(true, 'Badge updated.'); };
    scheduleCheck = function() { ok(true, 'Check scheduled.'); };
    getSetting = function(name) {
      if (name == SETTINGS.check_interval) {
        return 75;
      } else {
        ok(false, 'Invalid setting requested.');
      }
    };
    EPSILON = 10;

    var pages_checked = 0;
    checkPage = function(url, callback) {
      if (url == 'a' || url == 'b' || url == 'e' || url == 'f') {
        pages_checked++;
        if (pages_checked == 4) {
          ok(true, 'All correct pages checked.');
        } else if (pages_checked > 4) {
          ok(false, 'Too many pages checked.');
        }
      } else {
        ok(false, 'Page ' + url + ' updated.');
      }
      callback();
    };
    var pages_called_back = 0;
    actualCheck(false, function() {
      ok(true, 'Final callback called.');
    }, function() {
      pages_called_back++;
      if (pages_called_back == 4) {
        ok(true, 'All correct page callbacks called.');
      } else if (pages_called_back > 4) {
        ok(false, 'Too many page callbacks called.');
      }
    });

    var pages_checked = 0;
    checkPage = function(url, callback) {
      pages_checked++;
      if (pages_checked == 7) {
        ok(true, 'All correct pages checked.');
      } else if (pages_checked > 7) {
        ok(false, 'Too many pages checked.');
      }
      callback();
    };
    var pages_called_back = 0;
    actualCheck(true, function() {
      ok(true, 'Final callback called.');
    }, function() {
      pages_called_back++;
      if (pages_called_back == 7) {
        ok(true, 'All correct page callbacks called.');
      } else if (pages_called_back > 7) {
        ok(false, 'Too many page callbacks called.');
      }
    });

    EPSILON = old_EPSILON;
    getAllPages = old_getAllPages;
    Date.now = old_Date_now;
    updateBadge = old_updateBadge;
    scheduleCheck = old_scheduleCheck;
    getSetting = old_getSetting;
    checkPage = old_checkPage;
  });

  test('applySchedule', function() {
    expect(6);
    var old_Date_now = Date.now;
    var old_clearTimeout = clearTimeout;
    var old_setTimeout = setTimeout;

    Date.now = function() { return 100; };
    clearTimeout = function() {
      ok(true, 'Timeout cleared.');
    };
    setTimeout = function(func, milliseconds) {
      equal(func, check, 'Function set for timeout');
      equal(milliseconds, 42, 'Timeout milliseconds');
      return 123;
    };
    applySchedule(42);
    clearTimeout = function(timeout_id) {
      equal(timeout_id, 123, 'Old timeout ID');
    };
    applySchedule(42);

    Date.now = old_Date_now;
    clearTimeout = old_clearTimeout;
    setTimeout = old_setTimeout;
  });

  test('scheduleCheck', function() {
    expect(3);
    var old_Date_now = Date.now;
    var old_getAllPages = getAllPages;
    var old_getSetting = getSetting;
    var old_applySchedule = applySchedule;
    var old_MINIMUM_CHECK_SPACING = MINIMUM_CHECK_SPACING;

    Date.now = function() { return 100; };
    getAllPages = function(callback) {
      callback([{ last_check: 100, check_interval: 42 },
                { last_check: 43, check_interval: 100 },
                { last_check: 100 }]);
    };
    MINIMUM_CHECK_SPACING = 30;

    getSetting = function(name) {
      if (name == SETTINGS.check_interval) {
        return 75;
      } else {
        ok(false, 'Invalid setting requested.');
      }
    };
    applySchedule = function(time) {
      equal(time, 42, 'Schedule application time (page)');
    };
    scheduleCheck();

    getSetting = function(name) {
      if (name == SETTINGS.check_interval) {
        return 40;
      } else {
        ok(false, 'Invalid setting requested.');
      }
    };
    applySchedule = function(time) {
      equal(time, 40, 'Schedule application time (global)');
    };
    scheduleCheck();

    getSetting = function(name) {
      if (name == SETTINGS.check_interval) {
        return 25;
      } else {
        ok(false, 'Invalid setting requested.');
      }
    };
    applySchedule = function(time) {
      equal(time, 30, 'Schedule application time (min)');
    };
    scheduleCheck();

    Date.now = old_Date_now;
    getAllPages = old_getAllPages;
    getSetting = old_getSetting;
    applySchedule = old_applySchedule;
    MINIMUM_CHECK_SPACING = old_MINIMUM_CHECK_SPACING;
  });

  test('check', function() {
    expect(7);
    var old_$ = $;
    var old_actualCheck = actualCheck;
    var old_applySchedule = applySchedule;

    $ = { ajax: function(args) {
      equal(args.type, 'HEAD', 'Request type');
      equal(args.url, RELIABLE_CHECKPOINT, 'Checkpoint URL');
      args.complete({ status: 200 });
    } };
    actualCheck = function(force, callback, page_callback) {
      equal(force, 123, 'Force argument to actualCheck');
      equal(callback, 456, 'Callback argument to actualCheck');
      equal(page_callback, 789, 'Page callback argument to actualCheck');
    };
    check(123, 456, 789);

    $ = { ajax: function(args) { args.complete({ status: 404 }); } };
    applySchedule = function(delay) {
      equal(delay, RESCHEDULE_DELAY, 'Rescheduling delay');
    };
    check(null, function() { ok(true, 'Callback called.'); }, null);

    $ = old_$;
    actualCheck = old_actualCheck;
    applySchedule = old_applySchedule;
  });

  test('watchdog', function() {
    expect(1);
    var old_Date_now = Date.now;
    var old_setTimeout = setTimeout;
    var old_WATCHDOG_TOLERANCE = WATCHDOG_TOLERANCE;
    var old_scheduleCheck = scheduleCheck;

    Date.now = function() { return 100; };
    applySchedule(100);

    setTimeout = $.noop;
    WATCHDOG_TOLERANCE = 10;

    scheduleCheck = function() { ok(true, 'Check scheduled.'); };
    Date.now = function() { return 220; };
    watchdog();

    scheduleCheck = function() { ok(false, 'Unnecessary check scheduled.'); };
    Date.now = function() { return 200; };
    watchdog();

    scheduleCheck = old_scheduleCheck;
    Date.now = old_Date_now;
    setTimeout = old_setTimeout;
    WATCHDOG_TOLERANCE = old_WATCHDOG_TOLERANCE;
  });

  /****************************************************************************/
  module('Initialization');
  /****************************************************************************/

  test('getExtensionVersion', function() {
    expect(3);
    var old_$ = $;

    $ = { ajax: function(args) {
      equal(args.url, 'manifest.json', 'Requested file');
      equal(args.async, false, 'Asynchronous request');
      return { responseText: '{ "version": 123 }' };
    } };
    equal(getExtensionVersion(), 123, 'Dummy extension version');

    $ = old_$;
  });

  test('insertPages', function() {
    expect(4);
    var old_addPage = addPage;

    var page_expected = 1;
    addPage = function(page, callback) {
      equal(page, page_expected++, 'Page added');
      callback();
    }

    insertPages([1, 2, 3], function() { ok(true, 'Final callback called.'); });

    addPage = old_addPage;
  });

  test('importVersionOnePages', function() {
    expect(2);
    var old_insertPages = insertPages;
    var old_getSetting = getSetting;

    var raw_pages = {
      'a': { name: 'an', regex: 'hello' },
      'b': { name: 'bn', regex: false },
      'c': { name: 'cn' }
    };
    var expected_pages = [
      { url: 'a', name: 'an', mode: 'regex', regex: 'hello' },
      { url: 'b', name: 'bn', mode: 'text', regex: null },
      { url: 'c', name: 'cn', mode: 'text', regex: null }
    ];

    getSetting = function(name) {
      if (name == 'pages_to_check') {
        return raw_pages;
      } else {
        ok(false, 'Invalid setting requested.');
      }
    };

    insertPages = function(page, callback) {
      same(page, expected_pages, 'Pages to insert');
      equal(callback, 123, 'Dummy callback');
    };

    importVersionOnePages(123);

    getSetting = old_getSetting;
    insertPages = old_insertPages;
  });

  test('importVersionTwoPages', function() {
    expect(2);
    var old_insertPages = insertPages;
    var old_getSetting = getSetting;

    var raw_pages = {'a': { name: 'an', mode: 'am', regex: 'ar', selector: 'as',
                            timeout: 'at', html: 'ah', crc: 'ac', updated: 'au',
                            last_check: 'al', last_changed: 'al2' },
                     'b': { name: 'bn', mode: 'bm', regex: 'br', selector: 'bs',
                            timeout: 'bt', html: 'bh', crc: 'bc', updated: 'bu',
                            last_check: 'bl', last_changed: 'bl2' }};
    var expected_pages = [
      { url: 'a', name: 'an', mode: 'am', regex: 'ar', selector: 'as',
        check_interval: 'at', html: 'ah', crc: 'ac', updated: 'au',
        last_check: 'al', last_changed: 'al2' },
      { url: 'b', name: 'bn', mode: 'bm', regex: 'br', selector: 'bs',
        check_interval: 'bt', html: 'bh', crc: 'bc', updated: 'bu',
        last_check: 'bl', last_changed: 'bl2' }
    ];

    getSetting = function(name) {
      if (name == 'pages') {
        return ['a', 'b'];
      } else {
        var parts = name.split(' ');
        return raw_pages[parts[0]][parts[1]];
      }
    };

    insertPages = function(page, callback) {
      same(page, expected_pages, 'Pages to insert');
      equal(callback, 123, 'Dummy callback');
    };

    importVersionTwoPages(123);

    getSetting = old_getSetting;
    insertPages = old_insertPages;
  });

  test('removeUnusedSettings', function() {
    expect(1);
    var old_SETTINGS = SETTINGS;

    storage = { a: 1, b: 2, c: 3, d: 4 };
    SETTINGS = { a: 5, c: 6 };
    removeUnusedSettings(storage);
    same(storage, { a: 1, c: 3 }, 'Local storage after cleaning');

    SETTINGS = old_SETTINGS;
  });

  test('bringUpToDate', function() {
    expect(24);
    var old_initializeStorage = initializeStorage;
    var old_getExtensionVersion = getExtensionVersion;
    var old_removeUnusedSettings = removeUnusedSettings;
    var old_importVersionOnePages = importVersionOnePages;
    var old_importVersionTwoPages = importVersionTwoPages;
    var old_fixSoundAlerts = fixSoundAlerts;
    var old_setSetting = setSetting;
    var old_delSetting = delSetting;
    var old_getSetting = getSetting;

    var settings_set = {};

    initializeStorage = function(callback) {
      callback();
    };
    getExtensionVersion = function() {
      return 42;
    };
    removeUnusedSettings = function(storage) {
      equal(storage, localStorage, 'Storage to be cleared');
    };
    setSetting = function(name, value) {
      settings_set[name] = value;
    };
    importVersionTwoPages = function(callback) {
      ok(true, 'Imported from V2.');
      callback();
    };
    importVersionOnePages = function(callback) {
      ok(true, 'Imported from V1.');
      callback();
    };

    // Version 3.1.
    fixSoundAlerts = function() {
      ok(false, 'Unnecessarily fixed sound alerts.');
    };
    settings_set = {};
    bringUpToDate(3.1, function() { ok(true, 'Callback called.'); });
    same(settings_set, { version: 42 }, 'V3.1 updates');

    // Version 3.0.x.
    fixSoundAlerts = function() {
      ok(true, 'Fixed sound alerts.');
    };
    settings_set = {};
    bringUpToDate(3, function() { ok(true, 'Callback called.'); });
    same(settings_set, { version: 42 }, 'V3 updates');

    // Version 2.x.
    settings_set = {};
    delSetting = function(name) {
      equal(name, 'timeout', 'V2 deleted setting');
    };
    getSetting = function(name) {
      equal(name, 'timeout', 'V2 requested setting');
      return 456;
    };
    bringUpToDate(2.5, function() { ok(true, 'Callback called.'); });
    same(settings_set, {
      version: 42,
      view_all_action: 'original',
      check_interval: 456
    }, 'V2 updates');

    // Version 1.x.
    settings_set = {};
    delSetting = function(name) {
      equal(name, 'last_check', 'V1 deleted setting');
    };
    bringUpToDate(1.5, function() { ok(true, 'Callback called.'); });
    same(settings_set, {
      version: 42,
      view_all_action: 'original'
    }, 'V1 updates');

    // First install.
    settings_set = {};
    bringUpToDate(0.5, function() { ok(true, 'Callback called.'); });
    same(settings_set, {
      version: 42,
      badge_color: [0, 180, 0, 255],
      check_interval: DEFAULT_CHECK_INTERVAL,
      sound_alert: null,
      notifications_enabled: false,
      notifications_timeout: 30 * 1000,
      animations_disabled: false,
      sort_by: 'date added',
      version: 42,
      view_all_action: 'original'
    }, 'First install updates');

    initializeStorage = old_initializeStorage;
    getExtensionVersion = old_getExtensionVersion;
    removeUnusedSettings = old_removeUnusedSettings;
    importVersionOnePages = old_importVersionOnePages;
    importVersionTwoPages = old_importVersionTwoPages;
    fixSoundAlerts = old_fixSoundAlerts;
    setSetting = old_setSetting;
    delSetting = old_delSetting;
    getSetting = old_getSetting;
  });
});
