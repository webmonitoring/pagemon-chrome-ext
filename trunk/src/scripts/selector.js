/*
  A visual selector builder script to be inserted into arbitrary pages. Once the
  page loads, a set of controls is inserted into the page and these allow the
  user to visually select an element, and the script generates a selector behind
  the scenes. Once the user accepts their selection, a message is broadcasted
  to the extension with the selector and the URL of the page in question and the
  tab is closed.
*/

// Constants.
var OUTLINE_CLASS = 'chrome_page_monitor_outline';
var TEMP_OUTLINE_CLASS = 'chrome_page_monitor_temp_outline';
var ACTIVE_CLASS = 'chrome_page_monitor_active';
var DISABLED_CLASS = 'chrome_page_monitor_disabled';
var FRAME_ID = 'chrome_page_monitor_selector';

// Picking state.
var current_element = null;
var current_selector = '';
var pick_mode = true;

// References to the controls.
var frame = null;
var pick_button = null;
var parent_button = null;
var done_button = null;
var help_button = null;

// Generates the controls that are inserted into the page. Returns a wrapped
// jQuery set that's ready to be used with appendTo and the like.
function generateControls() {
  var template = '<div id="' + FRAME_ID + '"> \
                    <span title="Pick" class="' + ACTIVE_CLASS + '">%pick%</span> \
                    <span title="Parent" class="' + DISABLED_CLASS + '">%parent%</span> \
                    <input type="button" title="Done" value="%done%" disabled="disabled" /> \
                    <input type="button" title="Help" value="%help%" /> \
                  </div>';

  var pick = chrome.i18n.getMessage('selector_gui_pick');
  var parent = chrome.i18n.getMessage('selector_gui_parent');
  var done = chrome.i18n.getMessage('selector_gui_done');
  var help = chrome.i18n.getMessage('selector_gui_help');
  var controls = template.replace('%pick%', pick)
                         .replace('%parent%', parent)
                         .replace('%done%', done)
                         .replace('%help%', help);

  return $(controls);
}

// Updates current_selector, the visual outline and the state of various buttons
// depending on the value of current_element.
function currentElementChanged() {
  $('*').removeClass(TEMP_OUTLINE_CLASS).removeClass(OUTLINE_CLASS);

  done_button.attr('disabled', !current_element);

  if (current_element) {
    $(current_element).addClass(OUTLINE_CLASS);
    parent_button.removeClass(DISABLED_CLASS);
    current_selector = elementToSelector(current_element);
  } else {
    parent_button.addClass(DISABLED_CLASS);
    current_selector = '';
  }
}

// Takes an element and walks up its hierarchy constructing a selector which
// would match this element (and hopefully it alone). Stops as soon as it
// reaches an element with a defined ID attribute or when reaching the <body>.
// Ignores classes starting with chrome_page_monitor_ (e.g. the outline class).
// Elements outside of <body> return null.
function elementToSelector(element) {
  var path = [];

  element = $(element);

  if (element.is('body')) {
    return 'body';
  } else if (element.closest('body').length == 0) {
    return null;
  } else {
    while (!(element.is('body') || element.attr('id'))) {
      var tagname = element.get(0).tagName.toLowerCase();
      var classname = element.get(0).className;

      classname = classname.replace(/chrome_page_monitor_\w+/g, '')
                           .replace(/^\s+|\s+$/g, '')
                           .replace(/\s+/g, '.');

      var selector = classname ? (tagname + '.' + classname) : tagname;

      if (element.siblings(selector).length > 0) {
        selector += ':nth-child(' + (element.index() + 1) + ')';
      }

      path.push(selector);

      element = element.parent();
    }

    if (element.attr('id')) {
      path.push('#' + element.attr('id'));
    } else {
      path.push('');
    }

    path.reverse();

    return path.join('>');
  }
}

// Sets up the mousemove and click handlers for the <body> to highlight the
// element currently being hovered on with the chrome_page_monitor_temp_outline
// class and the selected one with chrome_page_monitor_active. Also sets
// current_element if one is clicked in pick mode, deactivates the pick button
// by removing its chrome_page_monitor_active class and calls
// currentElementChanged() to update the selection. Elements inside the control
// block are ignored during selection.
function setUpBodyHandlers() {
  $('body').mousemove(function(e) {
    if (pick_mode) {
      $('*').removeClass(TEMP_OUTLINE_CLASS);
      $(e.target).addClass(TEMP_OUTLINE_CLASS);
    }
  });

  $('body').click(function(e) {
    if (pick_mode) {
      var element = e.target;
      if (!($(element).is('body') ||
            $(element).closest('#' + FRAME_ID).length)) {
        current_element = element;
        currentElementChanged();
        pick_mode = false;
        pick_button.removeClass(ACTIVE_CLASS);
      }
      return false;
    }
  });
}

// Sets up the button handlers:
// 1. The pick button turns on pick mode and discards the current selection.
// 2. The parent button replaces the selection with its parent.
// 3. The done button sends the current selector and URL back to the extension
//    and closes the window when a reply is received.
// 4. The help button display an instructions message.
function setUpButtonHandlers() {
  pick_button.click(function() {
    pick_mode = true;
    current_element = null;
    currentElementChanged();
    $(this).addClass(ACTIVE_CLASS);
  });

  parent_button.click(function() {
    if (!$(this).hasClass(DISABLED_CLASS) && current_element) {
      var parent = $(current_element).parent();
      if (parent.is('body')) {
        parent_button.addClass(DISABLED_CLASS);
      } else {
        current_element = parent.get(0);
        currentElementChanged();
      }
    }
  });

  done_button.click(function() {
    if (current_selector) {
      chrome.extension.sendRequest({
        selector: current_selector,
        url: window.location.href
      }, window.close);
    } else {
      window.close();
    }
  });

  help_button.click(function() {
    alert(chrome.i18n.getMessage('selector_gui_help_text'));
  });
}

// The main function. Inserts the controls, updates the global references to
// them, then sets up event handlers for everything by calling
// setUpBodyHandlers() and setUpButtonHandlers().
function initialize() {
  generateControls().appendTo('body');

  frame = $('#' + FRAME_ID);
  pick_button = $('span[title=Pick]', frame);
  parent_button = $('span[title=Parent]', frame);
  done_button = $('input[type=button][title=Done]', frame);
  help_button = $('input[type=button][title=Help]', frame);

  setUpButtonHandlers();
  setUpBodyHandlers();
}
