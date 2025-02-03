// 保存设置到 Chrome 存储
async function saveOptions() {
  const webhookUrl = document.getElementById('webhookUrl').value;
  const defaultTag = document.getElementById('defaultTag').value;
  const selectedScene = document.getElementById('sceneSelect').value;
  const customScene = document.getElementById('customScene').value;

  try {
    await chrome.storage.sync.set({
      webhookUrl,
      defaultTag,
      selectedScene,
      customScene
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
      selectedScene: 'default',
      customScene: ''
    });

    document.getElementById('webhookUrl').value = result.webhookUrl;
    document.getElementById('defaultTag').value = result.defaultTag;
    document.getElementById('sceneSelect').value = result.selectedScene;
    document.getElementById('customScene').value = result.customScene;
    
    // 根据选择显示/隐藏自定义场景输入框
    const customSceneInput = document.getElementById('customScene');
    customSceneInput.style.display = result.selectedScene === 'custom' ? 'block' : 'none';
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

// 状态管理类
class Store {
  constructor() {
    this.state = {};
    this.listeners = new Set();
  }

  // 订阅状态变化
  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // 更新状态
  async setState(newState) {
    this.state = { ...this.state, ...newState };
    try {
      // 保存到 Chrome Storage
      await chrome.storage.sync.set(this.state);
      // 通知所有监听器
      this.listeners.forEach(listener => listener(this.state));
      return true;
    } catch (error) {
      console.error('保存状态失败:', error);
      return false;
    }
  }

  // 加载状态
  async loadState() {
    const defaultState = {
      webhookUrl: '',
      defaultTag: '#英语单词',
      selectedScene: 'default',
      customScene: ''
    };

    try {
      this.state = await chrome.storage.sync.get(defaultState);
      this.listeners.forEach(listener => listener(this.state));
    } catch (error) {
      console.error('加载状态失败:', error);
      this.state = defaultState;
    }
  }
}

// UI 管理类
class UIManager {
  constructor(store) {
    this.store = store;
    this.init();
  }

  init() {
    // 订阅状态变化
    this.unsubscribe = this.store.subscribe(state => this.updateUI(state));
    
    // 初始化输入监听
    this.initInputListeners();
    
    // 加载初始状态
    this.store.loadState();
  }

  initInputListeners() {
    const debounce = (fn, delay) => {
      let timeout;
      return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => fn(...args), delay);
      };
    };

    // Webhook URL 输入监听
    const webhookInput = document.getElementById('webhookUrl');
    if (webhookInput) {
      webhookInput.addEventListener('input', debounce(e => {
        this.handleInputChange('webhookUrl', e.target.value);
      }, 500));
    }

    // 默认标签输入监听
    const tagInput = document.getElementById('defaultTag');
    if (tagInput) {
      tagInput.addEventListener('input', debounce(e => {
        this.handleInputChange('defaultTag', e.target.value);
      }, 500));
    }

    // 场景卡片点击监听
    document.querySelectorAll('.scene-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (!e.target.classList.contains('custom-scene-input')) {
          const sceneType = card.dataset.scene;
          this.handleSceneChange(sceneType);
        }
      });
    });

    // 自定义场景输入监听
    const customInput = document.getElementById('customScene');
    if (customInput) {
      customInput.addEventListener('click', e => e.stopPropagation());
      customInput.addEventListener('input', debounce(e => {
        this.handleInputChange('customScene', e.target.value);
      }, 500));
    }
  }

  async handleInputChange(key, value) {
    const success = await this.store.setState({ [key]: value.trim() });
    if (success) {
      this.showSaveStatus('设置已保存');
    } else {
      this.showSaveStatus('保存失败，请重试', true);
    }
  }

  async handleSceneChange(sceneType) {
    const success = await this.store.setState({ selectedScene: sceneType });
    if (success) {
      this.updateSceneUI(sceneType);
      this.showSaveStatus('设置已保存');
    } else {
      this.showSaveStatus('保存失败，请重试', true);
    }
  }

  updateUI(state) {
    // 更新输入框
    const webhookInput = document.getElementById('webhookUrl');
    if (webhookInput) webhookInput.value = state.webhookUrl;

    const tagInput = document.getElementById('defaultTag');
    if (tagInput) tagInput.value = state.defaultTag;

    // 更新场景选择
    this.updateSceneUI(state.selectedScene);

    // 更新自定义场景
    const customInput = document.getElementById('customScene');
    if (customInput && state.selectedScene === 'custom') {
      customInput.value = state.customScene;
    }
  }

  updateSceneUI(selectedScene) {
    document.querySelectorAll('.scene-card').forEach(card => {
      const isActive = card.dataset.scene === selectedScene;
      card.classList.toggle('active', isActive);
      const radio = card.querySelector('input[type="radio"]');
      if (radio) radio.checked = isActive;
    });

    const customInput = document.getElementById('customScene');
    if (customInput) {
      customInput.disabled = selectedScene !== 'custom';
      if (selectedScene === 'custom') {
        customInput.focus();
      }
    }
  }

  showSaveStatus(message, isError = false) {
    const saveStatus = document.getElementById('saveStatus');
    if (saveStatus) {
      saveStatus.textContent = message;
      saveStatus.style.color = isError ? '#dc3545' : '#4CAF50';
      
      // 添加淡入淡出效果
      saveStatus.style.opacity = '1';
      setTimeout(() => {
        saveStatus.style.opacity = '0';
      }, 2000);
    }
  }
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  const store = new Store();
  new UIManager(store);

  // 快捷键设置按钮点击事件
  document.getElementById('changeShortcut').addEventListener('click', () => {
    alert('请在 Chrome 浏览器地址栏输入: chrome://extensions/shortcuts\n然后找到"图词Flomo"进行快捷键设置');
  });

  // 场景选择变化处理
  document.getElementById('sceneSelect')?.addEventListener('change', (e) => {
    const customSceneInput = document.getElementById('customScene');
    customSceneInput.style.display = e.target.value === 'custom' ? 'block' : 'none';
    saveOptions();
  });
}); 