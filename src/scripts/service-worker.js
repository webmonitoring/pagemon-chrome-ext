var RELIABLE_CHECKPOINT = "http://www.google.com/",
  RELIABLE_CHECKPOINT_REGEX = /Google/,
  DEFAULT_CHECK_INTERVAL = 108e5,
  RESCHEDULE_DELAY = 9e5,
  MINIMUM_CHECK_SPACING = 1e3,
  BROWSER_ICON = "img/browser_icon.png",
  EPSILON = 500,
  WATCHDOG_INTERVAL = 9e5,
  WATCHDOG_TOLERANCE = 12e4;
(function () {
  var b = 0,
    a = null,
    d = !1,
    e = [];
  triggerSoundAlert = function () {
    var b = getSetting(SETTINGS.sound_alert);
    if (b) {
      var a = new Audio(b);
      a.addEventListener("canplaythrough", function () {
        a && (a.loop && (a.loop = !1), a.play(), (a = null));
      });
    }
  };
  triggerDesktopNotification = function () {
    if (
      getSetting(SETTINGS.notifications_enabled) &&
      !(0 < chrome.extension.getViews({ type: "popup" }).length)
    ) {
      var b = getSetting(SETTINGS.notifications_timeout) || 3e4;
      if (
        window.webkitNotifications &&
        webkitNotifications.createHTMLNotification
      )
        (a =
          window.webkitNotifications.createHTMLNotification(
            "notification.htm"
          )),
          a.show();
      else if (chrome.notifications && chrome.notifications.create)
        getAllUpdatedPages(function (b) {
          if (0 != b.length) {
            title =
              1 == b.length
                ? chrome.i18n.getMessage("page_updated_single")
                : chrome.i18n.getMessage(
                  "page_updated_multi",
                  b.length.toString()
                );
            var c = $.map(b, function (b) {
              return { title: b.name };
            });
            c = {
              type: "basic",
              iconUrl: chrome.extension.getURL("img/icon128.png"),
              title: title,
              message: "",
              buttons: c,
            };
            e = b;
            null != a && hideDesktopNotification();
            chrome.notifications.create("", c, function (b) {
              a = b;
            });
          }
        }),
          d ||
          (chrome.notifications.onButtonClicked.addListener(function (b, a) {
            var c = e[a];
            window.open("diff.htm#" + btoa(c.url));
            BG.setPageSettings(c.url, { updated: !1 }, function () {
              updateBadge();
              takeSnapshot(c.url, scheduleCheck);
              triggerDesktopNotification();
            });
          }),
            (d = !0));
      else return;
      6e4 >= b && setTimeout(hideDesktopNotification, b);
    }
  };
  hideDesktopNotification = function () {
    null != a &&
      ("string" == typeof a
        ? chrome.notifications.clear(a, $.noop)
        : a.cancel(),
        (a = null));
  };
  updateBadge = function () {
    getAllUpdatedPages(function (a) {
      a = a.length;
      chrome.browserAction.setBadgeBackgroundColor({
        color: getSetting(SETTINGS.badge_color) || [0, 180, 0, 255],
      });
      chrome.browserAction.setBadgeText({ text: a ? String(a) : "" });
      chrome.browserAction.setIcon({ path: BROWSER_ICON });
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
  actualCheck = function (b, a, c) {
    getAllPages(function (e) {
      function d(b) {
        (c || $.noop)(b);
        h++;
        console.assert(h <= f.length);
        h == f.length && (updateBadge(), scheduleCheck(), (a || $.noop)());
      }
      var g = Date.now(),
        f = b
          ? e
          : $.grep(e, function (b) {
            var a = b.check_interval || getSetting(SETTINGS.check_interval);
            return b.last_check + a - EPSILON <= g;
          }),
        h = 0;
      f.length
        ? $.each(f, function (b, a) {
          checkPage(a.url, d);
        })
        : (updateBadge(), scheduleCheck(), (a || $.noop)());
    });
  };
  applySchedule = function (d) {
    a = Date.now() + d;
    clearTimeout(b);
    b = setTimeout(check, d);
  };
  scheduleCheck = function () {
    var b = Date.now();
    getAllPages(function (a) {
      0 != a.length &&
        ((a = $.map(a, function (a) {
          if (a.updated || !a.last_check) return b;
          var c = a.check_interval || getSetting(SETTINGS.check_interval);
          return a.last_check + c - b;
        })),
          (a = Math.min.apply(Math, a)),
          a < MINIMUM_CHECK_SPACING
            ? (a = MINIMUM_CHECK_SPACING)
            : a == b && (a = DEFAULT_CHECK_INTERVAL),
          applySchedule(a));
    });
  };
  check = function (a, b, c) {
    $.ajax({
      url: RELIABLE_CHECKPOINT,
      complete: function (d) {
        var e = !1;
        d &&
          200 <= d.status &&
          300 > d.status &&
          (e = RELIABLE_CHECKPOINT_REGEX.test(d.responseText));
        e
          ? actualCheck(a, b, c)
          : (console.log(
            "Network appears down (" +
            (d && d.status) +
            "). Rescheduling check."
          ),
            applySchedule(RESCHEDULE_DELAY),
            (b || $.noop)());
      },
    });
  };
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
  console.log("message", message);
  if (messageHash[message.type]) {
    messageHash[message.type](message);
  }

  sendResponse(true);
});