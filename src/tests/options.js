$(function() {
  /****************************************************************************/
  module('Utilities');
  /****************************************************************************/
  test('isValidRegex', function() {
    regexes = {
      '': true,
      'asd': true,
      'a.*b': true,
      'ac?d': true,
      'ac??d': true,
      'ac???d': false,
      'a(c)d': true,
      'a(cd': false,
      '/a/cd/q': true,
      '\\\\': true,
      '\\': false,
      '?': false,
      '*': false,
      'x*': true,
    };
    for (regex in regexes) {
      equal(isValidRegex(regex), regexes[regex], regex + ' validity');
    }
  });

  test('isValidSelector', function() {
    selectors = {
      '': true,
      'abc': true,
      '*': true,
      '#': false,
      '#a': true,
      'a#b': true,
      '.': false,
      '.a': true,
      'a.b': true,
      'a.b#c': true,
      'a#b.c': true,
      'a b#c * d.e': true,
      '\\': false,
      '?': false,
      '^': false,
    };
    for (selector in selectors) {
      equal(isValidSelector(selector), selectors[selector],
            selector + ' validity');
    }
  });

  test('shadeBackground', function() {
    expect(13);
    var old_animate = $.fn.animate;
    var old_height = $.fn.height;

    var animation_effects;
    $.fn.animate = function(effect, callback) {
      animation_effects.push(effect);
      (callback || $.noop)();
    };
    $.fn.height = function(height) {
      equal(height, $('body').get(0).scrollHeight, 'Shader height set');
    };

    // First time; showing.
    animation_effects = [];
    equal($('#shader').length, 0, 'Shader existence, before');
    shadeBackground(true);
    equal($('#shader').length, 1, 'Shader existence, after');
    equal($('#shader').css('display'), 'block', 'Shader display');
    same(animation_effects, [{ opacity: 0.7 }], 'Animations');

    // Second time; hiding.
    animation_effects = [];
    shadeBackground(false);
    equal($('#shader').length, 1, 'Shader existence, after #2');
    equal($('#shader').css('display'), 'none', 'Shader display');
    same(animation_effects, [{ opacity: 0 }], 'Animations');

    // Third time; showing.
    animation_effects = [];
    shadeBackground(true);
    equal($('#shader').length, 1, 'Shader existence, after #3');
    equal($('#shader').css('display'), 'block', 'Shader display');
    same(animation_effects, [{ opacity: 0.7 }], 'Animations');

    $('#shader').remove();
    $.fn.height = old_height;
    $.fn.animate = old_animate;
  });

  test('findUrl', function() {
    expect(4);
    var old_closest = $.fn.closest;
    var old_find = $.fn.find;
    var old_get = $.fn.get;

    $.fn.closest = function(selector) {
      equal(selector, '.page_record', 'Selector passed to closest()');
      return this;
    };
    $.fn.find = function(selector) {
      if (selector != 'abc') {
        equal(selector, '.page_link', 'Selector passed to find()');
      }
      return this;
    };
    $.fn.get = function(index) {
      equal(index, 0, 'Index passed to find get()');
      return { href: 123 };
    };

    equal(findUrl('abc'), 123, 'Found URL');

    $.fn.closest = old_closest;
    $.fn.find = old_find;
    $.fn.get = old_get;
  });

  test('findPageRecord', function() {
    expect(6);
    var old_$ = $;

    closest_function_container = { closest: function(selector) {
      equal(selector, '.page_record', 'Selector passed to closest()');
      return 456;
    } };

    $ = function(arg) {
      equal(arg, 123, 'jQuery argument');
      return closest_function_container;
    }
    equal(findPageRecord(123), 456, 'Found URL');

    $ = function(arg) {
      equal(arg, '.page_link[href="abc"]', 'jQuery argument');
      return closest_function_container;
    }
    equal(findPageRecord('abc'), 456, 'Found URL');

    $ = old_$;
  });

  test('timeLogToAbsolute', function() {
    equal(timeLogToAbsolute(-6), 0.09, 'From -6');
    equal(timeLogToAbsolute(-3), 0.3, 'From -3');
    equal(timeLogToAbsolute(-2.5), 0.36, 'From -2.5');
    equal(timeLogToAbsolute(-2), 0.44, 'From -2');
    equal(timeLogToAbsolute(-1), 0.67, 'From -1');
    equal(timeLogToAbsolute(0), 1, 'From 0');
    equal(timeLogToAbsolute(1), 1.5, 'From 1');
    equal(timeLogToAbsolute(1.5), 1.8, 'From 1.5');
    equal(timeLogToAbsolute(2), 2.3, 'From 2');
    equal(timeLogToAbsolute(3), 3.4, 'From 3');
    equal(timeLogToAbsolute(8), 26, 'From 8');
    equal(timeLogToAbsolute(15), 438, 'From 15');
    equal(timeLogToAbsolute(17.4), 1159, 'From 17.4');
  });

  test('timeAbsoluteToLog', function() {
    equal(timeAbsoluteToLog(1), 0, 'From 1');
    equal(timeAbsoluteToLog(1.5), 1, 'From 1.5');
    equal(timeAbsoluteToLog(2.25), 2, 'From 2');
    equal(timeAbsoluteToLog(20), 7.388384878619028, 'From 20');
    equal(timeAbsoluteToLog(2000), 18.746132053154174, 'From 2000');
    same(timeAbsoluteToLog(-5), NaN, 'From -5');
  });

  test('updatePageModeControls', function() {
    var span = $('.mode .mode_string');
    var input = $('.mode .mode_test');

    updatePageModeControls($('body>div'), true);
    ok(!span.hasClass('invalid'), 'Span made valid.');
    equal(input.attr('disabled'), undefined, 'Input enabled.');

    updatePageModeControls($('body>div'), false);
    ok(span.hasClass('invalid'), 'Span made invalid.');
    equal(input.attr('disabled'), 'disabled', 'Input disabled.');
  });

  test('setPageCheckInterval', function() {
    expect(3);
    var old_setPageSettings = setPageSettings;

    setPageSettings = function(url, setting, callback) {
      equal(url, 'abc', 'URL passed to setPageSettings()');
      same(setting, { check_interval: 123 * 60 * 1000 },
           'URL passed to setPageSettings()');
      equal(callback, BG.scheduleCheck, 'URL passed to setPageSettings()');
    };
    setPageCheckInterval('abc', '123');

    setPageSettings = old_setPageSettings;
  });

  test('setPageRegexOrSelector', function() {
    expect(13);
    var old_setPageSettings = setPageSettings;
    var old_findPageRecord = findPageRecord;
    var old_updatePageModeControls = updatePageModeControls;
    var old_isValidRegex = isValidRegex;
    var old_isValidSelector = isValidSelector;

    findPageRecord = function(url) {
      equal(url, 'a', 'URL passed to findPageRecord');
      return 'abc';
    };

    try {
      setPageRegexOrSelector('a', 'b', 'c');
    } catch (e) {
      same(e.message, 'Invalid mode.', 'Result of passing an invalid mode');
    }

    setPageSettings = function(url, settings) {
      equal(url, 'a', 'URL passed to setPageSettings');
      same(settings, { mode: 'text', regex: null, selector: null },
           'Settings passed to setPageSettings');
    };
    setPageRegexOrSelector('a', 'regex', null);

    setPageSettings = function(url, settings) {
      ok(false, 'setPageSettings() called unnecessarily.');
    };
    isValidSelector = function(value) {
      ok(false, 'isValidSelector() called unnecessarily.');
    };
    isValidRegex = function(value) {
      equal(value, 'b', 'Value passed to isValidRegex()');
      return false;
    };
    updatePageModeControls = function(record, validity) {
      equal(record, 'abc', 'Record passed to updatePageModeControls()');
      equal(validity, false, 'Validity passed to updatePageModeControls()');
    };
    setPageRegexOrSelector('a', 'regex', 'b');

    setPageSettings = function(url, settings) {
      equal(url, 'a', 'URL passed to setPageSettings()');
      same(settings, { mode: 'selector', selector: 'b' },
           'Settings passed to setPageSettings()');
    };
    isValidSelector = function(value) {
      equal(value, 'b', 'Value passed to isValidRegex()');
      return true;
    };
    isValidRegex = function(value) {
      ok(false, 'isValidSelector() called unnecessarily.');
    };
    updatePageModeControls = function(record, validity) {
      equal(record, 'abc', 'Record passed to updatePageModeControls()');
      equal(validity, true, 'Validity passed to updatePageModeControls()');
    };
    setPageRegexOrSelector('a', 'selector', 'b');

    setPageSettings = old_setPageSettings;
    findPageRecord = old_findPageRecord;
    updatePageModeControls = old_updatePageModeControls;
    isValidRegex = old_isValidRegex;
    isValidSelector = old_isValidSelector;
  });

  /****************************************************************************/
  module('Import & Export');
  /****************************************************************************/

  test('exportPagesList', function() {
    expect(1);
    var old_Date_now = Date.now;
    var old_getAllPages = getAllPages;

    Date.now = function() { return 1000; };
    getAllPages = function(callback) {
      callback([{ name: 'n1',
                  url: 'u1',
                  mode: 'a',
                  regex: 'b',
                  selector: 'c',
                  check_interval: 'd',
                  crc: 'e',
                  last_check: 'f',
                  last_changed: 'g' },
                { name: 'n2',
                  url: 'u2',
                  mode: 'h',
                  regex: 'i',
                  selector: 'j',
                  check_interval: 'k',
                  crc: 'l' }]);
    };

    var expected_file = $.ajax({
      url: 'data/import_export.txt',
      async: false
    }).responseText;

    exportPagesList(function(file) {
      equal(file, expected_file, 'Exported output');
    });

    Date.now = old_Date_now;
    getAllPages = old_getAllPages;
  });

  test('importPagesList', function() {
    expect(3);
    var old_addPage = addPage;

    addPage = function(page) {
      if (page.mode == 'a') {
        same(page, { name: 'n1',
                     url: 'u1',
                     mode: 'a',
                     regex: 'b',
                     selector: 'c',
                     check_interval: 'd',
                     crc: 'e',
                     last_check: 'f',
                     last_changed: 'g' }, 'First page added.');
      } else if (page.mode == 'h') {
        same(page, { name: 'n2',
                     url: 'u2',
                     mode: 'h',
                     regex: 'i',
                     selector: 'j',
                     check_interval: 'k',
                     crc: 'l' }, 'Second page added.');
      } else {
        ok(false, 'Invalid page added: ' + JSON.stringify(page));
      }
    };

    var input_file = $.ajax({
      url: 'data/import_export.txt',
      async: false
    }).responseText;

    equal(importPagesList(input_file), 2, 'Returned pages');

    addPage = old_addPage;
  });

  /****************************************************************************/
  module('Global Initialization');
  /****************************************************************************/

  test('initializeGlobalControls', function() {
    var intializers = ['initializeColorPicker', 'initializeAnimationToggler',
                       'initializeSorter', 'initializeIntervalSliders',
                       'initializeNotificationsToggler',
                       'initializeNotificationsTimeout',
                       'initializeSoundSelector', 'initializeSoundPlayer',
                       'initializeSoundCreator', 'initializeViewAllSelector',
                       'initializeExporter', 'initializeImporter',
                       'initializeGlobalChecker', 'initializeAdvancedSwitch'];
    expect(intializers.length);

    var intializer_backup = {};
    for (var i = 0; i < intializers.length; i++) {
      intializer_backup[intializers[i]] = window[intializers[i]];
      with ({ intializer: intializers[i] }) {
        window[intializers[i]] = function() {
          ok(true, intializer + ' called.');
        };
      }
    }

    initializeGlobalControls();

    for (var i in intializer_backup) {
      window[i] = intializer_backup[i];
    }
  });

  test('initializeColorPicker', function() {
    expect(8);
    var old_getSetting = getSetting;
    var old_setSetting = setSetting;
    var old_BG = BG;
    var old_$ = $;

    getSetting = function(name) {
      equal(name, SETTINGS.badge_color, 'Setting requested via getSetting');
      return [1, 2, 3, 4];
    };
    setSetting = function(name, value) {
      equal(name, SETTINGS.badge_color, 'Name of setting set via setSetting');
      same(value, [1, 2, 3, 255], 'Value passed to setSetting');
    };
    BG = { updateBadge: function() { ok(true, 'Badge update triggered.'); } };
    $ = function(arg) {
      equal(arg, '#badge_color input', 'Argument passed to jQuery');
      return {
        val: function(arg) {
          if (arg === undefined) {
            return '#010203';
          } else {
            equal(arg, '#010203', 'Value applied to picker');
            return this;
          }
        },
        change: function(callback) {
          callback.apply('#badge_color input');
          return this;
        },
        colorPicker: function() { ok(true, 'Color picker initialized.'); }
      };
    };

    initializeColorPicker();

    getSetting = old_getSetting;
    setSetting = old_setSetting;
    BG = old_BG;
    $ = old_$;
  });

  test('initializeAnimationToggler', function() {
    expect(7);
    var old_getSetting = getSetting;
    var old_setSetting = setSetting;
    var old_$ = $;

    getSetting = function(name) {
      equal(name, SETTINGS.animations_disabled, 'Setting passed to getSetting');
      return 'abc';
    };
    setSetting = function(name, value) {
      equal(name, SETTINGS.animations_disabled, 'Setting passed to setSetting');
      same(value, false, 'Value passed to setSetting');
    };
    $ = function(arg) {
      equal(arg, '#animation select', 'Argument passed to jQuery');
      return {
        val: function(arg) {
          if (arg === undefined) {
            return 'enabled';
          } else {
            equal(arg, 'disabled', 'Value applied to toggler');
            return this;
          }
        },
        change: function(callback) {
          callback.apply('#animation select');
          return this;
        }
      };
    };
    $.fx = { off: 123 };

    initializeAnimationToggler();
    equal($.fx.off, false, 'JQuery effects toggler');

    getSetting = old_getSetting;
    setSetting = old_setSetting;
    $ = old_$;
  });

  test('initializeSorter', function() {
    expect(7);
    var old_getSetting = getSetting;
    var old_setSetting = setSetting;
    var old_$ = $;
    var old_fillPagesList = fillPagesList;

    getSetting = function(name) {
      equal(name, SETTINGS.sort_by, 'Setting passed to getSetting');
      return 'abc';
    };
    setSetting = function(name, value) {
      equal(name, SETTINGS.sort_by, 'Setting passed to setSetting');
      equal(value, 'def', 'Value passed to setSetting');
    };
    $ = function(arg) {
      equal(arg, '#sort select', 'Argument passed to jQuery');
      return {
        val: function(arg) {
          if (arg === undefined) {
            return 'def';
          } else {
            equal(arg, 'abc', 'Value applied to sorter');
            return this;
          }
        },
        change: function(callback) {
          callback.apply('#sort select');
          return this;
        }
      };
    };
    fillPagesList = function() {
      ok(true, 'Page list filler called.');
    };

    initializeSorter();

    getSetting = old_getSetting;
    setSetting = old_setSetting;
    $ = old_$;
    fillPagesList = old_fillPagesList;
  });

  test('initializeIntervalSliders', function() {
    expect(35);
    var old_getSetting = getSetting;
    var old_setSetting = setSetting;
    var old_timeAbsoluteToLog = timeAbsoluteToLog;
    var old_timeLogToAbsolute = timeLogToAbsolute;
    var old_describeTime = describeTime;
    var old_$ = $;

    getSetting = function(name) {
      equal(name, SETTINGS.check_interval, 'Setting passed to getSetting');
      return 123;
    };
    setSetting = function(name, value) {
      equal(name, SETTINGS.check_interval, 'Setting passed to setSetting');
      if (value == 67890 * 60 * 1000 || value == 3325 * 60 * 1000) {
        ok(true, 'Valid value passed to setSetting()');
      } else {
        ok(false, 'Invalid value passed to setSetting()');
      }
    };
    timeAbsoluteToLog = function(value) {
      if (value == 123 / (60 * 1000) || value == 3325) {
        ok(true, 'Valid value passed to timeAbsoluteToLog');
      } else {
        ok(false, 'Invalid value passed to val()');
      }
      return 12345;
    };
    timeLogToAbsolute = function(value) {
      equal(value, 12345, 'Value passed to timeLogToAbsolute');
      return 67890;
    };
    describeTime = function(value) {
      equal(value, 67890 * 60 * 1000, 'Value passed to describeTime');
      return 'abc';
    };
    var dispatcher = {
      val: function(arg) {
        if (arg === undefined) {
          return 12345;
        } else {
          if (arg == 12345 || arg == 67890 || arg == 3325 ||
              arg == 123 / (60 * 1000)) {
            ok(true, 'Valid value passed to val()');
          } else {
            ok(false, 'Invalid value passed to val()');
          }
          return this;
        }
      },
      change: function(callback) {
        if (callback === undefined) {
          ok(true, 'Change event triggered.');
        } else {
          callback.apply(this);
        }
        return this;
      },
      mouseup: function(callback) {
        if (callback === undefined) {
          ok(true, 'MouseUp event triggered.');
        } else {
          callback.apply(this);
        }
        return this;
      },
      siblings: function(selector) {
        equal(selector, '.range_value_label',
              'Selector passed to siblings()');
        return this;
      },
      text: function(text) {
        if (text == 'abc' || text == 'minutes') {
          ok(true, 'Valid text passed to text()');
        } else {
          ok(false, 'Invalid text passed to text()');
        }
        return this;
      },
      not: function(excluder) {
        equal(excluder, this, 'Excluded by not()');
        return this;
      },
      offset: function() {
        ok(true, 'Offset queried.');
        return {left: 123, top: 456};
      },
      width: function() {
        ok(true, 'Width queried.');
        return 78;
      },
      height: function() {
        ok(true, 'Height queried.');
        return 90;
      },
      css: function(arg) {
        same(arg, { left: 123 }, 'Repositioned.');
      }
    };
    $ = function(arg) {
      if (arg == '#interval input' ||
          arg == '#interval .check_every_label' ||
          arg == '#basic_interval input[type=range]' ||
          arg == '#basic_interval .range_value_label' ||
          arg == dispatcher) {
        ok(true, 'Valid input passed to jQuery.');
      } else {
        ok(false, 'Invalid input passed to jQuery: ' + arg + '.');
      }
      return dispatcher;
    };

    initializeIntervalSliders();

    getSetting = old_getSetting;
    setSetting = old_setSetting;
    timeAbsoluteToLog = old_timeAbsoluteToLog;
    timeLogToAbsolute = old_timeLogToAbsolute;
    describeTime = old_describeTime;
    $ = old_$;
  });

  test('initializeNotificationsToggler', function() {
    expect(11);
    var old_getSetting = getSetting;
    var old_setSetting = setSetting;
    var old_$ = $;

    getSetting = function(name) {
      equal(name, SETTINGS.notifications_enabled,
            'Setting passed to getSetting');
      return true;
    };
    setSetting = function(name, value) {
      equal(name, SETTINGS.notifications_enabled,
            'Setting passed to setSetting');
      equal(value, true, 'Value passed to setSetting');
    };
    var dispatcher = {
      val: function(arg) {
        if (arg === undefined) {
          return 'enabled';
        } else {
          equal(arg, 'enabled', 'Value passed to val()');
          return this;
        }
      },
      change: function(callback) {
        if (callback === undefined) {
          ok(true, 'Change event triggered.');
        } else {
          callback.apply(this);
        }
        return this;
      },
      not: function(excluder) {
        equal(excluder, this, 'Excluded by not()');
        return this;
      },
      attr: function(name, value) {
        equal(name, 'disabled', 'Name passed to attr()');
        equal(value, false, 'Value passed to attr()');
        return this;
      }
    };
    $ = function(arg) {
      if (arg == '#notifications select, #basic_notifications select' ||
          arg == '#notifications_timeout input' || arg == dispatcher) {
        ok(true, 'Valid input passed to jQuery.');
      } else {
        ok(false, 'Invalid input passed to jQuery.');
      }
      return dispatcher;
    };

    initializeNotificationsToggler();

    getSetting = old_getSetting;
    setSetting = old_setSetting;
    $ = old_$;
  });

  test('initializeNotificationsTimeout', function() {
    expect(14);
    var old_getSetting = getSetting;
    var old_setSetting = setSetting;
    var old_describeTime = describeTime;
    var old_$ = $;

    getSetting = function(name) {
      if (name == SETTINGS.notifications_timeout) {
        return 678 * 1000;
      } else if (name == SETTINGS.notifications_enabled) {
        return true;
      } else {
        ok(false, 'Invalid name passed to getSetting(): ' + name + '.');
      }
    };
    setSetting = function(name, value) {
      equal(name, SETTINGS.notifications_timeout,
            'Setting passed to setSetting');
      equal(value, 12 * 1000, 'Value passed to setSetting');
    };
    describeTime = function(value) {
      equal(value, 12 * 1000, 'Value passed to describeTime');
      return 'abc';
    };
    var dispatcher = {
      val: function(arg) {
        if (arg === undefined) {
          return 12;
        } else {
          equal(arg, 678, 'Value passed to val()');
          return this;
        }
      },
      change: function(callback) {
        if (callback === undefined) {
          ok(true, 'Change event triggered.');
        } else {
          callback.apply(this);
        }
        return this;
      },
      mouseup: function(callback) {
        ok(callback, 'MouseUp callback is defined.');
        callback.apply(this);
        return this;
      },
      siblings: function(selector) {
        equal(selector, '.range_value_label',
              'Selector passed to siblings()');
        return this;
      },
      text: function(text) {
        equal(text, 'abc', 'Text passed to text()');
        return this;
      },
      attr: function(name, value) {
        equal(name, 'disabled', 'Name passed to attr()');
        equal(value, false, 'Value passed to attr()');
      }
    };
    $ = function(arg) {
      if (arg == '#notifications_timeout input' || arg == dispatcher) {
        ok(true, 'Valid input passed to jQuery.');
      } else {
        ok(false, 'Invalid input passed to jQuery.');
      }
      return dispatcher;
    };

    initializeNotificationsTimeout();

    getSetting = old_getSetting;
    setSetting = old_setSetting;
    describeTime = old_describeTime;
    $ = old_$;
  });

  test('initializeSoundSelector', function() {
    expect(11);
    var old_getSetting = getSetting;
    var old_setSetting = setSetting;
    var old_$ = $;

    getSetting = function(name) {
      if (name == SETTINGS.custom_sounds) {
        return [{ name: 'a', url: 'b' }, { name: 'c', url: 'd' }];
      } else if (name == SETTINGS.sound_alert) {
        return 'a';
      } else {
        ok(false, 'Invalid name passed to getSetting(): ' + name + '.');
      }
    };
    setSetting = function(name, value) {
      equal(name, SETTINGS.sound_alert, 'Setting passed to setSetting');
      equal(value, 'b', 'Value passed to setSetting');
    };

    initializeSoundSelector();

    var basic_selector = $('#basic_sound_alert select');
    var advanced_selector = $('#sound_alert select');
    equal($('option', basic_selector).length, 2, 'Basic selector option count');
    equal($('option', advanced_selector).length, 2,
          'Advanced selector option count');
    equal($('option', advanced_selector).length, 2,
          'Advanced selector option count');

    setSetting = function(name, value) {
      equal(name, SETTINGS.sound_alert, 'Setting passed to setSetting');
      equal(value, 'd', 'Value passed to setSetting');
    };
    basic_selector.val('d').change();
    equal(advanced_selector.val(), 'd', 'Synchronized value');
    equal($('#play_sound').attr('disabled'), undefined, 'Play button disabled');

    getSetting = old_getSetting;
    setSetting = old_setSetting;
    $ = old_$;
  });

  test('initializeSoundPlayer', function() {
    expect(7);
    var old_Audio = Audio;
    var ended_event_callback;
    var selector = $('#sound_alert select');
    var button = $('#play_sound');

    initializeSoundPlayer();

    Audio = function(value) {
      equal(value, 'b', 'Value passed to Audio()');
      return {
        addEventListener: function(event, callback) {
          equal(event, 'ended', 'Play ended event assigned.');
          ended_event_callback = callback;
        },
        play: function() {
          ok(true, 'Sound played.');
        }
      };
    };
    selector.html('<option>a</option><option>b</option>').val('b');
    button.click();
    equal(selector.attr('disabled'), 'disabled', 'Selector disabled');
    equal(button.attr('disabled'), 'disabled', 'Play button disabled');
    ended_event_callback();
    equal(selector.attr('disabled'), undefined, 'Selector disabled');
    equal(button.attr('disabled'), undefined, 'Play button disabled');

    Audio = old_Audio;
  });
});
