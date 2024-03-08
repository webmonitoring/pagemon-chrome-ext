var DEFAULT_CHECK_INTERVAL = 108e5, //Duplicate
  BROWSER_ICON = "img/browser_icon.png",
  WATCHDOG_INTERVAL = 9e5,
  WATCHDOG_TOLERANCE = 12e4;
(function () {
  var b = 0,
    a = null,
    d = !1,
    e = [];

  hideDesktopNotification = function () {
    null != a &&
      ("string" == typeof a
        ? chrome.notifications.clear(a, $.noop)
        : a.cancel(),
        (a = null));
  };
  //Duplicate
  updateBadge = function () {
    getAllUpdatedPages(function (a) {
      a = a.length;
      chrome.action.setBadgeBackgroundColor({
        color: getSetting(SETTINGS.badge_color) || [0, 180, 0, 255],
      });
      chrome.action.setBadgeText({ text: a ? String(a) : "" });
      chrome.action.setIcon({ path: BROWSER_ICON });
      if (a > b)
        try {
          triggerSoundAlert(), triggerDesktopNotification();
        } catch (g) {
          console.log(g);
        }
      b = a;
    });
  };
})();
(function () {
  var b = 0,
    a = 0;

  watchdog = function () {
    Date.now() - a > WATCHDOG_TOLERANCE &&
      (console.log("WARNING: Watchdog recovered a lost timeout."),
        scheduleCheck());
  };
})();
(function () {
  var b = null;
  getExtensionVersion = function () {
    if (!b) {
      var a = $.ajax({ url: "manifest.json", async: !1 }).responseText;
      if ((a = JSON.parse(a || "null"))) b = a.version;
    }
    return b;
  };
})();
function insertPages(b, a) {
  for (var d = b.length, e = 0; e < b.length; e++)
    addPage(b[e], function () {
      0 == --d && (a || $.noop)();
    });
}
function importVersionOnePages(b) {
  var a = [];
  $.each(getSetting("pages_to_check") || {}, function (b, e) {
    a.push({
      url: b,
      name: e.name,
      mode: e.regex ? "regex" : "text",
      regex: e.regex || null,
    });
  });
  insertPages(a, b);
}
function importVersionTwoPages(b) {
  var a = getSetting("pages"),
    d = [],
    e;
  for (e in a) {
    var c = a[e];
    d.push({
      url: c,
      name: getSetting(c + " name"),
      mode: getSetting(c + " mode"),
      regex: getSetting(c + " regex"),
      selector: getSetting(c + " selector"),
      check_interval: getSetting(c + " timeout"),
      html: getSetting(c + " html"),
      crc: getSetting(c + " crc"),
      updated: getSetting(c + " updated"),
      last_check: getSetting(c + " last_check"),
      last_changed: getSetting(c + " last_changed"),
    });
  }
  insertPages(d, b);
}
function removeUnusedSettings(b) {
  for (var a in b) void 0 === SETTINGS[a] && delete b[a];
}
function fixSoundAlerts() {
  var b = getSetting(SETTINGS.custom_sounds) || [];
  b.unshift({
    name: chrome.i18n.getMessage("sound_cuckoo"),
    url: chrome.extension.getURL("audio/cuckoo.ogg"),
  });
  b.unshift({
    name: chrome.i18n.getMessage("sound_chime"),
    url: chrome.extension.getURL("audio/bell.ogg"),
  });
  setSetting(SETTINGS.custom_sounds, b);
  b = /^http:\/\/work\.max99x\.com\/(bell.ogg|cuckoo.ogg)$/;
  var a = getSetting(SETTINGS.sound_alert);
  b.test(a) &&
    ((b = "audio/" + a.match(b)[1]),
      setSetting(SETTINGS.sound_alert, chrome.extension.getURL(b)));
}
function bringUpToDate(b, a) {
  initializeStorage(function () {
    function d() {
      setSetting(SETTINGS.version, getExtensionVersion());
      removeUnusedSettings(localStorage);
      (a || $.noop)();
    }
    3.1 > b && fixSoundAlerts();
    1 > b
      ? (setSetting(SETTINGS.badge_color, [0, 180, 0, 255]),
        setSetting(SETTINGS.check_interval, DEFAULT_CHECK_INTERVAL),
        setSetting(SETTINGS.sound_alert, null),
        setSetting(SETTINGS.notifications_enabled, !1),
        setSetting(SETTINGS.notifications_timeout, 3e4),
        setSetting(SETTINGS.animations_disabled, !1),
        setSetting(SETTINGS.sort_by, "date added"),
        setSetting(SETTINGS.view_all_action, "original"),
        d())
      : 2 > b
        ? (setSetting(SETTINGS.view_all_action, "original"),
          delSetting("last_check"),
          importVersionOnePages(d))
        : 3 > b
          ? (setSetting(
            SETTINGS.check_interval,
            getSetting("timeout") || DEFAULT_CHECK_INTERVAL
          ),
            setSetting(SETTINGS.view_all_action, "original"),
            delSetting("timeout"),
            importVersionTwoPages(d))
          : d();
  });
}

const messageHash = {
  ['hideDesktopNotification']: () => {
    hideDesktopNotification();
  },
}

chrome.runtime.onMessage.addListener(async (message, _sender, sendResponse) => {
  if (messageHash[message.type]) {
    messageHash[message.type](message);
  }

  sendResponse(true);
});