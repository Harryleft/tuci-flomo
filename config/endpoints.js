/**
 * API 端点配置
 */
const API_ENDPOINTS = {
  GLM: {
    CHAT: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
    IMAGE: 'https://open.bigmodel.cn/api/paas/v4/images/generations',
    model: 'glm-4-flash',
    imageModel: 'cogview-4',
    auth: (apiKey) => `Bearer ${apiKey}`
  },
  VOLCENGINE: {
    CHAT: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
    model: 'ep-20250217174423-28s6w',
    auth: (apiKey) => `Bearer ${apiKey}`,
    timeout: 180000 // 3 minutes timeout
  }
};

export default API_ENDPOINTS; 