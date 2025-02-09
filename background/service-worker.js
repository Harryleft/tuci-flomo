// 初始化
chrome.runtime.onInstalled.addListener(() => {
  // 移除所有已存在的右键菜单项
  chrome.contextMenus.removeAll();

  // 设置侧边栏
  if (chrome.sidePanel) {
    chrome.sidePanel.setOptions({
      enabled: true,
      path: 'popup/popup.html'
    });
  }

  // 设置默认行为为打开侧边栏
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.error(error));
});

// 处理扩展图标点击
chrome.action.onClicked.addListener((tab) => {
  // 打开侧边栏
  chrome.sidePanel.open({ windowId: tab.windowId });
});

// 处理快捷键
chrome.commands.onCommand.addListener((command) => {
  if (command === '_execute_action') {
    if (chrome.sidePanel) {
      chrome.sidePanel.open();
    }
  }
}); 