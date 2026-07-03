import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import axios from 'axios';

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

// ========== 模型配置 ==========
const MODELS = {
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
  // doubao: {
  //   name: '豆包',
  //   provider: 'doubao',
  //   apiUrl: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
  //   apiKey: process.env.DOUBAO_API_KEY,
  //   model: 'doubao-seed-evolving',
  // },
};

// 默认模型
let currentModel = 'deepseek';

// ========== 通用调用函数 ==========
async function callAI(messages, modelKey) {
  const config = MODELS[modelKey];
  if (!config) throw new Error('不支持的模型');

  const requestBody = {
    model: config.model,
    messages: messages,
  };

  const response = await axios.post(config.apiUrl, requestBody, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    timeout: 60000,
  });

  return response.data.choices[0].message.content;
}

// ========== 聊天接口 ==========
app.post('/api/chat', async (req, res) => {
  const { messages, model } = req.body;
  const modelKey = model || currentModel;

  try {
    const reply = await callAI(messages, modelKey);
    res.json({ reply, model: modelKey });
  } catch (error) {
    console.error('AI 调用失败:', error.message);
    res.status(500).json({ error: 'AI 服务暂时不可用' });
  }
});

// ========== 获取模型列表 ==========
app.get('/api/models', (req, res) => {
  const list = Object.keys(MODELS).map(key => ({
    key,
    name: MODELS[key].name,
  }));
  res.json({ models: list, current: currentModel });
});

// ========== 切换模型 ==========
app.post('/api/models/switch', (req, res) => {
  const { model } = req.body;
  if (!MODELS[model]) {
    return res.status(400).json({ error: '不支持的模型' });
  }
  currentModel = model;
  res.json({ success: true, current: model });
});

app.listen(port, () => {
  console.log(`🚀 AI 代理服务已启动: http://localhost:3000`);
  console.log(`📦 可用模型: ${Object.keys(MODELS).join(', ')}`);
});