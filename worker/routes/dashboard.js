/**
 * routes/dashboard.js
 * GET /dashboard/* — 교수용 조회 엔드포인트 (C4 태스크)
 * 모든 요청은 auth.js에서 토큰 검증 후 진입
 */

import { listAssessments, listRoster } from '../services/storage.js';
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
  if (request.method === 'POST' && pathname === '/dashboard/send-email') {
    return handleSendEmail(request, env);
  }
  if (pathname === '/dashboard/locks') {
    if (request.method === 'GET') return handleGetLocks(env);
    if (request.method === 'POST') return handleSetLock(request, env);
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

  // 이메일 enrichment: 고유 student_id별 프로필 조회
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
    <h2 style="color:#2563eb;">교수 메시지</h2>
    <p>안녕하세요, <strong>${escHtml(studentName)}</strong>님!</p>
    <div style="border-left:4px solid #2563eb;padding:12px 16px;background:#eff6ff;margin:16px 0;white-space:pre-wrap;">${escHtml(message)}</div>
    <p style="color:#6b7280;font-size:12px;">본 메일은 디지털 논리회로 학습 시스템에서 발송되었습니다.</p>
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

function escHtml(str) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
