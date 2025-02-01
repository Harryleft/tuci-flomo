// 监听用户选中文本事件
document.addEventListener('mouseup', () => {
  const selectedText = window.getSelection().toString().trim();
  if (selectedText) {
    // 可以在这里添加一个小工具栏显示
    console.log('选中文本:', selectedText);
  }
});

// 发送消息到 background script
function captureWord(word) {
  chrome.runtime.sendMessage({
    type: 'CAPTURE_WORD',
    word: word
  });
} 