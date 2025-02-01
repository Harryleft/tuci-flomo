document.addEventListener('DOMContentLoaded', () => {
  // 获取DOM元素
  const wordInput = document.getElementById('wordInput');
  const captureBtn = document.getElementById('captureBtn');
  const submitToFlomoBtn = document.getElementById('submitToFlomo');
  const settingsBtn = document.getElementById('settings');

  // 记录按钮点击事件
  captureBtn.addEventListener('click', () => {
    const word = wordInput.value.trim();
    if (word) {
      handleWordCapture(word);
    }
  });

  // 提交到Flomo按钮点击事件
  submitToFlomoBtn.addEventListener('click', () => {
    // TODO: 实现提交到Flomo的逻辑
    console.log('提交到Flomo');
  });

  // 设置按钮点击事件
  settingsBtn.addEventListener('click', () => {
    // TODO: 实现打开设置页面的逻辑
    console.log('打开设置');
  });
});

// 处理单词捕获
async function handleWordCapture(word) {
  try {
    // TODO: 实现单词处理逻辑
    console.log('处理单词:', word);
  } catch (error) {
    console.error('处理单词时出错:', error);
  }
} 