$(function() {
  test('getNotificationUrl', function() {
    equals(getNotificationUrl($('#getNotificationUrl_test_row1')),
           'http://example.com/test1',
           'Link in table cell from row');
    equals(getNotificationUrl($('#getNotificationUrl_test_row1 td')),
           'http://example.com/test1',
           'Link in table cell from cell');
    equals(getNotificationUrl($('#getNotificationUrl_test_row1 a')),
           'http://example.com/test1',
           'Link in table cell from the link itself');
    equals(getNotificationUrl($('#getNotificationUrl_test_row2 td')),
           'http://example.com/test2',
           'Link in div from cell');
    equals(getNotificationUrl($('body')), null, 'Outside of table');
  });

  test('markPageVisited', function() {
    expect(22);
    var old_getNotificationUrl = getNotificationUrl;
    var old_BG = BG;
    var old_$ = $;
    var old_fillNotifications = fillNotifications;
    var length = null;

    getNotificationUrl = function(arg) {
      equals(arg, 'test1', 'Argument to getNotificationUrl()');
      return 'test2';
    };
    BG = {
      updateBadge: function() {
        ok(true, 'Badge update triggered.');
      },
      takeSnapshot: function(url, callback) {
        equals(url, 'test2', 'URL argument to takeSnapshot()');
        equals(callback, 'test3', 'Callback argument to takeSnapshot()');
      },
      scheduleCheck: 'test3',
      setPageSettings: function(url, properties, callback) {
        equals(url, 'test2', 'URL argument to setPageSettings()');
        same(properties, { updated: false },
             'Properties argument to setPageSettings()');
        callback();
      }
    };
    $ = function(selector_or_object) {
      if ($.state == 0) {
        equals(selector_or_object, 'test1',
               'Selector or object argument to $()');
        return $;
      } else {
        return jQuery.extend({}, $, { length: length });
      }
    };
    $.closest = function(selector) {
      equals(selector, '.notification td', 'Selector argument to closest()');
      return $;
    };
    $.slideUp = function(speed, callback) {
      equals(speed, 'slow', 'Speed argument to slideUp()');
      $.state = 1;
      callback();
    };

    length = 0;
    $.state = 0;
    $.animate = function() {
      ok(false, 'animate() called when $.length == 0.');
    };
    fillNotifications = function() {
      ok(true, 'Notifications refilled.');

      // Second test has to wait until the end of the first, which happens at
      // this point.
      length = 1;
      $.state = 0;
      $.animate = function(settings, speed, callback) {
        same(settings, { height: '2.7em', opacity: 1 },
             'Settings argument to animate()');
        equals(speed, 'slow', 'Speed argument to animate()');
        equals(callback, fillNotifications, 'Callback argument to animate()');
      };
      markPageVisited.call('test1');

      fillNotifications = old_fillNotifications;
      $ = old_$;
      BG = old_BG;
      getNotificationUrl = old_getNotificationUrl;
    };
    markPageVisited.call('test1');
  });

  test('monitorCurrentPage', function() {
    expect(5);
    var old_getSelected = chrome.tabs.getSelected;
    var old_addPage = addPage;
    var old_updateButtonsState = updateButtonsState;

    chrome.tabs.getSelected = function(id, callback) {
      equals(id, null, 'ID argument to getSelected()');
      ok($('#monitor_page').hasClass('inprogress'), 'In-progress class added.');
      callback({ url: 'test1', title: 'test2' });
    };
    addPage = function(page, callback) {
      same(page, { url: 'test1', name: 'test2' },
           'Page argument to addPage()');
      callback();
      ok(!$('#monitor_page').hasClass('inprogress'),
         'In-progress class removed.');
    };
    updateButtonsState = function() {
      ok(true, 'Buttons state updated.');
    };

    monitorCurrentPage();

    updateButtonsState = old_updateButtonsState;
    addPage = old_addPage;
    chrome.tabs.getSelected = old_getSelected;
  });

  test('fillNotifications', function() {
    expect(4);
    var old_getAllUpdatedPages = getAllUpdatedPages;
    var old_updateButtonsState = updateButtonsState;
    var old_getFavicon = getFavicon;

    getAllUpdatedPages = function(callback) {
      callback([{ url: 'u1', name: 'n1' }, { url: 'u2', name: 'n2' }]);
    };
    updateButtonsState = function() {
      ok(true, 'Buttons state updated.');
    };
    getFavicon = function(url) {
      return 'test_' + url;
    };

    fillNotifications(function() {
      var expected = $('#notifications_expected tbody').html();
      var got = $('#notifications tbody').html();
      equals(got.replace(/^\s+|\s+$/, ''), expected.replace(/^\s+|\s+$/, ''),
             'Contents of table when 2 pages are supplied');
    });

    getAllUpdatedPages = function(callback) { callback([]); };
    fillNotifications(function() {
      var expected = $('#templates .empty').get(0).outerHTML;
      var got = $('#notifications tbody').get(0).innerHTML;
      equals(got, expected, 'Contents of table when no pages are supplied');
    });

    getFavicon = old_getFavicon;
    updateButtonsState = old_updateButtonsState;
    getAllUpdatedPages = old_getAllUpdatedPages;
  });

  test('updateButtonsState / Monitor This Page', function() {
    expect(9);
    var old_getSelected = chrome.tabs.getSelected;
    var old_isPageMonitored = isPageMonitored;

    function isMonitorButtonEnabled() {
      var page_monitored_message = chrome.i18n.getMessage('page_monitored');
      var monitor_message = chrome.i18n.getMessage('monitor');

      if ($('#monitor_page').hasClass('inactive') &&
          ($('#monitor_page span').text() == monitor_message ||
           $('#monitor_page span').text() == page_monitored_message) &&
          $('#monitor_page img').attr('src') == 'img/monitor_inactive.png') {
        return false;
      } else if (!$('#monitor_page').hasClass('inactive') &&
                 $('#monitor_page span').text() == monitor_message &&
                 $('#monitor_page img').attr('src') == 'img/monitor.png') {
        return true;
      } else {
        throw new Error('Inconsistent monitoring button state.');
      };
    }

    chrome.tabs.getSelected = function(id, callback) {
      equals(id, null, 'ID argument to getSelected()');
      callback({ url: 'qqq://example.com/' });
    };
    isPageMonitored = function(url, callback) {
      equals(url, 'qqq://example.com/', 'URL argument to isPageMonitored()');
      callback(false);
    };
    updateButtonsState();
    ok(!isMonitorButtonEnabled(), 'Disabled with invalid URL.');

    chrome.tabs.getSelected = function(id, callback) {
      equals(id, null, 'ID argument to getSelected()');
      callback({ url: 'http://example.com/' });
    };
    isPageMonitored = function(url, callback) {
      equals(url, 'http://example.com/', 'URL argument to isPageMonitored()');
      callback(false);
    };
    updateButtonsState();
    ok(isMonitorButtonEnabled(), 'Enabled with valid, unmonitored URL.');

    isPageMonitored = function(url, callback) {
      equals(url, 'http://example.com/', 'URL argument to isPageMonitored()');
      callback(true);
    };
    updateButtonsState();
    ok(!isMonitorButtonEnabled(), 'Disabled with valid, monitored URL.');

    isPageMonitored = old_isPageMonitored;
    chrome.tabs.getSelected = old_getSelected;
  });

  test('updateButtonsState / View All', function() {
    $('#notifications').html('');
    updateButtonsState();
    ok($('#view_all').hasClass('inactive'), 'Added inactive class.');
    equal($('#view_all img').attr('src'), 'img/view_all_inactive.png',
          'Inactive image.');

    $('#templates .notification').appendTo('#notifications');
    updateButtonsState();
    ok(!$('#view_all').hasClass('inactive'), 'Removed inactive class.');
    equal($('#view_all img').attr('src'), 'img/view_all.png',
          'Active image.');
  });

  test('updateButtonsState / Check All Now', function() {
    var old_getAllPageURLs = getAllPageURLs;
    var old_getAllUpdatedPages = getAllUpdatedPages;

    getAllPageURLs = function(callback) {
      callback([]);
    };
    getAllUpdatedPages = function(callback) {
      callback([]);
    };
    updateButtonsState();
    ok($('#check_now').hasClass('inactive'), 'Added inactive class.');
    equal($('#check_now img').attr('src'), 'img/refresh_inactive.png',
          'Inactive image.');

    getAllPageURLs = function(callback) {
      callback(['a', 'b']);
    };
    updateButtonsState();
    ok(!$('#check_now').hasClass('inactive'), 'Removed inactive class.');
    equal($('#check_now img').attr('src'), 'img/refresh.png',
          'Active image.');

    getAllPageURLs = function(callback) {
      callback([1, 2, 3]);
    };
    getAllUpdatedPages = function(callback) {
      callback([1, 2, 3]);
    };
    updateButtonsState();
    ok($('#check_now').hasClass('inactive'), 'Readded inactive class.');
    equal($('#check_now img').attr('src'), 'img/refresh_inactive.png',
          'Inactive image.');

    getAllPageURLs = old_getAllPageURLs;
    getAllUpdatedPages = old_getAllUpdatedPages;
  });

  test('checkAllPages', function() {
    expect(28);
    var old_getAllPageURLs = getAllPageURLs;
    var old_BG = BG;
    var old_unbind = $.fn.unbind;
    var old_animate = $.fn.animate;
    var old_show = $.fn.show;
    var old_click = $.fn.click;
    var old_fillNotifications = fillNotifications;

    BG = {};

    getAllPageURLs = function(callback) {
      callback([]);
    };
    BG.check = function() {
      ok(false, 'Check called when there are no URLs to check.');
    };
    checkAllPages();

    $('#templates .notification').appendTo('#notifications');
    getAllPageURLs = function(callback) {
      callback(['a']);
    };
    checkAllPages();


    $('#notifications').html('');
    getAllPageURLs = function(callback) {
      callback(['a']);
    };
    $.fn.unbind = function(event) {
      ok(this.is('#check_now'), 'Unbinding from #check_now.');
      equal(event, 'click', 'Event to unbind from #check_now');
      return this;
    };
    $.fn.animate = function(properties, speed, callback) {
      ok(this.is('#notifications'), 'Animating #notifications.');
      same(properties, { opacity: 0.01 }, 'Animation target');
      equal(speed, 'slow', 'Animation speed');

      $.fn.show = function() {
        ok($(this).is('#check_all_test'), 'Showing #check_all_test.');
        return this;
      };
      $.fn.animate = function(properties, speed, callback) {
        ok(this.is('#check_all_test'), 'Animating #check_all_test.');
        same(properties, { opacity: 1.0 }, 'Animation target');
        equal(speed, 400, 'Animation speed');
        equal(callback, null, 'Animation callback');
        return this;
      };
      callback.call($('#check_all_test'));
      ok($('#check_all_test').hasClass('loading'), 'Added loading class.');
      var expected = $('#templates .loading_spacer').get(0).outerHTML;
      equal($('#check_all_test').html(), expected, 'Loading bar content');

      return this;
    };
    BG.check = function(force, callback) {
      equal(force, true, 'Force argument to BG.check()');

      $.fn.animate = function(properties, speed, callback) {
        ok(this.is('#notifications'), 'Animating #notifications again.');
        same(properties, { opacity: 0 }, 'Animation target');
        equal(speed, 400, 'Animation speed');
        callback.call(this);
      };
      callback();
    };
    fillNotifications = function(callback) {
      var notifications = $('#notifications');
      notifications.html('test');

      var expected_properties = { height: notifications.height() + 'px' };
      $.fn.animate = function(properties, speed, callback) {
        ok(this.is('#notifications'), 'Animating #notifications yet again.');
        same(properties, expected_properties, 'Animation target');
        equal(speed, 'slow', 'Animation speed');
        ok(!notifications.hasClass('loading'), 'Loading class removed.');
        equal(notifications.html(), '', 'Table contents');
        equal(parseInt(notifications.css('height')), '43', 'Table height');

        $.fn.animate = function(properties, speed) {
          ok(this.is('#notifications'), 'Final #notifications animation.');
          same(properties, { opacity: 1 }, 'Animation target');
          equal(speed, 400, 'Animation speed');
        };
        $.fn.click = function(handler) {
          ok(this.is('#check_now'), 'Binding click handler of #check_now.');
          equal(handler, checkAllPages, 'Handler being bound');
        };
        callback.call(this);
        equal(notifications.html(), 'test', 'Table contents at the end');
        // TODO(max99x): Re-enable this.
        //equal(notifications.css('height'), 'auto', 'Table height at the end');
      };
      callback();
    };
    checkAllPages();


    fillNotifications = old_fillNotifications;
    $.fn.click = old_click;
    $.fn.show = old_show;
    $.fn.animate = old_animate;
    $.fn.unbind = old_unbind;
    BG = old_BG;
    getAllPageURLs = old_getAllPageURLs;
  });

  test('openAllPages', function() {
    expect(4);
    var old_getSetting = getSetting;
    var old_click = $.fn.click;

    getSetting = function(name) {
      equal(name, SETTINGS.view_all_action, 'Name of the requested setting');
      return 'diff';
    };
    $.fn.click = function() {
      equal(this.selector, '#notifications .view_diff', 'Links triggered');
    };
    openAllPages();

    getSetting = function(name) {
      equal(name, SETTINGS.view_all_action, 'Name of the requested setting');
      return 'originals';
    };
    $.fn.click = function() {
      equal(this.selector, '#notifications .page_link', 'Links triggered');
    };
    openAllPages();

    $.fn.click = old_click;
    getSetting = old_getSetting;
  });

  test('openLinkInNewTab', function() {
    expect(2);
    var old_create = chrome.tabs.create;
    var event = {preventDefault: function() { ok(true, 'Default prevented.'); }};

    chrome.tabs.create = function(arg) {
      same(arg, { url: 'test', selected: false }, 'Argument to create()');
    };
    openLinkInNewTab.call({ href: 'test' }, event);

    chrome.tabs.create = old_create;
  });

  test('openDiffPage', function() {
    expect(2);
    var old_create = chrome.tabs.create;
    var old_getNotificationUrl = getNotificationUrl;

    chrome.tabs.create = function(arg) {
      same(arg, { url: 'diff.htm#' + btoa('test2'), selected: false },
           'Argument to create()');
    };
    getNotificationUrl = function(arg) {
      same(arg, 'test1', 'Argument to getNotificationUrl()');
      return 'test2';
    };
    openDiffPage.call('test1');

    getNotificationUrl = old_getNotificationUrl;
    chrome.tabs.create = old_create;
  });

  test('stopMonitoring', function() {
    expect(2);
    var old_removePage = BG.removePage;
    var old_getNotificationUrl = getNotificationUrl;

    BG.removePage = function(arg) {
      equal(arg, 'test2', 'Argument to create()');
    };
    getNotificationUrl = function(arg) {
      same(arg, 'test1', 'Argument to getNotificationUrl()');
      return 'test2';
    };
    stopMonitoring.call('test1');

    getNotificationUrl = old_getNotificationUrl;
    BG.removePage = old_removePage;
  });

  test('setUpHandlers', function() {
    expect(11);
    var old_click = $.fn.click;
    var old_live = $.fn.live;

    $.fn.click = function(handler) {
      switch (this.selector) {
        case '#monitor_page':
          equal(handler, monitorCurrentPage, 'Monitor Page handler');
          break;
        case '#check_now':
          equal(handler, checkAllPages, 'Check All Now handler');
          break;
        case '#view_all':
          equal(handler, openAllPages, 'View All handler');
          break;
        default:
          throw new Error('Invalid selector when calling click().');
      }
    };
    $.fn.live = function(event, handler) {
      equal(event, 'click', 'Type of live event bound');
      switch (this.selector) {
        case '.page_link,.mark_visited,.view_diff,.stop_monitoring':
          equal(handler, markPageVisited, 'All links handler');
          break;
        case '.page_link':
          equal(handler, openLinkInNewTab, 'Page link handler');
          break;
        case '.view_diff':
          equal(handler, openDiffPage, 'Diff link handler');
          break;
        case '.stop_monitoring':
          equal(handler, stopMonitoring, 'Stop monitoring link handler');
          break;
        default:
          throw new Error('Invalid selector when calling live().');
      }
    };
    setUpHandlers();

    $.fn.live = old_live;
    $.fn.click = old_click;
  });
});
