// 保存设置到 Chrome 存储
async function saveOptions() {
  const webhookUrl = document.getElementById('webhookUrl').value;
  const defaultTag = document.getElementById('defaultTag').value;
  const isChristmasTheme = document.getElementById('themeToggle').checked;

  try {
    await chrome.storage.sync.set({
      webhookUrl,
      defaultTag,
      isChristmasTheme
    });

    // 显示保存成功提示
    const saveBtn = document.getElementById('saveBtn');
    const originalText = saveBtn.textContent;
    saveBtn.textContent = '保存成功！';
    saveBtn.disabled = true;
    
    setTimeout(() => {
      saveBtn.textContent = originalText;
      saveBtn.disabled = false;
    }, 2000);
  } catch (error) {
    console.error('保存设置失败:', error);
    alert('保存设置失败，请重试');
  }
}

// 从 Chrome 存储加载设置
async function loadOptions() {
  try {
    const result = await chrome.storage.sync.get({
      webhookUrl: '',
      defaultTag: '#英语单词',
      isChristmasTheme: false
    });

    document.getElementById('webhookUrl').value = result.webhookUrl;
    document.getElementById('defaultTag').value = result.defaultTag;
    document.getElementById('themeToggle').checked = result.isChristmasTheme;
  } catch (error) {
    console.error('加载设置失败:', error);
  }
}

// 打开 Chrome 扩展快捷键设置页面
function openShortcutSettings() {
  chrome.tabs.create({
    url: 'chrome://extensions/shortcuts'
  });
}

document.addEventListener('DOMContentLoaded', () => {
  // 加载保存的设置
  loadOptions();

  // 保存按钮点击事件
  document.getElementById('saveBtn').addEventListener('click', saveOptions);

  // 快捷键设置按钮点击事件
  document.getElementById('changeShortcut').addEventListener('click', () => {
    alert('请在 Chrome 浏览器地址栏输入: chrome://extensions/shortcuts\n然后找到"图词Flomo"进行快捷键设置');
  });

  // 监听输入变化，实时保存
  const inputs = document.querySelectorAll('input');
  inputs.forEach(input => {
    input.addEventListener('change', saveOptions);
  });
}); 