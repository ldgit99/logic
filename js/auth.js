const AUTH_KEY = 'logic_auth_v2';

const WORKER_URLS = [
  'https://logic-proxy.dongkuklee99.workers.dev',
  'https://logic.dongkuklee99.workers.dev',
  ...(window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1') ? [window.location.origin] : []),
];

function getEl(id) {
  return document.getElementById(id);
}

function sanitize(value) {
  return String(value || '').trim();
}

function setError(message) {
  const el = getEl('login-error');
  if (!el) return;
  el.textContent = message || '';
  el.classList.toggle('hidden', !message);
}

function setBusy(isBusy) {
  const loginBtn = getEl('login-submit');
  const signupBtn = getEl('signup-submit');
  if (loginBtn) loginBtn.disabled = isBusy;
  if (signupBtn) signupBtn.disabled = isBusy;
}

function loadAuthRaw() {
  try {
    return JSON.parse(localStorage.getItem(AUTH_KEY) || 'null');
  } catch {
    return null;
  }
}

function saveAuth(profile) {
  try {
    localStorage.setItem(AUTH_KEY, JSON.stringify(profile));
  } catch {
    // ignore storage failure
  }
}

function clearAuth() {
  try {
    localStorage.removeItem(AUTH_KEY);
  } catch {
    // ignore storage failure
  }
}

function normalizeProfile(raw) {
  if (!raw) return null;
  const token = sanitize(raw.token);
  const studentId = sanitize(raw.studentId);
  const studentName = sanitize(raw.studentName);
  if (!token || !studentId || !studentName) return null;

  return { token, studentId, studentName };
}

function updateHeaderProfile(profile) {
  const label = getEl('auth-student-label');
  if (label) {
    label.textContent = profile ? `${profile.studentName} (${profile.studentId})` : '';
  }
}

function showLoginGate() {
  const gate = getEl('login-gate');
  if (gate) gate.classList.remove('hidden');
}

function hideLoginGate() {
  const gate = getEl('login-gate');
  if (gate) gate.classList.add('hidden');
}

function parseError(data, fallback) {
  if (!data) return fallback;
  if (typeof data.error === 'string' && data.error) return data.error;
  return fallback;
}

async function apiRequest(path, method = 'GET', body = null, token = '') {
  let lastErr = null;

  for (const base of WORKER_URLS) {
    try {
      const res = await fetch(`${base}${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      let data = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }

      if (!res.ok) {
        const e = new Error(parseError(data, `request failed: ${res.status}`));
        e.status = res.status;
        throw e;
      }

      return data;
    } catch (err) {
      lastErr = err;
    }
  }

  if (lastErr && String(lastErr.message || '').includes('Failed to fetch')) {
    throw new Error('네트워크/CORS 오류로 서버에 연결하지 못했습니다. 잠시 후 다시 시도하세요.');
  }
  throw lastErr || new Error('network error');
}

async function signup(studentName, studentId, password, email) {
  const data = await apiRequest('/auth/signup', 'POST', {
    student_name: studentName,
    student_id: studentId,
    password,
    email,
  });
  return {
    token: data.token,
    studentId: data.profile?.student_id || studentId,
    studentName: data.profile?.student_name || studentName,
  };
}

async function login(studentId, password) {
  const data = await apiRequest('/auth/login', 'POST', {
    student_id: studentId,
    password,
  });
  return {
    token: data.token,
    studentId: data.profile?.student_id || studentId,
    studentName: data.profile?.student_name || '',
  };
}

async function me(token) {
  const data = await apiRequest('/auth/me', 'GET', null, token);
  return {
    token,
    studentId: data.profile?.student_id || '',
    studentName: data.profile?.student_name || '',
  };
}

async function logout(token) {
  try {
    await apiRequest('/auth/logout', 'POST', {}, token);
  } catch {
    // ignore
  }
}

function getInputValues() {
  return {
    studentName: sanitize(getEl('login-name')?.value),
    studentId: sanitize(getEl('login-student-id')?.value),
    email: sanitize(getEl('login-email')?.value),
    password: String(getEl('login-password')?.value || ''),
    passwordConfirm: String(getEl('login-password-confirm')?.value || ''),
  };
}

function validateForSignup({ studentName, studentId, email, password, passwordConfirm }) {
  if (!studentName || !studentId || !email || !password) return '이름, 학번, 이메일, 비밀번호를 입력하세요.';
  if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)) return '유효한 이메일 형식을 입력하세요.';
  if (password.length < 8) return '비밀번호는 8자 이상이어야 합니다.';
  if (password !== passwordConfirm) return '비밀번호와 비밀번호 확인이 일치하지 않습니다.';
  return '';
}

function validateForLogin({ studentId, password }) {
  if (!studentId || !password) return '학번과 비밀번호를 입력하세요.';
  return '';
}

function bindLogoutOnce() {
  const btn = getEl('auth-logout');
  if (!btn || btn.dataset.bound === 'true') return;
  btn.dataset.bound = 'true';
  btn.addEventListener('click', async () => {
    const current = getStudentProfile();
    if (current?.token) await logout(current.token);
    clearAuth();
    location.reload();
  });
}

export function getStudentProfile() {
  return normalizeProfile(loadAuthRaw());
}

export async function initAuthGate() {
  bindLogoutOnce();

  const existing = getStudentProfile();
  if (existing?.token) {
    try {
      const verified = await me(existing.token);
      const normalized = normalizeProfile(verified);
      if (normalized) {
        saveAuth(normalized);
        updateHeaderProfile(normalized);
        hideLoginGate();
        return normalized;
      }
    } catch {
      clearAuth();
    }
  }

  showLoginGate();
  setError('');

  const nameInput = getEl('login-name');
  const idInput = getEl('login-student-id');
  const emailInput = getEl('login-email');
  const pwInput = getEl('login-password');
  const pwConfirmInput = getEl('login-password-confirm');
  const loginBtn = getEl('login-submit');
  const signupBtn = getEl('signup-submit');

  if (idInput) idInput.focus();

  return await new Promise((resolve) => {
    const completeAuth = (profile) => {
      const normalized = normalizeProfile(profile);
      if (!normalized) return;
      saveAuth(normalized);
      updateHeaderProfile(normalized);
      hideLoginGate();
      resolve(normalized);
    };

    const onLogin = async () => {
      const values = getInputValues();
      const invalid = validateForLogin(values);
      if (invalid) {
        setError(invalid);
        return;
      }

      setBusy(true);
      setError('');
      try {
        const profile = await login(values.studentId, values.password);
        completeAuth(profile);
      } catch (err) {
        setError(err?.message || '로그인에 실패했습니다.');
      } finally {
        setBusy(false);
      }
    };

    const onSignup = async () => {
      const values = getInputValues();
      const invalid = validateForSignup(values);
      if (invalid) {
        setError(invalid);
        return;
      }

      setBusy(true);
      setError('');
      try {
        const profile = await signup(values.studentName, values.studentId, values.password, values.email);
        completeAuth(profile);
      } catch (err) {
        setError(err?.message || '회원가입에 실패했습니다.');
      } finally {
        setBusy(false);
      }
    };

    loginBtn?.addEventListener('click', onLogin);
    signupBtn?.addEventListener('click', onSignup);

    const onKeyDown = (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      onLogin();
    };

    idInput?.addEventListener('keydown', onKeyDown);
    pwInput?.addEventListener('keydown', onKeyDown);
    pwConfirmInput?.addEventListener('keydown', onKeyDown);
    nameInput?.addEventListener('keydown', onKeyDown);
    emailInput?.addEventListener('keydown', onKeyDown);
  });
}