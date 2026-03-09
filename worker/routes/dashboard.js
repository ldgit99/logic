/**
 * routes/dashboard.js
 * GET /dashboard/* ????흮????브퀗?????븐뼔援?????(C4 ??戮?츩??
 * 嶺뚮ㅄ維獄???븐슙??? auth.js???????ルㅎ荑??롪틵?嶺???嶺뚯쉳???
 */

import { listAssessments, listRoster } from '../services/storage.js';
import { createUserByInstructor, deleteUserByInstructor } from '../services/studentAuth.js';
import { calcSummary, calcInterventions, calcConcepts } from '../services/analytics.js';

export async function handleDashboard(request, env, pathname) {
  const url = new URL(request.url);
  const params = Object.fromEntries(url.searchParams);

  if (pathname === '/dashboard/summary') {
    return handleSummary(env, params);
  }
  if (pathname === '/dashboard/students') {
    return handleStudents(env, params);
  }
  if (pathname === '/dashboard/concepts') {
    return handleConceptsRoute(env, params);
  }
  if (pathname === '/dashboard/interventions') {
    return handleInterventions(env, params);
  }
  if (pathname === '/dashboard/roster') {
    return handleRoster(env);
  }
  if (request.method === 'POST' && pathname === '/dashboard/members/add') {
    return handleRosterAdd(request, env);
  }
  if (request.method === 'POST' && pathname === '/dashboard/members/delete') {
    return handleRosterDelete(request, env);
  }
  if (request.method === 'POST' && pathname === '/dashboard/send-email') {
    return handleSendEmail(request, env);
  }
  if (pathname === '/dashboard/locks') {
    if (request.method === 'GET') return handleGetLocks(env);
    if (request.method === 'POST') return handleSetLock(request, env);
  }
  if (pathname.startsWith('/dashboard/questions/')) {
    const chapterId = pathname.split('/')[3];
    if (request.method === 'GET') return handleGetQuestions(env, chapterId);
    if (request.method === 'POST') return handleSetQuestions(request, env, chapterId);
  }

  return jsonResponse({ error: 'Not Found' }, 404);
}

async function handleSummary(env, params) {
  const submissions = await listAssessments(env, params);
  const summary = calcSummary(submissions);
  return jsonResponse(summary);
}

async function handleStudents(env, params) {
  const submissions = await listAssessments(env, params);

  // ???筌??enrichment: ??μ쪠?? student_id???熬곣뫁夷???브퀗???
  const uniqueIds = [...new Set(submissions.map((s) => s.student_id))];
  const profileMap = {};
  await Promise.all(
    uniqueIds.map(async (id) => {
      const raw = await env.SUBMISSIONS.get(`auth:user:${id}`);
      if (!raw) return;
      try {
        const u = JSON.parse(raw);
        profileMap[id] = { email: u.email || '', created_at: u.created_at || '' };
      } catch { /* ignore */ }
    }),
  );

  const enriched = submissions.map((s) => ({
    ...s,
    email: profileMap[s.student_id]?.email || '',
    registered_at: profileMap[s.student_id]?.created_at || '',
  }));

  return jsonResponse({ submissions: enriched, total: enriched.length });
}

async function handleRoster(env) {
  const roster = await listRoster(env);
  return jsonResponse({ roster, total: roster.length });
}


async function handleRosterAdd(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'invalid JSON' }, 400);
  }

  const studentId = String(body.student_id || '').trim();
  const studentName = String(body.student_name || '').trim();
  const email = String(body.email || '').trim();
  const password = String(body.password || '');

  if (!studentId || !studentName || !email || !password) {
    return jsonResponse({ error: 'missing required fields' }, 400);
  }
  if (studentId.length < 4 || studentId.length > 32) {
    return jsonResponse({ error: 'invalid student_id length' }, 400);
  }
  if (studentName.length < 2 || studentName.length > 30) {
    return jsonResponse({ error: 'invalid student_name length' }, 400);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return jsonResponse({ error: 'invalid email format' }, 400);
  }
  if (password.length < 8 || password.length > 64) {
    return jsonResponse({ error: 'invalid password length' }, 400);
  }

  const created = await createUserByInstructor(env, {
    studentId,
    studentName,
    password,
    email,
  });

  if (created?.error === 'USER_EXISTS') {
    return jsonResponse({ error: 'student already exists' }, 409);
  }

  return jsonResponse({
    ok: true,
    user: {
      student_id: created.user.student_id,
      student_name: created.user.student_name,
      email: created.user.email || '',
      created_at: created.user.created_at || '',
    },
  }, 201);
}

async function handleRosterDelete(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'invalid JSON' }, 400);
  }

  const studentId = String(body.student_id || '').trim();
  if (!studentId) return jsonResponse({ error: 'missing student_id' }, 400);

  const deleted = await deleteUserByInstructor(env, studentId);
  if (deleted?.error === 'USER_NOT_FOUND') {
    return jsonResponse({ error: 'student not found' }, 404);
  }

  return jsonResponse({ ok: true, student_id: studentId });
}
async function handleConceptsRoute(env, params) {
  const submissions = await listAssessments(env, params);
  const concepts = calcConcepts(submissions);
  return jsonResponse({ concepts });
}

async function handleInterventions(env, params) {
  const submissions = await listAssessments(env, params);
  const interventions = calcInterventions(submissions);
  return jsonResponse({ interventions });
}

const LOCKS_KEY = 'config:chapter_locks';

async function handleGetLocks(env) {
  const raw = await env.SUBMISSIONS.get(LOCKS_KEY);
  const locks = raw ? JSON.parse(raw) : {};
  return jsonResponse({ locks });
}

async function handleSetLock(request, env) {
  let body;
  try { body = await request.json(); } catch { return jsonResponse({ error: 'invalid JSON' }, 400); }
  const chapterId = String(body.chapter_id || '').trim();
  const locked = Boolean(body.locked);
  if (!chapterId) return jsonResponse({ error: 'missing chapter_id' }, 400);

  const raw = await env.SUBMISSIONS.get(LOCKS_KEY);
  const locks = raw ? JSON.parse(raw) : {};
  if (locked) {
    locks[chapterId] = true;
  } else {
    delete locks[chapterId];
  }
  await env.SUBMISSIONS.put(LOCKS_KEY, JSON.stringify(locks));
  return jsonResponse({ ok: true, locks });
}

async function handleSendEmail(request, env) {
  if (!env.RESEND_API_KEY) return jsonResponse({ error: 'email not configured' }, 503);
  let body;
  try { body = await request.json(); } catch { return jsonResponse({ error: 'invalid JSON' }, 400); }

  const studentId = String(body.student_id || '').trim();
  const subject = String(body.subject || '').trim();
  const message = String(body.message || '').trim();
  if (!studentId || !subject || !message) return jsonResponse({ error: 'missing fields' }, 400);

  const userRaw = await env.SUBMISSIONS.get(`auth:user:${studentId}`);
  if (!userRaw) return jsonResponse({ error: 'student not found' }, 404);
  let studentEmail = '', studentName = '';
  try { const u = JSON.parse(userRaw); studentEmail = u.email || ''; studentName = u.student_name || ''; } catch {}
  if (!studentEmail) return jsonResponse({ error: 'student has no email' }, 422);

  const from = env.EMAIL_FROM || 'noreply@resend.dev';
  const html = `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
    <h2 style="color:#2563eb;">??흮??嶺뚮∥???낆??</h2>
    <p>???댟??琉얠돪?? <strong>${escHtml(studentName)}</strong>??</p>
    <div style="border-left:4px solid #2563eb;padding:12px 16px;background:#eff6ff;margin:16px 0;white-space:pre-wrap;">${escHtml(message)}</div>
    <p style="color:#6b7280;font-size:12px;">??嶺뚮∥???? ???????寃몃뉴???夷????덈? ??戮?츩??戮?뱺???꾩룇裕???琉????鍮??</p>
  </div>`;

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [studentEmail], subject, html }),
    });
  } catch (e) {
    console.error('[send-email]', e);
    return jsonResponse({ error: 'email send failed' }, 502);
  }

  return jsonResponse({ ok: true });
}

async function handleGetQuestions(env, chapterId) {
  if (!chapterId) return jsonResponse({ error: 'missing chapter_id' }, 400);
  const raw = await env.SUBMISSIONS.get(`config:questions:${chapterId}`).catch(() => null);
  const questions = raw ? JSON.parse(raw) : null;
  return jsonResponse({ questions });
}

async function handleSetQuestions(request, env, chapterId) {
  if (!chapterId) return jsonResponse({ error: 'missing chapter_id' }, 400);
  let body;
  try { body = await request.json(); } catch { return jsonResponse({ error: 'invalid JSON' }, 400); }

  if (!Array.isArray(body.questions)) return jsonResponse({ error: 'questions must be array' }, 400);
  for (const q of body.questions) {
    if (!q.question || typeof q.question !== 'string') {
      return jsonResponse({ error: 'each question must have a question field' }, 400);
    }
  }

  const data = {
    totalQuestions: body.questions.length,
    questions: body.questions.map((q) => ({
      bloomLevel: String(q.bloomLevel || ''),
      concept: String(q.concept || ''),
      question: String(q.question),
      keyAnswer: String(q.keyAnswer || ''),
      hints: Array.isArray(q.hints) ? q.hints.map(String) : [],
    })),
  };

  await env.SUBMISSIONS.put(`config:questions:${chapterId}`, JSON.stringify(data));
  return jsonResponse({ ok: true, chapterId, totalQuestions: data.totalQuestions });
}

function escHtml(str) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

