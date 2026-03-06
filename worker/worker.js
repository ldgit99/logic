// ─── Cloudflare Worker — OpenAI API 프록시 ───
// 배포: wrangler deploy
// 환경변수: OPENAI_API_KEY (wrangler secret put OPENAI_API_KEY)

const ALLOWED_ORIGINS = [
  'https://ldgit99.github.io',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'http://localhost:8000',
];

function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return new Response('Bad Request: invalid JSON', { status: 400 });
    }

    // 허용된 모델만 통과
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

    // 스트리밍 / 논-스트리밍 모두 패스스루
    const resHeaders = {
      ...corsHeaders(origin),
      'Content-Type': openaiRes.headers.get('Content-Type') || 'application/json',
    };

    return new Response(openaiRes.body, {
      status: openaiRes.status,
      headers: resHeaders,
    });
  },
};
