/**
 * 图片服务类
 * 处理所有与图片生成相关的功能
 */
class ImageService {
  // API 端点
  static IMAGE_API_URL = 'https://open.bigmodel.cn/api/paas/v4/images/generations';
  
  /**
   * 从配置中获取 API Key
   * @private
   */
  static async getApiKey() {
    try {
      const result = await chrome.storage.sync.get('glmKey');
      return result.glmKey;
    } catch (error) {
      console.error('获取 API Key 失败:', error);
      throw new Error('无法获取 API Key');
    }
  }

  /**
   * 获取图片生成的提示词
   * @param {string} style 图片风格
   * @returns {string} 对应风格的提示词
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
   * 测试图片生成功能
   * @param {Object} options 配置选项
   * @param {string} options.size 图片尺寸
   * @param {string} options.style 图片风格
   * @param {string} options.apiKey GLM API密钥
   * @param {Function} options.onProgress 进度回调函数
   * @returns {Promise<{status: number, imageUrl: string}>}
   */
  static async testGeneration(options) {
    const { size, style, apiKey, onProgress = () => {} } = options;

    try {
      onProgress('准备发送请求...');

      const prompt = this.getPromptByStyle(style);
      const requestData = this.buildRequestData(prompt, size, style);

      console.log('发送图片生成请求:', {
        prompt,
        size,
        style
      });

      onProgress('正在生成图片...');
      const response = await this.sendRequest(requestData, apiKey);

      onProgress('正在处理响应...');
      const data = await this.processResponse(response);

      return {
        status: response.status,
        imageUrl: data.choices[0].image.url
      };

    } catch (error) {
      console.error('图片生成请求失败:', error);
      throw {
        status: error.status,
        message: error.message || '请求失败',
        response: error.response
      };
    }
  }

  /**
   * 构建请求数据
   * @private
   */
  static buildRequestData(prompt, size, style) {
    return {
      model: "cogview-4",  // 使用 cogview-4 模型
      prompt: prompt,      // 图像描述文本
      size: size,         // 图片尺寸
      user_id: "test_user_001" // 添加用户ID
    };
  }

  /**
   * 发送API请求
   * @private
   */
  static async sendRequest(requestData, apiKey) {
    console.log('发送请求数据:', JSON.stringify(requestData, null, 2));

    const response = await fetch(this.IMAGE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey.trim()}`
      },
      body: JSON.stringify(requestData)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('图片生成API响应错误:', {
        status: response.status,
        error: errorData,
        requestData: requestData
      });
      throw {
        status: response.status,
        message: errorData.error?.message || `请求失败: ${response.status}`,
        response: errorData
      };
    }

    return response;
  }

  /**
   * 处理API响应
   * @private
   */
  static async processResponse(response) {
    const data = await response.json();
    console.log('图片生成API响应:', data);
    
    // 根据新的响应格式修改
    if (!data.data?.[0]?.url) {
      throw new Error('API返回数据格式错误');
    }

    return {
      choices: [{
        image: {
          url: data.data[0].url
        }
      }]
    };
  }

  /**
   * 快速测试图片生成功能
   */
  static async quickTest(options = {}) {
    const defaultOptions = {
      size: '1024x1024',
      style: 'realistic',
      onProgress: () => {}
    };

    try {
      const apiKey = await this.getApiKey();
      if (!apiKey) {
        throw new Error('请先配置 GLM API Key');
      }

      const testOptions = {
        ...defaultOptions,
        ...options,
        apiKey
      };

      console.log('使用配置的 API Key 进行测试');
      return this.testGeneration(testOptions);
    } catch (error) {
      console.error('快速测试失败:', error);
      throw error;
    }
  }
}

export default ImageService; 