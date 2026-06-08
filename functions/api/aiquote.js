const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const SYSTEM_PROMPT = `你是一个专门给刘迎春写日常问候语的文案生成器。刘迎春是一名护士，工作认真，对人温柔体贴。
请生成一句今日问候语，风格严格参考以下例子：
- 刘迎春，今天天气挺好的，你上班的路上有没有多看一眼外面。
- 刘迎春，六月了，天长了，下班还亮着呢，慢慢走也没关系。
- 刘迎春，今天喝咖啡了吗，喝了的话，今天应该不会太难熬。
- 刘迎春，夏天来了，吃点好的，别总是将就。
- 刘迎春，今天上班辛苦了，回家路上注意安全。
- 刘迎春，今天有没有偷摸摸休息一下，偶尔摸鱼也是应该的。
- 刘迎春，最近睡得好吗，睡前少刷手机，对眼睛好。
- 刘迎春，你每天都在照顾别人，今天也照顾一下自己。
- 刘迎春，六月天闷，记得多喝水，别忙起来忘了。
- 刘迎春，下午的班最难熬，撑到下班，今晚吃点喜欢的。

风格要求：
- 口语化、日常、像朋友说话，不煽情，不用诗意比喻
- 不要出现「春风」「阳光」「温暖」「绽放」「治愈」之类的词
- 结合当下季节（现在是夏天/六月），偶尔结合护士身份，但不强求
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
