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

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
