import ConfigManager from '/services/ConfigManager.js';
import ImageService from '/services/ImageService.js';

// 工具函数
const debounce = (fn, delay) => {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), delay);
  };
};

// 状态管理类
class Store {
  // AI服务配置
  static AI_SERVICES = {
    deepseek: {
      name: 'DeepSeek AI',
      keyName: 'deepseekKey',
      testEndpoint: 'https://api.siliconflow.cn/v1/chat/completions'
    },
    glm: {
      name: '智谱 GLM-4',
      keyName: 'glmKey',
      testEndpoint: 'https://open.bigmodel.cn/api/paas/v4/chat/completions'
    },
    volcengine: {
      name: '火山云',
      keyName: 'volcengineKey',
      testEndpoint: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions'
    }
  };

  constructor() {
    this.state = {
      enableImageGen: false,
      imageSize: '1024x1024',
      imageStyle: 'realistic',
      volcengineKey: '',
      glmKey: ''
    };
    this.listeners = new Set();
    this.maskedFields = ['volcengineKey', 'glmKey'];
    
    // 添加保存防抖
    this.debouncedSave = debounce(this.saveToStorage.bind(this), 1000);
  }

  // 新增：将保存到存储的逻辑分离出来
  async saveToStorage(stateToSave) {
    try {
      await chrome.storage.sync.set(stateToSave);
      return true;
    } catch (error) {
      console.error('保存到存储失败:', error);
      return false;
    }
  }

  // 订阅状态变化
  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // 更新状态并持久化
  async setState(newState) {
    try {
      // 更新内存中的状态
      this.state = { ...this.state, ...newState };
      
      // 处理需要遮罩的字段
      const stateToSave = { ...newState };
      
      // 直接保存 API Key，不使用遮罩处理
      if (stateToSave.volcengineKey || stateToSave.glmKey) {
        await chrome.storage.sync.set(stateToSave);
      } else {
        // 使用防抖保存其他状态
        await this.debouncedSave(stateToSave);
      }
      
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
      volcengineKey: '',
      glmKey: '',
      enableImageGen: false,
      imageSize: '1024x1024',
      imageStyle: 'realistic'
    };

    try {
      // 加载所有状态，包括 API Keys
      const savedState = await chrome.storage.sync.get(defaultState);
      this.state = { ...defaultState, ...savedState };
      
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

  // 从安全存储获取API密钥
  async getAPIKey(keyName) {
    try {
      const result = await chrome.storage.sync.get(keyName);
      return result[keyName];
    } catch (error) {
      console.error(`获取${keyName}失败:`, error);
      return null;
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

    // 初始化图片生成设置
    this.initImageGenSettings();
  }

  initInputListeners() {
    // Webhook URL 输入监听
    const webhookInput = document.getElementById('webhookUrl');
    if (webhookInput) {
      webhookInput.addEventListener('input', debounce(e => {
        this.handleInputChange('webhookUrl', e.target.value);
      }, 1000));
    }

    // API Key 输入监听
    const apiKeyInput = document.getElementById('apiKey');
    if (apiKeyInput) {
      apiKeyInput.addEventListener('input', debounce(e => {
        // 只有当输入的不是占位符时才保存
        if (!e.target.value.match(/^[•]+$/)) {
          this.handleInputChange('apiKey', e.target.value);
        }
      }, 1000));
    }

    // 默认标签输入监听
    const tagInput = document.getElementById('defaultTag');
    if (tagInput) {
      tagInput.addEventListener('input', debounce(e => {
        this.handleInputChange('defaultTag', e.target.value);
      }, 1000));
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
      }, 1000));
    }

    // 添加 API Key 输入监听
    const volcengineKeyInput = document.getElementById('volcengineKey');
    const glmKeyInput = document.getElementById('glmKey');

    // 火山云 API Key 输入监听
    if (volcengineKeyInput) {
      volcengineKeyInput.addEventListener('input', debounce(async (e) => {
        if (!e.target.value.match(/^[•]+$/)) {
          await this.store.setState({ volcengineKey: e.target.value.trim() });
          this.showSaveStatus('API Key已保存', 'success');
        }
      }, 1000));
    }

    // GLM API Key 输入监听
    if (glmKeyInput) {
      glmKeyInput.addEventListener('input', debounce(async (e) => {
        if (!e.target.value.match(/^[•]+$/)) {
          await this.store.setState({ glmKey: e.target.value.trim() });
          this.showSaveStatus('API Key已保存', 'success');
        }
      }, 1000));
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

    // 更新所有 API Key 输入框
    ['volcengineKey', 'glmKey'].forEach(key => {
      const input = document.getElementById(key);
      if (input && state[key]) {
        input.value = state[key];
      }
    });

    // 更新AI服务选择
    const aiServiceSelect = document.getElementById('aiService');
    if (aiServiceSelect && state.selectedAIService) {
      aiServiceSelect.value = state.selectedAIService;
      // 触发change事件以更新UI
      aiServiceSelect.dispatchEvent(new Event('change'));
    }

    // 更新图片生成设置
    const imageGenCheckbox = document.getElementById('enableImageGen');
    const imageSettings = document.querySelector('.image-settings');
    if (imageGenCheckbox && state.enableImageGen !== undefined) {
      imageGenCheckbox.checked = state.enableImageGen;
      if (imageSettings) {
        imageSettings.style.display = state.enableImageGen ? 'block' : 'none';
      }
    }

    // 更新图片尺寸选择
    const imageSizeSelect = document.getElementById('imageSize');
    if (imageSizeSelect && state.imageSize) {
      imageSizeSelect.value = state.imageSize;
    }

    // 更新图片风格选择
    const imageStyleSelect = document.getElementById('imageStyle');
    if (imageStyleSelect && state.imageStyle) {
      imageStyleSelect.value = state.imageStyle;
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

  initImageGenSettings() {
    const imageGenCheckbox = document.getElementById('enableImageGen');
    const imageSettings = document.querySelector('.image-settings');
    
    if (imageGenCheckbox) {
      imageGenCheckbox.addEventListener('change', (e) => {
        if (imageSettings) {
          imageSettings.style.display = e.target.checked ? 'block' : 'none';
        }
        this.store.setState({ enableImageGen: e.target.checked });
      });
    }

    // 图片尺寸选择监听
    const imageSizeSelect = document.getElementById('imageSize');
    if (imageSizeSelect) {
      imageSizeSelect.addEventListener('change', (e) => {
        this.store.setState({ imageSize: e.target.value });
      });
    }

    // 图片风格选择监听
    const imageStyleSelect = document.getElementById('imageStyle');
    if (imageStyleSelect) {
      imageStyleSelect.addEventListener('change', (e) => {
        this.store.setState({ imageStyle: e.target.value });
      });
    }

    // 初始化 API 测试按钮
    document.querySelectorAll('.test-api').forEach(button => {
      button.addEventListener('click', async () => {
        const service = button.dataset.service;
        const resultSpan = button.nextElementSibling;
        button.disabled = true;
        
        try {
          resultSpan.textContent = '测试中...';
          resultSpan.className = 'api-test-result testing';
          
          let result;
          switch (service) {
            case 'glm':
              result = await ConfigManager.testGLMConnection();
              break;
            case 'volcengine':
              result = await ConfigManager.testVolcengineConnection();
              break;
            default:
              throw new Error('未知的 API 服务');
          }
          
          if (result.success) {
            resultSpan.textContent = result.message;
            resultSpan.className = 'api-test-result success';
          } else {
            throw new Error(result.message);
          }
        } catch (error) {
          resultSpan.textContent = error.message || '连接失败';
          resultSpan.className = 'api-test-result error';
          console.error(`${service} API测试失败:`, error);
        } finally {
          button.disabled = false;
          // 3秒后隐藏结果
          setTimeout(() => {
            resultSpan.style.opacity = '0';
          }, 3000);
        }
      });
    });

    // 测试图片生成按钮
    const testImageBtn = document.getElementById('testImageGen');
    if (testImageBtn) {
      testImageBtn.addEventListener('click', async () => {
        const imagePreview = document.getElementById('imagePreview');
        const previewImg = document.getElementById('previewImg');
        const loadingEl = imagePreview.querySelector('.preview-loading');
        
        try {
          loadingEl.style.display = 'block';
          imagePreview.style.display = 'block';
          
          const size = document.getElementById('imageSize').value;
          const style = document.getElementById('imageStyle').value;
          const apiKey = await ConfigManager.getGLMAPIKey();

          const response = await TestService.testImageGeneration({
            size,
            style,
            apiKey
          });

          previewImg.src = response.imageUrl;
          previewImg.style.display = 'block';
        } catch (error) {
          console.error('图片生成测试失败:', error);
          alert(error.message || '图片生成失败，请检查设置');
        } finally {
          loadingEl.style.display = 'none';
        }
      });
    }
  }
}

function showTestResult(success, message) {
  const resultEl = document.getElementById('apiTestResult');
  const tooltipEl = document.querySelector('.api-error-tooltip');
  
  resultEl.className = 'api-test-result ' + (success ? 'success' : 'error');
  resultEl.textContent = success ? '连接成功' : '连接失败';
  
  if (!success && tooltipEl) {
    tooltipEl.textContent = message || '请检查 API Key 是否正确';
  }
}

// 测试连接
async function testApiConnection(apiKey) {
  try {
    // ... API 测试逻辑 ...
    showTestResult(true);
  } catch (error) {
    let errorMessage = '连接失败';
    if (error.status === 401) {
      errorMessage = 'API Key 无效或已过期';
    } else if (error.status === 429) {
      errorMessage = 'API 调用次数已达上限';
    } else if (error.status === 500) {
      errorMessage = '服务器内部错误，请稍后再试';
    } else if (error.status === 502) {
      errorMessage = '网关错误，请稍后再试';
    } else if (error.status === 503) {
      errorMessage = '服务暂时不可用，请稍后再试';      
    } else if (error.status === 504) {
      errorMessage = '网关超时，请稍后再试';
    } else if (!navigator.onLine) {
      errorMessage = '请检查网络连接';
    }
    showTestResult(false, errorMessage);
  }
}

// 测试图片生成功能
document.getElementById('testImageGen').addEventListener('click', async () => {
  const imagePreview = document.getElementById('imagePreview');
  const previewImg = document.getElementById('previewImg');
  const loadingEl = imagePreview.querySelector('.preview-loading');
  const resultEl = document.querySelector('.api-test-result');
  
  try {
    // 显示加载状态
    loadingEl.style.display = 'block';
    imagePreview.style.display = 'block';
    resultEl.textContent = '准备测试...';
    resultEl.className = 'api-test-result testing';
    
    // 获取当前设置
    const size = document.getElementById('imageSize').value;
    const style = document.getElementById('imageStyle').value;

    // 使用快速测试方法
    const response = await ImageService.quickTest({
      size,
      style,
      onProgress: (stage) => {
        resultEl.textContent = stage;
      }
    });

    // 显示生成的图片
    resultEl.textContent = '正在加载图片...';
    previewImg.onload = () => {
      resultEl.textContent = '✅ 测试成功';
      resultEl.className = 'api-test-result success';
      console.log('图片加载成功');
    };
    previewImg.onerror = (e) => {
      console.error('图片加载失败:', e);
      throw new Error('图片加载失败');
    };
    previewImg.src = response.imageUrl;
    previewImg.style.display = 'block';
    
  } catch (error) {
    console.error('图片生成测试失败:', {
      message: error.message,
      status: error.status,
      response: error.response,
      stack: error.stack
    });

    // 显示详细错误信息
    let errorMessage = '❌ ';
    if (error.status === 401) {
      errorMessage += 'API Key 无效';
    } else if (error.status === 429) {
      errorMessage += 'API 调用次数超限';
    } else if (error.status === 500) {
      errorMessage += '服务器内部错误';
    } else if (!navigator.onLine) {
      errorMessage += '网络连接失败';
    } else {
      errorMessage += error.message || '未知错误';
    }

    resultEl.textContent = errorMessage;
    resultEl.className = 'api-test-result error';
    previewImg.style.display = 'none';
    
  } finally {
    loadingEl.style.display = 'none';
  }
});

// 图片加载完成后的处理
document.getElementById('previewImg').addEventListener('load', function() {
  this.style.display = 'block';
  // 调整预览区域大小
  const imagePreview = document.getElementById('imagePreview');
  imagePreview.style.minHeight = this.height + 'px';
});

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