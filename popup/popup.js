import APIClient from '../services/APIClient.js';
import ConfigManager from '../services/ConfigManager.js';

class PopupManager {
  constructor() {
    console.log('PopupManager 构造函数被调用');
    if (document.readyState === 'loading') {
      console.log('DOM 还在加载中，等待 DOMContentLoaded');
      document.addEventListener('DOMContentLoaded', () => this.initialize());
    } else {
      console.log('DOM 已加载完成，直接初始化');
      this.initialize();
    }
    this.currentDescription = null;  // 存储当前生成的描述
  }

  async initialize() {
    try {
      console.log('开始初始化');
      await this.initLayout();
      await this.init();
      console.log('初始化完成');
    } catch (error) {
      console.error('初始化失败:', error);
    }
  }

  async init() {
    try {
      // 初始化元素引用
      this.wordInput = this.getElement('wordInput');
      this.generateBtn = this.getElement('generateBtn');
      this.descriptionContent = this.getElement('sceneDescription');
      this.imageContent = this.getElement('aiImage');
      this.submitBtn = this.getElement('submitBtn');
      this.settingsBtn = this.getElement('settingsBtn');
      this.closeBtn = this.getElement('closeBtn');  // 添加关闭按钮引用

      // 加载设置
      await this.loadSettings();

      // 绑定事件
      if (this.generateBtn) {
        this.generateBtn.addEventListener('click', () => this.handleGenerate());
      }
      
      if (this.submitBtn) {
        this.submitBtn.addEventListener('click', () => this.handleSubmit());
        this.submitBtn.disabled = true;  // 初始禁用提交按钮
      }

      if (this.settingsBtn) {
        this.settingsBtn.addEventListener('click', () => {
          chrome.runtime.openOptionsPage();
        });
      }

      // 添加关闭按钮事件监听
      if (this.closeBtn) {
        this.closeBtn.addEventListener('click', () => {
          this.closePanel();
        });
      }

    } catch (error) {
      console.error('初始化组件失败:', error);
      this.showError('初始化失败，请刷新页面重试');
    }
  }

  // 辅助方法：获取 DOM 元素
  getElement(id) {
    const element = document.getElementById(id);
    if (!element) {
      console.warn(`未找到元素: ${id}`);
    }
    return element;
  }

  initLayout() {
    try {
      console.log('初始化布局');
      
      // 添加滑入动画
      const sidePanel = document.querySelector('.side-panel');
      if (sidePanel) {
        // 确保元素已渲染
        requestAnimationFrame(() => {
          // 触发重排以确保动画生效
          sidePanel.offsetHeight;
          // 添加可见类名触发动画
          sidePanel.classList.add('is-visible');
        });
      }

    } catch (error) {
      console.error('布局初始化失败:', error);
    }
  }

  async loadSettings() {
    try {
      // 检查 API Key
      if (!await ConfigManager.hasValidAPIKey()) {
        this.showError('请先在设置页面配置 API Key');
        this.generateBtn.disabled = true;
        return;
      }

      // 加载场景设置
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

  async handleGenerate() {
    const word = this.wordInput.value.trim();
    if (!word) {
      console.warn('未输入单词');
      this.showError('请输入要记忆的单词');
      return;
    }

    try {
      console.log('开始生成内容:', { word, scene: this.currentScene });
      // 显示加载状态
      this.setGenerating(true);
      this.descriptionContent.innerHTML = '<div class="loading">生成中...</div>';

      // 生成场景描述
      console.log('调用 API 生成描述...');
      const result = await APIClient.generateDescription(word, this.currentScene);
      console.log('描述生成成功:', result);

      // 格式化显示内容
      const formattedContent = `
        <div class="word-section">
          <h3>📝 ${result.英语}</h3>
        </div>
        <div class="memory-section">
          <p><strong>💡 助记拆解：</strong></p>
          <p>${result.关键词}</p>
        </div>
        <div class="scene-section">
          <p><strong>🌟 场景描述：</strong></p>
          <p>${result.图像描述}</p>
        </div>
      `;
      
      this.descriptionContent.innerHTML = formattedContent;

      // 保存当前描述用于提交
      this.currentDescription = result;

      // 启用提交按钮
      this.submitBtn.disabled = false;
    } catch (error) {
      console.error('生成失败:', {
        error: error.message,
        stack: error.stack,
        word: this.wordInput.value,
        scene: this.currentScene
      });
      this.showError(error.message || '生成失败，请重试');
      this.submitBtn.disabled = true;  // 生成失败时禁用提交按钮
    } finally {
      this.setGenerating(false);
    }
  }

  async handleSubmit() {
    if (!this.currentDescription) {
      console.warn('没有可提交的内容');
      this.showError('请先生成内容');
      return;
    }

    try {
      // 显示提交状态
      this.submitBtn.disabled = true;
      this.submitBtn.innerHTML = `
        <span class="submit-icon">📝</span>
        <span>提交中...</span>
      `;

      // 提交到 Flomo
      await APIClient.submitToFlomo(this.currentDescription);

      // 显示成功状态
      const submitStatus = document.getElementById('submitStatus');
      submitStatus.innerHTML = `
        <span class="success-icon">✅</span>
        <span>已成功保存到 Flomo</span>
      `;
      submitStatus.className = 'submit-status success show';

      // 重置界面
      setTimeout(() => {
        this.wordInput.value = '';
        this.descriptionContent.innerHTML = '<div class="placeholder">输入单词并点击生成按钮，AI将为你创建生动的场景描述...</div>';
        this.currentDescription = null;
        this.submitBtn.disabled = true;
        this.submitBtn.innerHTML = `
          <span class="submit-icon">📝</span>
          <span>提交到 Flomo</span>
        `;
        // 淡出成功提示
        submitStatus.className = 'submit-status';
      }, 2000);
    } catch (error) {
      console.error('提交失败:', error);
      const submitStatus = document.getElementById('submitStatus');
      submitStatus.innerHTML = `
        <span class="error-icon">⚠️</span>
        <span>${error.message || '提交失败，请重试'}</span>
      `;
      submitStatus.className = 'submit-status error show';
      
      // 恢复提交按钮
      this.submitBtn.disabled = false;
      this.submitBtn.innerHTML = `
        <span class="submit-icon">📝</span>
        <span>提交到 Flomo</span>
      `;
    }
  }

  formatDescription(text) {
    // 将换行转换为 HTML 段落
    return text.split('\n')
      .filter(line => line.trim())
      .map(line => `<p>${line}</p>`)
      .join('');
  }

  setGenerating(isGenerating) {
    this.generateBtn.disabled = isGenerating;
    this.generateBtn.innerHTML = isGenerating ? 
      '<span>生成中...</span>' : 
      '<span>✨ 生成</span>';
  }

  showError(message) {
    console.warn('显示错误:', message);
    if (this.descriptionContent) {
      this.descriptionContent.innerHTML = `
        <div class="error-message">
          <span class="error-icon">⚠️</span>
          <span>${message}</span>
        </div>
      `;
    }
  }

  showSuccess(message) {
    this.descriptionContent.innerHTML = `
      <div class="success-message">
        <span class="success-icon">✅</span>
        <span>${message}</span>
      </div>
    `;
  }

  closePanel() {
    window.close();  // 直接关闭窗口
  }
}

// 导出 PopupManager 类
export default PopupManager;

// 初始化
new PopupManager(); 