import ConfigManager from './ConfigManager.js';
import API_ENDPOINTS from '../config/endpoints.js';

class APIClient {
  static GLM_URL = API_ENDPOINTS.GLM.CHAT;
  static GLM_IMAGE_URL = API_ENDPOINTS.GLM.IMAGE;
  static VOLCENGINE_URL = API_ENDPOINTS.VOLCENGINE.CHAT;

  // 统一的场景设置
  static sceneSettings = {
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
      description: "在甄嬛传场景中展现该单词的含义"
    },
    custom: (customScene) => ({
      background: customScene,
      description: `在${customScene}中展现该单词的中文含义`
    })
  };

  // 统一的提示词模板
  static _buildPromptTemplate(word, setting) {
    return `
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
    5) Do not output any example or instruction, just output the JSON result
    6) Use emojis appropriately to add fun
    7) For words with multiple meanings (e.g. noun vs verb), describe comprehensively based on context
    8) Must strictly follow the given scene's worldview, no creating or modifying scene settings
    --------------
    # Scene
    1. Background: ${setting.background}
    2. Description: ${setting.description}
    --------------
    # Word to process
    ${word}
    --------------
    # Format        
    {
        "英语": "${word}",
        "关键词": "创造性的词根词缀拆解或记忆技巧",
        "世界观": "${setting.background}",
        "图像描述": "生动有趣的场景描述，需要包含单词的中文含义，但不要直接给出"
    }
    --------------
    # Example    
    {
        "英语": "justice",
        "关键词": "just（只）+ice（冰）",
        "世界观": "日常生活场景",
        "图像描述": "一个小孩跟妈妈抱怨被别的孩子打了。作为安慰，他只得到了一个冰激凌，但也算是**公平**地解决了"
    }`;
  }

  // 统一的提示词构建方法
  static _buildPrompt(word, scene) {
    // 获取场景设置
    let setting = this.sceneSettings[scene] || this.sceneSettings.default;
    if (typeof this.sceneSettings[scene] === 'function') {
      setting = this.sceneSettings[scene](word);
    }

    // 验证世界观是否符合预期
    if (!setting || !setting.background || !setting.description) {
      console.error('场景设置无效:', scene, setting);
      setting = this.sceneSettings.default;
    }

    // 使用统一的提示词模板
    return this._buildPromptTemplate(word, setting);
  }

  static async generateDescription(word, scene = 'default') {
    try {      
      // 使用火山云服务生成描述
      return await this.generateDescriptionWithVolcengine(word, scene);

    } catch (error) {
      console.error('生成描述失败:', error);
      throw error;
    }
  }

  static async generateImage(description) {
    try {
      console.log('开始生成图片:', { description });

      // 验证 API Key
      const apiKey = await ConfigManager.getGLMAPIKey();
      if (!apiKey) {
        throw new Error('请先设置 GLM API Key');
      }

      // 构建请求选项
      const options = {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'cogView-4',
          prompt: description,
          size: '1024x1024', // 默认尺寸，可以根据需要调整
          n: 1 // 生成图片数量
        })
      };

      // 发送请求
      console.log('发送图片生成请求...');
      const response = await fetch(this.GLM_IMAGE_URL, options);
      
      if (!response.ok) {
        const errorData = await response.text();
        console.error('图片生成失败:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData
        });
        throw new Error('图片生成失败，请稍后重试');
      }

      const data = await response.json();
      console.log('图片生成响应:', data);

      if (!data.data || !data.data[0]?.url) {
        throw new Error('图片生成响应格式错误');
      }

      return data.data[0].url;
    } catch (error) {
      console.error('图片生成失败:', error);
      throw error;
    }
  }

  static async submitToFlomo(data, imageUrl = null) {
    try {
      console.log('开始提交到 Flomo:', { data, imageUrl });
      
      // 获取 Webhook URL
      const webhookUrl = await ConfigManager.getWebhookUrl();
      if (!webhookUrl) {
        throw new Error('请先设置 Flomo API');
      }

      // 获取默认标签
      const defaultTag = await ConfigManager.getDefaultTag() || '#英语单词';

      // 构建提交内容，添加图片支持
      const content = `📝 ${data.英语}

---
💡 助记拆解：
${data.关键词}

🌟 场景描述：
${data.图像描述}

${imageUrl ? `\n![场景图片](${imageUrl})\n` : ''}

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
      console.error('提交到 Flomo 时出错:', error);
      throw error;
    }
  }

  static async generateDescriptionWithGLM(word, scene = 'default') {
    try {
      console.log('开始使用GLM-4生成描述:', { word, scene });

      // 验证 API Key
      const apiKey = await ConfigManager.getGLMAPIKey();
      if (!apiKey) {
        throw new Error('请先设置 GLM API Key');
      }

      // 构建提示词
      const prompt = this._buildPrompt(word, scene);
      console.log('构建的GLM提示词:', prompt);

      // 构建请求选项
      const options = {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: API_ENDPOINTS.GLM.model,
          messages: [
            {
              role: 'system',
              content: '你是一个专业的英语单词记忆助手，擅长创造生动有趣的场景来帮助记忆单词。'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.7,
          top_p: 0.95,
          max_tokens: 1024
        })
      };

      // 发送请求
      console.log('发送 GLM API 请求...');
      const response = await fetch(this.GLM_URL, options);
      
      if (!response.ok) {
        const errorData = await response.text();
        console.error('GLM API 响应错误:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData
        });
        throw new Error('生成描述失败，请稍后重试');
      }

      const data = await response.json();
      console.log('GLM API 响应数据:', data);

      if (!data.choices || !data.choices[0]?.message?.content) {
        throw new Error('GLM API 返回数据格式错误');
      }

      // 处理响应
      const content = data.choices[0].message.content;
      console.log('GLM生成的原始内容:', content);

      try {
        // 尝试解析 JSON
        const result = JSON.parse(content);
        console.log('GLM解析后的结果:', result);
        return result;
      } catch (parseError) {
        console.error('GLM JSON 解析失败:', parseError);
        throw new Error('生成的内容格式不正确');
      }
    } catch (error) {
      console.error('GLM生成描述失败:', error);
      throw error;
    }
  }

  static async generateDescriptionWithVolcengine(word, scene = 'default') {
    try {
      const apiKey = await ConfigManager.getVolcengineAPIKey();
      if (!apiKey) {
        throw new Error('请先设置火山云 API Key');
      }

      const prompt = this._buildPrompt(word, scene);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), API_ENDPOINTS.VOLCENGINE.timeout);

      const options = {
        method: 'POST',
        headers: {
          'Authorization': API_ENDPOINTS.VOLCENGINE.auth(apiKey),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: API_ENDPOINTS.VOLCENGINE.model,
          messages: [
            {
              role: 'system',
              content: '你是一个专业的英语单词记忆助手，擅长创造生动有趣的图像化场景来帮助记忆单词。'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.7,
          top_p: 0.95,
          max_tokens: 1024,
          stream: false
        }),
        signal: controller.signal
      };

      const response = await fetch(this.VOLCENGINE_URL, options);
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('火山云 API 错误:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText
        });
        throw new Error(`生成描述失败: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log('火山云原始响应:', data);

      // 检查火山云的响应格式
      if (!data.choices || !data.choices[0] || !data.choices[0].message || !data.choices[0].message.content) {
        console.error('火山云响应格式错误:', data);
        throw new Error('API 响应格式错误');
      }

      const content = data.choices[0].message.content;
      console.log('解析前的内容:', content);
      
      try {
        // 尝试直接解析 JSON
        let result;
        try {
          result = JSON.parse(content);
        } catch (e) {
          // 如果直接解析失败，尝试从 markdown 中提取
          const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || content.match(/\{[\s\S]*\}/);
          if (!jsonMatch) {
            throw new Error('无法找到 JSON 内容');
          }
          const jsonStr = jsonMatch[1] || jsonMatch[0];
          result = JSON.parse(jsonStr);
        }
        
        // 验证返回的数据格式
        if (!result.英语 || !result.关键词 || !result.世界观 || !result.图像描述) {
          console.error('数据格式不完整:', result);
          throw new Error('返回的数据格式不完整');
        }
        
        return result;
      } catch (parseError) {
        console.error('内容解析失败:', {
          error: parseError,
          content: content
        });
        throw new Error('生成的内容格式不正确');
      }
    } catch (error) {
      console.error('火山云生成描述失败:', error);
      throw error;
    }
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