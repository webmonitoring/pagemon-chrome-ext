# pagemon-chrome-ext

**NOTE:** The project is currently in maintenance mode. No new features are planned.

This extension allows your browser to monitor changes to web pages for you. It can inform you whenever a particular page changes without you having to go and check every time.

To use, simply go to a page you would like to monitor, click on the Page Monitor icon and select "Monitor This Page". You're done! Now whenever this page changes, the monitor icon will display a notification on its badge. Of course, you can repeat this for any number of pages.

In addition, you can change the check interval globally or per page, specify sound alerts, desktop notifications, or visually select specific parts of a page to monitor.

Features:

- Monitor any number of pages for changes.
- Add pages with two clicks.
- Visually select parts of a page to track.
- Smart comparison system that ignores ads and code changes.
- Highlighting of changes that happened to a page since the last check.
- Set separate check interval for each page.
- Set a sound alert when a page change is detected.
- Custom sound alerts.
- Desktop notifications.
- Import and export the monitored pages list.

## Building

Run the following command from the `/src` folder to build the app
`python ./build.py --nocompilejs`
