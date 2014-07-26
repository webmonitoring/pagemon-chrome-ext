$(function() {
  $('title').text(chrome.i18n.getMessage('diff_title'));
  $('#diff_in_progress').text(chrome.i18n.getMessage('diff_progress'));
  try {
    initiateDiff(atob(window.location.hash.substr(1)));
  } catch (e) {
    alert(chrome.i18n.getMessage('diff_error') + '\n\n' +
          e.message + '\n' + e.stack);
  }
});
