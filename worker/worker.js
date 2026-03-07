/**
 * worker.js — Cloudflare Worker 메인 진입점
 *
 * 라우팅:
 *   POST /              → OpenAI API 프록시 (기존)
 *   POST /events        → 이벤트 수집 (신규)
 *   POST /assessment    → 평가 결과 저장 (신규)
 *   POST /feedback-report → 피드백 리포트 저장 (신규)
 *   GET  /dashboard/*   → 교수용 조회 (신규, 토큰 인증 필요)
 *
 * 환경변수 설정:
 *   wrangler secret put OPENAI_API_KEY
 *   wrangler secret put DASHBOARD_TOKEN
 *   wrangler secret put TA_TOKEN        (선택)
 *   wrangler secret put ADMIN_TOKEN     (선택)
 *
 * KV 네임스페이스:
 *   wrangler kv:namespace create SUBMISSIONS
 *   → wrangler.toml에 id/preview_id 입력
 */

import { handleEvents } from './routes/events.js';
import { handleAssessments } from './routes/assessments.js';
import { handleFeedbackReports } from './routes/feedbackReports.js';
import { handleDashboard } from './routes/dashboard.js';
import { handleStudentAuth } from './routes/studentAuth.js';
import { authenticate } from './services/auth.js';

const ALLOWED_ORIGINS = [
  'https://ldgit99.github.io',
  'https://logic.dongkuklee99.workers.dev',
  'https://logic-proxy.dongkuklee99.workers.dev',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'http://localhost:8000',
];

function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

function withCors(response, origin) {
  const headers = new Headers(response.headers);
  Object.entries(corsHeaders(origin)).forEach(([k, v]) => headers.set(k, v));
  return new Response(response.body, { status: response.status, headers });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const url = new URL(request.url);
    const pathname = url.pathname;

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    let response;

    try {
      // auth endpoints
      if (pathname.startsWith('/auth/')) {
        response = await handleStudentAuth(request, env, pathname);

      // ── GET /dashboard/* ─────────────────────────────────────────
      } else if (request.method === 'GET' && pathname.startsWith('/dashboard/')) {
        const authError = authenticate(request, env, pathname);
        if (authError) return withCors(authError, origin);

        response = await handleDashboard(request, env, pathname);

      // ── POST /events ─────────────────────────────────────────────
      } else if (request.method === 'POST' && pathname === '/events') {
        response = await handleEvents(request, env);

      // ── POST /assessment ─────────────────────────────────────────
      } else if (request.method === 'POST' && pathname === '/assessment') {
        response = await handleAssessments(request, env);

      // ── POST /feedback-report ────────────────────────────────────
      } else if (request.method === 'POST' && pathname === '/feedback-report') {
        response = await handleFeedbackReports(request, env);

      // ── POST / → OpenAI 프록시 (기존) ──────────────────────────
      } else if (request.method === 'POST' && pathname === '/') {
        response = await handleOpenAIProxy(request, env);

      } else {
        response = new Response(JSON.stringify({ error: 'Not Found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    } catch (err) {
      console.error('[Worker]', err);
      response = new Response(JSON.stringify({ error: 'Internal Server Error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return withCors(response, origin);
  },
};

// ── OpenAI API 프록시 (기존 로직 유지) ──────────────────────────────

async function handleOpenAIProxy(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response('Bad Request: invalid JSON', { status: 400 });
  }

  const allowedModels = ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'];
  if (!allowedModels.includes(body.model)) {
    return new Response('Bad Request: model not allowed', { status: 400 });
  }

  const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  return new Response(openaiRes.body, {
    status: openaiRes.status,
    headers: {
      'Content-Type': openaiRes.headers.get('Content-Type') || 'application/json',
    },
  });
}

// deploy-trigger-20260307
