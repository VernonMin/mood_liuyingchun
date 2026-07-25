const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const KV_KEY = 'ielts_progress_v1';

const LEVEL_SPECS = [
  { id: 'prep', title: '预备级', total: 8 },
  { id: 'basic', title: '初级', total: 26 },
  { id: 'mid', title: '中级', total: 12 },
  { id: 'advanced', title: '高级', total: 6 },
];

const PRAISE_LINES = [
  '刘迎春真棒',
];

function getBeijingDate() {
  const now = new Date(Date.now() + 8 * 60 * 60 * 1000);
  return now.toISOString().slice(0, 10);
}

function shiftBeijingDate(dateStr, deltaDays) {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + deltaDays));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

function buildDefaultData() {
  return {
    updatedAt: new Date().toISOString(),
    checkins: [],
    levels: LEVEL_SPECS.map(level => ({
      id: level.id,
      title: level.title,
      total: level.total,
      lists: Array.from({ length: level.total }, (_, idx) => ({
        id: `${level.id}_${String(idx + 1).padStart(2, '0')}`,
        title: `Word List ${String(idx + 1).padStart(2, '0')}`,
        status: 'todo',
        updatedDate: '',
      })),
    })),
  };
}

function normalizeData(data) {
  if (!data || !Array.isArray(data.levels)) return buildDefaultData();
  const defaultData = buildDefaultData();
  const levelMap = new Map((data.levels || []).map(level => [level.id, level]));
  return {
    updatedAt: data.updatedAt || defaultData.updatedAt,
    checkins: Array.isArray(data.checkins) ? data.checkins : [],
    levels: defaultData.levels.map(def => {
      const saved = levelMap.get(def.id) || {};
      const listMap = new Map((saved.lists || []).map(item => [item.id, item]));
      return {
        ...def,
        lists: def.lists.map(item => {
          const savedItem = listMap.get(item.id) || {};
          return {
            ...item,
            status: ['todo', 'doing', 'done'].includes(savedItem.status) ? savedItem.status : item.status,
            updatedDate: savedItem.updatedDate || '',
          };
        }),
      };
    }),
  };
}

function computeStreak(checkins) {
  const unique = new Set(checkins);
  const today = getBeijingDate();
  let cursor = today;
  if (!unique.has(cursor)) {
    cursor = shiftBeijingDate(cursor, -1);
  }
  let streak = 0;
  while (unique.has(cursor)) {
    streak += 1;
    cursor = shiftBeijingDate(cursor, -1);
  }
  return streak;
}

function collectStudyDates(data) {
  const dates = new Set(Array.isArray(data.checkins) ? data.checkins : []);
  for (const level of data.levels || []) {
    for (const item of level.lists || []) {
      if (item.status !== 'todo' && item.updatedDate) {
        dates.add(item.updatedDate);
      }
    }
  }
  return [...dates].sort();
}

function buildResponse(data) {
  const studyDates = collectStudyDates(data);
  const completedLists = data.levels.reduce(
    (sum, level) => sum + level.lists.filter(item => item.status === 'done').length,
    0
  );
  const totalLists = data.levels.reduce((sum, level) => sum + level.total, 0);
  const allDone = completedLists === totalLists;
  const currentLevel = allDone ? null
    : data.levels.find(level => level.lists.some(item => item.status === 'doing'))
      || data.levels.find(level => level.lists.some(item => item.status === 'todo'))
      || null;
  const currentItem = currentLevel
    ? currentLevel.lists.find(item => item.status === 'doing')
      || currentLevel.lists.find(item => item.status === 'todo')
    : null;
  const today = getBeijingDate();
  const todayStudy = {
    date: today,
    done: studyDates.includes(today),
    note: studyDates.includes(today)
      ? `今天已经学到 ${currentLevel?.title || '词汇'} 了，迎春继续稳稳地往前走。`
      : '',
  };

  return {
    updatedAt: data.updatedAt,
    todayStudy,
    summary: {
      totalLists,
      completedLists,
      streakDays: computeStreak(studyDates),
      currentItem: currentItem ? {
        levelId: currentLevel.id,
        levelTitle: currentLevel.title,
        id: currentItem.id,
        title: currentItem.title,
      } : null,
    },
    levels: data.levels.map(level => ({
      id: level.id,
      title: level.title,
      total: level.total,
      completed: level.lists.filter(item => item.status === 'done').length,
      lists: level.lists,
    })),
  };
}

async function loadData(env) {
  const raw = await env.LIUYINGCHUN_MOOD_KV.get(KV_KEY, 'json');
  return normalizeData(raw);
}

export async function onRequestOptions() {
  return new Response(null, { headers: CORS });
}

export async function onRequestGet({ env }) {
  const data = await loadData(env);
  return new Response(JSON.stringify(buildResponse(data)), {
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

export async function onRequestPost({ env, request }) {
  const { levelId, listId, status } = await request.json();
  if (!levelId || !listId || !['todo', 'doing', 'done'].includes(status)) {
    return new Response(JSON.stringify({ error: 'invalid payload' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...CORS },
    });
  }

  const data = await loadData(env);
  const level = data.levels.find(item => item.id === levelId);
  const list = level?.lists.find(item => item.id === listId);
  if (!level || !list) {
    return new Response(JSON.stringify({ error: 'not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json', ...CORS },
    });
  }

  const prevStatus = list.status;
  const today = getBeijingDate();
  list.status = status;
  list.updatedDate = today;
  if (status !== 'todo' && !data.checkins.includes(today)) data.checkins.push(today);
  data.checkins = [...new Set(data.checkins)].sort().slice(-180);
  data.updatedAt = new Date().toISOString();

  await env.LIUYINGCHUN_MOOD_KV.put(KV_KEY, JSON.stringify(data));

  const response = buildResponse(data);
  const praised = prevStatus !== 'done' && status === 'done';
  if (praised) {
    response.praised = true;
    response.praiseMessage = PRAISE_LINES[Math.floor(Math.random() * PRAISE_LINES.length)];
  }

  return new Response(JSON.stringify(response), {
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}
