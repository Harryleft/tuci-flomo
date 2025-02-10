class ConfigManager {
  static async getAPIKey() {
    try {
      console.log('获取 API Key...');
      const result = await chrome.storage.sync.get('apiKey');
      console.log('API Key 状态:', result.apiKey ? '已配置' : '未配置');
      return result.apiKey;
    } catch (error) {
      console.error('获取 API Key 失败:', {
        error: error.message,
        stack: error.stack
      });
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
      console.log('测试 API 连接...');
      const apiKey = await this.getAPIKey();
      if (!apiKey) {
        console.warn('未配置 API Key');
        throw new Error('请先设置 API Key');
      }

      console.log('发送测试请求...');
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

      console.log('测试响应状态:', response.status);
      const data = await response.json();
      console.log('测试响应数据:', data);

      if (!response.ok) {
        console.error('API 测试失败:', {
          status: response.status,
          statusText: response.statusText,
          error: data.error
        });
        throw new Error(data.error?.message || 'API 连接测试失败');
      }

      console.log('API 测试成功');
      return true;
    } catch (error) {
      console.error('API 连接测试失败:', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  static async getWebhookUrl() {
    try {
      console.log('获取 Webhook URL...');
      const result = await chrome.storage.sync.get('webhookUrl');
      console.log('Webhook URL 状态:', result.webhookUrl ? '已配置' : '未配置');
      return result.webhookUrl;
    } catch (error) {
      console.error('获取 Webhook URL 失败:', error);
      throw error;
    }
  }

  static async getDefaultTag() {
    try {
      const result = await chrome.storage.sync.get({
        defaultTag: '#英语单词'
      });
      return result.defaultTag;
    } catch (error) {
      console.error('获取默认标签失败:', error);
      return '#英语单词';  // 返回默认值
    }
  }

  static async getGLMAPIKey() {
    try {
      const result = await chrome.storage.sync.get('glmKey');
      return result.glmKey;
    } catch (error) {
      console.error('获取GLM API Key失败:', error);
      throw error;
    }
  }

  // 测试DeepSeek API连接
  static async testDeepSeekConnection() {
    try {
      console.log('测试 DeepSeek API 连接...');
      const apiKey = await this.getAPIKey();
      if (!apiKey) {
        console.warn('未配置 DeepSeek API Key');
        throw new Error('请先设置 API Key');
      }

      console.log('发送测试请求...');
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

      console.log('测试响应状态:', response.status);
      const data = await response.json();
      console.log('测试响应数据:', data);

      if (!response.ok) {
        console.error('API 测试失败:', {
          status: response.status,
          statusText: response.statusText,
          error: data.error
        });
        throw new Error(data.error?.message || 'API 连接测试失败');
      }

      console.log('API 测试成功');
      return true;
    } catch (error) {
      console.error('API 连接测试失败:', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  // 测试GLM API连接
  static async testGLMConnection() {
    try {
      console.log('测试 GLM API 连接...');
      const apiKey = await this.getGLMAPIKey();
      if (!apiKey) {
        console.warn('未配置 GLM API Key');
        throw new Error('请先设置 GLM API Key');
      }

      console.log('发送测试请求...');
      const response = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'glm-4-flash',
          messages: [{
            role: 'user',
            content: 'Hello'
          }],
          max_tokens: 5
        })
      });

      console.log('测试响应状态:', response.status);
      const data = await response.json();
      console.log('测试响应数据:', data);

      if (!response.ok) {
        console.error('GLM API 测试失败:', {
          status: response.status,
          statusText: response.statusText,
          error: data.error
        });
        throw new Error(data.error?.message || 'GLM API 连接测试失败');
      }

      console.log('GLM API 测试成功');
      return true;
    } catch (error) {
      console.error('GLM API 连接测试失败:', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }
}

export default ConfigManager; 