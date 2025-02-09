import ConfigManager from './ConfigManager.js';

class APIClient {
  static BASE_URL = 'https://api.siliconflow.cn/v1/chat/completions';

  static async generateDescription(word, scene = 'default') {
    try {
      console.log('开始生成描述:', { word, scene });

      // 验证 API Key
      const apiKey = await ConfigManager.getAPIKey();
      if (!apiKey) {
        throw new Error('请先设置 API Key');
      }

      // 构建提示词
      const prompt = this._buildPrompt(word, scene);
      console.log('构建的提示词:', prompt);

      // 构建请求选项
      const options = {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'deepseek-ai/DeepSeek-V3',
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.7,
          max_tokens: 1000
        })
      };

      // 发送请求
      console.log('发送 API 请求...');
      const response = await fetch('https://api.siliconflow.cn/v1/chat/completions', options);
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('API 响应错误:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData
        });
        throw new Error('生成描述失败，请稍后重试');
      }

      const data = await response.json();
      console.log('API 响应数据:', data);

      if (!data.choices || !data.choices[0]?.message?.content) {
        throw new Error('API 返回数据格式错误');
      }

      // 处理响应
      const content = data.choices[0].message.content;
      console.log('生成的原始内容:', content);

      try {
        // 尝试解析 JSON
        const result = JSON.parse(content);
        console.log('解析后的结果:', result);
        return result;
      } catch (parseError) {
        console.error('JSON 解析失败:', parseError);
        throw new Error('生成的内容格式不正确');
      }

    } catch (error) {
      console.error('生成描述失败:', error);
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
    // 首先获取场景设置
    const sceneSettings = {
      default: {
        background: "现代日常生活",
        description: "在日常生活场景中描述该单词的含义和用法"
      },
      harrypotter: {
        background: "哈利波特魔法世界",
        description: "在霍格沃茨魔法学校或魔法世界中展现该单词的含义"
      },
      zhenhuanchuan: {
        background: "甄嬛传宫廷",
        description: "在清朝宫廷中展现该单词的含义"
      },
      custom: (customScene) => ({
        background: customScene,
        description: `在${customScene}中展现该单词的含义`
      })
    };

    // 获取场景设置并验证
    let setting;
    if (typeof sceneSettings[scene] === 'function') {
      setting = sceneSettings[scene](word);
    } else {
      setting = sceneSettings[scene] || sceneSettings.default;
    }

    // 验证世界观是否符合预期
    if (!setting || !setting.background || !setting.description) {
      console.error('场景设置无效:', scene, setting);
      setting = sceneSettings.default;
    }

    // 基础提示词模板
    const basePrompt = `
        # Role
        Create memory aids based on user input English words.
        --------------
        # Object
        Requirements: Provide keywords and visual memory aids, but do not directly state the Chinese meaning. Instead, incorporate the meaning into the memory aids.
        --------------
        # Rules
        Conditions:
        1) The broken-down keywords must be simple and meaningful
        2) Image descriptions must be reasonable, logical, engaging and have contrast
        3) The word's [Chinese meaning] must be marked in bold or enclosed in parentheses ( such as **justice** )
        4) Must strictly follow the JSON format below, with no other content
        5) Do not output any other content, do not output any other content, do not output any other content
        6) Use emojis appropriately to add fun
        7) For words with multiple meanings (e.g. noun vs verb), describe comprehensively based on context
        8) Must strictly follow the given scene's worldview, no creating or modifying scene settings
        --------------
        #Example    

        {
            "英语": "justice",
            "关键词": "just（只）+ice（冰）",
            "世界观": "${setting.background}",
            "图像描述": "一个小孩跟妈妈抱怨被别的孩子打了。作为安慰，他只得到了一个冰激凌，但也算是**公平**地解决了"
        }
        --------------
        # Format        
        {
            "英语": "${word}",
            "关键词": "拆解的关键词",
            "世界观": "${setting.background}",
            "图像描述": "${setting.description}"
        }`;

    return basePrompt
      .replace(/\${setting\.background}/g, setting.background)
      .replace(/\${setting\.description}/g, setting.description)
      .replace(/\${word}/g, word);
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