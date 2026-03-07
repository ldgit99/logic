/**
 * apiClient.js
 * Worker API와의 통신을 담당하는 클라이언트 유틸리티
 */

const WORKER_BASE_URLS = [
  'https://logic-proxy.dongkuklee99.workers.dev',
  'https://logic-proxy.ldgit99.workers.dev',
];

let _token = null;

export function setToken(token) {
  _token = token;
}

export function clearToken() {
  _token = null;
}

function getAuthHeaders() {
  return {
    'Content-Type': 'application/json',
    ...((_token) ? { Authorization: `Bearer ${_token}` } : {}),
  };
}

/**
 * Worker에 GET 요청을 보낸다. 여러 URL을 순차 시도한다.
 * @param {string} path  예: '/dashboard/summary'
 * @param {Record<string,string>} [params] 쿼리 파라미터
 */
export async function apiGet(path, params = {}) {
  const query = new URLSearchParams(params).toString();
  const suffix = query ? `${path}?${query}` : path;
  let lastError;

  for (const base of WORKER_BASE_URLS) {
    try {
      const res = await fetch(`${base}${suffix}`, {
        method: 'GET',
        headers: getAuthHeaders(),
      });

      if (res.status === 401) throw new ApiError(401, '인증 실패');
      if (res.status === 403) throw new ApiError(403, '권한 없음');
      if (!res.ok) {
        const text = await res.text();
        throw new ApiError(res.status, text);
      }

      return await res.json();
    } catch (err) {
      if (err instanceof ApiError) throw err;
      lastError = err;
    }
  }

  throw lastError || new Error('API 요청 실패');
}

/**
 * Worker에 POST 요청을 보낸다.
 * @param {string} path
 * @param {object} body
 */
export async function apiPost(path, body) {
  let lastError;

  for (const base of WORKER_BASE_URLS) {
    try {
      const res = await fetch(`${base}${path}`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(body),
      });

      if (res.status === 401) throw new ApiError(401, '인증 실패');
      if (res.status === 403) throw new ApiError(403, '권한 없음');
      if (!res.ok) {
        const text = await res.text();
        throw new ApiError(res.status, text);
      }

      const text = await res.text();
      return text ? JSON.parse(text) : null;
    } catch (err) {
      if (err instanceof ApiError) throw err;
      lastError = err;
    }
  }

  throw lastError || new Error('API 요청 실패');
}

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// ── 대시보드 전용 API 함수 ─────────────────────────────────────

/**
 * 인증 검증 (토큰 유효성 확인)
 * @param {string} token
 */
export async function verifyToken(token) {
  setToken(token);
  try {
    await apiGet('/dashboard/summary', { chapter: '', limit: '1' });
    return true;
  } catch (err) {
    clearToken();
    if (err instanceof ApiError && err.status === 401) return false;
    throw err;
  }
}

/**
 * 요약 데이터 조회
 * @param {{ chapter?: string, from?: string, to?: string, studentId?: string }} filters
 */
export async function fetchSummary(filters = {}) {
  return apiGet('/dashboard/summary', cleanParams(filters));
}

/**
 * 학생 목록(제출 결과) 조회
 */
export async function fetchStudents(filters = {}) {
  return apiGet('/dashboard/students', cleanParams(filters));
}

/**
 * 개념별 취약도 조회
 */
export async function fetchConcepts(filters = {}) {
  return apiGet('/dashboard/concepts', cleanParams(filters));
}

/**
 * 개입 우선순위 큐 조회
 */
export async function fetchInterventions(filters = {}) {
  return apiGet('/dashboard/interventions', cleanParams(filters));
}

function cleanParams(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined && v !== null && v !== '') out[k] = String(v);
  }
  return out;
}
