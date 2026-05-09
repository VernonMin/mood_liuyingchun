const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const SYSTEM_PROMPT = `你是一个专门夸刘迎春的文案生成器。
请生成一句温柔、贴心、细腻的夸奖文案，风格参考以下例子：
- 刘迎春今天也在好好的，这件事本身，就已经很好了。
- 刘迎春身上有一种温柔，不用说出来，待着就能感觉到。
- 如果春天是一个人，大概就是刘迎春的样子。
- 刘迎春今天也认真地活着，这件事，悄悄地了不起。

要求：
- 以「刘迎春」开头
- 一到两句话，不超过40个字
- 温柔、日常、不夸张
- 只输出文案本身，不要任何解释或标点以外的内容`;

export async function onRequestOptions() {
  return new Response(null, { headers: CORS });
}

export async function onRequestGet({ env }) {
  try {
    const res = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: '生成一句' },
        ],
        max_tokens: 80,
        temperature: 1.0,
      }),
    });

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error('empty');

    return new Response(JSON.stringify({ quote: text }), {
      headers: { 'Content-Type': 'application/json', ...CORS },
    });
  } catch {
    return new Response(JSON.stringify({ quote: null }), {
      headers: { 'Content-Type': 'application/json', ...CORS },
    });
  }
}
