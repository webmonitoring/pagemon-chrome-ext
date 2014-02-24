$(function() {
  test('calculateHtmlDiff', function() {
    equal(calculateHtmlDiff('', ''), '', 'Empty string');

    equal(calculateHtmlDiff('', ' '),
          '<ins class="chrome_page_monitor_ins"> </ins>',
          'Space addition');
    equal(calculateHtmlDiff(' ', ''),
          '<del class="chrome_page_monitor_del"> </del>',
          'Space removal');

    equal(calculateHtmlDiff('', 'a'),
          '<ins class="chrome_page_monitor_ins">a</ins>',
          'Letter addition');
    equal(calculateHtmlDiff('a', ''),
          '<del class="chrome_page_monitor_del">a</del>',
          'Letter removal');
    equal(calculateHtmlDiff('a', 'b'),
          '<del class="chrome_page_monitor_del">a</del>' +
          '<ins class="chrome_page_monitor_ins">b</ins>',
          'Letter swap');

    equal(calculateHtmlDiff('', 'hello'),
          '<ins class="chrome_page_monitor_ins">hello</ins>',
          'Word addition');
    equal(calculateHtmlDiff('hello', ''),
          '<del class="chrome_page_monitor_del">hello</del>',
          'Word removal');
    equal(calculateHtmlDiff('hello', 'world'),
          '<del class="chrome_page_monitor_del">hello</del>' +
          '<ins class="chrome_page_monitor_ins">world</ins>',
          'Word swap');

    equal(calculateHtmlDiff('', '<br>'),
          '<ins class="chrome_page_monitor_ins"><br></ins>',
          'Self-closing tag addition');
    equal(calculateHtmlDiff('<br>', ''),
          '<del class="chrome_page_monitor_del"><br></del>',
          'Self-closing tag removal');
    equal(calculateHtmlDiff('<br>', '<br />'), '<br>', 'Self-closing tag swap');

    equal(calculateHtmlDiff('', '<span>'),
          '<ins class="chrome_page_monitor_ins"><span></span></ins>',
          'Non-closing tag addition');
    equal(calculateHtmlDiff('<span>', ''),
          '<del class="chrome_page_monitor_del"><span></span></del>',
          'Non-closing tag removal');
    equal(calculateHtmlDiff('<span>', '<p>'),
          '<del class="chrome_page_monitor_del"><span></span></del>' + 
          '<ins class="chrome_page_monitor_ins"><p></p></ins>',
          'Non-closing tag swap');

    equal(calculateHtmlDiff('<span>hello<br>world</span>! This is a test.',
                            '<img src="hello_world.png"><span>Testing</span>'),
          '<ins class="chrome_page_monitor_ins">' +
            '<img src="hello_world.png">' +
          '</ins>' +
          '<span>' +
            '<del class="chrome_page_monitor_del">hello<br>world</del>' +
            '<ins class="chrome_page_monitor_ins">Testing</ins>' +
          '</span>' +
          '<del class="chrome_page_monitor_del">! This is a test.</del>',
          'Mixed swap');
  });

  test('calculateTextDiff', function() {
    equal(calculateTextDiff('', ''), '<pre></pre>', 'Empty string');

    equal(calculateTextDiff('', ' '),
          '<pre><ins class="chrome_page_monitor_ins"> </ins></pre>',
          'Space addition');
    equal(calculateTextDiff(' ', ''),
          '<pre><del class="chrome_page_monitor_del"> </del></pre>',
          'Space removal');

    equal(calculateTextDiff('', '\n'),
          '<pre><ins class="chrome_page_monitor_ins"><br /></ins></pre>',
          'Newline addition');
    equal(calculateTextDiff('\r\n', ''),
          '<pre><del class="chrome_page_monitor_del"><br /></del></pre>',
          'Newline removal');

    equal(calculateTextDiff('', 'a'),
          '<pre><ins class="chrome_page_monitor_ins">a</ins></pre>',
          'Letter addition');
    equal(calculateTextDiff('a', ''),
          '<pre><del class="chrome_page_monitor_del">a</del></pre>',
          'Letter removal');
    equal(calculateTextDiff('a', 'b'),
          '<pre><del class="chrome_page_monitor_del">a</del>' +
          '<ins class="chrome_page_monitor_ins">b</ins></pre>',
          'Letter swap');

    equal(calculateTextDiff('', 'hello'),
          '<pre><ins class="chrome_page_monitor_ins">hello</ins></pre>',
          'Word addition');
    equal(calculateTextDiff('hello', ''),
          '<pre><del class="chrome_page_monitor_del">hello</del></pre>',
          'Word removal');
    equal(calculateTextDiff('hello', 'world'),
          '<pre><del class="chrome_page_monitor_del">hello</del>' +
          '<ins class="chrome_page_monitor_ins">world</ins></pre>',
          'Word swap');

    equal(calculateTextDiff('', '<span>'),
          '<pre><ins class="chrome_page_monitor_ins">&lt;span&gt;</ins></pre>',
          'Non-closing tag addition');
    equal(calculateTextDiff('<span>', ''),
          '<pre><del class="chrome_page_monitor_del">&lt;span&gt;</del></pre>',
          'Non-closing tag removal');
    equal(calculateTextDiff('<span>', '<p>'),
          '<pre>&lt;<del class="chrome_page_monitor_del">span</del>' +
          '<ins class="chrome_page_monitor_ins">p</ins>&gt;</pre>',
          'Non-closing tag swap');

    equal(calculateTextDiff('hello\n  there\n  nice\n  world!',
                            'there are\n\nno tests.'),
          '<pre><del class="chrome_page_monitor_del">hello<br />  there' +
          '<br />  nice<br />  world!</del>' +
          '<ins class="chrome_page_monitor_ins">' +
          'there are<br /><br />no tests.</ins></pre>',
          'Generic text swap with lots of distorted spacing');

    equal(calculateTextDiff('hello\nthere\nnice\nworld!',
                            'it\nis\na\nworld!'),
          '<pre><del class="chrome_page_monitor_del">hello<br />there<br />' +
          'nice</del><ins class="chrome_page_monitor_ins">it<br />is' +
          '<br />a</ins><br />world!</pre>',
          'Multi-line with shared suffix');
  });

  test('generateControls', function() {
    var $controls = generateControls('test');

    ok($controls.is('#chrome_page_monitor_ext_orig_link'), 'Block id');
    equal($('a', $controls).length, 3, 'Links in block');
    equal($('br', $controls).length, 2, 'Line breaks in block');
    equal($('a:first', $controls).attr('href'), 'test', 'Injected URL');
    equal($('a:first', $controls).attr('title'),
          chrome.i18n.getMessage('diff_original_title'),
          'Original link title');
    equal($('.pm_original', $controls).text(),
          chrome.i18n.getMessage('diff_original'),
          'Original link text');
    equal($('.pm_textize', $controls).text(),
          chrome.i18n.getMessage('diff_textize'),
          'Textize button text');
    equal($('.pm_hide', $controls).text(),
          chrome.i18n.getMessage('diff_hide_deletions'),
          'Hide button text');

    $('#del_test').show();
    $('a:last', $controls).click();
    equal($('#del_test').css('display'), 'none',
          '<del> display after first click');
    $('a:last', $controls).click();
    equal($('#del_test').css('display'), 'inline',
          '<del> display after second click');

    // TODO: Test textize switcher.
  });

  test('calculateBaseUrl', function() {
    equal(calculateBaseUrl('a', '', ''), 'a', 'Empty strings');
    equal(calculateBaseUrl('a', '<span>hello</span>', '<br />'), 'a',
          'Irrelevant HTML');
    equal(calculateBaseUrl('a', '<base href="b">', '<br />'), 'b',
          'Base in src');
    equal(calculateBaseUrl('a', '<br />', '<base href="c">'), 'c',
          'Base in dest');
    equal(calculateBaseUrl('a', '<base href="b">', '<base href="c">'), 'b',
          'Base in both src and dest');
    equal(calculateBaseUrl('a', '<base href="">', '<base href="">'), 'a',
          'Empty base in both src and dest');
    equal(calculateBaseUrl('a', '<base attr="x" href="b" type="d" />', ''), 'b',
          'Self-closed base in src with extra attributes');
  });

  test('getInlineStyles', function() {
    equal(getInlineStyles(''), '', 'Empty string');
    equal(getInlineStyles('<span>test</span>'), '', 'Irrelevant HTML');
    equal(getInlineStyles('<style>test</style>'), 'test', 'Style tag alone');
    equal(getInlineStyles('<style>test</style><style>test2</style>'),
          'test\ntest2',
          'Two style tags alone');
    equal(getInlineStyles('<html><style>abc</style><link>def</link></html>'),
          'abc',
          'Style tag in HTML');
    equal(getInlineStyles('<html><style>abc</style><link>def</link><style>' + 
                          'ghi</style></html>'),
          'abc\nghi',
          'Two style tags in HTML');
    equal(getInlineStyles('<html><style type="text/css">abc</style></html>'),
          'abc',
          'Style tag with attributes');
  });

  test('getReferencedStyles', function() {
    equal(getReferencedStyles('').length, 0, 'Empty string');
    equal(getReferencedStyles('<span>abc</span>').length, 0, 'Irrelevant HTML');
    equal(getReferencedStyles('<link href="abc">').length, 0,
          'Rel-less link tag, alone');
    equal(getReferencedStyles('<link href="abc" rel="home">').length, 0,
          'Non-stylesheet link tag, alone');
    equal(getReferencedStyles('<link href="abc" rel="stylesheet">').length, 1,
          'Stylesheet link tag, alone');
    equal(getReferencedStyles('<link href="a" rel="stylesheet">').attr('href'),
          'a',
          'Stylesheet link tag, href');
    equal(getReferencedStyles('<link href="abc" rel="stylesheet">' +
                              '<link href="def" rel="stylesheet">').length, 2,
          'Two stylesheet link tags');
    equal(getReferencedStyles('<html><head><link href="abc" rel="stylesheet">' +
                              '<script>x</script><link href="def" rel=' + 
                              '"notastyle"><style>y</style><link href="ghi"' +
                              ' rel="stylesheet"></head></html>').length, 2,
          'Two valid stylesheet link tag in HTML');
  });

  test('findFirstChangePosition', function() {
    var content_div = $('body>div');
    var old_content = content_div.html();

    content_div.html('');
    same(findFirstChangePosition(), { left: 0, top: 0 }, 'No <del>/<ins> tags');

    content_div.html('<del></del>');
    same(findFirstChangePosition(), { left: 0, top: 0 }, 'Empty <del> tag');

    content_div.html('<del>   \t\r\n   </del>');
    same(findFirstChangePosition(), { left: 0, top: 0 },
         'Whitespace-only <del> tag');

    content_div.html('<del>a</del>');
    same(findFirstChangePosition(), $('del', content_div).position(),
         '<del> tag with content');

    content_div.html('<ins>a</ins>');
    same(findFirstChangePosition(), $('ins', content_div).position(),
         '<ins> tag with content');

    content_div.html('<ins>a</ins><br/><del>b</del>');
    same(findFirstChangePosition(), $('ins', content_div).position(),
         'Both <ins> and <del> tags with content');

    content_div.html(old_content);
  });

  test('applyDiff', function() {
    expect(28);

    var old_calculateBaseUrl = calculateBaseUrl;
    var old_getInlineStyles = getInlineStyles;
    var old_getReferencedStyles = getReferencedStyles;
    var old_calculateHtmlDiff = calculateHtmlDiff;
    var old_calculateTextDiff = calculateTextDiff;
    var old_getStrippedBody = getStrippedBody;
    var old_generateControls = generateControls;
    var old_findFirstChangePosition = findFirstChangePosition;
    var old_scrollTo = scrollTo;
    var old_alert = alert;
    var old_html = $.fn.html;
    var old_setTimeout = setTimeout;

    setTimeout = function(f, ms) {
      f();
    };
    calculateBaseUrl = function(url, src, dest) {
      ok(true, 'calculateBaseUrl() called.');
      equal(url, 'url', 'URL passed to calculateBaseUrl()');
      equal(src, 'src', 'Src passed to calculateBaseUrl()');
      equal(dest, 'dest', 'Dest passed to calculateBaseUrl()');
      return 'url2';
    };
    getInlineStyles = function(src) {
      ok(true, 'getInlineStyles() called.');
      equal(src, 'dest', 'Dest passed to getInlineStyles()');
      return 'style1';
    };
    getReferencedStyles = function(src) {
      ok(true, 'getReferencedStyles() called.');
      equal(src, 'dest', 'Dest passed to getReferencedStyles()');
      return $('<link rel="test" />');
    };
    calculateHtmlDiff = function(src, dest) {
      ok(true, 'calculateHtmlDiff() called for an HTML input.');
      equal(src, 'src2', 'Src passed to calculateHtmlDiff()');
      equal(dest, 'dest2', 'Dest passed to calculateHtmlDiff()');
      return 'diff';
    };
    calculateTextDiff = function() {
      ok(false, 'calculateTextDiff() called for an HTML input.');
      return '';
    };
    getStrippedBody = function(html) {
      ok(true, 'getStrippedBody() called.');
      var valid = (html == 'src') || (html == 'dest');
      ok(valid, 'Valid argument passed to getStrippedBody().');
      return html + '2';
    };
    generateControls = function(url) {
      ok(true, 'generateControls() called.');
      equal(url, 'url', 'URL passed to generateControls()');
      return $('<div style="display: none" class="test_genControls">');
    };
    findFirstChangePosition = function() {
      ok(true, 'findFirstChangePosition() called.');
      return { top: 42, left: 43 };
    };
    scrollTo = function(left, top) {
      ok(true, 'scrollTo() called.');
      equal(top, 42 - SCROLL_MARGIN, 'Left passed to scrollTo()');
      equal(left, 43, 'Left passed to scrollTo()');
    };
    alert = function(left, top) {
      ok(false, 'alert() called when it shouldn\'t.');
    };
    $.fn.html = function(html) {
      ok(true, '$.fn.html() called.');
      equal(this.selector, 'body', 'Selector used when calling $.fn.html()');
      equal(html, 'diff', 'Diff passed to $.fn.html()');
    };

    applyDiff('url', 'src', 'dest', 'text/html');

    equal($('base[href=url2]').length, 1, '<base> tags added');
    equal($('style:last').text(), 'style1', '<style> tag content');
    equal($('link[rel=test]').length, 1, '<link> tags added');
    equal($('div.test_genControls').length, 1, 'Control blocks added');

    $('base,style:last,link[rel=test],.test_genControls').remove();

    calculateBaseUrl = old_calculateBaseUrl;
    getInlineStyles = old_getInlineStyles;
    getReferencedStyles = old_getReferencedStyles;
    calculateHtmlDiff = old_calculateHtmlDiff;
    calculateTextDiff = old_calculateTextDiff;
    getStrippedBody = old_getStrippedBody;
    generateControls = old_generateControls;
    findFirstChangePosition = old_findFirstChangePosition;
    scrollTo = old_scrollTo;
    alert = old_alert;
    setTimeout = old_setTimeout;
    $.fn.html = old_html;
  });

  test('initiateDiff (valid page)', function() {
    expect(15);

    var old_getPage = getPage;
    var old_ajax = $.ajax;
    var old_canonizePage = canonizePage;
    var old_applyDiff = applyDiff;
    var old_setPageSettings = setPageSettings;
    var old_hide = $.fn.hide;
    var old_html = $.fn.html;

    getPage = function(url, callback) {
      ok(true, 'getPage() called.');
      equal(url, 'test_url', 'URL passed to getPage()');
      callback({ html: 'test_html' });
    }
    $.ajax = function(arg) {
      ok(true, '$.ajax() called.');
      equal(arg.url, 'test_url', 'URL passed to $.ajax()');
      equal(arg.dataType, 'text', 'Data type passed to $.ajax()');
      arg.success('test_html2', 0, { getResponseHeader: function(arg) {
        ok(true, 'getResponseHeader() called.');
        equal(arg, 'Content-type', 'Header requested');
        return 'test_type';
      } });
    }
    canonizePage = function(html, type) {
      ok(true, 'canonizePage() called.');
      equal(html, 'test_html2', 'HTML passed to canonizePage()');
      equal(type, 'test_type', 'Type passed to canonizePage()');
      return 'test_html3';
    }
    applyDiff = function(url, src, dst, type) {
      ok(true, 'applyDiff() called.');
      equal(url, 'test_url', 'URL passed to applyDiff()');
      equal(src, 'test_html', 'Src passed to applyDiff()');
      equal(dst, 'test_html3', 'Dst passed to applyDiff()');
      equal(type, 'test_type', 'Type passed to applyDiff()');
    }
    setPageSettings = function() {
      ok(false, 'setPageSettings() called when it shouldn\'t have.');
    }
    $.fn.hide = function() {
      ok(false, '$.fn.hide() called when it shouldn\'t have.');
    }
    $.fn.html = function() {
      ok(false, '$.fn.html() called when it shouldn\'t have.');
    }

    initiateDiff('test_url');

    getPage = old_getPage;
    $.ajax = old_ajax;
    canonizePage = old_canonizePage;
    applyDiff = old_applyDiff;
    setPageSettings = old_setPageSettings;
    $.fn.hide = old_hide;
    $.fn.html = old_html;
  });

  test('initiateDiff (invalid page)', function() {
    expect(14);

    var old_getPage = getPage;
    var old_ajax = $.ajax;
    var old_canonizePage = canonizePage;
    var old_applyDiff = applyDiff;
    var old_setPageSettings = setPageSettings;
    var old_hide = $.fn.hide;
    var old_html = $.fn.html;

    getPage = function(url, callback) {
      ok(true, 'getPage() called.');
      equal(url, 'test_url', 'URL passed to getPage()');
      callback({ html: '' });
    }
    $.ajax = function(arg) {
      ok(true, '$.ajax() called.');
      equal(arg.url, 'test_url', 'URL passed to $.ajax()');
      equal(arg.dataType, 'text', 'Data type passed to $.ajax()');
      arg.success('test_html2', 0, { getResponseHeader: function(arg) {
        ok(true, 'getResponseHeader() called.');
        equal(arg, 'Content-type', 'Header requested');
        return 'test_type';
      } });
    }
    canonizePage = function(html, type) {
      ok(true, 'canonizePage() called.');
      equal(html, 'test_html2', 'HTML passed to canonizePage()');
      equal(type, 'test_type', 'Type passed to canonizePage()');
      return 'test_html3';
    }
    applyDiff = function(url, src, dst, type) {
      ok(false, 'applyDiff() called when it shouldn\'t have.');
    }
    setPageSettings = function(url, obj) {
      ok(true, 'setPageSettings() called.');
      equal(url, 'test_url', 'URL passed to setPageSettings()');
      same(obj, { html: 'test_html2' }, 'Update passed to setPageSettings()');
    }
    $.fn.hide = function() {
      ok(true, '$.fn.hide() called.');
      equal(this.selector, 'img', 'Selector used with $.fn.hide()');
    }
    $.fn.html = function() {
      ok(true, '$.fn.html() called.');
      equal(this.selector, 'div:first', 'Selector used with $.fn.html()');
    }

    initiateDiff('test_url');

    getPage = old_getPage;
    $.ajax = old_ajax;
    canonizePage = old_canonizePage;
    applyDiff = old_applyDiff;
    setPageSettings = old_setPageSettings;
    $.fn.hide = old_hide;
    $.fn.html = old_html;
  });
});