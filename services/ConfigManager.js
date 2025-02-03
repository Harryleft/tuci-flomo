class ConfigManager {
  static async getAPIKey() {
    try {
      const result = await chrome.storage.sync.get('apiKey');
      return result.apiKey;
    } catch (error) {
      console.error('获取 API Key 失败:', error);
      throw error;
    }
  }

  static async setAPIKey(apiKey) {
    try {
      await chrome.storage.sync.set({ apiKey });
      return true;
    } catch (error) {
      console.error('保存 API Key 失败:', error);
      throw error;
    }
  }

  static async hasValidAPIKey() {
    const apiKey = await this.getAPIKey();
    return Boolean(apiKey);
  }

  static async testAPIConnection() {
    try {
      const apiKey = await this.getAPIKey();
      if (!apiKey) {
        throw new Error('请先设置 API Key');
      }

      const response = await fetch('https://api.siliconflow.cn/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'deepseek-ai/DeepSeek-V3',
          messages: [{
            role: 'user',
            content: 'Hello'
          }],
          max_tokens: 5
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'API 连接测试失败');
      }

      return true;
    } catch (error) {
      console.error('API 连接测试失败:', error);
      throw error;
    }
  }
}

export default ConfigManager; 