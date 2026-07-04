const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(express.json());

// ========== 提供静态文件 ==========
// 让 express 能返回 public 文件夹里的内容（前端页面）
app.use(express.static(path.join(__dirname, 'public')));

// ========== 模型配置 ==========
function getModels() {
  return {
  deepseek: {
    name: 'DeepSeek',
    provider: 'deepseek',
    apiUrl: 'https://api.deepseek.com/v1/chat/completions',
    apiKey: process.env.DEEPSEEK_API_KEY,
    model: 'deepseek-chat',
  },
  zhipu: {
    name: '智谱 GLM',
    provider: 'zhipu',
    apiUrl: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
    apiKey: process.env.ZHIPU_API_KEY,
    model: 'glm-5.2',
  },
}
};

// ========== API 路由：处理聊天请求 ==========
app.post('/api/chat', async (req, res) => {
  const { messages, model = 'zhipu' } = req.body;
  const MODELS = getModels();
  const config = MODELS[model];

  // 检查模型是否存在
  if (!config) {
    return res.status(400).json({ 
      error: '不支持的模型',
      debug: { availableModels: Object.keys(MODELS) }
    });
  }

  // 检查 API Key 是否配置
  if (!config.apiKey) {
    return res.status(500).json({ 
      error: `模型 ${model} 的 API Key 未配置`,
      debug: { model: model }
    });
  }

  try {
    const response = await fetch(config.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: messages,
        stream: false,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ 
        error: data.error?.message || 'API 请求失败',
        debug: { status: response.status }
      });
    }

    const reply = data.choices?.[0]?.message?.content || '抱歉，我暂时无法回答。';
    res.json({ reply });

  } catch (error) {
    console.error('API 调用失败:', error);
    res.status(500).json({ 
      error: '服务器内部错误',
      debug: { message: error.message }
    });
  }
});

// ========== 处理所有非 API 请求 ==========
// 这个要放在最后，确保所有路由都返回 index.html（支持前端路由）
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ========== 启动服务器 ==========
app.listen(port, () => {
  console.log(`AI 代理服务已启动: http://localhost:${port}`);
  console.log(`可用模型: ${Object.keys(MODELS).join(', ')}`);
});