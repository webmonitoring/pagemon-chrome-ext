const SETTINGS = {
  check_interval: "check_interval",
  badge_color: "badge_color",
  version: "4.0.0",
  sound_alert: "sound_alert",
  notifications_enabled: "notifications_enabled",
  notifications_timeout: "notifications_timeout",
  animations_disabled: "animations_disabled",
  sort_by: "sort_by",
  custom_sounds: "custom_sounds",
  view_all_action: "view_all_action",
  hide_deletions: "hide_deletions",
  show_full_page_diff: "show_full_page_diff",
}
const RELIABLE_CHECKPOINT = "http://www.google.com/";
const RELIABLE_CHECKPOINT_REGEX = /Google/;
const RESCHEDULE_DELAY = 9e5;
const DEFAULT_CHECK_INTERVAL = 108e5,
  BROWSER_ICON = "img/browser_icon.png",
  WATCHDOG_INTERVAL = 9e5
WATCHDOG_TOLERANCE = 12e4,
  DATABASE_STRUCTURE =
  "CREATE TABLE IF NOT EXISTS pages (   `url` TEXT NOT NULL UNIQUE,   `name` TEXT NOT NULL,   `mode` TEXT NOT NULL DEFAULT 'text',   `regex` TEXT,   `selector` TEXT,   `check_interval` INTEGER,   `html` TEXT NOT NULL DEFAULT '',   `crc` INTEGER NOT NULL DEFAULT 0,   `updated` INTEGER,   `last_check` INTEGER,   `last_changed` INTEGER );";

function getSetting(a) {
  return JSON.parse(localStorage.getItem(a) || "null");
}
function setSetting(a, b) {
  localStorage.setItem(a, JSON.stringify(b));
}
function delSetting(a) {
  localStorage.removeItem(a);
}
function sqlResultToArray(a) {
  for (var b = [], d = 0; d < a.rows.length; d++) b.push(a.rows.item(d));
  return b;
}

function triggerSoundAlert() {
  var b = getSetting(SETTINGS.sound_alert);
  if (b) {
    var a = new Audio(b);
    a.addEventListener("canplaythrough", function () {
      a && (a.loop && (a.loop = !1), a.play(), (a = null));
    });
  }
};

function removeUnusedSettings(b) {
  for (var a in b) void 0 === SETTINGS[a] && delete b[a];
}