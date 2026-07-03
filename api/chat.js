export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { messages, model = 'glm-4-plus' } = req.body;

  const apiKey = process.env.ZHIPU_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'ZHIPU_API_KEY not configured' });
  }

  try {
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

    if (!response.ok) {
      return res.status(response.status).json({ error: data.error?.message || 'API request failed' });
    }

    // ⭐️ 重点修改这里
    const reply = data.choices?.[0]?.message?.content || '抱歉，我暂时无法回答。';
    return res.status(200).json({ reply });

  } catch (error) {
    console.error('Error calling Zhipu API:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}