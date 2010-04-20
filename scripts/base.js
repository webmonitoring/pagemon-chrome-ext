/*******************************************************************************
                                    Constants
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
  custom_sounds: 'custom_sounds'
};

// Reference to the background page.
var BG = chrome.extension.getBackgroundPage();

// Reference to the database.
var DB = openDatabase('pages', '1.0', 'Monitored Pages', 49 * 1024 * 1024);

/*******************************************************************************
                                    Utilities
*******************************************************************************/

// CRC Calculator - Taken from http://noteslog.com/post/crc32-for-javascript/ as
// per the MIT license.
(function() { 
  var table = "00000000 77073096 EE0E612C 990951BA 076DC419 706AF48F E963A535 9E6495A3 0EDB8832 79DCB8A4 E0D5E91E 97D2D988 09B64C2B 7EB17CBD E7B82D07 90BF1D91 1DB71064 6AB020F2 F3B97148 84BE41DE 1ADAD47D 6DDDE4EB F4D4B551 83D385C7 136C9856 646BA8C0 FD62F97A 8A65C9EC 14015C4F 63066CD9 FA0F3D63 8D080DF5 3B6E20C8 4C69105E D56041E4 A2677172 3C03E4D1 4B04D447 D20D85FD A50AB56B 35B5A8FA 42B2986C DBBBC9D6 ACBCF940 32D86CE3 45DF5C75 DCD60DCF ABD13D59 26D930AC 51DE003A C8D75180 BFD06116 21B4F4B5 56B3C423 CFBA9599 B8BDA50F 2802B89E 5F058808 C60CD9B2 B10BE924 2F6F7C87 58684C11 C1611DAB B6662D3D 76DC4190 01DB7106 98D220BC EFD5102A 71B18589 06B6B51F 9FBFE4A5 E8B8D433 7807C9A2 0F00F934 9609A88E E10E9818 7F6A0DBB 086D3D2D 91646C97 E6635C01 6B6B51F4 1C6C6162 856530D8 F262004E 6C0695ED 1B01A57B 8208F4C1 F50FC457 65B0D9C6 12B7E950 8BBEB8EA FCB9887C 62DD1DDF 15DA2D49 8CD37CF3 FBD44C65 4DB26158 3AB551CE A3BC0074 D4BB30E2 4ADFA541 3DD895D7 A4D1C46D D3D6F4FB 4369E96A 346ED9FC AD678846 DA60B8D0 44042D73 33031DE5 AA0A4C5F DD0D7CC9 5005713C 270241AA BE0B1010 C90C2086 5768B525 206F85B3 B966D409 CE61E49F 5EDEF90E 29D9C998 B0D09822 C7D7A8B4 59B33D17 2EB40D81 B7BD5C3B C0BA6CAD EDB88320 9ABFB3B6 03B6E20C 74B1D29A EAD54739 9DD277AF 04DB2615 73DC1683 E3630B12 94643B84 0D6D6A3E 7A6A5AA8 E40ECF0B 9309FF9D 0A00AE27 7D079EB1 F00F9344 8708A3D2 1E01F268 6906C2FE F762575D 806567CB 196C3671 6E6B06E7 FED41B76 89D32BE0 10DA7A5A 67DD4ACC F9B9DF6F 8EBEEFF9 17B7BE43 60B08ED5 D6D6A3E8 A1D1937E 38D8C2C4 4FDFF252 D1BB67F1 A6BC5767 3FB506DD 48B2364B D80D2BDA AF0A1B4C 36034AF6 41047A60 DF60EFC3 A867DF55 316E8EEF 4669BE79 CB61B38C BC66831A 256FD2A0 5268E236 CC0C7795 BB0B4703 220216B9 5505262F C5BA3BBE B2BD0B28 2BB45A92 5CB36A04 C2D7FFA7 B5D0CF31 2CD99E8B 5BDEAE1D 9B64C2B0 EC63F226 756AA39C 026D930A 9C0906A9 EB0E363F 72076785 05005713 95BF4A82 E2B87A14 7BB12BAE 0CB61B38 92D28E9B E5D5BE0D 7CDCEFB7 0BDBDF21 86D3D2D4 F1D4E242 68DDB3F8 1FDA836E 81BE16CD F6B9265B 6FB077E1 18B74777 88085AE6 FF0F6A70 66063BCA 11010B5C 8F659EFF F862AE69 616BFFD3 166CCF45 A00AE278 D70DD2EE 4E048354 3903B3C2 A7672661 D06016F7 4969474D 3E6E77DB AED16A4A D9D65ADC 40DF0B66 37D83BF0 A9BCAE53 DEBB9EC5 47B2CF7F 30B5FFE9 BDBDF21C CABAC28A 53B39330 24B4A3A6 BAD03605 CDD70693 54DE5729 23D967BF B3667A2E C4614AB8 5D681B02 2A6F2B94 B40BBE37 C30C8EA1 5A05DF1B 2D02EF8D";     

  // Takes a string and returns its crc32 number. 
  crc = function(str) { 
    var crc = 0; 
    var n = 0; // A number between 0 and 255.
    var x = 0; // A hex number.

    crc = crc ^ (-1); 
    for (var i = 0, iTop = str.length; i < iTop; i++) { 
      n = ( crc ^ str.charCodeAt( i ) ) & 0xFF; 
      x = '0x' + table.substr( n * 9, 8 ); 
      crc = ( crc >>> 8 ) ^ x; 
    } 
    return crc ^ (-1); 
  }; 
})();

// Returns the extension version, as defined in the manifest.
chrome.extension.getVersion = function() {
  if (!chrome.extension.version_) {
    var manifest = $.ajax({ url: 'manifest.json', async: false }).responseText;
    manifest = JSON.parse(manifest || 'null');
    if (manifest) {
      chrome.extension.version_ = manifest.version;
    }
  }
  
  return chrome.extension.version_; 
};

// Returns a string describing the amount of time that has passed since the time
// specified in the timestamp argument. Examples: '7 seconds ago', '1 hour ago',
// '3 hours 27 minutes ago', '40 days 10 hours 17 minutes ago'.
function describeTimeSince(timestamp) {
  var time_delta = new Date().getTime() - timestamp;
  var seconds = Math.floor(time_delta / 1000);
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
  
  label = chrome.i18n.getMessage('ago', label.replace(/^\s+|\s+$/g, ''));
  
  return label;
}

// Takes a string representation of an HTML document, tries to crop everything
// outside the <body> element, then strips <script> tags.
function getStrippedBody(html) {
  var body = html.match(/<body[^>]*>([^]*)(<\/body>)?/i);
  if (body && body.length > 1) {
    body = body[1];
  } else {
    body = html;
  }
  
  return body.replace(/<script\b[^>]*>([^]*?<\/script>)?/ig, '');
}

/*******************************************************************************
                             Settings Storage Interface
*******************************************************************************/

function getSetting(name) {
  return JSON.parse(localStorage.getItem(name) || 'null');
}

function setSetting(name, value) {
  localStorage.setItem(name, JSON.stringify(value));
}

function getPage(url, callback) {
  if (callback === null) return;
  
  DB.readTransaction(function(transaction) {
    transaction.executeSql('SELECT * FROM pages WHERE url = ?', [url], function(_, result) {
      if (result.rows.length == 1) {
        var page = result.rows.item(0);
        if (!page.check_interval) page.check_interval = getSetting(SETTINGS.check_interval);
        callback(page);
      } else {
        callback(null);
      }
    });
  });
}

// Returns an array of all monitored URLs.
function getAllPageURLs(callback) {
  if (callback === null) return;
  
  DB.readTransaction(function(transaction) {
    transaction.executeSql('SELECT url FROM pages', [], function(_, result) {
      var pages = [];
      for (var i = 0; i < result.rows.length; i++) {
        pages.push(result.rows.item(i).url);
      }
      callback(pages);
    });
  });
}

// Returns an array of all monitored pages.
function getAllPages(callback) {
  if (callback === null) return;
  
  DB.readTransaction(function(transaction) {
    transaction.executeSql('SELECT * FROM pages', [], function(_, result) {
      var pages = [];
      for (var i = 0; i < result.rows.length; i++) {
        pages.push(result.rows.item(i));
      }
      callback(pages);
    });
  });
}

// Returns an array of pages that are marked as updated.
function getAllUpdatedPages(callback) {
  if (callback === null) return;
  
  DB.readTransaction(function(transaction) {
    transaction.executeSql('SELECT * FROM pages WHERE updated = 1', [], function(_, result) {
      var pages = [];
      for (var i = 0; i < result.rows.length; i++) {
        pages.push(result.rows.item(i));
      }
      callback(pages);
    });
  });
}

function setPageSettings(url, settings, callback) {
  if (settings.length == 0) return;
  
  DB.transaction(function(transaction) {
    buffer = [];
    args = [];
    for (var i in settings) {
      buffer.push(i + ' = ?');
      if (settings[i] === true || settings[i] === false) settings[i] += 0;
      args.push(settings[i]);
    }
    args.push(url);
    transaction.executeSql('UPDATE pages SET ' + buffer.join(', ') + ' WHERE url = ?', args);
  }, $.noop, (callback || $.noop));
}

function executeSql(sql, args, resultCallback, transactionCallback) {
  DB.transaction(function(transaction) {
    transaction.executeSql(sql, args, function(_, result) {
      (resultCallback || $.noop)(result);
    });
  }, $.noop, (transactionCallback || $.noop));
}

function sqlResultToArray(result) {
  var array = [];
  for (var i = 0; i < result.rows.length; i++) {
    array.push(result.rows.item(i));
  }
  return array;
}

/*******************************************************************************
                               Cleaning & Hashing
*******************************************************************************/

// Searches for all matches of regex in text and returns them in a formatted
// form. WARNING: this is blocking, and may take a while.
function findAndFormatRegexMatches(text, regex) {
  if (!regex) return '';

  var results = [];
  var match = null;
  regex = new RegExp(regex, 'g');
  
  while (true) {
    match = regex.exec(text, regex.lastIndex);
    if (!match || match.join('').length == 0) break;
    
    if (match.length == 1) {
      // If there were no captured groups, append the whole match.
      results.push('"' + match[0] + '"');
    } else {
      // Append all capture groups but not the whole match.
      results.push('"' + match.slice(1).join('", "') + '"');
    }
  }
  
  return results.join('\n');
}

// Searches for all matches of selector in the html (a string) and returns them
// in a formatted form.
function findAndFormatSelectorMatches(html, selector) {
  var body = $('<body>').html(getStrippedBody(html));
  
  return $(selector, body).map(function() {
    return '"' + $('<div>').append(this).html() + '"';
  }).get().join('\n');
}

// Returns the CRC of a page, after cleaning it. If mode=regex and the regex
// parameter is set, the page is cleaned by replacing it with all the matches of
// this regex. If mode=selector and the selector parameter is set, the pages is
// cleaned by replacing it with the innerHTML of all matches of that selector.
// Otherwise cleaning means that all tags and non-letters are stripped.
function cleanAndHashPage(html, mode, regex, selector) {
  if (!mode) mode = regex ? 'regex' : 'text';
  
  if (mode == 'regex' && regex != null && regex != undefined) {
    html = findAndFormatRegexMatches(html, regex);
  } else if (mode == 'selector' && selector != null && selector != undefined) {
    html = findAndFormatSelectorMatches(html, selector);
  } else {
    html = html.toLowerCase();
    // Get rid of everything before and after the body.
    html = html.replace(/[^]*<body[^>]*>/, '');
    html = html.replace(/([^]*)<\/body[^>]*>[^>]*/, '$1');
    // Remove major non-text elements.
    html = html.replace(/<(script|style|object|embed|applet)[^>]*>[^]*?<\/\1>/g, '');
    // Replace images with their sources (to preserve after tag stripping).
    html = html.replace(/<img[^>]*src\s*=\s*([^]+?)\b[^>]*>/g, '{imgsrc:$1}');
    // Strip tags.
    html = html.replace(/<[^>]*>/g, '');
    // Collapse whitespace.
    html = html.replace(/\s+/g, ' ');
    // Remove numbers with common number suffixes. This helps with pages that
    // print out the current date/time or time since an item was posted.
    html = html.replace(/\d+ ?(st|nd|rd|th|am|pm|seconds?|minutes?|hours?|days?|weeks?|months?)\b/g, '');
    // Remove everything other than letters (note - unicode letters are preserved).
    html = html.replace(/[\x00-\x40\x5B-\x60\x7B-\xBF]/g, '');
  }
  
  return crc(html);
}

/*******************************************************************************
                              Adding & Removing Pages
*******************************************************************************/

// Registers a URL for monitoring and takes a snapshot of it. Redirects itself
// to the background page if needed.
function addPage(page, callback) {
  if (window != BG) return BG.addPage(page, callback);

  var html = '';
  $.ajax({
    url: page.url,
    dataType: 'text',
    complete: function() {
      DB.transaction(function(transaction) {
        transaction.executeSql('INSERT INTO pages VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [
          page.url,
          page.name || chrome.i18n.getMessage('untitled', page.url),
          page.mode || 'text',
          page.regex || null,
          page.selector || null,
          page.timeout || null,
          page.html || html,
          cleanAndHashPage(html, 'text'),
          page.icon || null,
          page.updated ? 1 : 0,
          new Date().getTime(),
          page.last_changed || null
        ], (callback || $.noop));
      });
      scheduleCheck();
    },
    success: function(x) {
      html = x;
    }
  });
}

// Removes a page from the monitoring registry and deletes all settings related
// to it.
function removePage(url, callback) {
  DB.transaction(function(transaction) {
    transaction.executeSql('DELETE FROM pages WHERE url = ?', [url], function() {
      BG.scheduleCheck();
      (callback || $.noop)();
    });
  });
}

// Returns a boolean indicating whether the supplied URL is being monitored.
function isPageMonitored(url, callback) {
  DB.readTransaction(function(transaction) {
    transaction.executeSql('SELECT COUNT(*) FROM pages WHERE url = ?', [url], function(_, result) {
      (callback || $.noop)(result.rows.item(0)['COUNT(*)'] == 1);
    });
  });
}

/*******************************************************************************
                                  Page Checking
*******************************************************************************/

// Fetches the page, marks it as updated if necessary, and reschedules itself.
// For the scheduling to work, it MUST run on the background page. Calls from
// other pages are automatically redirected to the background page.
function checkPage(url, callback, force_snapshot) {
  console.log('Checking ' + url);
  DB.readTransaction(function(transaction) {
    transaction.executeSql('SELECT updated FROM pages WHERE url = ?', [url], function(_, result) {
      // If page is already marked as updated, skip check.
      if (result.rows.item(0).updated) {
        (callback || $.noop)(url);
      } else {
        $.ajax({
          url: url,
          dataType: 'text',
          success: function(html) {
            if (!html) return;
            
            getPage(url, function(page) {
              var crc = cleanAndHashPage(html, page.mode, page.regex, page.selector);
              var settings = {};
              
              if (crc != page.crc) {
                console.log('Setting updated = true');
                settings = {
                  updated: true,
                  crc: crc,
                  html: force_snapshot ? html.replace(/\s+/g, ' ') : page.html,
                  last_changed: new Date().getTime()
                }
              } else {
                settings = { html: html.replace(/\s+/g, ' ') };
              }
              
              settings['last_check'] = new Date().getTime();
              setPageSettings(url, settings, function() {
                (callback || $.noop)(url);
              });
            });
          },
          error: function() {
            setPageSettings(url, { last_check: new Date().getTime() }, function() {
              (callback || $.noop)(url);
            });
          }
        });
      }
    });
  });
}

function takeSnapshot(url, callback) {
  checkPage(url, function() {
    console.log('Setting updated = false');
    setPageSettings(url, { updated: false }, callback);
  }, true);
}