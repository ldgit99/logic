/**
 * apiClient.js
 * Worker API????듭떊???대떦?섎뒗 ?대씪?댁뼵???좏떥由ы떚
 */

const ORIGIN = (typeof window !== 'undefined' && window.location?.origin) ? window.location.origin : '';
const isWorkerOrigin =
  typeof window !== 'undefined'
  && /(^|\.)workers\.dev$/i.test(window.location.hostname || '');

const WORKER_BASE_URLS = Array.from(new Set([
  'https://logic.dongkuklee99.workers.dev',
  'https://logic-proxy.dongkuklee99.workers.dev',
  'https://logic-proxy.ldgit99.workers.dev',
  ...(isWorkerOrigin ? [ORIGIN] : []),
].filter(Boolean)));

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
 * Worker??GET ?붿껌??蹂대궦?? ?щ윭 URL???쒖감 ?쒕룄?쒕떎.
 * @param {string} path  ?? '/dashboard/summary'
 * @param {Record<string,string>} [params] 荑쇰━ ?뚮씪誘명꽣
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

      if (res.status === 401) throw new ApiError(401, '?몄쬆 ?ㅽ뙣');
      if (res.status === 403) throw new ApiError(403, '沅뚰븳 ?놁쓬');
      if (!res.ok) {
        const text = await res.text();
        throw new ApiError(res.status, text);
      }

      return await res.json();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 404 || err.status >= 500) {
          lastError = err;
          continue;
        }
        throw err;
      }
      lastError = err;
    }
  }

  throw lastError || new Error('API ?붿껌 ?ㅽ뙣');
}

/**
 * Worker??POST ?붿껌??蹂대궦??
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

      if (res.status === 401) throw new ApiError(401, '?몄쬆 ?ㅽ뙣');
      if (res.status === 403) throw new ApiError(403, '沅뚰븳 ?놁쓬');
      if (!res.ok) {
        const text = await res.text();
        throw new ApiError(res.status, text);
      }

      const text = await res.text();
      return text ? JSON.parse(text) : null;
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 404 || err.status >= 500) {
          lastError = err;
          continue;
        }
        throw err;
      }
      lastError = err;
    }
  }

  throw lastError || new Error('API ?붿껌 ?ㅽ뙣');
}

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// ?? ??쒕낫???꾩슜 API ?⑥닔 ?????????????????????????????????????

/**
 * ?몄쬆 寃利?(?좏겙 ?좏슚???뺤씤)
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
 * ?붿빟 ?곗씠??議고쉶
 * @param {{ chapter?: string, from?: string, to?: string, studentId?: string }} filters
 */
export async function fetchSummary(filters = {}) {
  return apiGet('/dashboard/summary', cleanParams(filters));
}

/**
 * ?숈깮 紐⑸줉(?쒖텧 寃곌낵) 議고쉶
 */
export async function fetchStudents(filters = {}) {
  return apiGet('/dashboard/students', cleanParams(filters));
}

/**
 * 媛쒕뀗蹂?痍⑥빟??議고쉶
 */
export async function fetchConcepts(filters = {}) {
  return apiGet('/dashboard/concepts', cleanParams(filters));
}

/**
 * 媛쒖엯 ?곗꽑?쒖쐞 ??議고쉶
 */
export async function fetchInterventions(filters = {}) {
  return apiGet('/dashboard/interventions', cleanParams(filters));
}

/**
 * ?섍컯??紐낅떒 議고쉶 (媛???뺣낫 湲곕컲)
 */
export async function fetchRoster() {
  return apiGet('/dashboard/roster');
}

/**
 * Add student account from instructor dashboard.
 * @param {{ student_id: string, student_name: string, email?: string, password: string }} payload
 */
export async function addRosterMember(payload) {
  return apiPost('/dashboard/members/add', payload);
}

/**
 * Delete student account from instructor dashboard.
 * @param {string} studentId
 */
export async function deleteRosterMember(studentId) {
  return apiPost('/dashboard/members/delete', { student_id: studentId });
}

/**
 * 성찰일지 목록 조회
 * @param {{ chapter_id?: string, student_id?: string }} filters
 */
export async function fetchReflections(filters = {}) {
  return apiGet('/dashboard/reflections', cleanParams(filters));
}

/**
 * Soft-delete reflection record.
 * @param {{ student_id: string, chapter_id: string, reason?: string }} payload
 */
export async function deleteReflection(payload) {
  return apiPost('/dashboard/reflections/delete', payload);
}

/**
 * Restore soft-deleted reflection record.
 * @param {{ student_id: string, chapter_id: string }} payload
 */
export async function restoreReflection(payload) {
  return apiPost('/dashboard/reflections/restore', payload);
}

/**
 * Delete one formative-assessment submission from summary tab.
 * @param {{ student_id: string, chapter_id: string, session_id: string, submitted_at?: string }} payload
 */
export async function deleteSubmission(payload) {
  return apiPost('/dashboard/submissions/delete', payload);
}

/**
 * 챕터별 형성평가 문항 조회
 * @param {string} chapterId  예: '01', '02'
 */
export async function fetchQuestions(chapterId) {
  return apiGet(`/dashboard/questions/${chapterId}`);
}

/**
 * 챕터별 형성평가 문항 저장
 * @param {string} chapterId
 * @param {{ questions: Array }} data
 */
export async function saveQuestions(chapterId, data) {
  return apiPost(`/dashboard/questions/${chapterId}`, data);
}

/**
 * ?뱀젙 ?숈깮???꾩껜 ?쒖텧 ?대젰 議고쉶
 * @param {string} studentId
 */
export async function fetchStudentHistory(studentId) {
  return apiGet('/dashboard/students', cleanParams({ studentId }));
}

function cleanParams(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined && v !== null && v !== '') out[k] = String(v);
  }
  return out;
}

