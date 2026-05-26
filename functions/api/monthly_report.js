const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const SYSTEM_PROMPT = `你是一个专门为刘迎春写月度心情总结的助手。刘迎春是一名护士，工作认真，对人温柔体贴。

根据这个月的心情数据，分别写两段话：
- opening：温柔地描述这个月，2-3句话，像一个懂她的朋友在说话，不超过70字
- closing：给她一句温暖的月度寄语，1-2句话，不超过50字

风格要求：
- 口语化、克制、不夸张，不煽情
- 不要出现「春风」「阳光」「温暖」「绽放」等词
- 说的是她这个人，不是泛泛的鸡汤
- 以「刘迎春」开头
- 返回严格的JSON格式：{"opening": "...", "closing": "..."}
- 只返回JSON，不要其他内容`;

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
  const allMoods = await env.LIUYINGCHUN_MOOD_KV.get('moods', 'json') || [];
  const moodData = allMoods.filter(m => m.date.startsWith(month));

  const allJar = await env.LIUYINGCHUN_MOOD_KV.get('jar_entries', 'json') || [];
  const jarEntries = allJar.filter(e => e.date && e.date.startsWith(month));

  const notesList = await env.LIUYINGCHUN_MOOD_KV.list({ prefix: `note_${month}` });
  const notes = [];
  for (const key of notesList.keys) {
    const note = await env.LIUYINGCHUN_MOOD_KV.get(key.name, 'json');
    if (note) notes.push({ ...note, date: key.name.replace('note_', '') });
  }

  const moodCounts = { '很好': 0, '还行': 0, '有点累': 0, '不太好': 0 };
  moodData.forEach(m => { if (m.mood in moodCounts) moodCounts[m.mood]++; });
  const dominantMood = Object.entries(moodCounts)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])[0]?.[0] || '';

  const [y, mo] = month.split('-').map(Number);
  const monthLabel = `${y}年${mo}月`;

  let dataDesc = `${monthLabel}，刘迎春记录了${moodData.length}天心情。\n`;
  if (moodData.length > 0) {
    dataDesc += `心情分布：很好${moodCounts['很好']}天，还行${moodCounts['还行']}天，有点累${moodCounts['有点累']}天，不太好${moodCounts['不太好']}天。\n`;
  }
  if (jarEntries.length > 0) {
    dataDesc += `罐子里存了${jarEntries.length}条好心情：${jarEntries.slice(0, 3).map(e => `「${e.text}」`).join('、')}。\n`;
  }
  if (notes.length > 0) {
    dataDesc += `写了${notes.length}条复盘笔记：${notes.slice(0, 2).map(n => `「${n.text}」`).join('、')}。\n`;
  }
  if (moodData.length === 0) {
    dataDesc += '这个月没有记录心情数据。\n';
  }

  let aiText = {
    opening: `${monthLabel}，刘迎春认真地过着每一天，好的不好的都是她的。`,
    closing: `下个月也好好的。`,
  };

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
        temperature: 0.85,
        max_tokens: 400,
        response_format: { type: 'json_object' },
      }),
    });
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || '';
    const parsed = JSON.parse(content);
    if (parsed.opening && parsed.closing) aiText = parsed;
  } catch (e) {
    // 用默认文案兜底
  }

  return {
    month,
    generatedAt: new Date().toISOString(),
    moodData,
    jarEntries,
    notes,
    moodCounts,
    dominantMood,
    aiText,
  };
}
