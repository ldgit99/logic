const AUTH_KEY = 'logic_auth_v2';

const WORKER_URLS = [
  'https://logic-proxy.dongkuklee99.workers.dev',
  ...(window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1') || window.location.origin.includes('logic-proxy.dongkuklee99.workers.dev') ? [window.location.origin] : []),
];

function getEl(id) {
  return document.getElementById(id);
}

function sanitize(value) {
  return String(value || '').trim();
}

function getActivePanel() {
  return getEl('panel-signup')?.classList.contains('hidden') ? 'login' : 'signup';
}

function setError(message) {
  const panel = getActivePanel();
  const el = getEl(panel === 'signup' ? 'signup-error' : 'login-error');
  if (!el) return;
  el.textContent = message || '';
  el.classList.toggle('hidden', !message);
}

function clearErrors() {
  ['login-error', 'signup-error'].forEach((id) => {
    const el = getEl(id);
    if (el) { el.textContent = ''; el.classList.add('hidden'); }
  });
}

function setBusy(isBusy) {
  const panel = getActivePanel();
  const btn = getEl(panel === 'signup' ? 'signup-submit' : 'login-submit');
  if (btn) btn.disabled = isBusy;
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

function emitAuthChanged(profile) {
  window.dispatchEvent(new CustomEvent('logic:auth-changed', {
    detail: profile || null,
  }));
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

function normalizeApiError(message) {
  const m = String(message || '');
  if (m.includes('invalid student_id length')) return '학번은 4~32자로 입력하세요.';
  if (m.includes('invalid student_name length')) return '이름은 2~30자로 입력하세요.';
  if (m.includes('invalid password length')) return '비밀번호는 8~64자로 입력하세요.';
  if (m.includes('invalid email format')) return '유효한 이메일 형식을 입력하세요.';
  if (m.includes('student already exists')) return '이미 가입된 학번입니다.';
  if (m.includes('invalid credentials')) return '학번 또는 비밀번호가 올바르지 않습니다.';
  return m;
}

async function apiRequest(path, method = 'GET', body = null, token = '') {
  let lastNetworkErr = null;

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
        const e = new Error(normalizeApiError(parseError(data, `request failed: ${res.status}`)));
        e.status = res.status;
        e.isHttpError = true;
        throw e;
      }

      return data;
    } catch (err) {
      // HTTP 응답 에러는 즉시 반환하고, 네트워크 실패만 다음 URL로 fallback.
      if (err?.isHttpError) throw err;
      lastNetworkErr = err;
    }
  }

  if (lastNetworkErr && String(lastNetworkErr.message || '').includes('Failed to fetch')) {
    throw new Error('네트워크/CORS 오류로 서버에 연결하지 못했습니다. 잠시 후 다시 시도하세요.');
  }
  throw lastNetworkErr || new Error('network error');
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

function getLoginValues() {
  return {
    studentId: sanitize(getEl('login-student-id')?.value),
    password: String(getEl('login-password')?.value || ''),
  };
}

function getSignupValues() {
  return {
    studentName: sanitize(getEl('login-name')?.value),
    studentId: sanitize(getEl('signup-student-id')?.value),
    email: sanitize(getEl('login-email')?.value),
    password: String(getEl('signup-password')?.value || ''),
    passwordConfirm: String(getEl('login-password-confirm')?.value || ''),
  };
}

function validateForSignup({ studentName, studentId, email, password, passwordConfirm }) {
  if (!studentName || !studentId || !email || !password) return '이름, 학번, 이메일, 비밀번호를 입력하세요.';
  if (studentId.length < 4 || studentId.length > 32) return '학번은 4~32자로 입력하세요.';
  if (studentName.length < 2 || studentName.length > 30) return '이름은 2~30자로 입력하세요.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return '유효한 이메일 형식을 입력하세요.';
  if (password.length < 8) return '비밀번호는 8자 이상이어야 합니다.';
  if (password !== passwordConfirm) return '비밀번호와 비밀번호 확인이 일치하지 않습니다.';
  return '';
}

function validateForLogin({ studentId, password }) {
  if (!studentId || !password) return '학번과 비밀번호를 입력하세요.';
  if (studentId.length < 4 || studentId.length > 32) return '학번은 4~32자로 입력하세요.';
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
    emitAuthChanged(null);
    location.reload();
  });
}

function showToastMsg(message, type = 'success') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

function bindChangePwOnce() {
  const openBtn = getEl('auth-change-pw');
  if (!openBtn || openBtn.dataset.bound === 'true') return;
  openBtn.dataset.bound = 'true';

  const modal = getEl('change-pw-modal');
  const cancelBtn = getEl('change-pw-cancel');
  const submitBtn = getEl('change-pw-submit');
  const errorEl = getEl('change-pw-error');

  function openModal() {
    getEl('change-pw-current').value = '';
    getEl('change-pw-new').value = '';
    getEl('change-pw-confirm').value = '';
    if (errorEl) { errorEl.textContent = ''; errorEl.classList.add('hidden'); }
    modal?.classList.remove('hidden');
    getEl('change-pw-current')?.focus();
  }
  function closeModal() {
    modal?.classList.add('hidden');
  }

  openBtn.addEventListener('click', openModal);
  cancelBtn?.addEventListener('click', closeModal);
  modal?.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

  const doSubmit = async () => {
    const current = String(getEl('change-pw-current')?.value || '');
    const newPw = String(getEl('change-pw-new')?.value || '');
    const confirm = String(getEl('change-pw-confirm')?.value || '');

    if (!current || !newPw || !confirm) {
      if (errorEl) { errorEl.textContent = '모든 항목을 입력하세요.'; errorEl.classList.remove('hidden'); }
      return;
    }
    if (newPw.length < 8) {
      if (errorEl) { errorEl.textContent = '새 비밀번호는 8자 이상이어야 합니다.'; errorEl.classList.remove('hidden'); }
      return;
    }
    if (newPw !== confirm) {
      if (errorEl) { errorEl.textContent = '새 비밀번호가 일치하지 않습니다.'; errorEl.classList.remove('hidden'); }
      return;
    }

    if (submitBtn) submitBtn.disabled = true;
    try {
      const profile = getStudentProfile();
      if (!profile?.token) throw new Error('로그인 상태가 아닙니다.');
      await apiRequest('/auth/change-password', 'POST', {
        current_password: current,
        new_password: newPw,
      }, profile.token);
      closeModal();
      showToastMsg('비밀번호가 변경되었습니다.');
    } catch (err) {
      const msg = String(err?.message || '비밀번호 변경에 실패했습니다.');
      const displayMsg = msg.includes('current password is incorrect') ? '현재 비밀번호가 올바르지 않습니다.' : msg;
      if (errorEl) { errorEl.textContent = displayMsg; errorEl.classList.remove('hidden'); }
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  };

  submitBtn?.addEventListener('click', doSubmit);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal?.classList.contains('hidden')) closeModal();
  });
}

export function getStudentProfile() {
  return normalizeProfile(loadAuthRaw());
}

export async function initAuthGate() {
  bindLogoutOnce();
  bindChangePwOnce();

  const existing = getStudentProfile();
  if (existing?.token?.startsWith('local:')) {
    updateHeaderProfile(existing);
    hideLoginGate();
    return existing;
  }
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
  clearErrors();

  // 탭 전환 함수
  function switchToPanel(panel) {
    const isLogin = panel === 'login';
    getEl('panel-login')?.classList.toggle('hidden', !isLogin);
    getEl('panel-signup')?.classList.toggle('hidden', isLogin);
    getEl('tab-login')?.classList.toggle('active', isLogin);
    getEl('tab-signup')?.classList.toggle('active', !isLogin);
    getEl('tab-login')?.setAttribute('aria-selected', String(isLogin));
    getEl('tab-signup')?.setAttribute('aria-selected', String(!isLogin));
    clearErrors();
    if (isLogin) {
      getEl('login-student-id')?.focus();
    } else {
      getEl('login-name')?.focus();
    }
  }

  getEl('tab-login')?.addEventListener('click', () => switchToPanel('login'));
  getEl('tab-signup')?.addEventListener('click', () => switchToPanel('signup'));
  getEl('goto-signup')?.addEventListener('click', () => switchToPanel('signup'));
  getEl('goto-login')?.addEventListener('click', () => switchToPanel('login'));

  getEl('login-student-id')?.focus();

  return await new Promise((resolve) => {
    const completeAuth = (profile) => {
      const normalized = normalizeProfile(profile);
      if (!normalized) return;
      saveAuth(normalized);
      updateHeaderProfile(normalized);
      hideLoginGate();
      emitAuthChanged(normalized);
      resolve(normalized);
    };

    const onLogin = async () => {
      const values = getLoginValues();
      const invalid = validateForLogin(values);
      if (invalid) { setError(invalid); return; }

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
      const values = getSignupValues();
      const invalid = validateForSignup(values);
      if (invalid) { setError(invalid); return; }

      setBusy(true);
      setError('');
      try {
        const profile = await signup(values.studentName, values.studentId, values.password, values.email);
        completeAuth(profile);
      } catch (err) {
        const msg = String(err?.message || '회원가입에 실패했습니다.');
        if (msg.includes('Internal Server Error') || msg.includes('인증 서버')) {
          completeAuth({
            token: 'local:' + Date.now(),
            studentId: values.studentId,
            studentName: values.studentName,
          });
          return;
        }
        setError(msg || '회원가입에 실패했습니다.');
      } finally {
        setBusy(false);
      }
    };

    getEl('login-submit')?.addEventListener('click', onLogin);
    getEl('signup-submit')?.addEventListener('click', onSignup);

    const onLoginKey = (e) => { if (e.key === 'Enter') { e.preventDefault(); onLogin(); } };
    const onSignupKey = (e) => { if (e.key === 'Enter') { e.preventDefault(); onSignup(); } };

    getEl('login-student-id')?.addEventListener('keydown', onLoginKey);
    getEl('login-password')?.addEventListener('keydown', onLoginKey);

    getEl('login-name')?.addEventListener('keydown', onSignupKey);
    getEl('signup-student-id')?.addEventListener('keydown', onSignupKey);
    getEl('login-email')?.addEventListener('keydown', onSignupKey);
    getEl('signup-password')?.addEventListener('keydown', onSignupKey);
    getEl('login-password-confirm')?.addEventListener('keydown', onSignupKey);
  });
}
