// The amount of milliseconds to wait per callback when stopping a test.
var TEST_WAIT = 1000000;
// The default properties of a page object (excluding url and name).
var DEFAULT_PAGE = {
  mode: "text",
  regex: null,
  selector: null,
  check_interval: null,
  html: '',
  crc: 0,
  updated: null,
  last_check: null,
  last_changed: null
};
// A dummy page object with filled properties.
var DUMMY_PAGE = {
  url: 'dummy',
  name: 'dummy',
  mode: 'c',
  regex: 'd',
  selector: 'e',
  html: 'f',
  updated: 0,
  last_check: 123,
  last_changed: 456,
  check_interval: 789,
  crc: crc('f')
};

// Setup/Teardown.
(function() {
  var local_storage_backup = null;
  var db_backup = null;
  var regex_worker_backup = null;

  QUnit.moduleStart = function(name) {
    console.log('Start ' + name);
    switch(name) {
      case 'Local Storage':
        local_storage_backup = {};
        for (var prop in localStorage) {
          if (localStorage.hasOwnProperty(prop)) {
            local_storage_backup[prop] = localStorage[prop];
          }
        }
        localStorage.clear();
        break;
      case 'SQL Database':
      case 'Page Checking':
        db_backup = DB;
        DB = openDatabase('test', '1.0', 'Monitored Pages', 49 * 1024 * 1024);
        stop();
        DB.transaction(function(transaction) {
          transaction.executeSql(BG.DATABASE_STRUCTURE, [], function() {
            transaction.executeSql('DELETE FROM pages', [], function() {
              start();
            });
          });
        });
        break;
      case 'Cleaning and Hashing':
        regex_worker_backup = REGEX_WORKER_PATH;
        REGEX_WORKER_PATH = '../scripts/regex.js';
        break;
    }
  }

  QUnit.moduleDone = function(name, failures, total) {
    if (total == 0) return;
    console.log('Done  ' + name);
    switch(name) {
      case 'Local Storage':
        localStorage.clear();
        for (var prop in local_storage_backup) {
          if (local_storage_backup.hasOwnProperty(prop)) {
            localStorage.setItem(prop, local_storage_backup[prop]);
          }
        }
        break;
      case 'SQL Database':
      case 'Page Checking':
        stop();
        DB.transaction(function(transaction) {
          transaction.executeSql('DROP TABLE pages', [], function() {
            start();
          });
        });
        DB = db_backup;
        break;
      case 'Cleaning and Hashing':
        REGEX_WORKER_PATH = regex_worker_backup;
        break;
    }
  }
})();

// Helper for asynchronous tests.
function delayedTest(name, callbacks, test_function) {
  test(name, function() {
    stop(TEST_WAIT * callbacks);
    var callbacks_remaining = callbacks;
    test_function(function() { if (--callbacks_remaining == 0) start(); });
  });
}

$(function() {
  /****************************************************************************/
  module('Constants');
  /****************************************************************************/

  test('Settings', function() {
    var count = 0;

    for (var setting in SETTINGS) {
      if (SETTINGS.hasOwnProperty(setting)) {
        equals(setting, SETTINGS[setting], 'Setting name equals value');
        count++;
      }
    }

    equals(count, 12, 'Setting strings count');
  });

  test('References', function() {
    ok(window.BG, 'BG is defined and non-null.');
    ok(window.DB, 'DB is defined and non-null.');
    ok(window.REGEX_TIMEOUT, 'REGEX_TIMEOUT is defined and nonzero.');
  });

  /****************************************************************************/
  module('Utilities');
  /****************************************************************************/

  test('crc', function() {
    equals(crc(''), 0, 'CRC of an empty string');
    equals(crc('abc'), 891568578, 'CRC of "abc"');
    equals(crc('123'), -2008521774, 'CRC of "123"');
    equals(crc(null), null, 'CRC of null');
    equals(crc([]), null, 'CRC of an empty array');
    equals(crc(123), null, 'CRC of a number');
  });

  test('describeTime (English)', function() {
    equals(describeTime(0), '0 seconds', '0ms');
    equals(describeTime(100), '0 seconds', '100ms');
    equals(describeTime(900), '0 seconds', '900ms');
    equals(describeTime(1100), '1 second', '1100ms');
    equals(describeTime(1900), '1 second', '1900ms');
    equals(describeTime(59 * 1000), '59 seconds', '59s');
    equals(describeTime(61 * 1000), '1 minute', '61s');
    equals(describeTime(10 * 60 * 1000), '10 minutes', '10m');
    equals(describeTime(60 * 60 * 1000), '1 hour', '60m');
    equals(describeTime(80 * 60 * 1000), '1 hour 20 minutes', '80m');
    equals(describeTime(3 * 60 * 60 * 1000), '3 hours', '3h');
    equals(describeTime(3.5 * 60 * 60 * 1000), '3 hours 30 minutes', '3.5h');
    equals(describeTime(24 * 60 * 60 * 1000), '1 day', '24h');
    equals(describeTime(24.5 * 60 * 60 * 1000), '1 day', '24.5h');
    equals(describeTime(28 * 60 * 60 * 1000), '1 day 4 hours', '28h');
    equals(describeTime(40 * 24 * 60 * 60 * 1000), '40 days', '40 days');
  });

  test('describeTimeSince (English)', function() {
    var BASE_TIMESTAMP = Math.pow(10, 10);
    var old_Date_now = Date.now;
    var old_describeTime = describeTime;

    Date.now = function() { return BASE_TIMESTAMP; };
    describeTime = function(milliseconds) {
      equal(milliseconds, 42, 'Milliseconds');
      return 'abc def ghi';
    }
    equal(describeTimeSince(BASE_TIMESTAMP - 42), 'abc def ghi ago',
          'Time description');

    Date.now = old_Date_now;
    describeTime = old_describeTime;
  });

  test('getStrippedBody', function() {
    equals(getStrippedBody(''), '', 'Empty string');

    equals(getStrippedBody('abc'), 'abc', 'Non-HTML string');

    equals(getStrippedBody('<html></html>'),
           '<html></html>',
           'Empty HTML');

    equals(getStrippedBody('<body></body>'),
           '',
           'Empty stripped body');

    equals(getStrippedBody('<body>abc</body>'),
           'abc',
           'Body with content');

    equals(getStrippedBody('<html><head></head><body>abc</body></html>'),
           'abc',
           'HTML with body');

    equals(getStrippedBody('<html><head></head><body>abc</html>'),
           'abc</html>',
           'HTML with unclosed body');

    equals(getStrippedBody('<html><head></head><body>abc</body><body>def' +
                           '</body></html>'),
           'abc</body><body>def',
           'HTML with 2 bodies');

    equals(getStrippedBody('<html><body>abc<script src="qwe"></script>def' +
                           '</body></html>'),
           'abc<blink/>def',
           'HTML with an external srcipt within body');

    equals(getStrippedBody('<html><body>abc<script src="qwe" />def</body>' +
                           '</html>'),
           'abc<blink/>def',
           'HTML with a self-closed external srcipt within body');

    equals(getStrippedBody('<html><body>abc<script>qwe</script></body></html>'),
           'abc<blink/>',
           'HTML with an internal script within body');

    equals(getStrippedBody('<html><body>abc<script>qwe</script>def<script src' +
                           '="hello" type="text/javascript"></script>ghi' +
                           '<script src="rty" />\n jkl</body></html>'),
           'abc<blink/>def<blink/>ghi<blink/>\n jkl',
           'HTML with multiple internal and external scripts within body');

    var old_MIN_BODY_TAIL_LENGTH = MIN_BODY_TAIL_LENGTH;
    MIN_BODY_TAIL_LENGTH = 4;
    equals(getStrippedBody('<html><head></head><body>abc</body>def'),
           'abc',
           'HTML with little content outside body');

    equals(getStrippedBody('<html><head></head><body>abc</body>defghi'),
           'abc defghi',
           'HTML with a lot of content outside body');
    MIN_BODY_TAIL_LENGTH = old_MIN_BODY_TAIL_LENGTH;
  });

  test('getFavicon', function() {
    equals(getFavicon('http://example.com/test.htm'),
           'chrome://favicon/http://example.com/test.htm',
           'Basic URL.');
    equals(getFavicon('http://example.com'),
           'chrome://favicon/http://example.com',
           'Path-less URL.');
    equals(getFavicon('bad url'),
           'chrome://favicon/bad url',
           'Invalid URL.');
  });

  test('applyLocalization', function() {
    old_getMessage = chrome.i18n.getMessage;
    chrome.i18n.getMessage = function(x) { return 'test:' + x; };

    applyLocalization();

    equals($('#applyLocalization_test span:eq(0)').text(), 'test:abc',
           'Ordinary span');
    equals($('#applyLocalization_test span:eq(1)').text(), 'test:def',
           'Span with previous content');
    equals($('#applyLocalization_test span:eq(2)').text(), 'test:ghi',
           'Span with another class');
    equals($('#applyLocalization_test span:eq(3)').text(), 'Old',
           'Untitled span');
    equals($('#applyLocalization_test label').text(), 'test:jkl',
           'Label');

    chrome.i18n.getMessage = old_getMessage;
  });

  /****************************************************************************/
  module('Local Storage');
  /****************************************************************************/

  test('(get/set/del)Setting', function() {
    equals(getSetting('test'), null, 'Non-existent setting');

    var test_cases = [
     ['', 'Empty String'],
     ['abc', 'Non-empty String'],
     [null, 'Null'],
     [false, 'False'],
     [123, 'Number'],
     [[], 'Empty array'],
     [[123, 'asd', true], 'Non-empty array'],
     [[123, [456, [], 789]], 'Nested array'],
     [{}, 'Empty object'],
     [{ a: 5 }, 'Non-empty object'],
     [{ a: 123, _: 'abc', bcd: [4, 5], $: { e: 6, f: 'd' } }, 'Nested object'],
    ];

    for (var i = 0; i<test_cases.length; i++) {
      var name = 'test_' + i;
      var tc = test_cases[i];

      equals(getSetting(name), null, tc[1] + ' (before)');
      setSetting(name, tc[0]);
      same(getSetting(name), tc[0], tc[1] + ' (set)');
      delSetting(name);
      equals(getSetting(name), null, tc[1] + ' (unset)');
    }
  });

  /****************************************************************************/
  module('SQL Database');
  /****************************************************************************/

  delayedTest('executeSql', 4, function(resume) {
    executeSql('SELECT * FROM pages', [], function() {
      ok(true, 'Result callback called.');
      resume();
    }, function() {
      ok(true, 'Transaction callback called.');
      resume();
    });

    executeSql('SELECT * FROM pages', [], function(result) {
      equals(result.rows.length, 0, 'Results rows before insertion');
      resume();
    });

    executeSql("INSERT INTO pages(url, name) VALUES(?, ?)", ['abc', 'def'],
               function() {
      executeSql('SELECT * FROM pages', [], function(result) {
        equals(result.rows.length, 1, 'Results rows after insertion');
        equals(result.rows.item(0).url, 'abc', 'Inserted URL');
        equals(result.rows.item(0).name, 'def', 'Inserted Name');
        executeSql('DELETE FROM pages', [], function() {
          executeSql('SELECT * FROM pages', [], function(result) {
            equals(result.rows.length, 0, 'Results rows after deletion');
            resume();
          });
        });
      });
    });
  });

  delayedTest('sqlResultToArray', 1, function(resume) {
    executeSql("INSERT INTO pages(url, name) VALUES('a', 'b')", [],
               function() {
      executeSql("INSERT INTO pages(url, name) VALUES('c', 'd')", [],
                 function() {
        executeSql('SELECT * FROM pages', [], function(result) {
          var expected = [{ url: 'a', name: 'b' }, { url: 'c', name: 'd' }];
          $.extend(expected[0], DEFAULT_PAGE);
          $.extend(expected[1], DEFAULT_PAGE);

          same(sqlResultToArray(result), expected, 'Converted array');

          executeSql('DELETE FROM pages', [], resume);
        });
      });
    });
  });

  delayedTest('addPage', 2, function(resume) {
    var old_scheduleCheck = BG.scheduleCheck;
    scheduleCheck = function() { ok(true, 'Check scheduled.'); resume(); };
    var old_BG  = BG;
    BG = window;
    var old_Date_now = Date.now;
    Date.now = function() { return 123;};

    executeSql('SELECT * FROM pages', [], function(result) {
      addPage(DUMMY_PAGE, function() {
        executeSql('SELECT * FROM pages', [], function(result) {
          result = sqlResultToArray(result);
          equals(result.length, 1, 'Inserted page count');
          same(result[0], DUMMY_PAGE, 'Inserted page');

          scheduleCheck = old_scheduleCheck;
          BG = old_BG;
          Date.now = old_Date_now;

          executeSql('DELETE FROM pages', [], resume);
        });
      });
    });
  });

  delayedTest('removePage', 2, function(resume) {
    var old_BG  = BG;
    BG = window;
    var old_scheduleCheck = BG.scheduleCheck;
    scheduleCheck = $.noop;

    addPage({ url: 'a', name: 'b' }, function() {
      addPage({ url: 'c', name: 'd' }, function() {
        scheduleCheck = function() { ok(true, 'Check scheduled.'); resume(); };

        removePage('a', function() {
          executeSql('SELECT * FROM pages', [], function(result) {
            result = sqlResultToArray(result);
            equals(result.length, 1, 'Remaining page count');
            equals(result[0].url, 'c', 'Remaining page URL');

            scheduleCheck = old_scheduleCheck;
            BG = old_BG;

            executeSql('DELETE FROM pages', [], resume);
          });
        });
      });
    });
  });

  delayedTest('getPage', 2, function(resume) {
    var old_BG  = BG;
    BG = window;
    var old_scheduleCheck = BG.scheduleCheck;
    scheduleCheck = $.noop;
    var old_Date_now = Date.now;
    Date.now = function() { return DUMMY_PAGE.last_check; };

    getPage('nonexistent', function(page) {
      equals(page, null, 'Non-existent page');
      resume();
    });

    addPage(DUMMY_PAGE, function() {
      addPage({ url: 'a', name: 'b' }, function() {
        getPage(DUMMY_PAGE.url, function(returned_page) {
          same(returned_page, DUMMY_PAGE, 'Existing page');

          scheduleCheck = old_scheduleCheck;
          BG = old_BG;
          Date.now = old_Date_now;

          executeSql('DELETE FROM pages', [], resume);
        });
      });
    });
  });

  delayedTest('getAllPageURLs', 1, function(resume) {
    var old_BG  = BG;
    BG = window;
    var old_scheduleCheck = BG.scheduleCheck;
    scheduleCheck = $.noop;

    getAllPageURLs(function(urls) {
      same(urls, [], 'URLs of empty list');

      addPage({ url: 'a', name: 'b' }, function() {
        addPage({ url: 'c', name: 'd' }, function() {
          getAllPageURLs(function(urls) {
            same(urls, ['a', 'c'], 'URLs after filling');

            scheduleCheck = old_scheduleCheck;
            BG = old_BG;

            executeSql('DELETE FROM pages', [], resume);
          });
        });
      });
    });
  });

  delayedTest('getAllPages', 1, function(resume) {
    var old_BG  = BG;
    BG = window;
    var old_scheduleCheck = BG.scheduleCheck;
    scheduleCheck = $.noop;
    var old_Date_now = Date.now;
    Date.now = function() { return DUMMY_PAGE.last_check; };

    getAllPages(function(pages) {
      same(pages, [], 'Empty pages list');

      var pages = [$.extend({}, DUMMY_PAGE), $.extend({}, DUMMY_PAGE)];
      $.extend(pages[0], { url: 'a', name: 'b' });
      $.extend(pages[1], { url: 'c', name: 'd' });

      addPage(pages[0], function() {
        addPage(pages[1], function() {
          getAllPages(function(returned_pages) {
            same(returned_pages, pages, 'Filled pages list');

            scheduleCheck = old_scheduleCheck;
            BG = old_BG;
            Date.now = old_Date_now;

            executeSql('DELETE FROM pages', [], resume);
          });
        });
      });
    });
  });

  delayedTest('getAllUpdatedPages', 1, function(resume) {
    var old_BG  = BG;
    BG = window;
    var old_scheduleCheck = BG.scheduleCheck;
    scheduleCheck = $.noop;

    getAllUpdatedPages(function(pages) {
      same(pages, [], 'Empty table');

      addPage({ url: 'a', name: 'b', updated: false }, function() {
        getAllUpdatedPages(function(pages) {
          same(pages, [], 'No updated pages');
          addPage({ url: 'c', name: 'd', updated: true }, function() {
            getAllUpdatedPages(function(pages) {
              equal(pages.length, 1, 'An updated page');
              equal(pages[0].url, 'c', 'Updated page URL');

              scheduleCheck = old_scheduleCheck;
              BG = old_BG;

              executeSql('DELETE FROM pages', [], resume);
            });
          });
        });
      });
    });
  });

  delayedTest('isPageMonitored', 2, function(resume) {
    var old_BG  = BG;
    BG = window;
    var old_scheduleCheck = BG.scheduleCheck;
    scheduleCheck = $.noop;

    isPageMonitored('nonexistent', function(is_monitored) {
      equals(is_monitored, false, 'Non-existent page');
      resume();
    });

    addPage(DUMMY_PAGE, function() {
      isPageMonitored(DUMMY_PAGE.url, function(is_monitored) {
        equals(is_monitored, true, 'Existing page');

        scheduleCheck = old_scheduleCheck;
        BG = old_BG;

        executeSql('DELETE FROM pages', [], resume);
      });
    });
  });

  delayedTest('setPageSettings', 1, function(resume) {
    var old_BG  = BG;
    BG = window;
    var old_scheduleCheck = BG.scheduleCheck;
    scheduleCheck = $.noop;
    var old_Date_now = Date.now;
    Date.now = function() { return DUMMY_PAGE.last_check; };

    var url = DUMMY_PAGE.url;

    addPage({ url: url, name: 'test' }, function() {
      getPage(url, function(page) {
        equals(page.name, 'test', 'Initial name');
        setPageSettings(url, DUMMY_PAGE, function() {
          getPage(url, function(page) {
            for (var prop in DUMMY_PAGE) {
              if (DUMMY_PAGE.hasOwnProperty(prop)) {
                equals(page[prop], DUMMY_PAGE[prop], prop + ' (dummy)');
              }
            }
            setPageSettings(url, { name: 'new_test' }, function() {
              getPage(url, function(page) {
                equals(page.name, 'new_test', 'Newly set name');

                scheduleCheck = old_scheduleCheck;
                BG = old_BG;
                Date.now = old_Date_now;

                executeSql('DELETE FROM pages', [], resume);
              });
            });
          });
        });
      });
    });
  });

  delayedTest('Storage of 6+ MB of data', 1, function(resume) {
    var large_string = Date.now() + '';

    while (large_string.length < (6 * (2 << 20))) {
      large_string = large_string + large_string;
    }

    executeSql("INSERT INTO pages(url, name, html) VALUES('a', 'b', ?)",
               [large_string], function() {
      executeSql('SELECT url, name, html FROM pages', [], function(result) {
        result = sqlResultToArray(result);

        equals(result.length, 1, 'Number of results');
        equals(result[0].url, 'a', 'Resulting URL');
        equals(result[0].name, 'b', 'Resulting name');

        // Not an equals() check to avoid printing out the large string.
        ok(result[0].html == large_string, 'Resulting HTML matched.');

        executeSql('DELETE FROM pages', [], resume);
      });
    });
  });

  /****************************************************************************/
  module('Cleaning and Hashing');
  /****************************************************************************/

  test('canonizePage', function() {
    equals(canonizePage('', 'text/plain'), '', 'Empty plain text.');
    equals(canonizePage('', 'text/html'), '', 'Empty HTML.');
    equals(canonizePage('', 'application/x-yz'), '', 'Empty other MIME type.');
    equals(canonizePage('abc  def\nghi\n\njkl', 'text/plain'),
           'abc  def\nghi\n\njkl',
           'Plain text with multiple spaces and lines breaks.');
    equals(canonizePage('abc  def\nghi\n\njkl', 'text/html'),
           'abc def ghi jkl',
           'HTML with multiple spaces and lines breaks.');
    equals(canonizePage('abc  def\nghi\n\njkl', 'application/x-yz'),
           'abc  def\nghi\n\njkl',
           'Other MIME type with multiple spaces and lines breaks.');
    equals(canonizePage('a\rb\nc\r\nd\n\r', 'text/plain'),
           'a\rb\nc\r\nd\n\r',
           'Plain text with mixed lines breaks (\\r and \\n).');
  });

  delayedTest('findAndFormatRegexMatches', 7, function(resume) {
    findAndFormatRegexMatches('abcde', '', function(result) {
      equals(result, '', 'Empty regex');
      resume();
    });
    findAndFormatRegexMatches('', 'abcde', function(result) {
      equals(result, '', 'Empty text');
      resume();
    });
    findAndFormatRegexMatches('abcde', 'bc', function(result) {
      equals(result, '"bc"', 'Regular string match; single');
      resume();
    });
    findAndFormatRegexMatches('abcdeabcde', 'bc', function(result) {
      equals(result, '"bc"\n"bc"', 'Regular string match; multiple');
      resume();
    });
    findAndFormatRegexMatches('abcde', '.{3}', function(result) {
      equals(result, '"abc"', 'Regex match; single');
      resume();
    });
    findAndFormatRegexMatches('abcde', '.{2}', function(result) {
      equals(result, '"ab"\n"cd"', 'Regex match; multiple');
      resume();
    });
    findAndFormatRegexMatches('abcde', '.{7}', function(result) {
      equals(result, '', 'Regex non-match');
      resume();
    });
  });

  delayedTest('findAndFormatRegexMatches (timeout)', 1, function(resume) {
    findAndFormatRegexMatches('abcde', '.{4}', function(result) {
      equals(result, '"abcd"', 'Regular timeout');

      var old_REGEX_TIMEOUT = REGEX_TIMEOUT;
      REGEX_TIMEOUT = 1;
      findAndFormatRegexMatches('abcde', '.{4}', function(result) {
        equals(result, null, '1ms timeout');
        REGEX_TIMEOUT = old_REGEX_TIMEOUT;
        resume();
      });
    });
  });

  delayedTest('findAndFormatSelectorMatches', 9, function(resume) {
    findAndFormatSelectorMatches('<div>test</div>', 'div', function(result) {
      equals(result, '"<div>test</div>"', 'A simple div');
      resume();
    });
    findAndFormatSelectorMatches('<span>test</span>', 'div', function(result) {
      equals(result, '', 'A non-existent div');
      resume();
    });
    findAndFormatSelectorMatches('<div class="test">test</div>',
                                 'div.test', function(result) {
      equals(result, '"<div class="test">test</div>"', 'A div with a class');
      resume();
    });
    findAndFormatSelectorMatches('<div>test</div>',
                                 'div.test', function(result) {
      equals(result, '', 'A non-existent div with a class');
      resume();
    });
    findAndFormatSelectorMatches('<html><body><span></span></body></html>',
                                 'span', function(result) {
      equals(result, '"<span></span>"', 'A span in the body');
      resume();
    });
    findAndFormatSelectorMatches('<html><span></span><body></body></html>',
                                 'span', function(result) {
      equals(result, '', 'A span outside of the body');
      resume();
    });
    findAndFormatSelectorMatches('<html><body><link></link></body></html>',
                                 'link', function(result) {
      equals(result, '"<link>"',
             'A <link> in the body (closing tags of this are ignored in HTML)');
      resume();
    });
    findAndFormatSelectorMatches('<html><link></link><body></body></html>',
                                 'link', function(result) {
      equals(result, '', 'A <link> outside of the body');
      resume();
    });
    findAndFormatSelectorMatches('<div class="a"><br><br></div>' +
                                 '<div class="b"><br><br></div>',
                                 '.a br', function(result) {
      equals(result, '"<br>"\n"<br>"', 'A pair of targeted <br>s');
      resume();
    });
  });

  delayedTest('cleanHtmlPage', 8, function(resume) {
    cleanHtmlPage('AbCDefG', function(cleaned) {
      equals(cleaned, 'abcdefg', 'Mixed capitalization');
      resume();
    });
    cleanHtmlPage('abc  \n def', function(cleaned) {
      equals(cleaned, 'abcdef', 'Removed spaces');
      resume();
    });
    cleanHtmlPage('abc123def', function(cleaned) {
      equals(cleaned, 'abcdef', 'Removed digits');
      resume();
    });
    cleanHtmlPage('a,.b!@#$c\\[]-=d&|e\t`~f', function(cleaned) {
      equals(cleaned, 'abcdef', 'Removed non-alphanumerics');
      resume();
    });
    cleanHtmlPage('abc<br>def<span>ghi</span>', function(cleaned) {
      equals(cleaned, 'abcdefghi', 'Removed tags');
      resume();
    });
    cleanHtmlPage('1st 2nd 3rd 4th 5am 6pm 7ab 8 seconds 9 minutes 10 hours ' +
                  '11 days 12 weeks 13 months 14 month 15 month(s) 16s 17secs' +
                  '18daysnobreak', function(cleaned) {
      equals(cleaned, 'absssecsdaysnobreak', 'Removed suffixes');
      resume();
    });
    cleanHtmlPage('<script>a</script>b<span>c</span>d' +
                  '<style type="text/css">e</style>f<pre>g</pre>h' +
                  '<object>i</object>j<embed>k</embed>l<applet>m</applet>n',
                  function(cleaned) {
      equals(cleaned, 'bcdfghjln', 'Remove non-text elements');
      resume();
    });
    cleanHtmlPage('<img title="a" src="b" alt="c" /><img src=\'d\'>' +
                  '<img src=e alt=f></img><img src=g>',
                  function(cleaned) {
      equals(cleaned,
             'startimgbendimgstartimgdendimgstartimgeendimgstartimggendimg',
             'Treatment of images');
      resume();
    });
  });

  test('cleanAndHashPage', function() {
    expect(8);

    var old_findAndFormatRegexMatches = findAndFormatRegexMatches;
    var old_findAndFormatSelectorMatches = findAndFormatSelectorMatches;
    var old_cleanHtmlPage = cleanHtmlPage;

    findAndFormatSelectorMatches = cleanHtmlPage = $.noop;
    findAndFormatRegexMatches = function(html, regex) {
      equals(html, 'h', 'HTML passed to regex extractor');
      equals(regex, 'r', 'Regex passed to regex extractor');
    }
    cleanAndHashPage('h', 'regex', 'r', 's', $.noop);

    findAndFormatRegexMatches = cleanHtmlPage = $.noop;
    findAndFormatSelectorMatches = function(html, selector) {
      equals(html, 'h', 'HTML passed to selector extractor');
      equals(selector, 's', 'Selector passed to selector extractor');
    }
    cleanAndHashPage('h', 'selector', 'r', 's', $.noop);

    findAndFormatRegexMatches = findAndFormatSelectorMatches = $.noop;
    cleanHtmlPage = function(html) {
      equals(html, 'h', 'HTML passed to html extractor');
    }
    cleanAndHashPage('h', 'text', 'r', 's', $.noop);
    cleanHtmlPage = function(html) {
      ok(true, 'HTML extractor called when mode=regex and regex=null.');
    }
    cleanAndHashPage('h', 'regex', null, 's', $.noop);
    cleanHtmlPage = function(html) {
      ok(true, 'HTML extractor called when mode=selector and selector=null.');
    }
    cleanAndHashPage('h', 'selector', 'r', null, $.noop);

    findAndFormatRegexMatches = findAndFormatSelectorMatches = $.noop;
    cleanHtmlPage = function(html, callback) {
      callback('h');
    }
    function callback(hash) {
      equals(hash, crc('h'), 'Callback called with hash');
    }
    cleanAndHashPage('h', 'text', null, null, callback);

    findAndFormatRegexMatches = old_findAndFormatRegexMatches;
    findAndFormatSelectorMatches = old_findAndFormatSelectorMatches;
    cleanHtmlPage = old_cleanHtmlPage;
  });

  /****************************************************************************/
  module('Page Checking');
  /****************************************************************************/

  delayedTest('checkPage', 1, function(resume) {
    expect(9);

    var old_BG  = BG;
    var old_scheduleCheck = BG.scheduleCheck;
    var old_Date_now = Date.now;
    var old_ajax = $.ajax;
    var old_setPageSettings = setPageSettings;
    BG = window;
    scheduleCheck = $.noop;
    Date.now = function() { return 123; };

    function shouldNotBeCalled() {
      ok(false, 'Ajax called when page is updated.');
    }

    function mockAjax(arg) {
      ok(true, 'Ajax called when page is not updated.');
      equals(arg.url, 'a', 'Ajaxed URL');
      equals(arg.dataType, 'text', 'Ajaxed data type');

      setPageSettings = function(url, update, callback) {
        equals(url, 'a', 'URL passed to the on-error callback');
        same(update, { last_check: 123 }, 'Update passed to on-error callback');
        ok(callback, 'A valid callback was passed to the on-error callback.');
      }
      arg.error();

      var mock_xhr = { getResponseHeader: function() { return 'text/plain'; } };

      setPageSettings = function(url, update, callback) {
        equals(url, 'a', 'URL passed to the success callback');
        same(update, {
          crc: crc('text'),
          html: '',
          last_changed: 123,
          last_check: 123,
          updated: true
        }, 'Update passed to success callback');
        ok(callback, 'A valid callback was passed to the on-error callback.');

        scheduleCheck = old_scheduleCheck;
        BG = old_BG;
        Date.now = old_Date_now;
        $.ajax = old_ajax;
        setPageSettings = old_setPageSettings;
        executeSql('DELETE FROM pages', [], resume);
      }
      arg.success('text', null, mock_xhr);
    }

    addPage({ url: 'a', mode: 'text', updated: true }, function() {
      $.ajax = shouldNotBeCalled;
      checkPage('a', function() {
        setPageSettings('a', { updated: false }, function() {
          $.ajax = mockAjax;
          checkPage('a', $.noop);
        });
      });
    });
  });

  test('takeSnapshot', function() {
    expect(4);

    var old_checkPage = checkPage;
    checkPage = function(url, callback) {
      equals(url, 'a', 'URL passed to checkPage');
      callback();
    }
    var old_setPageSettings = setPageSettings;
    setPageSettings = function(url, update, callback) {
      equals(url, 'a', 'URL passed to setPageSettings');
      same(update, { updated: false }, 'Update negator');
      equals(callback, $.noop, 'Callback passed to setPageSettings');
    }

    takeSnapshot('a', $.noop);

    checkPage = old_checkPage;
    setPageSettings = old_setPageSettings;
  });
});
