/**
 * worker.js Cloudflare Worker entry
 */

import { handleEvents } from './routes/events.js';
import { handleAssessments } from './routes/assessments.js';
import { handleFeedbackReports } from './routes/feedbackReports.js';
import { handleDashboard } from './routes/dashboard.js';
import { handleStudentAuth } from './routes/studentAuth.js';
import { handleSessions } from './routes/sessions.js';
import { handleReflections } from './routes/reflections.js';
import { authenticate } from './services/auth.js';

const ALLOWED_ORIGINS = [
  'https://ldgit99.github.io',
  'https://logic.dongkuklee99.workers.dev',
  'https://logic-proxy.dongkuklee99.workers.dev',
  'https://logic-proxy.ldgit99.workers.dev',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'http://localhost:8000',
];

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept, Origin',
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

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    let response;

    try {
      if (pathname.startsWith('/auth/')) {
        response = await handleStudentAuth(request, env, pathname);
      } else if (pathname.startsWith('/sessions/')) {
        response = await handleSessions(request, env, pathname, url);
      } else if (request.method === 'GET' && pathname === '/sessions/latest') {
        response = await handleSessions(request, env, pathname, url);
      } else if ((request.method === 'GET' || request.method === 'POST') && pathname.startsWith('/dashboard/')) {
        const authError = authenticate(request, env, pathname);
        if (authError) return withCors(authError, origin);
        response = await handleDashboard(request, env, pathname);
      } else if (request.method === 'GET' && pathname === '/locks') {
        const raw = await env.SUBMISSIONS.get('config:chapter_locks').catch(() => null);
        const locks = raw ? JSON.parse(raw) : {};
        response = new Response(JSON.stringify({ locks }), {
          headers: { 'Content-Type': 'application/json' },
        });
      } else if (request.method === 'GET' && pathname.startsWith('/questions/')) {
        const chapterId = pathname.split('/')[2];
        const raw = await env.SUBMISSIONS.get(`config:questions:${chapterId}`).catch(() => null);
        const questions = raw ? JSON.parse(raw) : null;
        response = new Response(JSON.stringify({ questions }), {
          headers: { 'Content-Type': 'application/json' },
        });
      } else if (request.method === 'POST' && pathname === '/reflections') {
        response = await handleReflections(request, env);
      } else if (request.method === 'POST' && pathname === '/events') {
        response = await handleEvents(request, env);
      } else if (request.method === 'POST' && pathname === '/assessment') {
        response = await handleAssessments(request, env);
      } else if (request.method === 'POST' && pathname === '/feedback-report') {
        response = await handleFeedbackReports(request, env);
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
