/*******************************************************************************
                                 Global Constants
*******************************************************************************/

// The address to check when testing for network availability.
var RELIABLE_CHECKPOINT = 'http://www.google.com/';

// Maximum timeout (in milliseconds) when checking for network availability.
var RELIABILITY_TIMEOUT = 10000;

// The delay (in milliseconds) to wait after a check attempt that failed due to
// the network being down.
var RESCHEDULE_DELAY = 15 * 60 * 1000;

// The delay (in milliseconds) to wait before updating the badge when an updated
// page is detected. See scheduleBadgeUpdate().
var BADGE_UPDATE_DELAY = 10 * 1000;

// Browser action icon.
var BROWSER_ICON = 'img/browser_icon.png';

// Setting names.
var SETTINGS = {
  timeout: 'timeout',
  badge_color: 'badge_color',
  version: 'version',
  pages_list: 'pages',
  sound_alert: 'sound_alert',
  page: {
    name: 'name',
    regex: 'regex',
    timeout: 'timeout',
    timeout_id: 'timeout_id',
    html: 'html',
    crc: 'crc',
    icon: 'icon',
    updated: 'updated',
    last_check: 'last_check'
  }
};

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
    manifest = JSON.parse(manifest);
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
  var time_delta = (new Date()).getTime() - timestamp;
  var seconds = Math.floor(time_delta / 1000);
  var minutes = Math.floor(seconds / 60) % 60;
  var hours = Math.floor(seconds / (60 * 60)) % 24;
  var days = Math.floor(seconds / (60 * 60 * 24));
  
  var label = '';
  
  if (days) label += days + ((days == 1) ? ' day ' : ' days ');
  if (hours) label += hours + ((hours == 1) ? ' hour ' : ' hours ');
  if (minutes) label += minutes + ((minutes == 1) ? ' minute ' : ' minutes ');
  if (!label) label += seconds + ((seconds == 1) ? ' second ' : ' seconds ');
  label += 'ago';
  
  return label;
}

/*******************************************************************************
                             Settings Storage Interface
*******************************************************************************/

function getSetting(name) {
  return JSON.parse(localStorage.getItem(name));
}

function setSetting(name, value) {
  localStorage.setItem(name, JSON.stringify(value));
}

function deleteSetting(name) {
  delete localStorage[name];
}

function getPageSetting(url, name) {
  return getSetting(url + ' ' + name);
}

 function setPageSetting(url, name, value) {
  setSetting(url + ' ' + name, value);
}

function deletePageSetting(url, name) {
  deleteSetting(url + ' ' + name);
}

// Returns the page's timeout, or if not set, the global timeout.
function getPageTimeout(url) {
  var timeout = getPageSetting(url, SETTINGS.page.timeout);
  
  if (timeout === null || timeout === undefined) {
    timeout = getSetting(SETTINGS.timeout);
  }
  
  return timeout;
}

/*******************************************************************************
                               Cleaning & Hashing
*******************************************************************************/

// Searches for all matches of regex in text and returns them in a formatted
// form. WARNING: this is blocking, and may take a while.
function findAndFormatRegexMatches(text, regex) {
  var results = [];
  var match = null;
  regex = new RegExp(regex, 'g');
  
  while (match = regex.exec(text, regex.lastIndex)) {
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

// Returns the CRC of a page, after cleaning it. If the regex parameter is
// specified, the page is cleaned by replacing it with all the matches of this
// regex. Otherwise cleaning means that all tags and non-letters are stripped.
function cleanAndHashPage(html, regex) {
  if (regex) {
    html = findAndFormatRegexMatches(html, regex);
  } else {
    html = html.toLowerCase();
    // Get rid of everything before and after the body.
    html = html.replace(/[^]*<body[^>]*>/, '');
    html = html.replace(/([^]*)<\/body[^>]*>[^>]*/, '$1');
    // Remove major non-text elements.
    html = html.replace(/<(script|style|object|embed|applet)[^>]*>[^]*?<\/\1>/g, '');
    // Replace images with their sources (to preserve after tag stripping).
    html = html.replace(/<img[^>]*src\s*=\s*(.+?)\b[^>]*>/g, '{imgsrc:$1}');
    // Strip tags.
    html = html.replace(/<[^>]*>/g, '');
    // Collapse whitespace.
    html = html.replace(/\s+/g, ' ');
    // Remove numbers with common number prefixes. This helps with pages that
    // print out the current date/time.
    html = html.replace(/\d+\s?(st|nd|rd|th|am|pm)\b/g, '');
    // Remove everything other than letters.
    html = html.replace(/[\x00-\x40\x5B-\x60\x7B-\xBF]/g, '');
  }
  
  return crc(html);
}

/*******************************************************************************
                              Adding & Removing Pages
*******************************************************************************/

// Registers a URL for monitoring, takes a snapshot of it, and calls the
// optional callback once the snapshot is successfully taken.
function addPage(url, name, icon) {
  // Make sure this is running on the background page. If not, redirect.
  var bg = chrome.extension.getBackgroundPage();
  if (bg != window) {
    return bg.addPage(url, name, icon);
  }
  
  var pages = getSetting(SETTINGS.pages_list);
  pages.push(url);
  setSetting(SETTINGS.pages_list, pages);
  
  if (name) setPageSetting(url, SETTINGS.page.name, name);
  if (icon) setPageSetting(url, SETTINGS.page.icon, icon);
  setPageSetting(url, SETTINGS.page.updated, false);
  
  $.get(url, function(html) {
    setPageSetting(url, SETTINGS.page.html, html.replace(/\s+/g, ' '));
    setPageSetting(url, SETTINGS.page.crc, cleanAndHashPage(html));
    setPageSetting(url, SETTINGS.page.last_check, (new Date()).getTime());
    
    var timeout = getSetting(SETTINGS.timeout);
    var timeout_id = setTimeout(function() { checkPage(url); }, timeout);
    setPageSetting(url, SETTINGS.page.timeout_id, timeout_id);
  });
}

// Removes a page from the monitoring registry and deletes all settings related
// to it.
function removePage(url) {
  var pages = getSetting(SETTINGS.pages_list);
  var new_pages = [];
  
  $.each(pages, function(i, url2) {
    if (url != url2) {
      new_pages.push(url2);
    }
  });
  
  setSetting(SETTINGS.pages_list, new_pages);
  
  $.each(SETTINGS.page, function(k, name) {
    deletePageSetting(url, name);
  });
}

// Returns a boolean indicating whether the supplied URL is being monitored.
function isPageMonitored(url) {
  return $.inArray(url, getSetting(SETTINGS.pages_list)) != -1;
}

// Returns an array of URLs indicating all pages that are marked as updated.
function getAllUpdatedPages() {
  var pages = getSetting(SETTINGS.pages_list);
  var updated_pages = [];
  
  $.each(pages, function(i, url) {
    if (getPageSetting(url, SETTINGS.page.updated) === true) {
      updated_pages.push(url);
    }
  });
  
  return updated_pages;
}

/*******************************************************************************
                                Badge Updating
*******************************************************************************/

(function() {
  // Some update-related state.
  var last_badge_text = '';
  var badge_update_timeout_id = null;

  // Checks if any pages are marked as updated, and if so, displays their count
  // on the browser action badge, highlighting it. If no pages are updated and
  // the badge is displayed, removes it and switches to the "incative" icon".
  updateBadge = function() {
    // Make sure this is running on the background page. If not, redirect.
    var bg = chrome.extension.getBackgroundPage();
    if (bg != window) {
      return bg.updateBadge();
    }
    
    var updated_count = getAllUpdatedPages().length;
    var updated_message = (updated_count > 0) ? updated_count.toString() : '';

    chrome.browserAction.setBadgeBackgroundColor({
      color: getSetting(SETTINGS.badge_color)
    });
    chrome.browserAction.setBadgeText({ text: updated_message });
    chrome.browserAction.setIcon({ path: BROWSER_ICON });
  
    var sound_alert = getSetting(SETTINGS.sound_alert);
    if (updated_message != '' && last_badge_text == '' && sound_alert) {
      (new Audio(sound_alert)).play();
    }
    
    last_badge_text = updated_message;
  }

  // Schedules a badgeUpdate() call within BADGE_UPDATE_DELAY milliseconds. If
  // called before the timeout is reached, it is cancelled and rescheduled again.
  scheduleBadgeUpdate = function() {
    // Make sure this is running on the background page. If not, redirect.
    var bg = chrome.extension.getBackgroundPage();
    if (bg != window) {
      return bg.scheduleBadgeUpdate();
    }
    
    if (badge_update_timeout_id !== null) {
      clearTimeout(badge_update_timeout_id);
    }
    
    badge_update_timeout_id = setTimeout(function() {
      updateBadge();
      badge_update_timeout_id = null;
    }, BADGE_UPDATE_DELAY);
  };
})();

/*******************************************************************************
                                 Actual Monitoring
*******************************************************************************/

// Fetches the page, marks it as updated if necessary, and reschedules itself.
// For the scheduling to work, it MUST run on the background page. Calls from
// other pages are automatically redirected to the background page.
function checkPage(url, callback) {
  // Make sure this is running on the background page. If not, redirect.
  var bg = chrome.extension.getBackgroundPage();
  if (bg != window) {
    return bg.checkPage(url, callback);
  }
  
  // If page is already marked as updated, skip check.
  if (getPageSetting(url, SETTINGS.page.updated) == true) {
    schedulePageCheck(url);
    (callback || $.noop)();
  } else {
    $.ajax({
      type: 'HEAD',
      url: RELIABLE_CHECKPOINT,
      timeout: RELIABILITY_TIMEOUT,
      error: function() {
        // Network down. Reschedule check.
        clearTimeout(getPageSetting(url, SETTINGS.page.timeout_id));
        var timeout_id = setTimeout(function() {
          checkPage(url);
        }, RESCHEDULE_DELAY);
        setPageSetting(url, SETTINGS.page.timeout_id, timeout_id);
        (callback || $.noop)();
      },
      success: function() {
        // Network up do the check.
        $.get(url, function(html) {
          var regex = getPageSetting(url, SETTINGS.page.regex);
          var crc = cleanAndHashPage(html, regex);
          
          if (crc != getPageSetting(url, SETTINGS.page.crc)) {
            setPageSetting(url, SETTINGS.page.updated, true);
            setPageSetting(url, SETTINGS.page.crc, crc);
          } else {
            setPageSetting(url, SETTINGS.page.html, html.replace(/\s+/g, ' '));
          }
          
          // Schedule next check and mark check time.
          schedulePageCheck(url);
          setPageSetting(url, SETTINGS.page.last_check, (new Date()).getTime());
          
          scheduleBadgeUpdate();
          (callback || $.noop)();
        });
      }
    });
  }
}

// Schedules a check for the given page. Overrides pending checks. MUST run on
// the background page; redirected if not.
function schedulePageCheck(url) {
  // Make sure this is running on the background page. If not, redirect.
  var bg = chrome.extension.getBackgroundPage();
  if (bg != window) {
    return bg.schedulePageCheck(url);
  }

  clearTimeout(getPageSetting(url, SETTINGS.page.timeout_id));
  var timeout = getPageTimeout(url);
  var timeout_id = setTimeout(function() { checkPage(url); }, timeout);
  setPageSetting(url, SETTINGS.page.timeout_id, timeout_id);
}
