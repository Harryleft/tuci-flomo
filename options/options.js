import ConfigManager from '/services/ConfigManager.js';

// 状态管理类
class Store {
  constructor() {
    this.state = {};
    this.listeners = new Set();
    this.maskedFields = ['apiKey']; // 需要遮罩的字段
  }

  // 订阅状态变化
  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // 更新状态
  async setState(newState) {
    // 处理需要遮罩的字段
    const stateToSave = { ...newState };
    for (const field of this.maskedFields) {
      if (stateToSave[field] === '••••••••') {
        delete stateToSave[field];
      }
    }

    try {
      this.state = { ...this.state, ...stateToSave };
      // 保存到 Chrome Storage
      await chrome.storage.sync.set(this.state);
      
      // 创建用于显示的状态（包含遮罩）
      const displayState = { ...this.state };
      for (const field of this.maskedFields) {
        if (displayState[field]) {
          displayState[field] = '••••••••';
        }
      }
      
      // 通知所有监听器
      this.listeners.forEach(listener => listener(displayState));
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
      customScene: '',
      apiKey: ''
    };

    try {
      this.state = await chrome.storage.sync.get(defaultState);
      
      // 创建用于显示的状态（包含遮罩）
      const displayState = { ...this.state };
      for (const field of this.maskedFields) {
        if (displayState[field]) {
          displayState[field] = '••••••••';
        }
      }
      
      this.listeners.forEach(listener => listener(displayState));
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

    // 初始化 API 测试按钮
    this.initApiTest();
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

    // API Key 输入监听
    const apiKeyInput = document.getElementById('apiKey');
    if (apiKeyInput) {
      apiKeyInput.addEventListener('input', debounce(e => {
        // 只有当输入的不是占位符时才保存
        if (!e.target.value.match(/^[•]+$/)) {
          this.handleInputChange('apiKey', e.target.value);
        }
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

    // 更新 API Key 输入框
    const apiKeyInput = document.getElementById('apiKey');
    if (apiKeyInput) {
      // 如果有值则显示占位符，否则清空
      apiKeyInput.value = state.apiKey ? '••••••••' : '';
    }

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

  initApiTest() {
    const testBtn = document.getElementById('testApiBtn');
    const resultSpan = document.getElementById('apiTestResult');

    if (testBtn) {
      testBtn.addEventListener('click', async () => {
        try {
          testBtn.disabled = true;
          resultSpan.textContent = '测试中...';
          resultSpan.className = 'api-test-result';

          await ConfigManager.testAPIConnection();

          resultSpan.textContent = '连接成功 ✓';
          resultSpan.className = 'api-test-result success';
        } catch (error) {
          resultSpan.textContent = error.message || 'API 连接失败';
          resultSpan.className = 'api-test-result error';
        } finally {
          testBtn.disabled = false;
          setTimeout(() => {
            resultSpan.style.opacity = '0';
          }, 3000);
        }
      });
    }
  }
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  try {
    const store = new Store();
    new UIManager(store);
    console.log('设置页面初始化成功');
  } catch (error) {
    console.error('初始化失败:', {
      message: error.message,
      stack: error.stack
    });
    // 显示友好的错误信息
    document.body.innerHTML = `
      <div class="error-message" style="padding: 20px;">
        <h2>设置页面加载失败</h2>
        <p>错误信息：${error.message}</p>
        <p>请尝试重新加载页面或联系开发者</p>
      </div>
    `;
  }
}); 