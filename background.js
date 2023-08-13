"use strict";

(function () {
	let tabsToListenTo = {};

	/**
	 * Initial listener - saves the tab id and
	 * responds so the content script can set up it's message listeners.
	 * The goal is to send messages only to Jira tabs.
	 */
	chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
		if (message.startListening === true) {
			tabsToListenTo[sender.tab.id] = true;
			sendResponse({ action: "backgroundListeningToTab" });
		}

		return true;
	});

	chrome.tabs.onActivated.addListener((tabs) => {
		if (tabsToListenTo[tabs.tabId]) {
			chrome.tabs.sendMessage(tabs.tabId, { action: "onActivated" });
		}
	});

	chrome.webNavigation.onHistoryStateUpdated.addListener((tabs) => {
		if (tabsToListenTo[tabs.tabId]) {
			chrome.tabs.sendMessage(tabs.tabId, {
				action: "onHistoryStateUpdated",
			});
		}
	});

	chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
		delete tabsToListenTo[tabId];
	});

	chrome.tabs.onReplaced.addListener((addedTabId, removedTabId) => {
		delete tabsToListenTo[removedTabId];
	});
})();
