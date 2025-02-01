// 初始化右键菜单
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'captureWord',
    title: '记录单词 "%s"',
    contexts: ['selection']
  });
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