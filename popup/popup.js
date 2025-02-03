import APIClient from '../services/APIClient.js';
import ConfigManager from '../services/ConfigManager.js';

class PopupManager {
  constructor() {
    this.init();
    this.currentDescription = null;  // 存储当前生成的描述
  }

  async init() {
    // 初始化元素引用
    this.wordInput = document.getElementById('wordInput');
    this.generateBtn = document.getElementById('generateBtn');
    this.descriptionContent = document.getElementById('sceneDescription');
    this.imageContent = document.getElementById('aiImage');
    this.submitBtn = document.getElementById('submitBtn');

    // 加载设置
    await this.loadSettings();

    // 绑定事件
    this.generateBtn.addEventListener('click', () => this.handleGenerate());
    this.submitBtn.addEventListener('click', () => this.handleSubmit());

    // 添加设置按钮点击事件处理
    document.getElementById('settingsBtn').addEventListener('click', () => {
      // 打开选项页面
      chrome.runtime.openOptionsPage();
    });

    // 添加关闭按钮点击事件处理
    document.getElementById('closeBtn').addEventListener('click', () => {
      window.close();
    });

    // 绑定提交按钮事件
    this.submitBtn.disabled = true;  // 初始禁用提交按钮
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

      // 显示成功提示
      this.showSuccess('已保存到 Flomo');

      // 重置界面
      setTimeout(() => {
        this.wordInput.value = '';
        this.descriptionContent.innerHTML = '<div class="placeholder">输入单词并点击生成按钮，AI将为你创建生动的场景描述...</div>';
        this.imageContent.innerHTML = '<div class="placeholder">场景描述生成后，AI将自动创建配图...</div>';
        this.currentDescription = null;
        this.submitBtn.disabled = true;
        this.submitBtn.innerHTML = `
          <span class="submit-icon">📝</span>
          <span>保存到 Flomo</span>
        `;
      }, 2000);
    } catch (error) {
      console.error('提交失败:', error);
      this.showError(error.message || '提交失败，请重试');
      // 恢复提交按钮
      this.submitBtn.disabled = false;
      this.submitBtn.innerHTML = `
        <span class="submit-icon">📝</span>
        <span>保存到 Flomo</span>
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
    // 在描述区域显示错误信息
    this.descriptionContent.innerHTML = `
      <div class="error-message">
        <span class="error-icon">⚠️</span>
        <span>${message}</span>
      </div>
    `;
  }

  showSuccess(message) {
    this.descriptionContent.innerHTML = `
      <div class="success-message">
        <span class="success-icon">✅</span>
        <span>${message}</span>
      </div>
    `;
  }
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  new PopupManager();
}); 