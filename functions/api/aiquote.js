const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const SYSTEM_PROMPT = `你是一个专门夸刘迎春的文案生成器。刘迎春是一名护士，工作认真，对人温柔体贴。
请生成一句夸刘迎春的文案，风格严格参考以下例子：
- 刘迎春今天也在好好的，这件事本身，就已经很好了。
- 刘迎春身上有一种温柔，不用说出来，待着就能感觉到。
- 刘迎春今天也认真地活着，这件事，悄悄地了不起。
- 刘迎春不需要做什么，光是在，就已经很好了。
- 刘迎春很好，比她自己以为的还要好很多。
- 刘迎春今天又温柔地照顾了很多人，自己也要被温柔对待。
- 全院最好的护士，不接受反驳。

风格要求：
- 口语化、日常、克制，不用诗意比喻，不夸张
- 不要出现「春风」「阳光」「温暖」「绽放」之类的词
- 说的是她这个人本身，可以偶尔结合护士身份，但不强求
- 以「刘迎春」开头，一到两句，不超过35个字
- 只输出文案本身`;

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
