import APIClient from '../services/APIClient.js';
import ConfigManager from '../services/ConfigManager.js';

class PopupManager {
  constructor() {
    console.log('PopupManager 构造函数被调用');
    // 初始化 elements 为空对象
    this.elements = {};
    
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.initialize());
    } else {
      this.initialize();
    }
  }

  async initialize() {
    try {
      console.log('开始初始化 PopupManager');
      
      // 先初始化元素，确保后续操作有效
      await this.initElements();
      
      // 检查 API Key
      const hasAPIKey = await ConfigManager.hasValidAPIKey();
      console.log('API Key 状态:', hasAPIKey);
      
      await this.loadSettings();
      this.bindEventListeners();
      
      // 根据 API Key 状态设置按钮
      if (!hasAPIKey) {
        this.elements.generateBtn.disabled = true;
        this.showError('请先在设置页面配置 API Key');
      } else {
        this.elements.generateBtn.disabled = false;
      }
      
      // 初始化提交按钮状态为 default
      this.updateSubmitButtonState('default');
      
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
      for (const [key, selector] of Object.entries(selectors)) {
        const element = document.querySelector(selector);
        if (!element) {
          throw new Error(`找不到元素: ${key} (选择器: ${selector})`);
        }
        this.elements[key] = element;
        console.log(`找到元素: ${key}`);
      }

      console.log('所有必需元素已找到:', Object.keys(this.elements));

      // 添加键盘事件监听
      this.elements.wordInput.addEventListener('keydown', (e) => {
        // 检查是否按下了 Shift + Enter
        if (e.key === 'Enter' && e.shiftKey) {
          e.preventDefault(); // 阻止默认行为
          
          // 如果提交按钮可用，则触发提交
          if (!this.elements.submitBtn.disabled) {
            this.handleSubmit();
          }
        } 
        // 普通回车键生成
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
    }

    // 添加输入框事件监听
    const { wordInput } = this.elements;
    if (wordInput) {
      // 失去焦点时，如果输入框为空，恢复示例文本
      wordInput.addEventListener('blur', () => {
        if (!wordInput.value.trim()) {
          wordInput.placeholder = '示例：sunshine';
        }
      });

      // 获得焦点时，暂时隐藏示例文本
      wordInput.addEventListener('focus', () => {
        wordInput.placeholder = '';
      });

      // 输入内容变化时，根据是否为空决定是否显示示例文本
      wordInput.addEventListener('input', () => {
        if (!wordInput.value.trim()) {
          wordInput.placeholder = '示例：sunshine';
        }
      });
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
      // generateBtn.textContent = '生成中...';

      // 显示加载动画和进度指示器
      this.elements.descriptionContent.innerHTML = `
        <div class="loading-container">
          <div class="loading-progress"></div>
          <div class="loading-container__icon">✨</div>
          <div class="loading-container__text">
            <div>AI 正在为您生成场景描述...</div>
            <div style="font-size: 12px; opacity: 0.8; margin-top: 4px;">这可能需要几秒钟时间</div>
          </div>
        </div>
      `;

      const result = await APIClient.generateDescription(word, this.currentScene);

      // 保存当前描述，用于提交到 Flomo
      this.currentDescription = result;

      // 创建结果容器
      const formattedContent = `
        <div class="result-card__content">
          <!-- 助记拆解部分 -->
          <div class="result-card__part memory-section">
            <div class="result-card__part-title">
              <span class="result-card__part-icon">💡</span>
              <span>助记拆解</span>
            </div>
            <div class="result-card__part-content">
              ${formatParagraphs(result.关键词)}
            </div>
          </div>
          
          <!-- 场景描述部分 -->
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

      // 依次执行打字机效果
      const elements = this.elements.descriptionContent.querySelectorAll('.typewriter-content');
      for (const element of elements) {
        const text = element.textContent;
        element.textContent = '';
        await this.typewriterEffect(element, text);
      }

      // 生成成功后更新按钮状态
      this.updateSubmitButtonState('ready');

    } catch (error) {
      console.error('生成失败:', error);
      this.showError(error.message || '生成失败，请重试');
      this.updateSubmitButtonState('default');
    } finally {
      // 恢复按钮状态，添加过渡动画
      const generateBtn = this.elements.generateBtn;
      generateBtn.style.transition = 'all 0.3s ease';
      generateBtn.classList.remove('loading');
      generateBtn.disabled = false;
      generateBtn.innerHTML = `
        <span class="generate-btn__text">生成</span>
        <span class="generate-btn__icon">✨</span>
      `;
      
      // 移除过渡动画
      setTimeout(() => {
        generateBtn.style.transition = '';
      }, 300);
    }
  }

  async handleSubmit() {
    if (!this.currentDescription) {
      this.showError('请先生成内容');
      return;
    }

    try {
      // 设置提交中状态
      this.updateSubmitButtonState('submitting');
      await APIClient.submitToFlomo(this.currentDescription);
      
      // 设置成功状态
      this.updateSubmitButtonState('success');
      
      // 1.5秒后重置状态和界面
      setTimeout(() => {
        this.elements.wordInput.value = '';
        this.elements.descriptionContent.innerHTML = `
          <div class="result-section__placeholder">
            <div>输入单词并点击生成按钮</div>
            <div>AI 将为你创建生动的场景描述...</div>
          </div>
        `
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

  // 更新提交按钮状态的方法
  updateSubmitButtonState(state = 'default') {
    const submitBtn = this.elements.submitBtn;
    if (!submitBtn) {
      console.warn('提交按钮未找到，跳过状态更新');
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
    
    // 重置按钮状态
    submitBtn.disabled = config.disabled;
    submitBtn.className = `btn btn--submit ${config.class}`;
    // 使用 innerHTML 来保持 HTML 结构
    submitBtn.innerHTML = `
      <span class="btn__icon">${config.icon}</span>
      <span class="btn__text">${config.text}</span>
    `;
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

function updateResultCard(result) {
  const sceneDescription = document.getElementById('sceneDescription');
  sceneDescription.innerHTML = `
    <div class="result-card__content">
      <!-- 助记拆解部分 -->
      <div class="result-card__part memory-section">
        <div class="result-card__part-title">
          <span class="result-card__part-icon">💡</span>
          <span>助记拆解</span>
        </div>
        <div class="result-card__part-content">
          ${formatParagraphs(result.关键词)}
        </div>
      </div>
      
      <!-- 场景描述部分 -->
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
}

// 格式化段落
function formatParagraphs(text) {
  return text.split('\n')
    .filter(line => line.trim())
    .map(line => `<p>${line}</p>`)
    .join('');
} 