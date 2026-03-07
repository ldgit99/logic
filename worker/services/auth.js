/**
 * services/auth.js
 * Bearer 토큰 검증 및 역할 기반 접근 제어 (C6 태스크)
 *
 * 환경변수:
 *   DASHBOARD_TOKEN  — 교수용 토큰 (wrangler secret put DASHBOARD_TOKEN)
 *   TA_TOKEN         — 조교용 토큰 (선택)
 *   ADMIN_TOKEN      — 운영자 토큰 (선택)
 *
 * 역할별 접근 범위:
 *   professor : /dashboard/* 전체 조회 가능
 *   ta        : /dashboard/summary, /dashboard/students 조회 가능
 *   admin     : /dashboard/* + 감사로그 조회 가능
 */

const ROLE_PERMISSIONS = {
  professor: ['/dashboard/summary', '/dashboard/students', '/dashboard/concepts', '/dashboard/interventions'],
  ta:        ['/dashboard/summary', '/dashboard/students'],
  admin:     ['/dashboard/summary', '/dashboard/students', '/dashboard/concepts', '/dashboard/interventions', '/dashboard/audit'],
};

/**
 * Authorization 헤더에서 Bearer 토큰을 추출한다.
 */
function extractToken(request) {
  const header = request.headers.get('Authorization') || '';
  if (!header.startsWith('Bearer ')) return null;
  return header.slice(7).trim();
}

/**
 * 토큰을 검증하고 역할을 반환한다.
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
 * 요청을 인증한다. 실패 시 Response를 반환하고, 성공 시 null을 반환한다.
 * @param {Request} request
 * @param {object} env
 * @param {string} pathname  접근하려는 경로
 * @returns {Response|null}  Response: 인증 실패 / null: 인증 성공
 */
export function authenticate(request, env, pathname) {
  const token = extractToken(request);
  const role = resolveRole(token, env);

  if (!role) {
    return new Response(JSON.stringify({ error: '인증 실패' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const allowed = ROLE_PERMISSIONS[role] || [];
  const hasAccess = allowed.some((p) => pathname.startsWith(p));

  if (!hasAccess) {
    return new Response(JSON.stringify({ error: '권한 없음' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return null; // 인증 성공
}
