/**
 * routes/dashboard.js
 * GET /dashboard/* — 교수용 조회 엔드포인트 (C4 태스크)
 * 모든 요청은 auth.js에서 토큰 검증 후 진입
 */

import { listAssessments } from '../services/storage.js';
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

  return jsonResponse({ error: 'Not Found' }, 404);
}

async function handleSummary(env, params) {
  const submissions = await listAssessments(env, params);
  const summary = calcSummary(submissions);
  return jsonResponse(summary);
}

async function handleStudents(env, params) {
  const submissions = await listAssessments(env, params);
  return jsonResponse({ submissions, total: submissions.length });
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
