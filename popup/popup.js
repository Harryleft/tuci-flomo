import APIClient from '../services/APIClient.js';
import ConfigManager from '../services/ConfigManager.js';

class PopupManager {
  constructor() {
    this.elements = {};
    
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.initialize());
    } else {
      this.initialize();
    }
  }

  async initialize() {
    try {
      await this.initElements();
      const hasAPIKey = await ConfigManager.hasValidAPIKey();
      
      await this.loadSettings();
      this.bindEventListeners();
      
      if (!hasAPIKey) {
        this.elements.generateBtn.disabled = true;
        this.showError('请先在设置页面配置 API Key');
      } else {
        this.elements.generateBtn.disabled = false;
      }
      
      this.updateSubmitButtonState('default');
      this.preventAutoClose();
    } catch (error) {
      console.error('初始化失败:', error);
      this.showError('初始化失败，请刷新重试');
    }
  }

  async initElements() {
    try {
      const selectors = {
        wordInput: '#wordInput',
        generateBtn: '#generateBtn',
        descriptionContent: '#sceneDescription',
        submitBtn: '#submitBtn',
        settingsBtn: '.header-btn[title="设置"]',
        closeBtn: '.header-btn[title="关闭"]'
      };

      for (const [key, selector] of Object.entries(selectors)) {
        const element = document.querySelector(selector);
        if (!element) {
          throw new Error(`找不到元素: ${key} (选择器: ${selector})`);
        }
        this.elements[key] = element;
      }

      this.elements.wordInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && e.shiftKey) {
          e.preventDefault();
          
          if (!this.elements.submitBtn.disabled) {
            this.handleSubmit();
          }
        } 
        else if (e.key === 'Enter' && !e.shiftKey && e.target.value.trim()) {
          e.preventDefault();
          
          if (!this.elements.generateBtn.disabled) {
            this.handleGenerate();
          }
        }
      });
    } catch (error) {
      console.error('初始化元素失败:', error);
      throw error;
    }
  }

  bindEventListeners() {
    const { settingsBtn, closeBtn, generateBtn, submitBtn } = this.elements;

    if (settingsBtn) {
      settingsBtn.style.cursor = 'pointer';
      
      settingsBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        settingsBtn.classList.add('clicked');
        setTimeout(() => settingsBtn.classList.remove('clicked'), 200);

        try {
          if (chrome.runtime.openOptionsPage) {
            chrome.runtime.openOptionsPage(() => {
              if (chrome.runtime.lastError) {
                console.error('使用 openOptionsPage 失败:', chrome.runtime.lastError);
                this.openOptionsPageFallback();
              }
            });
          } else {
            this.openOptionsPageFallback();
          }
        } catch (error) {
          console.error('打开设置页面时发生错误:', error);
          this.showError('无法打开设置页面，请稍后重试');
        }
      });
    } else {
      console.error('设置按钮未找到，无法绑定事件');
    }

    closeBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.closePanel();
    });

    if (generateBtn) {
      generateBtn.addEventListener('click', async (e) => {
        if (generateBtn.disabled) {
          return;
        }

        try {
          await this.handleGenerate();
        } catch (error) {
          console.error('生成处理失败:', error);
          this.showError('生成失败，请重试');
        }
      });
    } else {
      console.error('生成按钮未找到');
    }

    const { wordInput } = this.elements;
    if (wordInput) {
      wordInput.addEventListener('blur', () => {
        if (!wordInput.value.trim()) {
          wordInput.placeholder = '示例：sunshine';
        }
      });

      wordInput.addEventListener('focus', () => {
        wordInput.placeholder = '';
      });

      wordInput.addEventListener('input', () => {
        if (!wordInput.value.trim()) {
          wordInput.placeholder = '示例：sunshine';
        }
      });
    }
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

    const generateBtn = this.elements.generateBtn;
    generateBtn.classList.add('loading');
    generateBtn.disabled = true;

    try {
      // 显示加载状态
      this.showLoading('AI 正在为您生成场景描述...');

      const result = await APIClient.generateDescription(word, this.currentScene);
      this.currentDescription = result;

      // 更新界面显示结果
      this.showResult(result);
      this.updateSubmitButtonState('ready');

    } catch (error) {
      console.error('生成失败:', error);
      this.showRetryableError(error.message || '生成失败，正在重试...');
      this.updateSubmitButtonState('default');
    } finally {
      this.updateGenerateButton(false);
    }
  }

  async handleSubmit() {
    if (!this.currentDescription) {
      this.showError('请先生成内容');
      return;
    }

    try {
      this.updateSubmitButtonState('submitting');
      await APIClient.submitToFlomo(this.currentDescription);
      
      this.updateSubmitButtonState('success');
      
      setTimeout(() => {
        this.elements.wordInput.value = '';
        this.elements.descriptionContent.innerHTML = `
          <div class="result-section__placeholder">
            <div>输入单词并点击生成按钮</div>
            <div>AI 将为你创建生动的场景描述...</div>
          </div>
        `;
        this.currentDescription = null;
        this.updateSubmitButtonState('default');
      }, 1500);

    } catch (error) {
      this.updateSubmitButtonState('ready');
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

  preventAutoClose() {
    const preventClose = (e) => {
      if (e.target.closest('button[id]')) {
        return;
      }
      e.stopPropagation();
    };

    document.addEventListener('click', preventClose, true);
  }

  closePanel() {
    try {
      window.close();
    } catch (error) {
      console.error('关闭面板失败:', error);
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

  openOptionsPageFallback() {
    try {
      const optionsUrl = chrome.runtime.getURL('options/options.html');
      chrome.tabs.create({ url: optionsUrl }, (tab) => {
        if (chrome.runtime.lastError) {
          console.error('创建选项页标签失败:', chrome.runtime.lastError);
          this.showError('无法打开设置页面');
        }
      });
    } catch (error) {
      console.error('后备方案失败:', error);
      this.showError('无法打开设置页面，请稍后重试');
    }
  }

  updateSubmitButtonState(state = 'default') {
    const submitBtn = this.elements.submitBtn;
    if (!submitBtn) {
      return;
    }

    const states = {
      default: {
        disabled: true,
        icon: '📝',
        text: '提交到 Flomo',
        class: 'btn--submit-default'
      },
      ready: {
        disabled: false,
        icon: '📝',
        text: '提交到 Flomo',
        class: 'btn--submit-ready'
      },
      submitting: {
        disabled: true,
        icon: '⏳',
        text: '提交中...',
        class: 'btn--submit-submitting'
      },
      success: {
        disabled: true,
        icon: '✅',
        text: '已提交',
        class: 'btn--submit-success'
      }
    };

    const config = states[state] || states.default;
    
    submitBtn.disabled = config.disabled;
    submitBtn.className = `btn btn--submit ${config.class}`;
    submitBtn.innerHTML = `
      <span class="btn__icon">${config.icon}</span>
      <span class="btn__text">${config.text}</span>
    `;
  }

  // 添加新的错误显示方法
  showRetryableError(message) {
    if (this.elements.descriptionContent) {
      this.elements.descriptionContent.innerHTML = `
        <div class="error-message retryable">
          <div class="error-icon-container">
            <span class="error-icon">⚠️</span>
            <div class="retry-spinner"></div>
          </div>
          <div class="error-content">
            <div class="error-text">${message}</div>
            <div class="retry-text">自动重试中...</div>
          </div>
        </div>
      `;
    }
  }

  // 添加加载状态显示方法
  showLoading(message) {
    this.elements.descriptionContent.innerHTML = `
      <div class="loading-container">
        <div class="loading-progress"></div>
        <div class="loading-container__icon">✨</div>
        <div class="loading-container__text">
          <div>${message}</div>
          <div class="loading-container__subtext">这可能需要几秒钟时间</div>
        </div>
      </div>
    `;
  }

  updateGenerateButton(isGenerating) {
    this.setGenerating(isGenerating);
    this.elements.generateBtn.disabled = isGenerating;
  }

  showResult(result) {
    const formattedContent = `
      <div class="result-card__content">
        <div class="result-card__part memory-section">
          <div class="result-card__part-title">
            <span class="result-card__part-icon">💡</span>
            <span>助记拆解</span>
          </div>
          <div class="result-card__part-content">
            ${formatParagraphs(result.关键词)}
          </div>
        </div>
        
        <div class="result-card__part scene-section">
          <div class="result-card__part-title">
            <span class="result-card__part-icon">🎬</span>
            <span>场景描述</span>
          </div>
          <div class="result-card__part-content">
            ${formatParagraphs(result.图像描述)}
          </div>
        </div>
      </div>
    `;

    this.elements.descriptionContent.innerHTML = formattedContent;

    const elements = this.elements.descriptionContent.querySelectorAll('.typewriter-content');
    for (const element of elements) {
      const text = element.textContent;
      element.textContent = '';
      this.typewriterEffect(element, text);
    }
  }
}

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

function updateResultCard(result) {
  const sceneDescription = document.getElementById('sceneDescription');
  sceneDescription.innerHTML = `
    <div class="result-card__content">
      <div class="result-card__part memory-section">
        <div class="result-card__part-title">
          <span class="result-card__part-icon">💡</span>
          <span>助记拆解</span>
        </div>
        <div class="result-card__part-content">
          ${formatParagraphs(result.关键词)}
        </div>
      </div>
      
      <div class="result-card__part scene-section">
        <div class="result-card__part-title">
          <span class="result-card__part-icon">🎬</span>
          <span>场景描述</span>
        </div>
        <div class="result-card__part-content">
          ${formatParagraphs(result.图像描述)}
        </div>
      </div>
    </div>
  `;
  
  sceneDescription.classList.add('generated');

  const contentElements = sceneDescription.querySelectorAll('.result-card__part-content');
  contentElements.forEach(element => {
    if (element.scrollHeight > element.clientHeight) {
      element.classList.add('scrollable');
    }
  });
}

function formatParagraphs(text) {
  return text.split('\n')
    .filter(line => line.trim())
    .map(line => `<p>${line}</p>`)
    .join('');
} 