// ??? Cloudflare Worker ??OpenAI API ?꾨줉?????
// 諛고룷: wrangler deploy
// ?섍꼍蹂?? OPENAI_API_KEY (wrangler secret put OPENAI_API_KEY)

const ALLOWED_ORIGINS = [
  'https://ldgit99.github.io',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'http://localhost:8000',
];

function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : '*';
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

    // ?덉슜??紐⑤뜽留??듦낵
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

    // ?ㅽ듃由щ컢 / ???ㅽ듃由щ컢 紐⑤몢 ?⑥뒪?ㅻ（
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

