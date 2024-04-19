importScripts('common.js')

const messageHash = {
  ['getExtensionVersion']: () => {
    const manifest = chrome.runtime.getManifest();

    return manifest.version
  },
  ['getMessage']: ({ data }) => {
    return chrome.i18n.getMessage(data.key, data.substitutions)
  },
  ['setBadgeBackgroundColor']: ({ data }) => {
    return chrome.action.setBadgeBackgroundColor(data)
  },
  ['setBadgeText']: ({ data }) => {
    return chrome.action.setBadgeText(data)
  },
  ['setIcon']: ({ data }) => {
    return chrome.action.setIcon(data)
  },
  ['dataMigrated']: ({ data: { jobs } }) => {
    return emitAnalytics('migrated jobs', {
      numberOfJobs: jobs.length,
      numberOfActiveJobs: jobs.filter((job) => job.active).length,
    })
  },
};

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  let response;

  if (messageHash[message.type]) {
    response = messageHash[message.type](message);
  }
  sendResponse(response);
});

let creating; // A global promise to avoid concurrency issues
async function setupOffscreenDocument() {
  const path = '../offscreen.htm';
  // Check all windows controlled by the service worker to see if one
  // of them is the offscreen document with the given path
  const offscreenUrl = chrome.runtime.getURL(path);
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [offscreenUrl],
  });

  if (existingContexts.length > 0) {
    return;
  }

  // create offscreen document
  if (creating) {
    await creating;
  } else {
    creating = chrome.offscreen.createDocument({
      url: path,
      reasons: ['CLIPBOARD'],
      justification: 'reason for needing the document',
    });
    await creating;
    creating = null;
  }
}

setupOffscreenDocument();