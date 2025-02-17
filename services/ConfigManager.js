import TestService from './TestService.js';
import API_ENDPOINTS from '../config/endpoints.js';

class ConfigManager {
  // 定义 API 服务配置
  static API_SERVICES = {
    glm: {
      url: API_ENDPOINTS.GLM.CHAT,
      model: API_ENDPOINTS.GLM.model,
      keyName: 'glmKey'
    },
    volcengine: {
      url: API_ENDPOINTS.VOLCENGINE.CHAT,
      model: API_ENDPOINTS.VOLCENGINE.model,
      keyName: 'volcengineKey'
    }
  };

  static async getAPIKey() {
    try {
      const result = await chrome.storage.sync.get('apiKey');
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

  static async testAPIConnection(service = 'glm') {
    try {
      console.log('测试 API 连接...', service);
      
      // 获取服务配置
      const serviceConfig = this.API_SERVICES[service];
      if (!serviceConfig) {
        throw new Error('未知的 API 服务');
      }

      // 获取对应的 API Key
      const apiKey = await this.get(serviceConfig.keyName);
      if (!apiKey) {
        console.warn(`未配置 ${service} API Key`);
        throw new Error(`请先设置 ${service} API Key`);
      }

      console.log('发送测试请求...');
      const response = await fetch(serviceConfig.url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: serviceConfig.model,
          messages: [{
            role: 'user',
            content: 'Hello'
          }],
          temperature: 0.7,
          max_tokens: 5
        })
      });

      console.log('测试响应状态:', response.status);
      const data = await response.json();
      console.log('测试响应数据:', data);

      if (!response.ok || !data.choices) {
        console.error('API 测试失败:', {
          status: response.status,
          statusText: response.statusText,
          error: data.error
        });
        throw new Error(data.error?.message || `${service} API 连接测试失败`);
      }

      console.log('API 测试成功');
      return {
        success: true,
        message: '连接成功'
      };
    } catch (error) {
      console.error('API 连接测试失败:', {
        error: error.message,
        stack: error.stack
      });
      return {
        success: false,
        message: error.message || '连接失败，请检查 API Key'
      };
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

  static async testGLMConnection() {
    return this.testAPIConnection('glm');
  }

  static async testVolcengineConnection() {
    try {
      // 直接从 storage 获取 API Key
      const result = await chrome.storage.sync.get('volcengineKey');
      const apiKey = result.volcengineKey;
      
      if (!apiKey) {
        throw new Error('请先设置火山云 API Key');
      }
      
      return TestService.testVolcengineConnection(apiKey);
    } catch (error) {
      console.error('火山云连接测试失败:', error);
      return {
        success: false,
        message: error.message || '连接失败，请检查 API Key'
      };
    }
  }

  static async getImageGenEnabled() {
    try {
      const result = await chrome.storage.sync.get({
        enableImageGen: false
      });
      return result.enableImageGen;
    } catch (error) {
      console.error('获取图片生成设置失败:', error);
      return false;
    }
  }

  static async getVolcengineAPIKey() {
    try {
      const result = await chrome.storage.sync.get('volcengineKey');
      return result.volcengineKey;
    } catch (error) {
      console.error('获取火山云 API Key失败:', error);
      throw error;
    }
  }

  static async setVolcengineAPIKey(apiKey) {
    try {
      await chrome.storage.sync.set({ volcengineKey: apiKey });
      return true;
    } catch (error) {
      console.error('保存火山云 API Key 失败:', error);
      throw error;
    }
  }

  static async get(key) {
    try {
      const result = await chrome.storage.sync.get(key);
      return result[key];
    } catch (error) {
      console.error(`获取${key}失败:`, error);
      return null;
    }
  }

  static async set(key, value) {
    try {
      await chrome.storage.sync.set({ [key]: value });
      return true;
    } catch (error) {
      console.error(`设置${key}失败:`, error);
      return false;
    }
  }
}

export default ConfigManager; 