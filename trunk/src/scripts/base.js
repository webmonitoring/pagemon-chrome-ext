/*
  Contains generic functions that all other parts of the system use. These
  include basic utilities, storage interface, cleaning/hashing and single page
  checking functions.
*/

/*******************************************************************************
*                                  Constants                                   *
*******************************************************************************/

// Setting names.
var SETTINGS = {
  check_interval: 'check_interval',
  badge_color: 'badge_color',
  version: 'version',
  sound_alert: 'sound_alert',
  notifications_enabled: 'notifications_enabled',
  notifications_timeout: 'notifications_timeout',
  animations_disabled: 'animations_disabled',
  sort_by: 'sort_by',
  custom_sounds: 'custom_sounds',
  view_all_action: 'view_all_action',
  hide_deletions: 'hide_deletions',
  show_full_page_diff: 'show_full_page_diff'
};

// Reference to the background page.
var BG = chrome.extension.getBackgroundPage();

// Reference to the database.
var DB = openDatabase('pages', '1.0', 'Monitored Pages', 49 * 1024 * 1024);

// The maximum amount of time a regex match is allowed to take, in milliseconds.
var REGEX_TIMEOUT = 7 * 1000;

// The path to the worker script that runs asynchronous regex matches.
var REGEX_WORKER_PATH = 'scripts/regex.js';

// Maximum request timeout (in milliseconds).
var REQUEST_TIMEOUT = 10000;

// The minimum length of content after the </body> tag that cannot be ignored.
var MIN_BODY_TAIL_LENGTH = 100;

// The pages database table structure as an SQL CREATE TABLE statement.
var DATABASE_STRUCTURE = "CREATE TABLE IF NOT EXISTS pages ( \
  `url` TEXT NOT NULL UNIQUE, \
  `name` TEXT NOT NULL, \
  `mode` TEXT NOT NULL DEFAULT 'text', \
  `regex` TEXT, \
  `selector` TEXT, \
  `check_interval` INTEGER, \
  `html` TEXT NOT NULL DEFAULT '', \
  `crc` INTEGER NOT NULL DEFAULT 0, \
  `updated` INTEGER, \
  `last_check` INTEGER, \
  `last_changed` INTEGER \
);";

/*******************************************************************************
*                                  Utilities                                   *
*******************************************************************************/

(function() {
  var table = [0x00000000, 0x77073096, 0xEE0E612C, 0x990951BA, 0x076DC419, 0x706AF48F, 0xE963A535, 0x9E6495A3, 0x0EDB8832, 0x79DCB8A4, 0xE0D5E91E, 0x97D2D988, 0x09B64C2B, 0x7EB17CBD, 0xE7B82D07, 0x90BF1D91, 0x1DB71064, 0x6AB020F2, 0xF3B97148, 0x84BE41DE, 0x1ADAD47D, 0x6DDDE4EB, 0xF4D4B551, 0x83D385C7, 0x136C9856, 0x646BA8C0, 0xFD62F97A, 0x8A65C9EC, 0x14015C4F, 0x63066CD9, 0xFA0F3D63, 0x8D080DF5, 0x3B6E20C8, 0x4C69105E, 0xD56041E4, 0xA2677172, 0x3C03E4D1, 0x4B04D447, 0xD20D85FD, 0xA50AB56B, 0x35B5A8FA, 0x42B2986C, 0xDBBBC9D6, 0xACBCF940, 0x32D86CE3, 0x45DF5C75, 0xDCD60DCF, 0xABD13D59, 0x26D930AC, 0x51DE003A, 0xC8D75180, 0xBFD06116, 0x21B4F4B5, 0x56B3C423, 0xCFBA9599, 0xB8BDA50F, 0x2802B89E, 0x5F058808, 0xC60CD9B2, 0xB10BE924, 0x2F6F7C87, 0x58684C11, 0xC1611DAB, 0xB6662D3D, 0x76DC4190, 0x01DB7106, 0x98D220BC, 0xEFD5102A, 0x71B18589, 0x06B6B51F, 0x9FBFE4A5, 0xE8B8D433, 0x7807C9A2, 0x0F00F934, 0x9609A88E, 0xE10E9818, 0x7F6A0DBB, 0x086D3D2D, 0x91646C97, 0xE6635C01, 0x6B6B51F4, 0x1C6C6162, 0x856530D8, 0xF262004E, 0x6C0695ED, 0x1B01A57B, 0x8208F4C1, 0xF50FC457, 0x65B0D9C6, 0x12B7E950, 0x8BBEB8EA, 0xFCB9887C, 0x62DD1DDF, 0x15DA2D49, 0x8CD37CF3, 0xFBD44C65, 0x4DB26158, 0x3AB551CE, 0xA3BC0074, 0xD4BB30E2, 0x4ADFA541, 0x3DD895D7, 0xA4D1C46D, 0xD3D6F4FB, 0x4369E96A, 0x346ED9FC, 0xAD678846, 0xDA60B8D0, 0x44042D73, 0x33031DE5, 0xAA0A4C5F, 0xDD0D7CC9, 0x5005713C, 0x270241AA, 0xBE0B1010, 0xC90C2086, 0x5768B525, 0x206F85B3, 0xB966D409, 0xCE61E49F, 0x5EDEF90E, 0x29D9C998, 0xB0D09822, 0xC7D7A8B4, 0x59B33D17, 0x2EB40D81, 0xB7BD5C3B, 0xC0BA6CAD, 0xEDB88320, 0x9ABFB3B6, 0x03B6E20C, 0x74B1D29A, 0xEAD54739, 0x9DD277AF, 0x04DB2615, 0x73DC1683, 0xE3630B12, 0x94643B84, 0x0D6D6A3E, 0x7A6A5AA8, 0xE40ECF0B, 0x9309FF9D, 0x0A00AE27, 0x7D079EB1, 0xF00F9344, 0x8708A3D2, 0x1E01F268, 0x6906C2FE, 0xF762575D, 0x806567CB, 0x196C3671, 0x6E6B06E7, 0xFED41B76, 0x89D32BE0, 0x10DA7A5A, 0x67DD4ACC, 0xF9B9DF6F, 0x8EBEEFF9, 0x17B7BE43, 0x60B08ED5, 0xD6D6A3E8, 0xA1D1937E, 0x38D8C2C4, 0x4FDFF252, 0xD1BB67F1, 0xA6BC5767, 0x3FB506DD, 0x48B2364B, 0xD80D2BDA, 0xAF0A1B4C, 0x36034AF6, 0x41047A60, 0xDF60EFC3, 0xA867DF55, 0x316E8EEF, 0x4669BE79, 0xCB61B38C, 0xBC66831A, 0x256FD2A0, 0x5268E236, 0xCC0C7795, 0xBB0B4703, 0x220216B9, 0x5505262F, 0xC5BA3BBE, 0xB2BD0B28, 0x2BB45A92, 0x5CB36A04, 0xC2D7FFA7, 0xB5D0CF31, 0x2CD99E8B, 0x5BDEAE1D, 0x9B64C2B0, 0xEC63F226, 0x756AA39C, 0x026D930A, 0x9C0906A9, 0xEB0E363F, 0x72076785, 0x05005713, 0x95BF4A82, 0xE2B87A14, 0x7BB12BAE, 0x0CB61B38, 0x92D28E9B, 0xE5D5BE0D, 0x7CDCEFB7, 0x0BDBDF21, 0x86D3D2D4, 0xF1D4E242, 0x68DDB3F8, 0x1FDA836E, 0x81BE16CD, 0xF6B9265B, 0x6FB077E1, 0x18B74777, 0x88085AE6, 0xFF0F6A70, 0x66063BCA, 0x11010B5C, 0x8F659EFF, 0xF862AE69, 0x616BFFD3, 0x166CCF45, 0xA00AE278, 0xD70DD2EE, 0x4E048354, 0x3903B3C2, 0xA7672661, 0xD06016F7, 0x4969474D, 0x3E6E77DB, 0xAED16A4A, 0xD9D65ADC, 0x40DF0B66, 0x37D83BF0, 0xA9BCAE53, 0xDEBB9EC5, 0x47B2CF7F, 0x30B5FFE9, 0xBDBDF21C, 0xCABAC28A, 0x53B39330, 0x24B4A3A6, 0xBAD03605, 0xCDD70693, 0x54DE5729, 0x23D967BF, 0xB3667A2E, 0xC4614AB8, 0x5D681B02, 0x2A6F2B94, 0xB40BBE37, 0xC30C8EA1, 0x5A05DF1B, 0x2D02EF8D];

  // Takes a string and returns its crc32 checksum.
  crc = function(str) {
    if (typeof str != 'string') return null;

    str = encodeUTF8(str);

    var length = str.length;
    var crc = 0xFFFFFFFF;

    for (var i = 0; i < length; i++) {
      crc = (crc >>> 8) ^ table[(crc & 0xFF) ^ str.charCodeAt(i)];
    }

    return crc ^ -1;
  };
})();

// Encodes a unicode string into a UTF-8 byte sequence.
// Adapted from code at http://www.webtoolkit.info/javascript-utf8.html.
function encodeUTF8(string) {
  var utftext = [];

  for (var n = 0; n < string.length; n++) {
    var c = string.charCodeAt(n);

    if (c < 128) {
      utftext.push(String.fromCharCode(c));
    } else if ((c > 127) && (c < 2048)) {
      utftext.push(String.fromCharCode((c >> 6) | 192));
      utftext.push(String.fromCharCode((c & 63) | 128));
    } else {
      utftext.push(String.fromCharCode((c >> 12) | 224));
      utftext.push(String.fromCharCode(((c >> 6) & 63) | 128));
      utftext.push(String.fromCharCode((c & 63) | 128));
    }
  }

  return utftext.join('');
}

// Returns a string describing the amount of time equivalent to the specified
// amount of milliseconds. Examples: '7 seconds', '1 hour', '3 hours 9 minutes',
// '40 days 10 hours'. The exact words returned depend on the current locale.
function describeTime(milliseconds) {
  var seconds = Math.floor(milliseconds / 1000);
  var minutes = Math.floor(seconds / 60) % 60;
  var hours = Math.floor(seconds / (60 * 60)) % 24;
  var days = Math.floor(seconds / (60 * 60 * 24));

  var label = '';

  if (days) {
    var singular = chrome.i18n.getMessage('day');
    var plural = chrome.i18n.getMessage('days', days.toString());
    label += (days == 1) ? singular : plural;
  }
  if (hours) {
    var singular = chrome.i18n.getMessage('hour');
    var plural = chrome.i18n.getMessage('hours', hours.toString());
    label += ' ' + ((hours == 1) ? singular : plural);
  }
  if (!days && minutes) {
    var singular = chrome.i18n.getMessage('minute');
    var plural = chrome.i18n.getMessage('minutes', minutes.toString());
    label += ' ' + ((minutes == 1) ? singular : plural);
  }
  if (!label) {
    var singular = chrome.i18n.getMessage('second');
    var plural = chrome.i18n.getMessage('seconds', seconds.toString());
    label += ' ' + ((seconds == 1) ? singular : plural);
  }

  return label.replace(/^\s+|\s+$/g, '');
}

// Returns a string describing the amount of time that has passed since the time
// specified in the timestamp argument. Examples: '7 seconds ago', '1 hour ago',
// '3 hours 27 minutes ago', '40 days 10 hours ago'. The exact words returned
// depend on the current locale.
function describeTimeSince(timestamp) {
  return chrome.i18n.getMessage('ago', describeTime(Date.now() - timestamp));
}

// Takes a string representation of an HTML document, discards everything
// outside the <body> element (if one exists), then strips <script> tags.
function getStrippedBody(html) {
  var body = html.match(/<body[^>]*>(?:([^]*)<\/body>([^]*)|([^]*))/i);
  if (body && body.length > 1) {
    if (body[2] && body[2].length > MIN_BODY_TAIL_LENGTH) {
      body = body[1] + ' ' + body[2];
    } else if (body[1] === undefined) {
      body = body[3];
    } else {
      body = body[1];
    }
  } else {
    body = html;
  }

  // We can't simply remove the script tags since that will invalidate the
  // selectors which include nth-child(). Instead, we replace them with an
  // unlikely tag.
  return body.replace(/<script\b[^>]*(?:>[^]*?<\/script>|\/>)/ig,
                      '<blink/>');
}

// Returns a chrome://favicon/... URL that points to the Chrome-cached favicon
// of the given URL.
function getFavicon(url) {
  return 'chrome://favicon/' + url;
}

// Takes all elements of the class "i18n" that have a title attribute from the
// current page, then looks up a localization message with the title as the ID.
// The result of the lookup is inserted into the element and the title is
// removed.
function applyLocalization() {
  $('.i18n[title]').each(function() {
    $(this).removeClass('i18n')
           .text(chrome.i18n.getMessage($(this).attr('title')))
           .attr('title', '');
  });
}

/*******************************************************************************
*                          Settings Storage Interface                          *
*******************************************************************************/

// Retrieves a named value from local storage.
function getSetting(name) {
  return JSON.parse(localStorage.getItem(name) || 'null');
}

// Stored a JSON-encodeable value in local storage with the specified name.
function setSetting(name, value) {
  localStorage.setItem(name, JSON.stringify(value));
}

// Remove the value previously stored in local storage with the specified name.
function delSetting(name) {
  localStorage.removeItem(name);
}

// Creates the pages table in the database if it does not already exist.
function initializeStorage(callback) {
  executeSql(DATABASE_STRUCTURE, $.noop, callback);
}

// Executes the specified SQL query with the specified arguments within a
// transaction. If resultCallback is specified, it is called with the result of
// the query. If transactionCallback is specified, it is called after the
// transaction is successful (if it is).
function executeSql(sql, args, resultCallback, transactionCallback) {
  DB.transaction(function(transaction) {
    transaction.executeSql(sql, args, function(_, result) {
      (resultCallback || $.noop)(result);
    });
  }, $.noop, (transactionCallback || $.noop));
}

// Converts an SQL result object into an ordinary array.
function sqlResultToArray(result) {
  var array = [];
  for (var i = 0; i < result.rows.length; i++) {
    array.push(result.rows.item(i));
  }
  return array;
}

// Retrieves a page object from the database given an URL and sends it through
// the callback. If no pages matches the URL, the callback is called with a null
// argument. Pages that do not define a custom check interval are returned with
// their check interval set to the global setting.
function getPage(url, callback) {
  if (!callback) return;

  executeSql('SELECT * FROM pages WHERE url = ?', [url], function(result) {
    console.assert(result.rows.length <= 1);
    if (result.rows.length) {
      var page = result.rows.item(0);
      if (!page.check_interval) {
        page.check_interval = getSetting(SETTINGS.check_interval);
      }
      callback(page);
    } else {
      callback(null);
    }
  });
}

// Retrieves an array of all monitored URLs and calls the callback with them as
// an argument.
function getAllPageURLs(callback) {
  if (!callback) return;

  executeSql('SELECT url FROM pages', [], function(result) {
    var urls = [];
    for (var i = 0; i < result.rows.length; i++) {
      urls.push(result.rows.item(i).url);
    }
    callback(urls);
  });
}

// Retrieves an array of all monitored pages and calls the callback with them as
// an argument.
function getAllPages(callback) {
  if (!callback) return;

  executeSql('SELECT * FROM pages', [], function(result) {
    callback(sqlResultToArray(result));
  });
}

// Retrieves an array of all pages that have been marked as updated and calls
// the callback with them as an argument.
function getAllUpdatedPages(callback) {
  if (!callback) return;

  executeSql('SELECT * FROM pages WHERE updated = 1', [], function(result) {
    callback(sqlResultToArray(result));
  });
}

// Updates a page, specified by its URL with new settings, and calls the
// callback once the update is applied. The settings object can contain any
// number of valid page properties. Invalid properties will not result in a call
// to the callback. An empty settings object will result in an immediate call to
// the callback.
function setPageSettings(url, settings, callback) {
  var buffer = [];
  var args = [];

  for (var name in settings) {
    buffer.push(name + ' = ?');
    if (typeof(settings[name]) == 'boolean') {
      settings[name] = new Number(settings[name]);
    }
    args.push(settings[name]);
  }
  args.push(url);

  if (buffer) {
    var query = 'UPDATE pages SET ' + buffer.join(', ') + ' WHERE url = ?';

    executeSql(query, args, null, callback);
  } else {
    (callback || $.noop)();
  }
}

// Registers a URL for monitoring and takes a snapshot of it. Redirects itself
// to the background page if needed. Calls BG.scheduleCheck() then the callback
// after the new page is successfully added (if it is). NOTE: If the supplied
// page is already monitored, the callback is not called.
function addPage(page, callback) {
  if (window != BG) return BG.addPage(page, callback);

  var query = "INSERT INTO pages(url, name, mode, regex, selector, \
                                 check_interval, html, crc, updated, \
                                 last_check, last_changed) \
               VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";

  executeSql(query, [
    page.url,
    page.name || chrome.i18n.getMessage('untitled', page.url),
    page.mode || 'text',
    page.regex || null,
    page.selector || null,
    page.check_interval || null,
    page.html || '',
    page.crc || 0,
    page.updated ? 1 : 0,
    Date.now(),
    page.last_changed || null
  ], null, function() {
    BG.takeSnapshot();
    BG.scheduleCheck();
    (callback || $.noop)();
  });
}

// Removes a page from the monitoring registry, then calls BG.scheduleCheck()
// and the callback once the page is successfully removed (even if the page did
// not exist in the first place.
function removePage(url, callback) {
  executeSql('DELETE FROM pages WHERE url = ?', [url], null, function() {
    BG.scheduleCheck();
    (callback || $.noop)();
  });
}

// Calls the callback with a boolean indicating whether the supplied URL is
// being monitored.
function isPageMonitored(url, callback) {
  executeSql('SELECT COUNT(*) FROM pages WHERE url = ?',
             [url], function(result) {
    var count = result.rows.item(0)['COUNT(*)'];
    console.assert(count <= 1);
    (callback || $.noop)(count == 1);
  });
}

/*******************************************************************************
*                              Cleaning & Hashing                              *
*******************************************************************************/

// Takes a page (HTML or text) and a MIME type (allowing a ;q=... suffix) and
// converts the page to its canonical form. For HTML and XML, this means
// collapsing spaces. For other types, no transformation is applied. Empty input
// results in empty output.
function canonizePage(page, type) {
  if (!page) return page;
  return type.match(/\b(x|xht|ht)ml\b/) ? page.replace(/\s+/g, ' ') : page;
}

// Searches for all matches of regex in text, formats them into a single string,
// then calls the callback with the result as an argument. If matching the regex
// takes more than REGEX_TIMEOUT, the matching is cancelled and the callback is
// called with a null argument.
function findAndFormatRegexMatches(text, regex, callback) {
  if (!callback) return;
  if (!regex) return callback('');

  var called = false;
  var worker = new Worker(REGEX_WORKER_PATH);

  function finishMatching(result) {
    if (!called) {
      called = true;
      worker.terminate();
      (callback || $.noop)(result ? result.data : null);
    }
  }

  worker.onmessage = finishMatching;
  worker.postMessage(JSON.stringify({
    command: 'run',
    text: text,
    regex: regex
  }));

  setTimeout(finishMatching, REGEX_TIMEOUT);
}

// Searches for all matches of selector in the body of the html string, formats
// them into a single string, then calls the callback with the result as an
// argument. If called with an invalid selector, the callback is called with a
// null.
function findAndFormatSelectorMatches(html, selector, callback) {
  try {
    var body = $('<body>').html(getStrippedBody(html));
    var result = $(selector, body).map(function() {
      return '"' + $('<div>').append(this).html() + '"';
    }).get().join('\n');

    (callback || $.noop)(result);
  } catch (e) {
    (callback || $.noop)(null);
  }
}

// Extract the text out of the HTML page, then calls the callback with the
// result as an argument. If no callback is provided, simply returns the result.
// The extraction includes:
// 1. Trimming everything outside of <body> through getStrippedBody().
// 2. Removing the contents of script, style, object, embed and applet tags.
// 3. Replacing images with their src, surrounded by "startimg" and "endimg".
// 4. Removing all tags.
// 5. Removing time, date and cardinality number suffixes (1st, 5pm, 3 weeks).
// 6. Removing all ASCII non-letter characters.
// 7. Casting all the result into lowercase.
function cleanHtmlPage(html, callback) {
  html = html.toLowerCase();
  // Get rid of everything outside the body.
  html = getStrippedBody(html);
  // Remove major non-text elements.
  html = html.replace(/<(script|style|object|embed|applet)[^>]*>[^]*?<\/\1>/g, '');
  // Replace images with their sources (to preserve after tag stripping).
  html = html.replace(/<img[^>]*src\s*=\s*['"]?([^<>"' ]+)['"]?[^>]*>/g,
                     '{startimg:$1:endimg}');
  // Strip tags.
  html = html.replace(/<[^>]*>/g, '');
  // Collapse whitespace.
  html = html.replace(/\s+/g, ' ');
  // Unescape HTML entities (&nbsp;, &amp;, numeric unicode entities, etc.).
  html = $('<div/>').html(html).text();
  // Remove numbers with common number suffixes. This helps with pages that
  // print out the current date/time or time since an item was posted.
  html = html.replace(/\d+ ?(st|nd|rd|th|am|pm|seconds?|minutes?|hours?|days?|weeks?|months?)\b/g, '');
  // Remove everything other than letters (unicode letters are preserved).
  html = html.replace(/[\x00-\x40\x5B-\x60\x7B-\xBF]/g, '');

  if (callback) {
    callback(html);
  } else {
    return html;
  }
}

// Calculates the CRC of a page, after cleaning it, and calls the callback with
// this CRC as an argument. If mode=regex and the regex parameter is set, the
// page is cleaned by replacing it with all the matches of this regex. If
// mode=selector and the selector parameter is set, the pages is cleaned by
// replacing it with the outerHTML of all matches of that selector. Otherwise
// cleaning means calling cleanHtmlPage() which pretty much extracts the text
// out of the HTML (see the function for more details).
function cleanAndHashPage(html, mode, regex, selector, callback) {
  if (!callback) return;

  function callBackWithCrc(result) {
    callback(crc(result || ''));
  }

  if (mode == 'regex' && regex) {
    findAndFormatRegexMatches(html, regex, callBackWithCrc);
  } else if (mode == 'selector' && selector) {
    findAndFormatSelectorMatches(html, selector, callBackWithCrc);
  } else {
    cleanHtmlPage(html, callBackWithCrc);
  }
}

/*******************************************************************************
*                                Page Checking                                 *
*******************************************************************************/

// Performs a check on the specified page, and updates its crc field with new
// info. If a change is detected, sets the updated flag on that page. Once the
// check is done and all updates are applied, the callback is called with the
// URL of the checked page.
//
// If the changes in the page did not result in a different CRC from the one
// recorded (e.g. changes in numbers only, or in non-selected parts during
// selective monitoring), or force_snapshot is checked, the html field of the
// page is updated. It is not updated when the CRC changes so that the diff
// viewer has a snapshot of the page before the latest update.
function checkPage(url, callback, force_snapshot) {
  getPage(url, function(page) {
    if (!page || page.updated) {
      (callback || $.noop)(url);
      return;
    }

    $.ajax({
      url: url,
      dataType: 'text',
      success: function(html, _, xhr) {
        var type = xhr.getResponseHeader('Content-type');
        cleanAndHashPage(html, page.mode, page.regex, page.selector,
                        function(crc) {
          var settings = {};

          if (crc != page.crc) {
            settings = {
              updated: true,
              crc: crc,
              html: force_snapshot ? canonizePage(html, type) : page.html,
              last_changed: Date.now()
            }
          } else {
            settings = { html: canonizePage(html, type) };
          }

          settings.last_check = Date.now();
          setPageSettings(url, settings, function() {
            (callback || $.noop)(url);
          });
        });
      },
      error: function() {
        setPageSettings(url, { last_check: Date.now() }, function() {
          (callback || $.noop)(url);
        });
      }
    });
  });
}

// Updates the HTML snapshot of the specified page, and calls the callback once
// it's saved.
function takeSnapshot(url, callback) {
  checkPage(url, function() {
    setPageSettings(url, { updated: false }, callback);
  }, true);
}

// Sets AJAX timeout and always prevents caching.
$.ajaxSetup({
  timeout: REQUEST_TIMEOUT,
  headers: {
    'Cache-Control': 'no-cache',
    'Etag': 'bad-etag'
  }
});
