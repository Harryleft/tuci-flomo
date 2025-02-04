import APIClient from '../services/APIClient.js';
import ConfigManager from '../services/ConfigManager.js';

class PopupManager {
  constructor() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.initialize());
    } else {
      this.initialize();
    }
  }

  async initialize() {
    try {
      // 检查是否在 Side Panel 环境中
      this.isSidePanel = chrome.runtime?.getManifest()?.side_panel !== undefined;
      
      // 如果不在 Side Panel 中，则打开 Side Panel
      if (!this.isSidePanel) {
        await this.openSidePanel();
        return;
      }
      
      await this.initElements();
      await this.loadSettings();
    } catch (error) {
      console.error('初始化失败:', error);
    }
  }

  async initElements() {
    try {
      // 初始化元素引用
      this.wordInput = document.getElementById('wordInput');
      this.generateBtn = document.getElementById('generateBtn');
      this.descriptionContent = document.getElementById('sceneDescription');
      this.submitBtn = document.getElementById('submitBtn');
      this.settingsBtn = document.getElementById('settingsBtn');
      this.closeBtn = document.getElementById('closeBtn');

      // 绑定事件监听器
      this.bindEventListeners();
    } catch (error) {
      console.error('初始化元素失败:', error);
      throw error;
    }
  }

  bindEventListeners() {
    // 生成按钮事件
    if (this.generateBtn) {
      this.generateBtn.addEventListener('click', () => this.handleGenerate());
    }

    // 提交按钮事件
    if (this.submitBtn) {
      this.submitBtn.addEventListener('click', () => this.handleSubmit());
      this.submitBtn.disabled = true;  // 初始禁用提交按钮
    }

    // 设置按钮事件
    if (this.settingsBtn) {
      this.settingsBtn.addEventListener('click', () => {
        chrome.runtime.openOptionsPage();
      });
    }

    // 关闭按钮事件
    if (this.closeBtn) {
      this.closeBtn.addEventListener('click', () => this.closePanel());
    } else {
      console.error('关闭按钮未找到');
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
        <span class="btn__icon">📝</span>
        <span class="btn__text">提交中...</span>
      `;

      // 提交到 Flomo
      await APIClient.submitToFlomo(this.currentDescription);

      // 显示成功提示
      this.showSuccessStatus();

      // 重置界面
      setTimeout(() => {
        this.wordInput.value = '';
        this.descriptionContent.innerHTML = '<div class="placeholder">输入单词并点击生成按钮，AI将为你创建生动的场景描述...</div>';
        this.currentDescription = null;
        this.submitBtn.disabled = true;
        this.submitBtn.innerHTML = `
          <span class="btn__icon">📝</span>
          <span class="btn__text">提交到 Flomo</span>
        `;
      }, 1000);

    } catch (error) {
      console.error('提交失败:', error);
      
      // 恢复提交按钮状态
      this.submitBtn.disabled = false;
      this.submitBtn.innerHTML = `
        <span class="btn__icon">📝</span>
        <span class="btn__text">提交到 Flomo</span>
      `;
      
      // 显示错误提示
      this.showError(error.message || '提交失败，请重试');
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

  showSuccessStatus() {
    // 移除已存在的提示
    const existingStatus = document.getElementById('submitStatus');
    if (existingStatus) {
      existingStatus.remove();
    }
    
    // 创建新的提示元素
    const statusEl = document.createElement('div');
    statusEl.id = 'submitStatus';
    statusEl.className = 'submit-status';
    statusEl.innerHTML = `
      <span class="submit-status__icon">✓</span>
      <span class="submit-status__text">已保存</span>
    `;
    
    // 添加到 body 末尾
    document.body.appendChild(statusEl);
    
    // 强制重绘
    void statusEl.offsetWidth;
    
    // 显示提示
    statusEl.classList.add('submit-status--success');
    
    // 1秒后开始消失动画
    setTimeout(() => {
      statusEl.classList.add('submit-status--hide');
      
      // 动画结束后移除元素
      statusEl.addEventListener('animationend', () => {
        statusEl.remove();
      }, { once: true });
    }, 1000);
  }

  // 添加阻止自动关闭的方法
  preventAutoClose() {
    // 移除原有的 blur 事件监听，因为它可能会干扰正常的交互
    
    // 1. 阻止点击事件冒泡
    document.addEventListener('click', (e) => {
      e.stopPropagation();
    }, true);
    
    // 2. 阻止鼠标离开事件
    document.addEventListener('mouseleave', (e) => {
      e.stopPropagation();
      e.preventDefault();
    }, true);
    
    // 3. 阻止失焦事件
    document.addEventListener('blur', (e) => {
      e.stopPropagation();
      e.preventDefault();
    }, true);
    
    // 4. 阻止 visibilitychange 事件
    document.addEventListener('visibilitychange', (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (document.visibilityState === 'hidden') {
        document.visibilityState = 'visible';
      }
    }, true);
    
    // 5. 保持焦点在窗口内
    setInterval(() => {
      if (!document.hasFocus()) {
        window.focus();
      }
    }, 100);
    
    // 6. 阻止 ESC 键关闭
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        e.preventDefault();
      }
    }, true);
  }

  // 修改关闭面板方法
  closePanel() {
    if (this.isSidePanel) {
      chrome.sidePanel.close();
    } else {
      window.close();
    }
  }

  async openSidePanel() {
    try {
      // 打开 Side Panel
      await chrome.sidePanel.open();
      // 关闭当前 popup
      window.close();
    } catch (error) {
      console.error('打开 Side Panel 失败:', error);
    }
  }
}

// 初始化
new PopupManager(); 