/**
 * 测试服务类
 * 处理所有API测试相关的功能
 */
import API_ENDPOINTS from '../config/endpoints.js';

class TestService {
  static GLM_URL = API_ENDPOINTS.GLM.CHAT;
  static GLM_IMAGE_URL = API_ENDPOINTS.GLM.IMAGE;
  static VOLCENGINE_URL = API_ENDPOINTS.VOLCENGINE.CHAT;

  /**
   * 测试GLM API连接
   */
  static async testGLMConnection(apiKey) {
    try {
      console.log('测试 GLM API 连接...');
      if (!apiKey) {
        throw new Error('请先设置 GLM API Key');
      }

      const response = await fetch(this.GLM_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: API_ENDPOINTS.GLM.model,
          messages: [{
            role: 'user',
            content: 'Hello'
          }],
          temperature: 0.7,
          max_tokens: 5
        })
      });

      const data = await response.json();
      console.log('GLM测试响应:', data);

      if (!response.ok || !data.choices) {
        throw new Error(data.error?.message || 'GLM API 连接测试失败');
      }

      return {
        success: true,
        message: '连接成功'
      };
    } catch (error) {
      console.error('GLM API 测试失败:', error);
      return {
        success: false,
        message: error.message || '连接失败，请检查 API Key'
      };
    }
  }

  /**
   * 测试图片生成功能
   * @param {Object} options 配置选项
   * @param {string} options.size 图片尺寸
   * @param {string} options.style 图片风格
   * @param {string} options.apiKey GLM API密钥
   * @param {Function} options.onProgress 进度回调函数
   */
  static async testImageGeneration(options) {
    const { size, style, apiKey, onProgress = () => {} } = options;

    try {
      console.log('测试图片生成...');
      if (!apiKey) {
        throw new Error('请先设置 GLM API Key');
      }

      // 获取提示词
      const prompt = this.getPromptByStyle(style);
      onProgress('正在生成图片...');

      const response = await fetch(this.GLM_IMAGE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: "cogview-4",
          prompt: prompt,
          size: size,
          user_id: "test_user_001"
        })
      });

      const data = await response.json();
      console.log('图片生成测试响应:', data);

      if (!response.ok) {
        throw new Error(data.error?.message || '图片生成测试失败');
      }

      // 转换响应格式以保持一致性
      return {
        status: response.status,
        imageUrl: data.data[0].url
      };
    } catch (error) {
      console.error('图片生成测试失败:', error);
      throw error;
    }
  }

  /**
   * 获取图片生成的提示词
   * @private
   */
  static getPromptByStyle(style) {
    const prompts = {
      realistic: "A cute cat in natural lighting with soft background, ultra realistic, 8k uhd, detailed texture, professional photography",
      cartoon: "A cute cartoon cat with bright colors and simple lines, Disney animation style, vibrant",
      anime: "A cute anime cat with big eyes, Japanese anime style, soft color palette, detailed illustration",
      oil: "A cute cat in oil painting style, thick brushstrokes, rich color layers, impressionist style painting",
      default: "A cute cat in natural lighting, ultra realistic, 8k uhd"
    };
    return prompts[style] || prompts.default;
  }

  /**
   * 测试火山云 API连接
   */
  static async testVolcengineConnection(apiKey) {
    try {
      console.log('测试火山云 API 连接...');
      if (!apiKey) {
        throw new Error('请先设置火山云 API Key');
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), API_ENDPOINTS.VOLCENGINE.timeout);

      const response = await fetch(this.VOLCENGINE_URL, {
        method: 'POST',
        headers: {
          'Authorization': API_ENDPOINTS.VOLCENGINE.auth(apiKey),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: API_ENDPOINTS.VOLCENGINE.model,
          messages: [{
            role: 'user',
            content: 'Hello'
          }],
          temperature: 0.7,
          max_tokens: 5,
          stream: false
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      const data = await response.json();
      console.log('火山云测试响应:', data);

      if (!response.ok) {
        throw new Error(data.error?.message || '火山云 API 连接测试失败');
      }

      // 检查响应格式
      if (!data.choices?.[0]?.message?.content) {
        throw new Error('火山云返回数据格式不正确');
      }

      return {
        success: true,
        message: '连接成功'
      };
    } catch (error) {
      console.error('火山云 API 测试失败:', error);
      return {
        success: false,
        message: error.message || '连接失败，请检查 API Key'
      };
    }
  }
}

export default TestService; 