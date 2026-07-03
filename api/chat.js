export default async function handler(req, res) {
  // 只允许 POST 请求
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      error: 'Method not allowed',
      debug: { method: req.method }
    });
  }

  // 1. 获取请求体
  const { messages, model = 'glm-5.2' } = req.body;

  // 2. 读取环境变量
  const apiKey = process.env.ZHIPU_API_KEY;
  const testVar = process.env.TEST_VAR || '未设置';

  // 3. 如果 API Key 不存在，返回调试信息
  if (!apiKey) {
    return res.status(500).json({ 
      error: 'ZHIPU_API_KEY not configured',
      debug: { 
        testVar: testVar,
        hasApiKey: !!apiKey,
        envKeys: Object.keys(process.env).filter(k => k.includes('ZHIPU') || k.includes('TEST'))
      }
    });
  }

  try {
    // 4. 调用智谱 API
    const response = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model,
        messages: messages,
        stream: false,
      }),
    });

    const data = await response.json();

    // 5. 如果智谱返回错误，把详细信息返回给前端
    if (!response.ok) {
      return res.status(response.status).json({ 
        error: data.error?.message || 'API request failed',
        debug: {
          zhipuStatus: response.status,
          zhipuError: data.error,
          testVar: testVar,
          hasApiKey: !!apiKey,
          modelUsed: model
        }
      });
    }

    // 6. 成功：提取回复内容
    const reply = data.choices?.[0]?.message?.content || '抱歉，我暂时无法回答。';
    
    return res.status(200).json({ 
      reply: reply,
      debug: {
        testVar: testVar,
        hasApiKey: !!apiKey,
        modelUsed: model,
        zhipuId: data.id
      }
    });

  } catch (error) {
    console.error('Error calling Zhipu API:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      debug: {
        testVar: testVar,
        hasApiKey: !!apiKey,
        errorMessage: error.message
      }
    });
  }
}