const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const SYSTEM_PROMPT = `你是一个专门为刘迎春写月度心情信的助手。刘迎春是一名护士，工作认真，对人温柔体贴。

你写的是一封信，不是报告。

写作规则：
1. 如果有罐子内容，用她存的原话直接开头，加引号，然后从这句话展开
2. 把心情数字变成观察：不写「很好8天」，写「有好几天很好」
3. 说她是什么样的人，不只说她做了什么事
4. 如果有不太好的天，不回避，温柔地提：「有几天不太好，但她没有跟自己较劲」
5. 语气克制，像一个懂她的朋友，不煽情，不夸张
6. 150字左右，可以有两三段
7. 只输出信的正文，不要标题，不要署名，不要任何额外内容
8. 不要出现「春风」「阳光」「温暖」「绽放」「闪闪发光」等词`;

export async function onRequestOptions() {
  return new Response(null, { headers: CORS });
}

export async function onRequestGet({ env, request }) {
  const url = new URL(request.url);
  const month = url.searchParams.get('month');
  const regen = url.searchParams.get('regen') === '1';

  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return new Response(JSON.stringify({ error: 'invalid month' }), {
      status: 400, headers: { 'Content-Type': 'application/json', ...CORS },
    });
  }

  // 轻量预览模式：只返回心情数据，不调 AI
  const preview = url.searchParams.get('preview') === '1';
  if (preview) {
    const allMoods = await env.LIUYINGCHUN_MOOD_KV.get('moods', 'json') || [];
    const moodData = allMoods.filter(m => m.date.startsWith(month));
    const recent = [...moodData].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
    return new Response(JSON.stringify({
      month,
      recorded: moodData.length,
      recentEmojis: recent.map(m => m.emoji),
    }), { headers: { 'Content-Type': 'application/json', ...CORS } });
  }

  if (!regen) {
    const cached = await env.LIUYINGCHUN_MOOD_KV.get(`monthly_report:${month}`, 'json');
    if (cached) {
      return new Response(JSON.stringify(cached), {
        headers: { 'Content-Type': 'application/json', ...CORS },
      });
    }
  }

  const report = await generateReport(env, month);
  await env.LIUYINGCHUN_MOOD_KV.put(`monthly_report:${month}`, JSON.stringify(report));

  return new Response(JSON.stringify(report), {
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

async function generateReport(env, month) {
  // 心情数据
  const allMoods = await env.LIUYINGCHUN_MOOD_KV.get('moods', 'json') || [];
  const moodData = allMoods.filter(m => m.date.startsWith(month));

  // 罐子
  const allJar = await env.LIUYINGCHUN_MOOD_KV.get('jar_entries', 'json') || [];
  const jarEntries = allJar.filter(e => e.date && e.date.startsWith(month));

  // 复盘笔记
  const notesList = await env.LIUYINGCHUN_MOOD_KV.list({ prefix: `note_${month}` });
  const notes = [];
  for (const key of notesList.keys) {
    const note = await env.LIUYINGCHUN_MOOD_KV.get(key.name, 'json');
    if (note) notes.push({ ...note, date: key.name.replace('note_', '') });
  }

  // 统计
  const moodCounts = { '很好': 0, '还行': 0, '有点累': 0, '不太好': 0 };
  moodData.forEach(m => { if (m.mood in moodCounts) moodCounts[m.mood]++; });
  const dominantMood = Object.entries(moodCounts)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])[0]?.[0] || '';

  const [y, mo] = month.split('-').map(Number);
  const monthLabel = `${y}年${mo}月`;

  // 给 AI 的素材：尽量用她的原话
  let dataDesc = `${monthLabel}，刘迎春记录了${moodData.length}天心情。\n`;

  if (moodData.length > 0) {
    const good = moodCounts['很好'] + moodCounts['还行'];
    const bad = moodCounts['有点累'] + moodCounts['不太好'];
    if (good > bad) dataDesc += `大多数时候心情不错，`;
    else if (bad > good) dataDesc += `这个月有不少疲惫的时候，`;
    else dataDesc += `心情有起有落，`;
    if (moodCounts['不太好'] > 0) dataDesc += `有${moodCounts['不太好']}天不太好。\n`;
    else dataDesc += `没有太难受的天。\n`;
  }

  if (jarEntries.length > 0) {
    dataDesc += `\n她存进罐子的话：\n`;
    jarEntries.slice(0, 4).forEach(e => {
      const d = e.date.split('-');
      dataDesc += `- 「${e.text}」（${parseInt(d[1])}月${parseInt(d[2])}日）\n`;
    });
  }

  if (notes.length > 0) {
    dataDesc += `\n她写的复盘：\n`;
    notes.slice(0, 2).forEach(n => {
      dataDesc += `- 「${n.text}」\n`;
    });
  }

  if (moodData.length === 0 && jarEntries.length === 0) {
    dataDesc += '这个月没有记录任何内容。\n';
  }

  dataDesc += '\n请写一封信。';

  // 默认兜底文案
  const [y2, mo2] = month.split('-').map(Number);
  let letter = `${y2}年${mo2}月，刘迎春认真地过着每一天。好的不好的，都是她真实的这个月。`;

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
          { role: 'user', content: dataDesc },
        ],
        temperature: 0.9,
        max_tokens: 600,
      }),
    });
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || '';
    if (content) letter = content.trim();
  } catch (e) {
    // 用默认兜底
  }

  return {
    month,
    generatedAt: new Date().toISOString(),
    moodData,
    jarEntries,
    notes,
    moodCounts,
    dominantMood,
    letter,
  };
}
