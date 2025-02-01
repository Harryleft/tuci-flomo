document.addEventListener('DOMContentLoaded', () => {
  // 获取DOM元素
  const wordInput = document.getElementById('wordInput');
  const originalText = document.getElementById('originalText');
  const thoughts = document.getElementById('thoughts');
  const submitBtn = document.getElementById('submitBtn');
  const closeBtn = document.getElementById('closeBtn');
  const settingsBtn = document.getElementById('settingsBtn');
  const tabs = document.querySelectorAll('.tab');
  const sceneSelect = document.getElementById('sceneSelect');
  const customScene = document.getElementById('customScene');

  // 标签切换
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const tabId = tab.getAttribute('data-tab');
      
      // 切换标签样式
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      // 切换内容
      document.querySelectorAll('.tab-pane').forEach(pane => {
        pane.classList.remove('active');
      });
      document.getElementById(`${tabId}Content`).classList.add('active');

      // 如果切换到AI描述标签，自动生成描述
      if (tabId === 'description') {
        generateDescription();
      }
      // 如果切换到图像标签，自动生成图片
      else if (tabId === 'image') {
        generateImage();
      }
    });
  });

  // 场景选择
  sceneSelect.addEventListener('change', () => {
    const isCustom = sceneSelect.value === 'custom';
    customScene.style.display = isCustom ? 'block' : 'none';
    if (!isCustom) {
      generateDescription();
    }
  });

  customScene.addEventListener('input', () => {
    if (customScene.value.trim()) {
      generateDescription();
    }
  });

  // 关闭按钮
  closeBtn.addEventListener('click', () => {
    window.close();
  });

  // 设置按钮
  settingsBtn.addEventListener('click', () => {
    chrome.tabs.create({
      url: chrome.runtime.getURL('options/options.html')
    });
  });

  // 提交按钮
  submitBtn.addEventListener('click', async () => {
    const word = wordInput.value.trim();
    const context = originalText.value.trim();
    const personalThoughts = thoughts.value.trim();

    if (!word) {
      alert('请输入要记忆的单词');
      return;
    }

    try {
      await handleSubmit({
        word,
        context,
        personalThoughts
      });
    } catch (error) {
      console.error('提交失败:', error);
      alert('提交失败，请重试');
    }
  });

  // 自动获取剪贴板内容
  navigator.clipboard.readText()
    .then(text => {
      if (text && !wordInput.value) {
        wordInput.value = text.trim();
      }
    })
    .catch(err => console.log('无法读取剪贴板:', err));
});

async function handleSubmit(data) {
  try {
    // 1. 生成场景描述
    const description = await APIClient.generateDescription(data.word);
    
    // 2. 生成配图
    const image = await APIClient.generateImage(description);
    
    // 3. 提交到 Flomo
    await APIClient.submitToFlomo({
      ...data,
      description,
      image
    });

    // 4. 保存到本地历史
    await StorageService.saveWord({
      ...data,
      description,
      image,
      timestamp: Date.now()
    });

    // 5. 清空输入
    clearInputs();
    
    alert('提交成功！');
  } catch (error) {
    throw error;
  }
}

function clearInputs() {
  document.getElementById('wordInput').value = '';
  document.getElementById('originalText').value = '';
  document.getElementById('thoughts').value = '';
}

async function generateDescription() {
  const word = wordInput.value.trim();
  if (!word) return;

  const scene = sceneSelect.value === 'custom' 
    ? customScene.value.trim() 
    : sceneSelect.value;

  try {
    const description = await APIClient.generateDescription(word, scene);
    document.getElementById('sceneDescription').textContent = description;
  } catch (error) {
    console.error('生成描述失败:', error);
  }
}

async function generateImage() {
  const description = document.getElementById('sceneDescription').textContent;
  if (!description) return;

  try {
    const imageUrl = await APIClient.generateImage(description);
    const aiImage = document.getElementById('aiImage');
    aiImage.innerHTML = `<img src="${imageUrl}" alt="AI生成图片">`;
  } catch (error) {
    console.error('生成图片失败:', error);
  }
} 