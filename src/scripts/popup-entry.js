$(function() {
  BG.hideDesktopNotification();
  if (getSetting(SETTINGS.animations_disabled)) $.fx.off = true;
  applyLocalization();
  setUpHandlers();
  fillNotifications();
});
