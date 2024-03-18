var REGEX_TIMEOUT = 7e3,
  REGEX_WORKER_PATH = "./regex.js",
  REQUEST_TIMEOUT = 1e4;

(function () {
  var a = [
    0, 1996959894, 3993919788, 2567524794, 124634137, 1886057615, 3915621685,
    2657392035, 249268274, 2044508324, 3772115230, 2547177864, 162941995,
    2125561021, 3887607047, 2428444049, 498536548, 1789927666, 4089016648,
    2227061214, 450548861, 1843258603, 4107580753, 2211677639, 325883990,
    1684777152, 4251122042, 2321926636, 335633487, 1661365465, 4195302755,
    2366115317, 997073096, 1281953886, 3579855332, 2724688242, 1006888145,
    1258607687, 3524101629, 2768942443, 901097722, 1119000684, 3686517206,
    2898065728, 853044451, 1172266101, 3705015759, 2882616665, 651767980,
    1373503546, 3369554304, 3218104598, 565507253, 1454621731, 3485111705,
    3099436303, 671266974, 1594198024, 3322730930, 2970347812, 795835527,
    1483230225, 3244367275, 3060149565, 1994146192, 31158534, 2563907772,
    4023717930, 1907459465, 112637215, 2680153253, 3904427059, 2013776290,
    251722036, 2517215374, 3775830040, 2137656763, 141376813, 2439277719,
    3865271297, 1802195444, 476864866, 2238001368, 4066508878, 1812370925,
    453092731, 2181625025, 4111451223, 1706088902, 314042704, 2344532202,
    4240017532, 1658658271, 366619977, 2362670323, 4224994405, 1303535960,
    984961486, 2747007092, 3569037538, 1256170817, 1037604311, 2765210733,
    3554079995, 1131014506, 879679996, 2909243462, 3663771856, 1141124467,
    855842277, 2852801631, 3708648649, 1342533948, 654459306, 3188396048,
    3373015174, 1466479909, 544179635, 3110523913, 3462522015, 1591671054,
    702138776, 2966460450, 3352799412, 1504918807, 783551873, 3082640443,
    3233442989, 3988292384, 2596254646, 62317068, 1957810842, 3939845945,
    2647816111, 81470997, 1943803523, 3814918930, 2489596804, 225274430,
    2053790376, 3826175755, 2466906013, 167816743, 2097651377, 4027552580,
    2265490386, 503444072, 1762050814, 4150417245, 2154129355, 426522225,
    1852507879, 4275313526, 2312317920, 282753626, 1742555852, 4189708143,
    2394877945, 397917763, 1622183637, 3604390888, 2714866558, 953729732,
    1340076626, 3518719985, 2797360999, 1068828381, 1219638859, 3624741850,
    2936675148, 906185462, 1090812512, 3747672003, 2825379669, 829329135,
    1181335161, 3412177804, 3160834842, 628085408, 1382605366, 3423369109,
    3138078467, 570562233, 1426400815, 3317316542, 2998733608, 733239954,
    1555261956, 3268935591, 3050360625, 752459403, 1541320221, 2607071920,
    3965973030, 1969922972, 40735498, 2617837225, 3943577151, 1913087877,
    83908371, 2512341634, 3803740692, 2075208622, 213261112, 2463272603,
    3855990285, 2094854071, 198958881, 2262029012, 4057260610, 1759359992,
    534414190, 2176718541, 4139329115, 1873836001, 414664567, 2282248934,
    4279200368, 1711684554, 285281116, 2405801727, 4167216745, 1634467795,
    376229701, 2685067896, 3608007406, 1308918612, 956543938, 2808555105,
    3495958263, 1231636301, 1047427035, 2932959818, 3654703836, 1088359270,
    936918e3, 2847714899, 3736837829, 1202900863, 817233897, 3183342108,
    3401237130, 1404277552, 615818150, 3134207493, 3453421203, 1423857449,
    601450431, 3009837614, 3294710456, 1567103746, 711928724, 3020668471,
    3272380065, 1510334235, 755167117,
  ];
  crc = function (b) {
    if ("string" != typeof b) return null;
    b = encodeUTF8(b);
    for (var d = b.length, c = 4294967295, e = 0; e < d; e++)
      c = (c >>> 8) ^ a[(c & 255) ^ b.charCodeAt(e)];
    return c ^ -1;
  };
})();

var b = 0,
  a = null,
  d = !1,
  e = [];

function encodeUTF8(a) {
  for (var b = [], d = 0; d < a.length; d++) {
    var c = a.charCodeAt(d);
    128 > c
      ? b.push(String.fromCharCode(c))
      : (127 < c && 2048 > c
        ? b.push(String.fromCharCode((c >> 6) | 192))
        : (b.push(String.fromCharCode((c >> 12) | 224)),
          b.push(String.fromCharCode(((c >> 6) & 63) | 128))),
        b.push(String.fromCharCode((c & 63) | 128)));
  }
  return b.join("");
}
function describeTime(a) {
  var b = Math.floor(a / 1e3),
    d = Math.floor(b / 60) % 60,
    c = Math.floor(b / 3600) % 24,
    e = Math.floor(b / 86400),
    f = "";
  if (e) {
    var g = chrome.i18n.getMessage("day");
    a = chrome.i18n.getMessage("days", e.toString());
    f += 1 == e ? g : a;
  }
  c &&
    ((g = chrome.i18n.getMessage("hour")),
      (a = chrome.i18n.getMessage("hours", c.toString())),
      (f += " " + (1 == c ? g : a)));
  !e &&
    d &&
    ((g = chrome.i18n.getMessage("minute")),
      (a = chrome.i18n.getMessage("minutes", d.toString())),
      (f += " " + (1 == d ? g : a)));
  f ||
    ((g = chrome.i18n.getMessage("second")),
      (a = chrome.i18n.getMessage("seconds", b.toString())),
      (f += " " + (1 == b ? g : a)));
  return f.replace(/^\s+|\s+$/g, "");
}
function describeTimeSince(a) {
  return chrome.i18n.getMessage("ago", describeTime(Date.now() - a));
}
function getStrippedBody(a) {
  var b = a.match(/<body[^>]*>(?:([^]*)<\/body>([^]*)|([^]*))/i);
  b =
    b && 1 < b.length
      ? b[2] && b[2].length > MIN_BODY_TAIL_LENGTH
        ? b[1] + " " + b[2]
        : void 0 === b[1]
          ? b[3]
          : b[1]
      : a;
  return b.replace(/<script\b[^>]*(?:>[^]*?<\/script>|\/>)/gi, "<blink/>");
}
function getFavicon(a) {
  return chrome.runtime.getURL("/_favicon/?pageUrl=") + a;
}
function applyLocalization() {
  $(".i18n[title]").each(function () {
    $(this)
      .removeClass("i18n")
      .text(chrome.i18n.getMessage($(this).attr("title")))
      .attr("title", "");
  });
}
function getSetting(a) {
  return JSON.parse(localStorage.getItem(a) || "null");
}
function setSetting(a, b) {
  localStorage.setItem(a, JSON.stringify(b));
}
function delSetting(a) {
  localStorage.removeItem(a);
}
function initializeStorage(callback) {
  executeSql(DATABASE_STRUCTURE, [], callback);
}
function executeSql(query, values, callback) {
  SQLITE_DB.executeSql(query, values, callback)
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
function getAllPageURLs(callback) {
  PAGES.getAllPageURLs()
    .then(result => callback(result))
}
function getAllPages(callback) {
  PAGES.getAllPages()
    .then(result => {
      callback(result)
    })
}
function getAllUpdatedPages(callback) {
  PAGES.getAllUpdatedPages()
    .then(result => {
      callback(result);
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
      executeSql(a, e, d))
    : (d || $.noop)();
}
function addPage(value, callback) {
  PAGES.addPage(value)
    .then(() => {
      takeSnapshot();
      scheduleCheck();
      (callback || $.noop)();
    })
}
function removePage(a, b) {
  executeSql("DELETE FROM pages WHERE url = ?", [a], function () {
    scheduleCheck();
    (b || $.noop)();
  });
}

function canonizePage(a, b) {
  return a ? (b.match(/\b(x|xht|ht)ml\b/) ? a.replace(/\s+/g, " ") : a) : a;
}
function findAndFormatRegexMatches(a, b, d) {
  function c(a) {
    e || ((e = !0), f.terminate(), (d || $.noop)(a ? a.data : null));
  }
  if (d) {
    if (!b) return d("");
    var e = !1,
      f = new Worker(REGEX_WORKER_PATH);
    f.onmessage = c;
    f.postMessage(JSON.stringify({ command: "run", text: a, regex: b }));
    setTimeout(c, REGEX_TIMEOUT);
  }
}
function findAndFormatSelectorMatches(a, b, d) {
  try {
    var c = $("<body>").html(getStrippedBody(a)),
      e = $(b, c)
        .map(function () {
          return '"' + $("<div>").append(this).html() + '"';
        })
        .get()
        .join("\n");
    (d || $.noop)(e);
  } catch (f) {
    (d || $.noop)(null);
  }
}
function cleanHtmlPage(a, b) {
  a = a.toLowerCase();
  a = getStrippedBody(a);
  a = a.replace(/<(script|style|object|embed|applet)[^>]*>[^]*?<\/\1>/g, "");
  a = a.replace(
    /<img[^>]*src\s*=\s*['"]?([^<>"' ]+)['"]?[^>]*>/g,
    "{startimg:$1:endimg}"
  );
  a = a.replace(/<[^>]*>/g, "");
  a = a.replace(/\s+/g, " ");
  a = $("<div/>").html(a).text();
  a = a.replace(
    /\d+ ?(st|nd|rd|th|am|pm|seconds?|minutes?|hours?|days?|weeks?|months?)\b/g,
    ""
  );
  a = a.replace(/[\x00-\x40\x5B-\x60\x7B-\xBF]/g, "");
  if (b) b(a);
  else return a;
}
function cleanAndHashPage(a, b, d, c, e) {
  function f(a) {
    e(crc(a || ""));
  }
  e &&
    ("regex" == b && d
      ? findAndFormatRegexMatches(a, d, f)
      : "selector" == b && c
        ? findAndFormatSelectorMatches(a, c, f)
        : cleanHtmlPage(a, f));
}
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
function takeSnapshot(a, b) {
  checkPage(
    a,
    function () {
      setPageSettings(a, { updated: !1 }, b);
    },
    !0
  );
}

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

hideDesktopNotification = function () {
  null != a &&
    ("string" == typeof a
      ? chrome.notifications.clear(a, $.noop)
      : a.cancel(),
      (a = null));
};

$.ajaxSetup({
  timeout: REQUEST_TIMEOUT,
  headers: { "Cache-Control": "no-cache", Etag: "bad-etag" },
});
