const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const port = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ========== 核心：每次请求动态获取模型配置 ==========
function getModelConfig(modelKey) {
  const configs = {
    deepseek: {
      name: 'DeepSeek',
      provider: 'deepseek',
      apiUrl: 'https://api.deepseek.com/v1/chat/completions',
      apiKey: process.env.DEEPSEEK_API_KEY,  // 每次调用时重新读取
      model: 'deepseek-chat',
    },
    zhipu: {
      name: '智谱 GLM',
      provider: 'zhipu',
      apiUrl: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
      apiKey: process.env.ZHIPU_API_KEY,
      model: 'glm-5.2',
    },
  };
  return configs[modelKey];
}

// ========== API 路由 ==========
app.post('/api/chat', async (req, res) => {
  const { messages, model = 'zhipu' } = req.body;
  
  // 实时获取配置
  const config = getModelConfig(model);
  
  if (!config) {
    return res.status(400).json({ 
      error: `不支持的模型: ${model}`,
      debug: { available: ['deepseek', 'zhipu'] }
    });
  }

  if (!config.apiKey) {
    console.error(`❌ 模型 ${model} 的 API Key 缺失`);
    return res.status(500).json({ 
      error: `模型 ${model} 的 API Key 未配置`,
      debug: { model }
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
        enable_search: enable_search,
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

// ========== 前端路由 ==========
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ========== 启动服务器 ==========
app.listen(port, () => {
  console.log(`🚀 AI 代理服务已启动: http://localhost:${port}`);
  console.log(`📦 可用模型: deepseek (${process.env.DEEPSEEK_API_KEY ? '✅ 已配置' : '❌ 未配置'}), zhipu (${process.env.ZHIPU_API_KEY ? '✅ 已配置' : '❌ 未配置'})`);
});