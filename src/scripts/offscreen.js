var a = 0, b = 0

function getAllPages(a) {
  PAGES.getAllPages()
    .then(result => a(result));
}

function getPage(url, callback) {
  PAGES.getPage(url)
    .then(result => {
      console.assert(1 >= result.length);
      result.length
        ? ((a = result[0]),
          a.check_interval ||
          (a.check_interval = getSetting(SETTINGS.check_interval)),
          callback(a))
        : callback(null);
    })
}

function setPageSettings(a, b, d) {
  var c = [],
    e = [],
    f;
  for (f in b)
    c.push(f + " = ?"),
      "boolean" == typeof b[f] && (b[f] = Number(b[f])),
      e.push(b[f]);
  e.push(a);
  c
    ? ((a = "UPDATE pages SET " + c.join(", ") + " WHERE url = ?"),
      SQLITE_DB.executeSql(a, e, null, d))
    : (d || $.noop)();
}

const runCheck = function (a, b, c) {
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
  b = setTimeout(runCheck, d);
};

function checkPage(a, b, d) {
  getPage(a, function (c) {
    !c || c.updated
      ? (b || $.noop)(a)
      : $.ajax({
        url: a,
        dataType: "text",
        timeout: c.check_interval / 2,
        success: function (e, f, g) {
          var h = g.getResponseHeader("Content-type");
          cleanAndHashPage(e, c.mode, c.regex, c.selector, function (f) {
            var g = {};
            g =
              f != c.crc
                ? {
                  updated: !0,
                  crc: f,
                  html: d ? canonizePage(e, h) : c.html,
                  last_changed: Date.now(),
                }
                : { html: canonizePage(e, h) };
            g.last_check = Date.now();
            setPageSettings(a, g, function () {
              (b || $.noop)(a);
            });
          });
        },
        error: function () {
          setPageSettings(a, { last_check: Date.now() }, function () {
            (b || $.noop)(a);
          });
        },
      });
  });
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

async function initializeStorage(callback) {
  await SQLITE_DB.executeSql(DATABASE_STRUCTURE, [], callback);
}

function bringUpToDate(b, a) {
  initializeStorage(async function () {
    try {
      const dataMigrationService = new DataMigrationService()
      await dataMigrationService.handle();
  
      initializeSettings(a, b);
    } catch (error) {
      console.error(error);
      initializeSettings(a, b);
    }
  });
}

function initializeSettings(a, b) {
  function d() {
    chrome.runtime.sendMessage({ type: 'getExtensionVersion' }, (response) => {
      setSetting(SETTINGS.version, response);
      removeUnusedSettings(localStorage);
      (a || $.noop)();
    });
  }
  fixSoundAlerts();
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
}

async function fixSoundAlerts() {
  var b = getSetting(SETTINGS.custom_sounds) || [];
  const cuckoo = await chrome.runtime.sendMessage({ data: { key: "sound_cuckoo" }, type: 'getMessage' })
  const chime = await chrome.runtime.sendMessage({ data: { key: "sound_chime" }, type: 'getMessage' })

  if (b.map(sound => sound.name).includes(chime || cuckoo)) {
    return;
  }

  b.unshift({
    name: cuckoo,
    url: chrome.runtime.getURL("audio/cuckoo.ogg"),
  });
  b.unshift({
    name: chime,
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

function getAllUpdatedPages(callback) {
  PAGES.getAllUpdatedPages()
    .then(result => callback(result));
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
    await chrome.runtime.sendMessage({ data: { path: BROWSER_ICON }, type: 'setIcon' })

    if (a > b)
      try {
        triggerSoundAlert(), triggerDesktopNotification();
      } catch (g) {
        console.log(g);
      }
    b = a;
  });
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
      getAllUpdatedPages(async function (b) {
        if (0 != b.length) {
          title =
            1 == b.length
              ? await chrome.runtime.sendMessage({ data: { key: "page_updated_single" }, type: "getMessage" })
              : await chrome.runtime.sendMessage({ data: { key: "page_updated_multi", substitutions: b.length.toString() }, type: "getMessage" })
          var c = $.map(b, function (b) {
            return { title: b.name };
          });
          c = {
            type: "basic",
            iconUrl: chrome.runtime.getURL("img/icon128.png"),
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
          setPageSettings(c.url, { updated: !1 }, function () {
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

const watchdog = function () {
  Date.now() - a > WATCHDOG_TOLERANCE &&
    (console.log("WARNING: Watchdog recovered a lost timeout."),
      scheduleCheck());
};

const init = () => {
  bringUpToDate(parseFloat(getSetting(SETTINGS.version)) || 0, runCheck);
  setInterval(watchdog, WATCHDOG_INTERVAL);
  updateBadge();
}


init();
