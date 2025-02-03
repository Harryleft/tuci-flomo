import ConfigManager from './ConfigManager.js';

class APIClient {
  static BASE_URL = 'https://api.siliconflow.cn/v1/chat/completions';

  static async generateDescription(word, scene = 'default') {
    try {
      console.log('开始生成描述:', { word, scene });
      
      // 获取 API Key
      const apiKey = await ConfigManager.getAPIKey();
      if (!apiKey) {
        console.warn('未配置 API Key');
        throw new Error('请先设置 API Key');
      }
      console.log('API Key 验证通过');

      // 构建提示词
      const prompt = this._buildPrompt(word, scene);
      console.log('生成提示词:', prompt);
      
      // 构建请求选项
      const options = {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'deepseek-ai/DeepSeek-V3',
          messages: [{
            role: 'user',
            content: prompt
          }],
          stream: false,
          max_tokens: 512,
          temperature: 0.7,
          top_p: 0.7,
          top_k: 50,
          frequency_penalty: 0.5,
          n: 1
        })
      };
      console.log('API 请求配置:', {
        url: this.BASE_URL,
        method: options.method,
        headers: { ...options.headers, Authorization: '(hidden)' },
        body: JSON.parse(options.body)
      });

      // 发送请求
      const response = await fetch(this.BASE_URL, options);
      console.log('API 响应状态:', response.status);
      const data = await response.json();
      console.log('API 响应数据:', data);

      if (!response.ok) {
        console.error('API 请求失败:', {
          status: response.status,
          statusText: response.statusText,
          error: data.error
        });
        throw new Error(data.error?.message || '生成描述失败');
      }

      console.log('生成描述成功:', data.choices[0].message.content);
      // 处理并返回格式化的响应
      return this._processResponse(data.choices[0].message.content);
    } catch (error) {
      console.error('生成描述时出错:', {
        error: error.message,
        stack: error.stack,
        word,
        scene
      });
      throw error;
    }
  }

  static async generateImage(description) {
    // TODO: 实现调用智谱 GLM API 生成图片
  }

  static async submitToFlomo(data) {
    try {
      console.log('开始提交到 Flomo:', data);
      
      // 获取 Webhook URL
      const webhookUrl = await ConfigManager.getWebhookUrl();
      if (!webhookUrl) {
        console.warn('未配置 Flomo Webhook URL');
        throw new Error('请先设置 Flomo API');
      }
      console.log('Webhook URL 验证通过');

      // 获取默认标签
      const defaultTag = await ConfigManager.getDefaultTag() || '#英语单词';

      // 构建提交内容，使用 Markdown 格式美化
      const content = `📝 ${data.英语}

---
💡 助记拆解：
${data.关键词}

🌟 场景描述：
${data.图像描述}


${defaultTag} #场景记忆`;

      // 构建请求选项
      const options = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          content: content
        })
      };

      console.log('Flomo 提交配置:', {
        url: webhookUrl,
        method: options.method,
        headers: options.headers,
        content: content
      });

      // 发送请求
      const response = await fetch(webhookUrl, options);
      console.log('Flomo 响应状态:', response.status);
      
      if (!response.ok) {
        const error = await response.text();
        console.error('提交到 Flomo 失败:', {
          status: response.status,
          statusText: response.statusText,
          error
        });
        throw new Error('提交到 Flomo 失败，请检查 API 配置');
      }

      console.log('提交到 Flomo 成功');
      return true;
    } catch (error) {
      console.error('提交到 Flomo 时出错:', {
        error: error.message,
        stack: error.stack,
        data
      });
      throw error;
    }
  }

  // 根据场景构建提示词
  static _buildPrompt(word, scene) {
    // 基础提示词模板
    const basePrompt = `
        # Role
        根据用户输入的英文单词，开展辅助记忆。

        # Object
        要求：配上关键词与图像助记法，但不要直接告知我该单词的中文含义，要把它的含义融入助记法之中。

        # Rules
        条件：
        1）被拆解的关键词要足够简单且基础
        2）图像需要富有戏剧性、夸张、具体且生动
        3）其中文含义必须被额外标记出来，比如加粗或是用括号框住
        4）必须严格按照下面的 JSON 格式输出，不要有任何其他内容

        {
            "英语": "${word}",
            "关键词": "拆解的关键词",
            "世界观": "SCENE_BACKGROUND",
            "图像描述": "SCENE_DESCRIPTION"
        }`;

    // 不同场景的特定设置
    const sceneSettings = {
      default: {
        background: "现代日常生活",
        description: "在日常生活场景中自然使用该单词，融入中文含义"
      },
      harrypotter: {
        background: "霍格沃茨魔法世界",
        description: "在魔法世界中使用该单词，并巧妙标注中文含义"
      },
      zhenhuanchuan: {
        background: "甄嬛传",
        description: "在宫廷场景中使用该单词，融入宫廷元素和用语，并巧妙标注中文含义"
      },
      custom: (customScene) => ({
        background: customScene,
        description: `在${customScene}场景中使用该单词，融入相关元素，并巧妙标注中文含义`
      })
    };

    // 获取场景设置
    const setting = typeof sceneSettings[scene] === 'function' 
      ? sceneSettings[scene](word)
      : sceneSettings[scene] || sceneSettings.default;

    // 替换模板中的占位符
    return basePrompt
      .replace('SCENE_BACKGROUND', setting.background)
      .replace('SCENE_DESCRIPTION', setting.description);
  }

  // 处理 API 响应
  static _processResponse(content) {
    try {
      // 解析 JSON 响应
      const data = typeof content === 'object' ? content : JSON.parse(content);
      return {
        英语: data.英语,
        关键词: data.关键词,
        世界观: data.世界观,
        图像描述: data.图像描述
      };
    } catch (error) {
      console.error('响应格式化失败:', error);
      return {
        英语: '',
        关键词: '',
        世界观: '',
        图像描述: content
      };
    }
  }
}

export default APIClient; 