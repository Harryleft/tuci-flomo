// 初始化
chrome.runtime.onInstalled.addListener(() => {
  // 右键菜单配置
  chrome.contextMenus.create({
    id: 'captureWord',
    title: '记录单词 "%s"',
    contexts: ['selection']
  });

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

// 处理右键菜单点击
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'captureWord') {
    handleWordCapture(info.selectionText);
  }
});

// 处理来自 content script 的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'CAPTURE_WORD') {
    handleWordCapture(request.word);
    sendResponse({ success: true });
  }
});

// 处理单词捕获
async function handleWordCapture(word) {
  try {
    // TODO: 实现单词处理逻辑
    console.log('捕获单词:', word);
  } catch (error) {
    console.error('处理单词时出错:', error);
  }
}

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