/**
 * services/auth.js
 * Bearer ?좏겙 寃利?諛???븷 湲곕컲 ?묎렐 ?쒖뼱 (C6 ?쒖뒪??
 *
 * ?섍꼍蹂??
 *   DASHBOARD_TOKEN  ??援먯닔???좏겙 (wrangler secret put DASHBOARD_TOKEN)
 *   TA_TOKEN         ??議곌탳???좏겙 (?좏깮)
 *   ADMIN_TOKEN      ???댁쁺???좏겙 (?좏깮)
 *
 * ??븷蹂??묎렐 踰붿쐞:
 *   professor : /dashboard/* ?꾩껜 議고쉶 媛??
 *   ta        : /dashboard/summary, /dashboard/students 議고쉶 媛??
 *   admin     : /dashboard/* + 媛먯궗濡쒓렇 議고쉶 媛??
 */

const ROLE_PERMISSIONS = {
  professor: ['/dashboard/summary', '/dashboard/students', '/dashboard/concepts', '/dashboard/interventions', '/dashboard/roster', '/dashboard/members'],
  ta:        ['/dashboard/summary', '/dashboard/students', '/dashboard/roster'],
  admin:     ['/dashboard/summary', '/dashboard/students', '/dashboard/concepts', '/dashboard/interventions', '/dashboard/audit', '/dashboard/roster', '/dashboard/members'],
};

/**
 * Authorization ?ㅻ뜑?먯꽌 Bearer ?좏겙??異붿텧?쒕떎.
 */
function extractToken(request) {
  const header = request.headers.get('Authorization') || '';
  if (!header.startsWith('Bearer ')) return null;
  return header.slice(7).trim();
}

/**
 * ?좏겙??寃利앺븯怨???븷??諛섑솚?쒕떎.
 * @returns {'professor'|'ta'|'admin'|null}
 */
function resolveRole(token, env) {
  if (!token) return null;
  if (env.DASHBOARD_TOKEN && token === env.DASHBOARD_TOKEN) return 'professor';
  if (env.TA_TOKEN && token === env.TA_TOKEN) return 'ta';
  if (env.ADMIN_TOKEN && token === env.ADMIN_TOKEN) return 'admin';
  return null;
}

/**
 * ?붿껌???몄쬆?쒕떎. ?ㅽ뙣 ??Response瑜?諛섑솚?섍퀬, ?깃났 ??null??諛섑솚?쒕떎.
 * @param {Request} request
 * @param {object} env
 * @param {string} pathname  ?묎렐?섎젮??寃쎈줈
 * @returns {Response|null}  Response: ?몄쬆 ?ㅽ뙣 / null: ?몄쬆 ?깃났
 */
export function authenticate(request, env, pathname) {
  const token = extractToken(request);
  const role = resolveRole(token, env);

  if (!role) {
    return new Response(JSON.stringify({ error: '?몄쬆 ?ㅽ뙣' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const allowed = ROLE_PERMISSIONS[role] || [];
  const hasAccess = allowed.some((p) => pathname.startsWith(p));

  if (!hasAccess) {
    return new Response(JSON.stringify({ error: '沅뚰븳 ?놁쓬' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return null; // ?몄쬆 ?깃났
}
