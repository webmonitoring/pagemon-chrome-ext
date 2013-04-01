/*
  The code behind the options HTML page. Manages manipulating the pages list as
  well as editing global and per-page settings.
*/

/*******************************************************************************
*                                  Utilities                                   *
*******************************************************************************/

// The minimum length of time in minutes that a time textbox is allowed to have.
var MIN_TIME_TEXTBOX_VALUE = 0.8;  // ~5 seconds.

// Returns a boolean indicating whether the supplied string is a valid regex.
function isValidRegex(regex) {
  try {
    new RegExp(regex);
  } catch (e) {
    return false;
  }
  return true;
}

// Returns a boolean indicating whether the supplied string is a valid selector.
function isValidSelector(selector) {
  if (selector == '#') {
    return false;
  }
  try {
    $(selector);
  } catch (e) {
    return false;
  }
  return true;
}

// Fades the background (elements with z-index < 1) to gray and back, depending
// on whether the "show" argument evaluates to boolean true or false.
function shadeBackground(show) {
  var dark = $('#shader');
  if (dark.length == 0) dark = $('<div id="shader" />').appendTo('body');
  dark.height($('body').get(0).scrollHeight);

  if (show) {
    dark.css('display', 'block').animate({ opacity: 0.7 });
  } else {
    dark.animate({ opacity: 0 }, function() {
      dark.css('display', 'none');
    });
  }
}

// Returns the URL of the page record given any element in it.
function findUrl(context) {
  return $(context).closest('.page_record').find('.page_link').get(0).href;
}

// Returns a jQuery-wrapped page_record element which contains the specified
// context element of a link to the specified URL.
function findPageRecord(url_or_context) {
  if (typeof(url_or_context) == 'string') {
    url_or_context = '.page_link[href="' + url_or_context + '"]';
  }
  return $(url_or_context).closest('.page_record');
}

// Returns 2 to the power of the given value. Used when converting the value of
// the check interval sliders which use a logarithmic scale. The returned value
// is rounded to 2 decimal places if they are below 1. It is rounded to 1
// decimal place for values between 1 and 10. It is rounded to an integer for
// values above 10.
function timeLogToAbsolute(log) {
  var val = Math.pow(1.5, log);
  if (val < 1) {
    return Math.round(val * 100) / 100;
  } else if (val < 10) {
    return Math.round(val * 10) / 10;
  } else {
    return Math.round(val);
  }
}

// Returns the logarithm of 2 for the given value. Used when setting the check
// interval sliders which use a logarithmic scale.
function timeAbsoluteToLog(absolute) {
  return Math.log(absolute) / Math.log(1.5);
}

// Enables or disables the Test button and the regex/selector textbox for a
// particular page record depending on whether the enable argument is non-false.
function updatePageModeControls(page_record, enable) {
  page_record.find('.mode .mode_string').toggleClass('invalid', !enable);
  page_record.find('.mode .mode_test').attr({ disabled: !enable });
}

// Applies a per-page check interval to a page given its URL. The interval
// should be a number in minutes or a null to disable custom interval for this
// page. After the new value is applied, scheduleCheck() is called on the
// background page.
function setPageCheckInterval(url, minutes) {
  var interval = (parseFloat(minutes) * 60 * 1000) || null;
  setPageSettings(url, { check_interval: interval }, BG.scheduleCheck);
}

// Saves a regex or selector to a page's DB record given its URL. The mode
// argument must be either "regex" or "selector". The value argument is either a
// string or a null. If it's null, the page is switched to text mode and its
// regex and selector fields are deleted. If it's a valid regex/selector string,
// it is saved to the page record. If the value is non-null,
// updatePageModeControls() is called with the validity of the value as the
// enable argument.
function setPageRegexOrSelector(url, mode, value) {
  if (mode != 'regex' && mode != 'selector') throw(new Error('Invalid mode.'));

  if (value === null)  {
    setPageSettings(url, { mode: 'text', regex: null, selector: null });
  } else {
    var is_regex = (mode == 'regex');
    var valid = value && (is_regex ? isValidRegex : isValidSelector)(value);
    updatePageModeControls(findPageRecord(url), valid);
    if (valid) {
      var settings = { mode: mode };
      if (is_regex) {
        settings.regex = value;
      } else {
        settings.selector = value;
      }
      setPageSettings(url, settings);
    }
  }
}

/*******************************************************************************
*                              Import & Export                                 *
*******************************************************************************/

// Assembles a netscape bookmark file containing all the pages currently being
// monitored. Proprietary settings are put into a comment after each <DT>
// element. The comment starts with "PageMonitorAdvancedPageData=" and is
// followed by a JSON-encoded string of the page's advanced settings. The final
// string is passed to the supplied calback.
function exportPagesList(callback) {
  if (!callback) return;

  getAllPages(function(pages) {
    var buffer = [];
    var add_date = Date.now();

    buffer.push('<!DOCTYPE NETSCAPE-Bookmark-file-1>\n\n<!-- This is an' +
                ' automatically generated file.\n     It will be read and' +
                ' overwritten.\n     DO NOT EDIT! -->\n<META HTTP-EQUIV=' +
                '"Content-Type" CONTENT="text/html; charset=UTF-8">\n<TITLE>' +
                'Bookmarks</TITLE>\n<H1>Bookmarks</H1>\n<DL><p>\n');

    for (var i in pages) {
      buffer.push('        <DT><A HREF="' + pages[i].url + '" ADD_DATE="' +
                  add_date + '">' + pages[i].name + '</A>\n');

      var encoded_settings = JSON.stringify({
        mode: pages[i].mode,
        regex: pages[i].regex,
        selector: pages[i].selector,
        check_interval: pages[i].check_interval,
        crc: pages[i].crc,
        last_check: pages[i].last_check,
        last_changed: pages[i].last_changed
      }).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      buffer.push('            <!--PageMonitorAdvancedPageData=' +
                  encoded_settings + '-->\n');
    }

    buffer.push('</DL><p>');

    callback(buffer.join(''));
  });
}

// Takes the contents of a netscape bookmarks file and imports all the pages in
// it for monitoring. IF any of the pages contain Page Monitor-specific settings
// as written out by exportPagesList(), these are imported as well. Returns the
// number of pages found.
function importPagesList(bookmarks) {
  var page_regex = new RegExp('(<[aA][^<>]+>[^<>]+<\/[aA]>)(?:\\s*<!--' +
                              'PageMonitorAdvancedPageData=' +
                              '(\{.*?\})-->)?', 'g');
  var match;
  var matches_count = 0;

  while (match = page_regex.exec(bookmarks, page_regex.lastIndex)) {
    var link = $(match[1]);
    var url = link.attr('HREF') || '';
    var name = link.text() || chrome.i18n.getMessage('untitled', url);

    var advanced = {};
    if (match[2]) {
      advanced = JSON.parse(match[2].replace(/&amp;/g, '&')
                                    .replace(/&lt;/g, '<')
                                    .replace(/&gt;/g, '>'));
    }

    if (url) {
      addPage($.extend({ url: url, name: name }, advanced));
      matches_count++;
    }
  }

  return matches_count;
}

/*******************************************************************************
*                         Global Controls Initialization                       *
*******************************************************************************/

// Initializes the global controls with saved values and event handlers.
function initializeGlobalControls() {
  initializeColorPicker();
  initializeAnimationToggler();
  initializeSorter();
  initializeIntervalSliders();
  initializeNotificationsToggler();
  initializeNotificationsTimeout();
  initializeSoundSelector();
  initializeSoundPlayer();
  initializeSoundCreator();
  initializeViewAllSelector();
  initializeExporter();
  initializeImporter();
  initializeGlobalChecker();
  initializeAdvancedSwitch();
}

// Initializes the color picker input.Fills it with the color from
// SETTINGS.badge_color and applies the jQuery colorPicker plugin function on
// it. Also binds a handler for the change event, which saves the new value and
// calls updateBadge() on the background page.
function initializeColorPicker() {
  var toHex = function(d) {
    return d >= 16 ? d.toString(16) : '0' + d.toString(16);
  }

  var badge_color = getSetting(SETTINGS.badge_color) || [0, 180, 0, 255];
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

// Initializes the animation toggler drop-down. Updates its value from
// SETTINGS.animations_disabled and binds a handler for the change event to save
// the new value and enable or disable jQuery effects.
function initializeAnimationToggler() {
  $('#animation select').change(function() {
    var disabled = ($(this).val() != 'enabled');
    setSetting(SETTINGS.animations_disabled, disabled);
    $.fx.off = disabled;
  }).val(getSetting(SETTINGS.animations_disabled) ? 'disabled' : 'enabled');
}

// Initializes the sorter drop-down. Updates its value from SETTINGS.sort_by and
// binds a handler for the change event to save the new value and regenerate the
// pages list.
function initializeSorter() {
  $('#sort select').change(function() {
    setSetting(SETTINGS.sort_by, $(this).val());
    fillPagesList();
  }).val(getSetting(SETTINGS.sort_by) || 'date added');
}

// Initializes the two check interval sliders. Updates their value from
// SETTINGS.check_interval and binds handlers for their change and mouseup
// events. The change event updates the range label while the mouseup event
// saves the new value and synchronizes the value of the other textbox.
function initializeIntervalSliders() {
  var interval_ms = getSetting(SETTINGS.check_interval) || (180 * 60 * 1000);
  var interval_min = interval_ms / (60 * 1000);
  var slider = $('#basic_interval input[type=range]');
  var slider_label = $('#basic_interval .range_value_label');
  var textbox = $('#interval input');
  var textbox_label = $('#interval .check_every_label');

  textbox.val(interval_min).change(function() {
    var val_ms = parseFloat($(this).val()) * 60 * 1000;
    if (val_ms < 5000) val_ms = 5000;
    if (val_ms > 199500000) val_ms = 199500000;
    var val_min = val_ms / (60 * 1000);
    textbox.val(val_min);
    slider.val(timeAbsoluteToLog(val_min)).change();
    var message;
    if (val_min == 1) {
      message = chrome.i18n.getMessage('minute');
    } else {
      message = chrome.i18n.getMessage('minutes', '2');
    }
    textbox_label.text(message.split(' ')[1]);

    setSetting(SETTINGS.check_interval, val_ms);
  }).change();

  slider.val(timeAbsoluteToLog(interval_min)).change(function() {
    var val_ms = timeLogToAbsolute(parseFloat($(this).val())) * 60 * 1000;
    slider.siblings('.range_value_label').text(describeTime(val_ms));
  }).mouseup(function() {
    var val_min = timeLogToAbsolute(parseFloat($(this).val()));
    var val_ms = val_min * 60 * 1000;
    textbox.val(val_min);
    setSetting(SETTINGS.check_interval, val_ms);
  }).mouseup().change();

  var position = slider.offset();
  var width = slider.width();
  var height = slider.height();
  var label_width = slider_label.width();
  var label_height = slider_label.height();

  var new_left = position.left + width / 2 - label_width / 2;
  slider_label.css({ left: new_left });
}

// Initializes the two desktop notification togglers. Updates their state from
// SETTINGS.notifications_enabled and binds a handler for the change event of
// both drop-downs that synchronizes their values, and checks for notifications
// being permitted. If they are, the setting is saved. If not, the user is asked
// to permit them then the value of the dropdown is updated if they do.
function initializeNotificationsToggler() {
  var $togglers = $('#notifications select, #basic_notifications select');

  $togglers.change(function() {
    var val = $(this).val();
    $togglers.not(this).val(val);
    setSetting(SETTINGS.notifications_enabled, val == 'enabled');
    $('#notifications_timeout input').attr('disabled', val != 'enabled');
  }).val(getSetting(SETTINGS.notifications_enabled) ? 'enabled' : 'disabled');
}

// Initializes the notifications timeout textbox. Updates its value from
// SETTINGS.notifications_timeout and binds a handler for the change and keyup
// events that validates the contents and saves the new value.
function initializeNotificationsTimeout() {
  var timeout = (getSetting(SETTINGS.notifications_timeout) / 1000) || 30;

  $('#notifications_timeout input').val(timeout).change(function() {
    var val_ms = parseFloat($(this).val()) * 1000;
    var label;
    if (val_ms > 60000) {
      label = chrome.i18n.getMessage('until_closed');
    } else {
      label = describeTime(val_ms);
    }
    $(this).siblings('.range_value_label').text(label);
  }).mouseup(function() {
    var val_ms = parseFloat($(this).val()) * 1000;
    setSetting(SETTINGS.notifications_timeout, val_ms);
  }).change().attr('disabled', !getSetting(SETTINGS.notifications_enabled));
}

// Initializes the two sound alert selection drop-downs. Fills them with sounds
// from SETTINGS.custom_sounds and binds a handler for the change event of both
// drop-downs that synchronizes their values and saves the new choice.
function initializeSoundSelector() {
  var selects = $('#sound_alert select, #basic_sound_alert select');
  var play_button = $('#play_sound');
  var delete_button = $('#delete_sound');

  var custom_sounds = getSetting(SETTINGS.custom_sounds) || [];
  $.each(custom_sounds, function(i, v) {
    $('<option>').text(v.name).attr('value', v.url).appendTo(selects);
  });

  selects.change(function() {
    var audio_file = $(this).val();
    selects.not(this).val(audio_file);
    setSetting(SETTINGS.sound_alert, audio_file);
    play_button.attr({ disabled: audio_file == '' });
    delete_button.attr({ disabled: /^$|^chrome-extension:/.test(audio_file) });
  });

  selects.val(getSetting(SETTINGS.sound_alert) || '');
  selects.change();
}

// Initializes the Play Sound button with a click handler that plays the
// selected sound (the button and drop-down are disabled while playing).
function initializeSoundPlayer() {
  var select = $('#sound_alert select');
  var play_button = $('#play_sound');
  var delete_button = $('#delete_sound');

  play_button.click(function() {
    select.attr('disabled', true);
    play_button.attr('disabled', true);
    delete_button.attr('disabled', true);

    var audio = new Audio(select.val());

    audio.addEventListener('ended', function() {
      select.attr('disabled', false);
      play_button.attr('disabled', false);
      delete_button.attr('disabled', false);
    });
    audio.play();
  });
}

//---------------------------------- WARNING ---------------------------------//
//------------------ EVERYTHING BELOW THIS LINE IS UNTESTED ------------------//
//---------------------------------- WARNING ---------------------------------//

// Initializes the sound creation form, including the New button that displays
// the form, and the Ok/Cancel buttons in the form itself.
function initializeSoundCreator() {
  var new_button = $('#new_sound');
  var new_form = $('#new_sound_form');

  // Center the form.
  new_form.css({
    top: (window.innerHeight - new_form.height()) / 2,
    left: (window.innerWidth - new_form.width()) / 2
  });

  // Show form.
  new_button.click(function() {
    $('input', new_form).val('');
    shadeBackground(true);
    new_form.fadeIn();
  });

  // Cancel form.
  $('#new_sound_cancel').click(function() {
    shadeBackground(false);
    new_form.fadeOut();
  });

  // Try to create a new sound entry.
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

    // Make sure we can play the file.
    var audio_file = new Audio(url);

    audio_file.addEventListener('error', function() {
      alert(chrome.i18n.getMessage('new_sound_failed'));
      restoreCreateButton();
    });
    audio_file.addEventListener('canplaythrough', function() {
      var custom_sounds = getSetting(SETTINGS.custom_sounds) || [];
      custom_sounds.push({ name: name, url: url });
      setSetting(SETTINGS.custom_sounds, custom_sounds);

      $('<option>').text(name).attr('value', url)
                   .appendTo('#sound_alert select, #basic_sound_alert select');

      restoreCreateButton();
      shadeBackground(false);
      new_form.fadeOut();
    });
  });

  $('#delete_sound').click(function() {
    var sound_list = $('#sound_alert select');
    var selected = sound_list.val();
    var sounds = getSetting(SETTINGS.custom_sounds) || [];
    setSetting(SETTINGS.custom_sounds, sounds.filter(function(s) {
      return s.url != selected;
    }));
    $('option:selected', sound_list).remove();
    sound_list.val('');
  });
}

// Initializes the View All Function drop-down. Updates its state from
// SETTINGS.view_all_action and binds a handler for the change event to save the
// newly selected setting.
function initializeViewAllSelector() {
  $('#view_all select').change(function() {
    setSetting(SETTINGS.view_all_action, $(this).val());
  }).val(getSetting(SETTINGS.view_all_action) || 'diff');
}

// Initializes the Export Pages button and form. Binds a handler to the Export
// Pages button that pops up the form on click and fills it with the output of
// exportPagesList(), and another handler to the Close button in the form to
// hide it.
function initializeExporter() {
  var form = $('#export_form');

  $('#export').click(function() {
    exportPagesList(function(result) {
      $('textarea', form).val(result);
      shadeBackground(true);
      form.fadeIn();
    });
  });

  $('button', form).click(function() {
    form.fadeOut();
    shadeBackground(false);
  });
}

// Initializes the Import Pages button that displays the import form and the
// Import/Cancel buttons in the form itself.
function initializeImporter() {
  var form = $('#import_form');

  $('#import').click(function() {
    shadeBackground(true);
    form.fadeIn();
  });

  $('#import_cancel', form).click(function() {
    form.fadeOut();
    shadeBackground(false);
  });

  $('#import_perform', form).click(function() {
    var count = 0;
    try {
      count = importPagesList($('textarea', form).val());
    } catch (e) {
      alert(chrome.i18n.getMessage('import_error'));
      form.fadeOut();
      shadeBackground(false);
      return;
    }
    if (count) {
      var singular = chrome.i18n.getMessage('import_success_single');
      var plural = chrome.i18n.getMessage('import_success_multi',
                                          count.toString());
      fillPagesList(function() {
        // TODO: Uncomment this once this issue is fixed:
        // http://code.google.com/p/chromium/issues/detail?id=73125
        //alert(count == 1 ? singular : plural);
      });
    } else {
      alert(chrome.i18n.getMessage('import_empty'));
    }
    form.fadeOut();
    shadeBackground(false);
  });
}

// Initializes the "Check All Now" button handler.
function initializeGlobalChecker() {
  $('#check_all').click(function() {
    getAllPageURLs(function(pages) {
      var progress_message = chrome.i18n.getMessage('check_in_progress') + '..';
      $('.last_check_time').text(progress_message);

      BG.check(true, $.noop, function(url) {
        var page_record = findPageRecord(url);
        $('.last_check_time', page_record).trigger('time_updated');
      });
    });
  });
}

// Initializes the event handler for the button that switches between basic and
// advanced settings. The button is unresponsive while the switching animation
// is running.
(function() {
  var switching = false;

  initializeAdvancedSwitch = function() {
    if (switching) return false;
    switching = true;

    $('#options_switch input').click(function() {
      var checked = $(this).is(':checked');

      var label_state = checked ? 'hidden': 'visible';
      $('#basic_interval .range_value_label').css('visibility', label_state);

      var to_hide = checked ? '#basic_options' : '#advanced_options';
      var to_show = checked ? '#advanced_options' : '#basic_options';
      $(to_hide).slideUp('slow', function() {
        $(to_show).slideDown('slow', function() {
          switching = false;
        });
      });
    });
  }
})();

/*******************************************************************************
*                        Per-Page Controls Initialization                      *
*******************************************************************************/

// Initializes all per-page controls with their live event handlers.
function initializePageControls() {
  initializePageRename();
  initializePageRemove();
  initializePageCheck();

  initializePageAdvancedToggler();

  initializePageCheckInterval();
  initializePageModeSelector();
  initializePageModeTester();
  initializePageModePicker();
}

// Initializes the page renamer button and mini-form. Binds a handler to the
// rename button that swaps the page link with a textbox and an Ok/Cancel pair,
// and applies the appropriate handlers to the pair.
function initializePageRename() {
  $('.rename').live('click', function() {
    var record = findPageRecord(this);
    var page_link = record.find('.page_link');

    if (!page_link.is(':hidden')) {
      var textbox = $('<input type="text" value="' + page_link.text() + '" />');
      var cancel_button = $('<input type="button" value="' +
                            chrome.i18n.getMessage('cancel') + '" />');
      var ok_button = $('<input type="button" value="' +
                        chrome.i18n.getMessage('ok') + '" />');

      page_link.hide().after(cancel_button).after(ok_button).after(textbox);

      textbox.focus().keyup(function(event) {
        if (event.which == 13) {  // Enter.
          ok_button.click();
        } else if (event.which == 27) {  // Escape.
          cancel_button.click();
        }
      });

      cancel_button.click(function() {
        textbox.remove();
        ok_button.remove();
        cancel_button.remove();
        page_link.show();
      });

      ok_button.click(function() {
        page_link.text(textbox.val());
        setPageSettings(findUrl(this), { name: textbox.val() });
        cancel_button.click();
      });
    }
  });
}

// Initializes the remove button handler to slide up the page record, remove the
// page from the database, refill the pages list and update the badge when done
// in case the removed page was marked as updated.
function initializePageRemove() {
  $('.stop_monitoring').live('click', function() {
    var url = findUrl(this);

    removePage(url, BG.updateBadge);

    var scroll_position = scrollY;

    $('td', findPageRecord(this)).slideUp('slow', function() {
      if ($('#pages .page_record').length == 1) {
        $('#pages').animate(
          { height: '50px', opacity: 1 }, 'slow', fillPagesList
        );
      } else {
        fillPagesList();
        scrollTo(0, scroll_position);
      }
    });
  });
}

// Initializes the per-page forced check button handler to replace the last
// check label with a "check in progress" message, perform a check on this page,
// then fade in the new last check label and update the badge.
function initializePageCheck() {
  $('.check_now').live('click', function() {
    var timestamp = $('.last_check_time', findPageRecord(this));
    var url = findUrl(this);
    var progress_message = chrome.i18n.getMessage('check_in_progress') + '..';

    timestamp.text(progress_message);  
    BG.checkPage(url, function(url) {
      timestamp.trigger('time_updated');
      BG.updateBadge();
    });
  });
}

// Initializes the advanced page options toggler and individual advanced options
// togglers. The former slides the advanced options div up or down, adds or
// removes the "toggled" class, and restores the last settings entered into the
// controls in the custom div on sliding down. The latter toggles the "disabled"
// and "enabled" classes of sibling spans and enables/disables all <input> and
// <select> elements within the same parent.
function initializePageAdvancedToggler() {
  $('.advanced_toggle input[type=checkbox]').live('click', function() {
    var url = findUrl(this);
    var page_record = findPageRecord(this);

    if ($(this).is(':checked')) {
      $('.advanced_toggle', page_record).addClass('toggled');
      $('.advanced_controls', page_record).slideDown('fast');

      // Apply previously-set advanced settings.
      var interval_div = $('.page_interval', page_record);
      if ($(':checked', interval_div).length > 0) {
        var interval_log = $('input[type=range]', interval_div).val();
        var interval = timeLogToAbsolute(interval_log);
        setPageCheckInterval(url, interval);
      }

      if ($('.mode :checked', page_record).length > 0) {
        var custom_mode = $('.mode select', page_record).val();
        var custom_mode_string = $('.mode_string', page_record).val();
        setPageRegexOrSelector(url, custom_mode, custom_mode_string);
      }
    } else {
      $('.advanced_controls', page_record).slideUp('fast', function() {
        $('.advanced_toggle', page_record).removeClass('toggled');
      });

      setPageCheckInterval(url, null);
      setPageRegexOrSelector(url, 'regex', null);
    }
  });

  $('.advanced_controls input[type=checkbox]').live('click', function() {
    var checked = $(this).is(':checked');

    $(this).nextAll('span').toggleClass('enabled', checked)
                           .toggleClass('disabled', !checked);
    $('input,select', $(this).parent()).not(this).attr({ disabled: !checked });
  });
}

// Initializes the page check interval slider with a handler for the change
// event that updates the label and a handler for the mouseup event that saves
// the new value. Also binds a (secondary) handler to the interval checkbox that
// removes the custom interval when unchecked, and resaves the currently entered
// value when checked.
function initializePageCheckInterval() {
  $('.page_interval input[type=checkbox]').live('click', function() {
    var url = findUrl(this);
    if ($(this).is(':checked')) {
      var interval_log = $('input[type=range]', $(this).parent()).val();
      var interval = timeLogToAbsolute(parseFloat(interval_log));
      setPageCheckInterval(url, interval);
    } else {
      setPageCheckInterval(url, null);
    }
  });

  $('.page_interval input[type=range]').live('change', function() {
    var val_ms = timeLogToAbsolute(parseFloat($(this).val())) * 60 * 1000;
    $(this).siblings('.range_value_label').text(describeTime(val_ms));
  }).live('mouseup', function() {
    var val = timeLogToAbsolute(parseFloat($(this).val()));
    setPageCheckInterval(findUrl(this), val);
  });
}

// Initializes the custom monitoring mode checkbox, drop-down and textbox.
// 1. The checkbox enables/disables the rest of the controls on the same line.
//    When checked, it triggers the keyup event on the textbox, and when
//    unchecked, it resets the page to the default text mode.
// 2. The dropdown selects between regex and selector modes, triggers the keyup
//    event in the textbox, and enables the picker if selector mode is selected.
// 3. The textbox calls setPageRegexOrSelector() with the appropriate arguments
//    on keyup and change events.
function initializePageModeSelector() {
  $('.mode input[type=checkbox]').live('click', function() {
    var url = findUrl(this);
    var record = findPageRecord(this);

    if ($(this).is(':checked')) {
      $('.mode_string', record).keyup();
    } else {
      setPageSettings(url, { mode: 'text', regex: null, selector: null });
    }
  });

  $('.mode select').live('change', function() {
    var record = findPageRecord(this);
    $('.mode_string', record).keyup();
    $('.mode_pick', record).attr({ disabled: $(this).val() == 'regex' });
  });

  $('.mode_string').live('keyup', function() {
    var mode = $('select', findPageRecord(this)).val();
    setPageRegexOrSelector(findUrl(this), mode, $(this).val());
  }).live('change', function() { $(this).keyup(); });
}

// Initializes the custom monitoring mode test button. On click, the button
// disables itself and the textbox, runs a test with the currently specified
// mode and mode string, displays the result in an alert box, then re-enables
// itself and the textbox.
function initializePageModeTester() {
  var form = $('#test_result_form');

  $('.mode_test').live('click', function() {
    var url = findUrl(this);
    var record = findPageRecord(this);
    var mode = $('select', record).val();
    var mode_string = $('.mode_string', record).val();
    var button = $(this);

    button.val(chrome.i18n.getMessage('test_progress'))
          .add($('.mode_string', record)).attr({ disabled: true });

    $.ajax({
      url: url,
      dataType: 'text',
      success: function(html) {
        var findAndFormat = (mode == 'regex') ? findAndFormatRegexMatches :
                                                findAndFormatSelectorMatches;
        findAndFormat(html, mode_string, function(results) {
          $('textarea', form).val(results);
          shadeBackground(true);
          form.fadeIn();

          cleanAndHashPage(html, mode, mode_string, mode_string, function(crc) {
            setPageSettings(url, { crc: crc });
          });
        });
      },
      error: function() {
        alert(chrome.i18n.getMessage('test_fail'));
      },
      complete: function() {
        button.val(chrome.i18n.getMessage('test_button'))
              .add($('.mode_string', record)).attr({ disabled: false });
      }
    });
  });

  $('button', form).click(function() {
    form.fadeOut();
    shadeBackground(false);
  });
}

// Initializes the Pick button in the page mode selector. On click, the button
// spawns a tab with the URL of the page in the its record, then injects jquery,
// followed by scripts/selector.js  and styles/selector.css into the tab.
function initializePageModePicker() {
  $('.mode_pick').live('click', function() {
    chrome.tabs.create({
      url: findUrl(this),
      selected: true
    }, function(tab) {
      chrome.tabs.executeScript(tab.id, { file: 'lib/jquery-1.7.1.js' },
                                function() {
        chrome.tabs.executeScript(tab.id, { file: 'scripts/selector.js' },
                                  function() {
          chrome.tabs.executeScript(tab.id, { code: '$(initialize);' });
        });
        chrome.tabs.insertCSS(tab.id, { file: 'styles/selector.css' });
      });
    });
  });
}

/*******************************************************************************
*                              Page List Generator                             *
*******************************************************************************/

// Fills the pages table (id=pages) with a list of page records, each record
// containing basic info about the page and controls to edit per-page settings.
// The pages are sorted per SETTINGS.sort_by. If no pages are being monitored,
// a copy of the row with class=empty from the tebplates table is inserted.
// After the list is filled, executes the callback (if provided).
function fillPagesList(callback) {
  getAllPages(function(pages) {
    sortPagesInplace(pages, getSetting(SETTINGS.sort_by) || 'date added');

    $('#pages').html('');

    if (pages.length > 0) {
      $.each(pages, function(_, page) { addPageToTable(page); });
    } else {
      $('#templates .empty').clone().appendTo('#pages');
    }

    (callback || $.noop)();
  });
}

// Sorts an array of pages in-place given a sort_order. Valid sort order values:
// * date added: no sorting is done. The input array is expected to be
//   initially sorted by the date when the page was added.
// * name: the page's name attribute.
// * url: the page's url attribute.
// * check interval: the page's check interval (or the global check interval
//   for pages with no custom interval defined).
// * last check: the date when the page was last checked.
// * last change: the date when the page was last changed.
// Other values of sort order will raise an error.
function sortPagesInplace(pages, sort_order) {
  if (sort_order != 'date added') {
    var global_check_interval = getSetting(SETTINGS.check_interval);

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
      } else if (sort_order == 'last change') {
        a = -a.last_changed || 0;
        b = -b.last_changed || 0;
      } else if (sort_order == 'url') {
        a = a.url;
        b = b.url;
      } else {
        throw(new Error('Invalid sort order.'));
      }

      return (a < b) ? -1 : 1;
    });
  }
}

// Adds a page record to the pages table. The template is taken from #templates
// and filled with the info form the supplied argument (a page object as
// returned by the getPage() function).
function addPageToTable(page) {
  var page_record = $('#templates .page_record').clone();
  var global_check_interval = getSetting(SETTINGS.check_interval);
  var check_interval = page.check_interval || global_check_interval;
  var advanced_set = false;

  // Page info.
  var name = page.name || chrome.i18n.getMessage('untitled', page.url);
  if (name.length > 60) {
    name = name.replace(/([^]{20,60})(\w)\b.*$/, '$1$2...');
  }

  page_record.find('.page_link').attr({
    href: page.url,
    target: '_blank'
  }).text(name);

  page_record.find('.favicon').attr({
    src: getFavicon(page.url)
  });

  // Last check time ticker.
  var last_check_span = page_record.find('.last_check_time');
  last_check_span.bind('time_updated', function() {
    var $span = $(this);
    getPage(page.url, function(page) {
      var last_check = page.last_check ? describeTimeSince(page.last_check)
                                       : chrome.i18n.getMessage('never');

      if (last_check != $span.text()) {
        $span.fadeOut('slow', function() {
          $span.text(last_check).fadeIn('slow');
        });
      }
    });
  });
  last_check_span.trigger('time_updated');
  setInterval(function() { last_check_span.trigger('time_updated'); }, 15000);

  // Check interval range slider.
  var interval = check_interval / (60 * 1000);
  var interval_log = timeAbsoluteToLog(interval);
  var interval_div = $('.page_interval', page_record);
  $('input[type=range]', interval_div).val(interval_log);
  // HACK: Delay refresh until the page DOM has rendered.
  setTimeout(function() {
    $('input[type=range]', interval_div).change();
  }, 0);
  if (page.check_interval) {
    interval_div.children('span').addClass('enabled').removeClass('disabled');
    $('input', interval_div).attr({ disabled: false });
    $('input[type=checkbox]', interval_div).attr({ checked: true });
    advanced_set = true;
  }

  // Custom monitoring mode textbox.
  if (page.mode == null) {
    if (page.regex) {
      page.mode = 'regex';
    } else {
      page.mode = 'text';
    }
  }

  if (page.mode != 'text') {
    var mode_div = $('.mode', page_record);
    var mode_string = (page.mode == 'regex') ? page.regex : page.selector;

    mode_div.children('span').addClass('enabled').removeClass('disabled');
    $('input,select', mode_div).attr({ disabled: false });
    $('input[type=checkbox]', mode_div).attr({ checked: true });
    $('select', mode_div).val(page.mode).change();
    $('.mode_string', mode_div).val(mode_string).keyup();

    advanced_set = true;
  }

  // Advanced checkbox.
  if (advanced_set) {
    $('.advanced_toggle', page_record).addClass('toggled');
    $('.advanced_toggle input', page_record).attr({ checked: true });
    $('.advanced_controls', page_record).css({ display: 'block' });
  }

  page_record.appendTo('#pages');
}

/*******************************************************************************
*                           Server for Selector GUI                            *
*******************************************************************************/

// Waits for a request from a selector GUI page specifying a URL and a selector
// for the page at that URL. If there is a page record with that URL in the
// displayed page list, its advanced options are displayed and its custom mode
// checkbox is checked, then its mode is set to "selector", and its mode string
// textbox is filled with the selector string. A keyup event is triggered on the
// textbox.
function selectorServer(request, _, callback) {
  if (request && request.selector) {
    var page_record = findPageRecord(request.url);
    if (page_record.length > 0 &&
        $('.advanced_toggle.toggled', page_record).length > 0 &&
        $('.mode :checked', page_record).length > 0) {
      $('.mode select', page_record).val('selector');
      $('.mode_string', page_record).val(request.selector).keyup();
      callback(null);
    }
  }
}

/*******************************************************************************
*                               Main Function                                  *
*******************************************************************************/

// Completely initializes the page.
function init() {
  if (getSetting(SETTINGS.animations_disabled)) $.fx.off = true;

  applyLocalization();
  $('title').text(chrome.i18n.getMessage('options_title'));
  $('.mode_test').val(chrome.i18n.getMessage('test_button'));
  $('.mode_pick').val(chrome.i18n.getMessage('pick_button'));

  initializeGlobalControls();
  initializePageControls();

  chrome.extension.onRequest.addListener(selectorServer);

  fillPagesList();
}
