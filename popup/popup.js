import APIClient from '../services/APIClient.js';
import ConfigManager from '../services/ConfigManager.js';

class PopupManager {
  constructor() {
    this.init();
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
      this.imageContent.innerHTML = '<div class="loading">准备生成配图...</div>';

      // 生成场景描述
      console.log('调用 API 生成描述...');
      const description = await APIClient.generateDescription(word, this.currentScene);
      console.log('描述生成成功:', description);
      this.descriptionContent.innerHTML = this.formatDescription(description);

      // 生成配图
      // TODO: 实现图片生成
      this.imageContent.innerHTML = '<div class="placeholder">图片生成功能开发中...</div>';

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
    } finally {
      this.setGenerating(false);
    }
  }

  async handleSubmit() {
    try {
      // TODO: 实现提交到 Flomo
      console.log('提交到 Flomo');
    } catch (error) {
      console.error('提交失败:', error);
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
    // 在描述区域显示错误信息
    this.descriptionContent.innerHTML = `
      <div class="error-message">
        <span class="error-icon">⚠️</span>
        <span>${message}</span>
      </div>
    `;
  }
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  new PopupManager();
}); 