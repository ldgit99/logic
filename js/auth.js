const AUTH_KEY = 'logic_auth_v1';

function getEl(id) {
  return document.getElementById(id);
}

function sanitize(value) {
  return String(value || '').trim();
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
  const studentId = sanitize(raw.studentId);
  const studentName = sanitize(raw.studentName);
  if (!studentId || !studentName) return null;

  return {
    studentId,
    studentName,
  };
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

function bindLogoutOnce() {
  const btn = getEl('auth-logout');
  if (!btn || btn.dataset.bound === 'true') return;
  btn.dataset.bound = 'true';
  btn.addEventListener('click', () => {
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
  if (existing) {
    updateHeaderProfile(existing);
    hideLoginGate();
    return existing;
  }

  showLoginGate();

  const nameInput = getEl('login-name');
  const idInput = getEl('login-student-id');
  const startBtn = getEl('login-start');

  if (nameInput) nameInput.focus();

  return await new Promise((resolve) => {
    const submit = () => {
      const studentName = sanitize(nameInput?.value);
      const studentId = sanitize(idInput?.value);

      if (!studentName || !studentId) return;

      const profile = { studentId, studentName };
      saveAuth(profile);
      updateHeaderProfile(profile);
      hideLoginGate();
      resolve(profile);
    };

    startBtn?.addEventListener('click', submit, { once: true });

    const onKeyDown = (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      submit();
      if (getStudentProfile()) {
        nameInput?.removeEventListener('keydown', onKeyDown);
        idInput?.removeEventListener('keydown', onKeyDown);
      }
    };

    nameInput?.addEventListener('keydown', onKeyDown);
    idInput?.addEventListener('keydown', onKeyDown);
  });
}