$(function() {
  test('generateControls', function() {
    var controls = generateControls();

    ok(controls.is('#chrome_page_monitor_selector'), 'Valid control block id.');
    equal($('span[title=Pick]', controls).length, 1, 'Pick button count');
    equal($('span[title=Parent]', controls).length, 1, 'Parent button count');
    equal($('input[type=button][title=Done]', controls).length, 1,
          'Done button count');
    equal($('input[type=button][title=Help]', controls).length, 1,
          'Help button count');
  });

  test('currentElementChanged (no selection)', function() {
    done_button = $('<div>');
    parent_button = $('<div class="' + DISABLED_CLASS + '">');
    $('#test1').addClass(TEMP_OUTLINE_CLASS);
    $('#test2').addClass(OUTLINE_CLASS);
    current_element = null;
    current_selector = 'TEST';
    done_button.attr('disabled', true);

    currentElementChanged();

    equal(done_button.attr('disabled'), 'disabled', 'Done button disabled');
    ok(parent_button.hasClass(DISABLED_CLASS), 'Parent class left.');

    equal($('.' + TEMP_OUTLINE_CLASS).length, 0, 'Temp outlines');
    equal($('.' + OUTLINE_CLASS).length, 0, 'Outlines');

    equal(current_element, null, 'Current element');
    equal(current_selector, '', 'Current selector');

    done_button = parent_button = null;
  });

  test('currentElementChanged (valid selection)', function() {
    done_button = $('<div>');
    parent_button = $('<div class="' + DISABLED_CLASS + '">');
    $('#test1').addClass(TEMP_OUTLINE_CLASS);
    $('#test2').addClass(OUTLINE_CLASS);
    current_element = $('#test3').get(0);
    current_selector = 'TEST';
    done_button.attr('disabled', false);

    currentElementChanged();

    equal(done_button.attr('disabled'), undefined, 'Done button disabled');
    ok(!parent_button.hasClass(DISABLED_CLASS), 'Parent class removed.');

    equal($('.' + TEMP_OUTLINE_CLASS).length, 0, 'Temp outlines');
    equal($('.' + OUTLINE_CLASS).length, 1, 'Outlines');
    ok($('.' + OUTLINE_CLASS).is('#test3'), 'Outline correct.');

    equal(current_element, $('#test3').get(0), 'Current element');
    equal(current_selector, elementToSelector(current_element),
          'Current selector');

    done_button = parent_button = current_element = null;
    current_selector = '';
  });

  test('elementToSelector', function() {
    equal(elementToSelector($('body').get(0)), 'body', 'Body');
    equal(elementToSelector($('head').get(0)), null, 'Head');
    equal(elementToSelector($('#test2').get(0)), '#test2', 'ID');
    equal(elementToSelector($('#test2 div').get(0)), '#test2>div:nth-child(1)',
          'Unclassed child div');
    equal(elementToSelector($('#test2 span').get(0)), '#test2>span',
          'Unclassed child span (no other span siblings)');
    equal(elementToSelector($('.test4').get(0)), '#test2>div.test4',
          'Classed child div');
    equal(elementToSelector($('.chrome_page_monitor_ignore').get(0)),
          '>div>div:nth-child(4)',
          'Class to be ignored, ends with body');
    equal(elementToSelector($('br').get(0)), '#test2>br', 'Unclosed <br> tag');
    equal(elementToSelector($('img').get(0)), '#test2>img', 'Closed <img> tag');
  });

  test('setUpBodyHandlers (mousemove)', function() {
    setUpBodyHandlers();

    $('#test1').attr('class', TEMP_OUTLINE_CLASS);
    $('#test2').attr('class', OUTLINE_CLASS);
    $('#test3').attr('class', '');

    pick_mode = false;
    $('#test3').mousemove();

    ok($('#test1').hasClass(TEMP_OUTLINE_CLASS),
       'Pick mode off: temp outline remained.');
    ok($('#test2').hasClass(OUTLINE_CLASS),
       'Pick mode off: normal outline remained.');
    ok(!$('#test3').hasClass(OUTLINE_CLASS) &&
       !$('#test3').hasClass(TEMP_OUTLINE_CLASS),
       'Pick mode off: no temp outline added.');

    pick_mode = true;
    $('#test3').mousemove();

    ok(!$('#test1').hasClass(TEMP_OUTLINE_CLASS),
       'Pick mode on: temp outline removed.');
    ok($('#test2').hasClass(OUTLINE_CLASS),
       'Pick mode on: normal outline remained.');
    ok(!$('#test3').hasClass(OUTLINE_CLASS) &&
       $('#test3').hasClass(TEMP_OUTLINE_CLASS),
       'Pick mode on: temp outline added.');

    pick_mode = false;
    $('#test1,#test2,#test3').attr('class', '');
    $('body').unbind('mousemove').unbind('click');
  });

  test('setUpBodyHandlers (click)', function() {
    expect(7);

    setUpBodyHandlers();
    var old_currentElementChanged = currentElementChanged;

    current_element = null;
    pick_button = $('<div />').addClass(ACTIVE_CLASS);
    currentElementChanged = function() {
      ok(false, 'currentElementChanged() called when it shouldn\'t have been.');
    };
    pick_mode = false;

    $('#test3').click();

    equal(current_element, null, 'Pick mode off: current_element');
    equal(pick_mode, false, 'Pick mode off: pick_mode');
    ok(pick_button.hasClass(ACTIVE_CLASS),
       'Pick mode off: pick button still active.');

    currentElementChanged = function() {
      ok(true, 'currentElementChanged() called as per spec.');
    };
    pick_mode = true;

    $('#test3').click();

    equal(current_element, $('#test3').get(0),
          'Pick mode off: current_element');
    equal(pick_mode, false, 'Pick mode off: pick_mode');
    ok(!pick_button.hasClass(ACTIVE_CLASS),
       'Pick mode off: pick button no longer active.');

    current_element = null;
    pick_mode = false;
    pick_button = null;
    $('body').unbind('mousemove').unbind('click');
    currentElementChanged = old_currentElementChanged;
  });

  test('setUpButtonHandlers (help_button)', function() {
    expect(1);

    pick_button = parent_button = done_button = $('<div />');
    help_button = $('<div />');
    var old_alert = alert;
    alert = function(arg) {
      equal(arg, chrome.i18n.getMessage('selector_gui_help_text'),
            'Message passed to alert()');
    };

    setUpButtonHandlers();
    help_button.click();

    alert = old_alert;
    help_button = parent_button = done_button = pick_button = null;
  });

  test('setUpButtonHandlers (pick_button)', function() {
    expect(4);

    help_button = parent_button = done_button = $('<div />');
    pick_button = $('<div />');
    var old_currentElementChanged = currentElementChanged;
    currentElementChanged = function() {
      ok(true, 'currentElementChanged() called as per spec.');
    };
    pick_mode = false;
    current_element = 'test';

    setUpButtonHandlers();
    pick_button.click();

    equal(pick_mode, true, 'Pick mode');
    equal(current_element, null, 'Current element');
    ok(pick_button.hasClass(ACTIVE_CLASS), 'Pick button activated.');

    pick_mode = false;
    current_element = null;
    currentElementChanged = old_currentElementChanged;
    help_button = parent_button = done_button = pick_button = null;
  });

  test('setUpButtonHandlers (parent_button)', function() {
    expect(8);

    help_button = pick_button = done_button = $('<div />');
    parent_button = $('<div />');
    var old_currentElementChanged = currentElementChanged;
    setUpButtonHandlers();

    // Cases when the button should *not* work.
    currentElementChanged = function() {
      ok(false, 'currentElementChanged() called when it shouldn\'t have been.');
    };

    current_element = null;
    parent_button.click();
    equal(current_element, null,
          'Started with current_element=null. Current element');
    ok(!pick_button.hasClass(ACTIVE_CLASS),
       'Started with current_element=null. Pick button active.');

    current_element = $('#test3').get(0);
    parent_button.addClass(DISABLED_CLASS);
    parent_button.click();
    equal(current_element, $('#test3').get(0),
          'Started with disabled button. Current element');
    parent_button.removeClass(DISABLED_CLASS);

    // Cases when the button should become disabled.
    current_element = $('body>*').get(0);
    parent_button.click();
    equal(current_element, $('body *').get(0),
          'Started with a root element. Current element');
    ok(parent_button.hasClass(DISABLED_CLASS),
          'Started with a root element. Parent button disabled.');
    parent_button.removeClass(DISABLED_CLASS);

    // Cases when the button should work normally.
    currentElementChanged = function() {
      ok(true, 'currentElementChanged() called as per spec.');
    };
    current_element = $('#test3').get(0);
    parent_button.click();
    equal(current_element, $('#test3').parent().get(0),
          'Started with a valid element and enabled button. Current element');
    ok(!parent_button.hasClass(ACTIVE_CLASS),
       'Started with a valid element and enabled button. Button active.');

    current_element = null;
    currentElementChanged = old_currentElementChanged;
    help_button = parent_button = done_button = pick_button = null;
  });

  test('setUpButtonHandlers (done_button)', function() {
    expect(4);

    var old_close = close;
    var old_sendRequest = chrome.extension.sendRequest;
    help_button = pick_button = parent_button = $('<div />');
    done_button = $('<div />');
    setUpButtonHandlers();

    close = function() {
      ok(true, 'Closed window when current_selector is empty.');
    };
    chrome.extension.sendRequest = function() {
      ok(false, 'sendRequest() called when current_selector is empty.');
    };
    current_selector = '';
    done_button.click();

    close = function() {};
    chrome.extension.sendRequest = function(obj, callback) {
      ok(true, 'sendRequest() called when current_selector is not empty.');
      same(obj, {
        selector: current_selector,
        url: window.location.href
      }, 'Correct message passed to sendRequest().');
      equal(callback, close,
            'Correct close() callback passed to sendRequest().');
    };
    current_selector = 'TEST';
    done_button.click();

    current_selector = '';
    chrome.extension.sendRequest = old_sendRequest;
    close = old_close;
    help_button = parent_button = done_button = pick_button = null;
  });

  test('initialize', function() {
    expect(9);

    var old_generateControls = generateControls;
    var old_setUpButtonHandlers = setUpButtonHandlers;
    var old_setUpBodyHandlers = setUpBodyHandlers;

    setUpButtonHandlers = function() {
      ok(true, 'setUpButtonHandlers() called.');
    };
    setUpBodyHandlers = function() {
      ok(true, 'setUpBodyHandlers() called.');
    };
    generateControls = function() {
      ok(true, 'generateControls() called.');
      var controls = old_generateControls();
      return controls.addClass('test_class').css('display', 'none');
    }

    initialize();

    ok($('body>:last-child').hasClass('test_class'), 'Test class injected.');
    equal(frame.get(0), $('#' + FRAME_ID).get(0), 'Frame reference');
    equal(pick_button.get(0), $('span[title=Pick]', frame).get(0),
          'Pick button reference');
    equal(parent_button.get(0), $('span[title=Parent]', frame).get(0),
          'Parent button reference');
    equal(done_button.get(0), $('input[type=button][title=Done]', frame).get(0),
          'Done button reference');
    equal(help_button.get(0), $('input[type=button][title=Help]', frame).get(0),
          'Help button reference');

    generateControls = old_generateControls;
    setUpButtonHandlers = old_setUpButtonHandlers;
    setUpBodyHandlers = old_setUpBodyHandlers;
  });
});