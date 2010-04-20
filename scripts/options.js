// Background graying function, based on: 
// http://www.hunlock.com/blogs/Snippets:_Howto_Grey-Out_The_Screen
function grayOut(show, id_prefix) {
  // Pass true to gray out screen, false to ungray.
  var dark_id = (id_prefix || '') + '_shader';
  var dark = document.getElementById(dark_id);
  var first_time = (dark == null);
  
  if (first_time) {
    // First time - create shading layer.
    var dark = document.createElement('div');
    dark.id = dark_id;
    
    dark.style.position = 'absolute';
    dark.style.top = '0px';
    dark.style.left = '0px';
    dark.style.overflow = 'hidden';
    dark.style.opacity = '0';
    dark.style['-webkit-transition'] = 'opacity 0.5s ease';
    
    document.body.appendChild(dark);
  }
  
  if (show) {
    // Set the shader to cover the entire page and make it visible.
    dark.style.zIndex = 1;
    dark.style.backgroundColor = '#000000';
    dark.style.width = document.body.scrollWidth + 'px';
    dark.style.height = document.body.scrollHeight + 'px';
    dark.style.display = 'block';
    
    setTimeout(function() {dark.style.opacity = 0.7;}, 100);
  } else if (dark.style.opacity != 0) {
    setTimeout(function() {dark.style.opacity = 0;}, 100);
    setTimeout(function() {dark.style.display = 'none';}, 600);
  }
}

function initializeColorPicker() {
  var toHex = function(d) {
    return d >= 16 ? d.toString(16) : '0' + d.toString(16);
  }
  
  var badge_color = getSetting(SETTINGS.badge_color);
  var badge_color = '#' + toHex(badge_color[0]) + 
                          toHex(badge_color[1]) +
                          toHex(badge_color[2]);
  
  $('#badge_color input').val(badge_color).change(function() {
    var color = $(this).val();
  
    setSetting(SETTINGS.badge_color, [parseInt(color.slice(1,3), 16),
                                      parseInt(color.slice(3,5), 16),
                                      parseInt(color.slice(5,7), 16),
                                      255]);
    BG.updateBadge();
  }).colorPicker();
}
  
function initializeAnimationToggler() {
  $('#animation select').change(function() {
    var disabled = ($(this).val() != 'enabled');
    setSetting(SETTINGS.animations_disabled, disabled);
    $.fx.off = disabled;
  }).val(getSetting(SETTINGS.animations_disabled) ? 'disabled' : 'enabled');
}

function initializeSorter() {
  $('#sort select').change(function() {
    setSetting(SETTINGS.sort_by, $(this).val());
    fillPagesList();
  }).val(getSetting(SETTINGS.sort_by) || 'date added');
}

function initializeNotificationsChecker() {
  if (window.webkitNotifications.checkPermission() != 0) {
    setSetting(SETTINGS.notifications_enabled, false);
  }
  
  $('#notifications select').change(function() {
    var $this = $(this);
  
    var enabled = ($this.val() == 'enabled');
    if (enabled) {
      if (window.webkitNotifications.checkPermission() == 0) {
        setSetting(SETTINGS.notifications_enabled, true);
      } else {
        $this.val('disabled');
        webkitNotifications.requestPermission(function() {
          if (window.webkitNotifications.checkPermission() == 0) {
            setSetting(SETTINGS.notifications_enabled, true);
            $this.val('enabled');
          }
        });
      }
    } else {
      setSetting(SETTINGS.notifications_enabled, false);
    }
  }).val(getSetting(SETTINGS.notifications_enabled) ? 'enabled' : 'disabled');
  
  var timeout = (getSetting(SETTINGS.notifications_timeout) / 1000) || 30;
  $('#notifications input').val(timeout).keyup(function() {
    var new_timeout = cleanTimeoutTextbox(this);
    if (new_timeout < 1) {
      new_timeout = 1;
      $(this).val(new_timeout);
    }
    setSetting(SETTINGS.notifications_timeout, new_timeout * 1000);
  }).blur(function() { $(this).keyup(); });
}

function initializeSoundSelector() {
  var select = $('#sound_alert select');
  var play_button = $('#play_sound');
  var new_button = $('#new_sound');
  var new_form = $('#new_sound_form');
  
  new_form.css({
    top: (window.innerHeight - new_form.height()) / 2,
    left: (window.innerWidth - new_form.width()) / 2
  });
  
  var custom_sounds = getSetting(SETTINGS.custom_sounds) || [];
  $.each(custom_sounds, function(i, v) {
    $('<option>').text(v.name).attr('value', v.url).appendTo(select);
  });
  
  select.change(function() {
    var audio_file = select.val();
    
    setSetting(SETTINGS.sound_alert, audio_file);
    
    play_button.attr({ disabled: audio_file == '' });
  });
  
  play_button.click(function() {
    select.attr({ disabled: true });
    play_button.attr({ disabled: true });
    
    var audio = new Audio(select.val());
    
    audio.addEventListener('ended', function() {
      select.attr({ disabled: false });
      play_button.attr({ disabled: false });
    });
    audio.play();
  });
  
  new_button.click(function() {
    $('input', new_form).val('');
    grayOut(true);
    new_form.fadeIn();
  });
  
  $('#new_sound_cancel').click(function() {
    grayOut(false);
    new_form.fadeOut();
  });
  
  $('#new_sound_create').click(function() {
    var name = $('#new_sound_name').val();
    var url = $('#new_sound_url').val();
    var create_button = $(this);
    
    if (!(url && name)) {
      alert(chrome.i18n.getMessage('new_sound_prompt'));
      return;
    }
    
    create_button.attr('disabled', true);
    create_button.css('cursor', 'progress');
    
    var restoreCreateButton = function() {
      create_button.attr('disabled', false);
      create_button.css('cursor', 'auto');
    }
    
    new Audio(url).addEventListener('error', function() {
      alert(chrome.i18n.getMessage('new_sound_failed'));
      restoreCreateButton();
    });
    new Audio(url).addEventListener('canplaythrough', function() {
      var custom_sounds = getSetting(SETTINGS.custom_sounds) || [];
      custom_sounds.push({ name: name, url: url });
      setSetting(SETTINGS.custom_sounds, custom_sounds);
      
      $('<option>').text(name).attr('value', url).appendTo(select);
      
      restoreCreateButton();
      grayOut(false);
      new_form.fadeOut();
    });
  });
  
  select.val(getSetting(SETTINGS.sound_alert) || '');
  select.change();
}

function initializeExporter() {
  var form = $('#export_form');
  
  $('#export').click(function() {
    exportPagesList(function(result) {
      $('textarea', form).val(result);
      grayOut(true);
      form.fadeIn();
    });
  });

  $('button', form).click(function() {
    form.fadeOut();
    grayOut(false);
  });
}

function initializeImporter() {
  var form = $('#import_form');
  
  $('#import').click(function() {
    grayOut(true);
    form.fadeIn();
  });
    
  $('#import_cancel', form).click(function() {
    form.fadeOut();
    grayOut(false);
  });
  
  $('#import_perform', form).click(function() {
    var count = 0;
    try {
      count = importPagesList($('textarea', form).val());
    } catch (e) {
      alert(chrome.i18n.getMessage('import_error'));
      form.fadeOut();
      grayOut(false);
      return;
    }
    if (count) {
      var singular = chrome.i18n.getMessage('import_success_single');
      var plural = chrome.i18n.getMessage('import_success_multi', count.toString());
      alert(count == 1 ? singular : plural);
      fillPagesList();
    } else {
      alert(chrome.i18n.getMessage('import_empty'));
    }
    form.fadeOut();
    grayOut(false);
  });
}

function initializeTimeoutTextbox() {
  var timeout = Math.round(getSetting(SETTINGS.check_interval) / (60 * 1000));
  
  $('#global_timeout input').val(timeout).keyup(function() {
    setSetting(SETTINGS.check_interval, cleanTimeoutTextbox(this) * 60 * 1000);
  }).blur(function() { $(this).keyup(); });
}

function cleanTimeoutTextbox(textbox) {
  var caret_pos = textbox.selectionStart;
  var caret_end = textbox.selectionEnd;
  
  var str_timeout = $(textbox).val().replace(/[^.0-9]/g, '');
  var new_timeout = parseFloat(str_timeout) || 1;
  
  if (new_timeout <= 5 / 60) {
    new_timeout = 5 / 60;
  }
  
  if (str_timeout.match(/^0*\.|\.0*$/)) {
    $(textbox).val(str_timeout);
  } else {
    $(textbox).val(new_timeout);
  }
  
  textbox.selectionStart = caret_pos;
  textbox.selectionEnd = caret_end;
  
  return new_timeout;
}

// Returns the URL of the page record given any element in it.
function findUrl(context) {
  return $(context).closest('.page_record').find('.page_link').get()[0].href;
}

function fillPagesList() {
  var global_check_interval = getSetting(SETTINGS.check_interval);
  getAllPages(function(pages) {
    // Sort the pages.
    var sort_order = getSetting(SETTINGS.sort_by);
    if (sort_order != 'date added') {
      pages.sort(function(a, b) {
        if (sort_order == 'name') {
          a = a.name;
          b = b.name;
        } else if (sort_order == 'check interval') {
          a = a.check_interval || global_check_interval;
          b = b.check_interval || global_check_interval;
        } else if (sort_order == 'last check') {
          a = -a.last_check;
          b = -b.last_check;
        } else if (sort_order == 'last changed') {
          a = -a.last_changed || 0;
          b = -b.last_changed || 0;
        }
        
        return (a < b) ? -1 : 1;
      });
    }
    
    // Clear the list.
    $('#pages').html('');
    
    // Fill the list.
    if (pages.length > 0) {
      $.each(pages, function(_, page) {
        var page_record = $('#templates .page_record').clone();
        var check_interval = page.check_interval || global_check_interval;
        var advanced_set = false;
    
        var name = page.name || chrome.i18n.getMessage('untitled', page.url);
        if (name.length > 60) {
          name = name.replace(/([^]{20,60})(\w)\b.*$/, '$1$2...');
        }
        
        page_record.find('.page_link').attr({
          href: page.url,
          target: '_blank'
        }).text(name);
        
        page_record.find('.favicon').attr({
          src: page.icon || 'img/page.png'
        });
        
        var last_check_span = page_record.find('.last_check_time');
        last_check_span.bind('time_updated', function() {
          var $span = $(this);
          getPage(page.url, function(page) {
            var last_check = page.last_check ? describeTimeSince(page.last_check) : chrome.i18n.getMessage('never');
            
            if (last_check != $span.text()) {
              $span.fadeOut('slow', function() {
                $span.text(last_check).fadeIn('slow');
              });
            }
          });
        });
        last_check_span.trigger('time_updated');
        setInterval(function() { last_check_span.trigger('time_updated'); }, 15000);
        
        var timeout = check_interval / (60 * 1000);
        page_record.find('.timeout input[type=text]').val(timeout);
        if (page.check_interval) {
          page_record.find('.timeout span').addClass('enabled').removeClass('disabled');
          page_record.find('.timeout input').attr({ disabled: false });
          page_record.find('.timeout input[type=checkbox]').attr({ checked: true });
          advanced_set = true;
        }
        
        page_record.find('.mode input[type=radio]').attr({name: 'name' + crc(page.url) });
        
        if (page.mode == null) {
          if (page.regex) {
            page.mode = 'regex';
          } else {
            page.mode = 'text';
          }
        }
        if (page.mode == 'text') {
          page_record.find('.mode input[type=radio]').first().attr({ checked: true });
        } else {
          page_record.find('.mode span').first().addClass('enabled').removeClass('disabled');
          page_record.find('.mode input').attr({ disabled: false });
          page_record.find('.mode input[type=checkbox]').attr({ checked: true });
          page_record.find('.mode input[type=radio][value=' + page.mode + ']')
                     .click();
          if (page.mode == 'regex') {
            page_record.find('.mode input[type=text]').val(page.regex);
          } else if (page.mode == 'selector') {
            page_record.find('.mode input[type=text]').val(page.selector);
          }
          advanced_set = true;
        }
        
        if (advanced_set) {
          page_record.find('.advanced_toggle input[type=checkbox]').attr({ checked: true });
          page_record.find('.advanced_toggle').addClass('toggled');
          page_record.find('.advanced_controls').css({ display: 'block' });
        }
        
        page_record.appendTo('#pages');
      });
    } else {
      $('#templates .empty').clone().appendTo('#pages');
    }
  });
}

function setPageTimeout(context, timeout) {
  var url = findUrl(context);
  
  if (timeout != null) timeout = parseFloat(timeout) * 60 * 1000;
  
  setPageSettings(url, {check_interval: timeout}, BG.scheduleCheck);
}

function setPageRegex(context, regex) {
  if (regex === null)  {
    setPageSettings(findUrl(context), {regex: null, mode: 'text'});
  } else {
    var is_valid_regex = true;
    try {
      var temp_regex = new RegExp(regex);
    } catch (e) {
      is_valid_regex = false;
    }
  
    var textbox = $(context).closest('.page_record').find('.mode input[type=text]');
    var test_button = $(context).closest('.page_record').find('.mode input[type=button]');
    if (is_valid_regex) {
      textbox.removeClass('invalid');
      test_button.attr({ disabled: false });
      setPageSettings(findUrl(context), {regex: regex});
    } else {
      test_button.attr({ disabled: true });
      textbox.addClass('invalid');
    }
  }
}

function setPageSelector(context, selector) {
  if (selector === null)  {
    setPageSettings(findUrl(context), {selector: null, mode: 'text'});
  } else {
    var is_valid_selector = true;
    try {
      $(selector);
    } catch (e) {
      is_valid_selector = false;
    }
  
    var textbox = $(context).closest('.page_record').find('.mode input[type=text]');
    var test_button = $(context).closest('.page_record').find('.mode input[type=button]');
    if (is_valid_selector) {
      textbox.removeClass('invalid');
      test_button.attr({ disabled: false });
      setPageSettings(findUrl(context), {selector: selector});
    } else {
      test_button.attr({ disabled: true });
      textbox.addClass('invalid');
    }
  }
}

function exportPagesList(callback) {
  getAllPages(function(pages) {
    var buffer = [];
    var add_date = new Date().getTime();
    
    buffer.push('<!DOCTYPE NETSCAPE-Bookmark-file-1>\n\n\<\!\-\- This is an' +
                ' automatically generated file.\n     It will be read and' +
                ' overwritten.\n     DO NOT EDIT! \-\-\>\n<META HTTP-EQUIV=' +
                '"Content-Type" CONTENT="text/html; charset=UTF-8">\n<TITLE>' +
                'Bookmarks</TITLE>\n<H1>Bookmarks</H1>\n<DL><p>\n');
    
    for (var i in pages) {
      var icon_attr = pages[i].icon ? ' ICON_URI="' + pages[i].icon + '" ' : '';
      buffer.push('        <DT><A HREF="' + pages[i].url + '" ADD_DATE="' + add_date + '"' + icon_attr + '>' + pages[i].name + '</A>\n');
      
      var advanced_settings = {
        mode: pages[i].mode,
        regex: pages[i].regex,
        selector: pages[i].selector,
        check_interval: pages[i].check_interval,
        crc: pages[i].crc,
        last_check: pages[i].last_check,
        last_changed: pages[i].last_changed,
      }
      var encoded_settings = JSON.stringify(advanced_settings).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
      buffer.push('            \<\!\-\-PageMonitorAdvancedPageData=' + encoded_settings + '\-\-\>\n');
    }
    
    buffer.push('</DL><p>');
    
    (callback || $noop)(buffer.join(''));
  });
}

function importPagesList(bookmarks) {
  var page_regex = /(<[aA][^<>]+>[^<>]+<\/[aA]>)(?:\s*\<\!\-\-PageMonitorAdvancedPageData=(\{.*\})\-\-\>\n)?/g;
  var match;
  var matches_count = 0;
  
  while (match = page_regex.exec(bookmarks, page_regex.lastIndex)) {
    var page_link = $(match[1]);
    var page_url = page_link.attr('HREF') || '';
    var page_name = page_link.text() || chrome.i18n.getMessage('untitled', page_url);
    var page_icon = page_link.attr('ICON_URI') || null;
    
    var advanced = {};
    if (match[2]) {
      advanced = JSON.parse(match[2].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'));
    }
    
    if (page_url) {
      var page = $.extend({ url: page_url, name: page_name, icon: page_icon }, advanced);
      addPage(page);
      matches_count++;
    }
  }
  
  return matches_count;
}
