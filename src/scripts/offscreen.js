var DB = openDatabase("pages", "1.0", "Monitored Pages", 51380224);
var b = 0

function getAllPages(a) {
  a &&
    executeSql("SELECT * FROM pages", [], function (b) {
      a(sqlResultToArray(b));
    });
}

const check = function (a, b, c) {
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

actualCheck = function (b, a, c) {
  getAllPages(function (e) {
    function d(b) {
      (c || $.noop)(b);
      h++;
      console.assert(h <= f.length);
      h == f.length && (
        updateBadge(),
        scheduleCheck(), (a || $.noop)());
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
        applySchedule(a, b));
  });
};

applySchedule = function (d, now = Date.now()) {
  a = Date.now() + d;
  clearTimeout(now);
  b = setTimeout(check, d);
};

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

function initializeStorage(a) {
  executeSql(DATABASE_STRUCTURE, $.noop, a);
}

function executeSql(a, b, d, c) {
  var e = "function" === typeof b ? [] : b;
  DB.transaction(
    function (b) {
      b.executeSql(a, e, function (a, b) {
        (d || $.noop)(b);
      });
    },
    $.noop,
    c || $.noop
  );
}

function bringUpToDate(b, a) {
  initializeStorage(function () {
    function d() {
      chrome.runtime.sendMessage({ type: 'getExtensionVersion' }, (response) => {
        setSetting(SETTINGS.version, response);
        removeUnusedSettings(localStorage);
        (a || $.noop)();
      });
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

async function fixSoundAlerts() {
  var b = getSetting(SETTINGS.custom_sounds) || [];
  const soundCuckooName = await chrome.runtime.sendMessage({ key: "sound_cuckoo", type: 'getMessage' })
  const soundChimeName = await chrome.runtime.sendMessage({ key: "sound_chime", type: 'getMessage' })

  b.unshift({
    name: soundCuckooName,
    url: chrome.runtime.getURL("audio/cuckoo.ogg"),
  });
  b.unshift({
    name: soundChimeName,
    url: chrome.runtime.getURL("audio/bell.ogg"),
  });
  setSetting(SETTINGS.custom_sounds, b);
  b = /^http:\/\/work\.max99x\.com\/(bell.ogg|cuckoo.ogg)$/;
  var a = getSetting(SETTINGS.sound_alert);
  b.test(a) &&
    ((b = "audio/" + a.match(b)[1]),
      setSetting(SETTINGS.sound_alert, chrome.extension.getURL(b)));
}

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

function getAllUpdatedPages(a) {
  a &&
    executeSql("SELECT * FROM pages WHERE updated = ?", [1], function (b) {
      a(sqlResultToArray(b));
    });
}

updateBadge = function () {
  getAllUpdatedPages(async function (a) {
    a = a.length;
    await chrome.runtime.sendMessage({
      data: {
        color: getSetting(SETTINGS.badge_color) || [0, 180, 0, 255],
      },
      type: 'setBadgeBackgroundColor'
    })
    await chrome.runtime.sendMessage({
      data: { text: a ? String(a) : "" },
      type: 'setBadgeText'
    })
    await chrome.runtime.sendMessage({ path: BROWSER_ICON })

    if (a > b)
      try {
        triggerSoundAlert(), triggerDesktopNotification();
      } catch (g) {
        console.log(g);
      }
    b = a;
  });
};

const watchdog = function () {
  Date.now() - a > WATCHDOG_TOLERANCE &&
    (console.log("WARNING: Watchdog recovered a lost timeout."),
      scheduleCheck());
};

const init = () => {
  bringUpToDate(parseFloat(getSetting(SETTINGS.version)) || 0, check);
  setInterval(watchdog, WATCHDOG_INTERVAL);
  updateBadge();
}

init();
