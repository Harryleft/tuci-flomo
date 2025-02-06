import APIClient from '../services/APIClient.js';
import ConfigManager from '../services/ConfigManager.js';

class PopupManager {
  constructor() {
    console.log('PopupManager 构造函数被调用');
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.initialize());
    } else {
      this.initialize();
    }
  }

  async initialize() {
    try {
      console.log('开始初始化 PopupManager');
      
      // 先检查 API Key
      const hasAPIKey = await ConfigManager.hasValidAPIKey();
      console.log('API Key 状态:', hasAPIKey);
      
      await this.initElements();
      await this.loadSettings();
      this.bindEventListeners();
      
      // 根据 API Key 状态设置按钮
      if (!hasAPIKey) {
        this.elements.generateBtn.disabled = true;
        this.showError('请先在设置页面配置 API Key');
      } else {
        this.elements.generateBtn.disabled = false;
      }
      
      this.preventAutoClose();
      console.log('初始化完成');
    } catch (error) {
      console.error('初始化失败:', error);
      this.showError('初始化失败，请刷新重试');
    }
  }

  async initElements() {
    console.log('开始初始化元素');
    try {
      // 使用更严格的选择器
      const selectors = {
        wordInput: '#wordInput',
        generateBtn: '#generateBtn',
        descriptionContent: '#sceneDescription',
        submitBtn: '#submitBtn',
        settingsBtn: '.header-btn[title="设置"]', // 更精确的选择器
        closeBtn: '.header-btn[title="关闭"]'     // 更精确的选择器
      };

      // 查找所有元素
      this.elements = {};
      for (const [key, selector] of Object.entries(selectors)) {
        const element = document.querySelector(selector);
        if (!element) {
          throw new Error(`找不到元素: ${key} (选择器: ${selector})`);
        }
        this.elements[key] = element;
        console.log(`找到元素: ${key}`);
      }

      console.log('所有必需元素已找到:', Object.keys(this.elements));
    } catch (error) {
      console.error('初始化元素失败:', error);
      throw error;
    }
  }

  bindEventListeners() {
    console.log('开始绑定事件监听器');
    const { settingsBtn, closeBtn, generateBtn, submitBtn } = this.elements;

    if (settingsBtn) {
      console.log('找到设置按钮，准备绑定事件');
      
      // 添加视觉反馈
      settingsBtn.style.cursor = 'pointer';
      
      settingsBtn.addEventListener('click', (e) => {
        console.log('设置按钮被点击');
        e.preventDefault();
        e.stopPropagation();
        
        // 添加点击反馈
        settingsBtn.classList.add('clicked');
        setTimeout(() => settingsBtn.classList.remove('clicked'), 200);

        // 尝试打开选项页
        try {
          if (chrome.runtime.openOptionsPage) {
            chrome.runtime.openOptionsPage(() => {
              if (chrome.runtime.lastError) {
                console.error('使用 openOptionsPage 失败:', chrome.runtime.lastError);
                this.openOptionsPageFallback();
              } else {
                console.log('选项页面已打开');
              }
            });
          } else {
            console.log('openOptionsPage 不可用，使用后备方案');
            this.openOptionsPageFallback();
          }
        } catch (error) {
          console.error('打开设置页面时发生错误:', error);
          this.showError('无法打开设置页面，请稍后重试');
        }
      });
      
      console.log('设置按钮事件监听器已绑定');
    } else {
      console.error('设置按钮未找到，无法绑定事件');
    }

    closeBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log('关闭按钮被点击');
      this.closePanel();
    });

    if (generateBtn) {
      console.log('找到生成按钮，准备绑定事件');
      generateBtn.addEventListener('click', async (e) => {
        console.log('生成按钮被点击，按钮状态:', {
          disabled: generateBtn.disabled,
          classList: Array.from(generateBtn.classList)
        });
        
        if (generateBtn.disabled) {
          console.warn('按钮已被禁用');
          return;
        }

        try {
          await this.handleGenerate();
        } catch (error) {
          console.error('生成处理失败:', error);
          this.showError('生成失败，请重试');
        }
      });
      console.log('生成按钮事件监听器已绑定');
    } else {
      console.error('生成按钮未找到');
    }

    if (submitBtn) {
      submitBtn.addEventListener('click', () => this.handleSubmit());
      submitBtn.disabled = true;
    }

    console.log('事件监听器绑定完成');
  }

  async loadSettings() {
    try {
      if (!await ConfigManager.hasValidAPIKey()) {
        this.showError('请先在设置页面配置 API Key');
        this.elements.generateBtn.disabled = true;
        return;
      }

      const settings = await chrome.storage.sync.get({
        selectedScene: 'default',
        customScene: ''
      });
      this.currentScene = settings.selectedScene;
      this.customScene = settings.customScene;
    } catch (error) {
      console.error('加载设置失败:', error);
      this.showError('加载设置失败');
    }
  }

  async typewriterEffect(element, text, speed = 50) {
    let index = 0;
    element.textContent = '';
    element.classList.add('typing');
    
    // 添加光标
    const cursor = document.createElement('span');
    cursor.className = 'typewriter-cursor';
    element.parentNode.appendChild(cursor);

    return new Promise((resolve) => {
      const type = () => {
        if (index < text.length) {
          element.textContent += text.charAt(index);
          index++;
          setTimeout(type, speed);
        } else {
          // 动画完成后移除光标
          cursor.remove();
          resolve();
        }
      };
      type();
    });
  }

  async handleGenerate() {
    const word = this.elements.wordInput.value.trim();
    
    if (!word) {
      this.showError('请输入要记忆的单词');
      return;
    }

    try {
      // 设置按钮加载状态
      const generateBtn = this.elements.generateBtn;
      generateBtn.classList.add('loading');
      generateBtn.disabled = true;

      // 显示加载动画
      this.elements.descriptionContent.innerHTML = `
        <div class="loading-container">
          <div class="loading-container__icon">✨</div>
          <div class="loading-container__text">AI 正在为您生成场景描述...</div>
        </div>
      `;

      const result = await APIClient.generateDescription(word, this.currentScene);

      // 保存当前描述，用于提交到 Flomo
      this.currentDescription = result;

      // 创建结果容器
      const formattedContent = `
        <div class="result-card__content">
          <div class="word-section">
            <div class="word-section__header">
              <h3>${result.英语}</h3>
            </div>
          </div>
          
          <div class="memory-section">
            <div class="section-content">
              <div class="section-label">助记拆解</div>
              <p class="typewriter-content">${result.关键词}</p>
            </div>
          </div>
          
          <div class="scene-section">
            <div class="section-content">
              <div class="section-label">场景描述</div>
              <p class="typewriter-content">${result.图像描述}</p>
            </div>
          </div>
        </div>
      `;

      this.elements.descriptionContent.innerHTML = formattedContent;

      // 依次执行打字机效果
      const elements = this.elements.descriptionContent.querySelectorAll('.typewriter-content');
      for (const element of elements) {
        const text = element.textContent;
        element.textContent = '';
        await this.typewriterEffect(element, text);
      }

      // 启用提交按钮
      this.elements.submitBtn.disabled = false;

    } catch (error) {
      console.error('生成失败:', error);
      this.showError(error.message || '生成失败，请重试');
    } finally {
      // 恢复按钮状态
      const generateBtn = this.elements.generateBtn;
      generateBtn.classList.remove('loading');
      generateBtn.disabled = false;
      generateBtn.innerHTML = `
        <span class="generate-btn__text">生成</span>
        <span class="generate-btn__icon">✨</span>
      `;
    }
  }

  async handleSubmit() {
    if (!this.currentDescription) {
      console.warn('没有可提交的内容');
      this.showError('请先生成内容');
      return;
    }

    try {
      this.elements.submitBtn.disabled = true;
      this.elements.submitBtn.innerHTML = `
        <span class="btn__icon">📝</span>
        <span class="btn__text">提交中...</span>
      `;

      await APIClient.submitToFlomo(this.currentDescription);

      this.showSuccessStatus();

      setTimeout(() => {
        this.elements.wordInput.value = '';
        this.elements.descriptionContent.innerHTML = '<div class="placeholder">输入单词并点击生成按钮，AI将为你创建生动的场景描述...</div>';
        this.currentDescription = null;
        this.elements.submitBtn.disabled = true;
        this.elements.submitBtn.innerHTML = `
          <span class="btn__icon">📝</span>
          <span class="btn__text">提交到 Flomo</span>
        `;
      }, 1000);

    } catch (error) {
      console.error('提交失败:', error);
      
      this.elements.submitBtn.disabled = false;
      this.elements.submitBtn.innerHTML = `
        <span class="btn__icon">📝</span>
        <span class="btn__text">提交到 Flomo</span>
      `;
      
      this.showError(error.message || '提交失败，请重试');
    }
  }

  formatDescription(text) {
    return text.split('\n')
      .filter(line => line.trim())
      .map(line => `<p>${line}</p>`)
      .join('');
  }

  setGenerating(isGenerating) {
    this.elements.generateBtn.disabled = isGenerating;
    this.elements.generateBtn.innerHTML = isGenerating ? 
      '<span>生成中...</span>' : 
      '<span class="generate-btn__text">生成</span><span class="generate-btn__icon">✨</span>';
  }

  showError(message) {
    console.warn('显示错误:', message);
    if (this.elements.descriptionContent) {
      this.elements.descriptionContent.innerHTML = `
        <div class="error-message">
          <span class="error-icon">⚠️</span>
          <span>${message}</span>
        </div>
      `;
    }
  }

  showSuccess(message) {
    this.elements.descriptionContent.innerHTML = `
      <div class="success-message">
        <span class="success-icon">✅</span>
        <span>${message}</span>
      </div>
    `;
  }

  showSuccessStatus() {
    const existingStatus = document.getElementById('submitStatus');
    if (existingStatus) {
      existingStatus.remove();
    }
    
    const statusEl = document.createElement('div');
    statusEl.id = 'submitStatus';
    statusEl.className = 'submit-status';
    statusEl.innerHTML = `
      <span class="submit-status__icon">✓</span>
      <span class="submit-status__text">已保存</span>
    `;
    
    document.body.appendChild(statusEl);
    
    void statusEl.offsetWidth;
    
    statusEl.classList.add('submit-status--success');
    
    setTimeout(() => {
      statusEl.classList.add('submit-status--hide');
      
      statusEl.addEventListener('animationend', () => {
        statusEl.remove();
      }, { once: true });
    }, 1000);
  }

  preventAutoClose() {
    const preventClose = (e) => {
      // 检查是否是功能按钮
      if (e.target.closest('button[id]')) {  // 任何有 ID 的按钮都不阻止
        return;
      }
      e.stopPropagation();
    };

    document.addEventListener('click', preventClose, true);
  }

  closePanel() {
    console.log('执行关闭操作');
    try {
      // 对于 Chrome 扩展的弹出窗口，直接使用 window.close() 即可
      window.close();
    } catch (error) {
      console.error('关闭面板失败:', error);
      // 如果 window.close() 失败，尝试使用 Chrome API
      try {
        chrome.windows.getCurrent((window) => {
          if (window.type === 'popup') {
            chrome.windows.remove(window.id);
          }
        });
      } catch (innerError) {
        console.error('备用关闭方法也失败:', innerError);
      }
    }
  }

  // 添加后备方案方法
  openOptionsPageFallback() {
    console.log('使用后备方案打开选项页');
    try {
      const optionsUrl = chrome.runtime.getURL('options/options.html');
      console.log('选项页 URL:', optionsUrl);
      
      chrome.tabs.create({ url: optionsUrl }, (tab) => {
        if (chrome.runtime.lastError) {
          console.error('创建选项页标签失败:', chrome.runtime.lastError);
          this.showError('无法打开设置页面');
        } else {
          console.log('选项页已在新标签页打开:', tab);
        }
      });
    } catch (error) {
      console.error('后备方案失败:', error);
      this.showError('无法打开设置页面，请稍后重试');
    }
  }
}

console.log('准备初始化 PopupManager');
const popupManager = new PopupManager();

window.addEventListener('error', (event) => {
  console.error('全局错误:', event.error);
  const errorDiv = document.createElement('div');
  errorDiv.className = 'error-message';
  errorDiv.innerHTML = `
    <span class="error-icon">⚠️</span>
    <span>发生错误，请刷新页面重试</span>
  `;
  document.body.appendChild(errorDiv);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('未处理的 Promise 拒绝:', event.reason);
});

export default popupManager; 