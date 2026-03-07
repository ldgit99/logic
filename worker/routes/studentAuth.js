import {
  createSession,
  createUser,
  getSessionByToken,
  revokeSession,
  verifyUser,
} from '../services/studentAuth.js';

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function readBearerToken(request) {
  const auth = request.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) return '';
  return auth.slice(7).trim();
}

function sanitize(value) {
  return String(value || '').trim();
}

function validateCredentials({ studentId, studentName, password, needName }) {
  if (!studentId || !password || (needName && !studentName)) {
    return 'missing required fields';
  }
  if (studentId.length < 4 || studentId.length > 32) return 'invalid student_id length';
  if (needName && (studentName.length < 2 || studentName.length > 30)) return 'invalid student_name length';
  if (password.length < 8 || password.length > 64) return 'invalid password length';
  return null;
}

export async function handleStudentAuth(request, env, pathname) {
  if (request.method === 'POST' && pathname === '/auth/signup') {
    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'invalid JSON' }, 400);
    }

    const studentId = sanitize(body.student_id);
    const studentName = sanitize(body.student_name);
    const password = String(body.password || '');

    const invalid = validateCredentials({ studentId, studentName, password, needName: true });
    if (invalid) return json({ error: invalid }, 400);

    const created = await createUser(env, { studentId, studentName, password });
    if (created.error === 'USER_EXISTS') return json({ error: 'student already exists' }, 409);

    const { token } = await createSession(env, created.user);
    return json({
      ok: true,
      token,
      profile: { student_id: created.user.student_id, student_name: created.user.student_name },
    }, 201);
  }

  if (request.method === 'POST' && pathname === '/auth/login') {
    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'invalid JSON' }, 400);
    }

    const studentId = sanitize(body.student_id);
    const password = String(body.password || '');

    const invalid = validateCredentials({ studentId, studentName: '', password, needName: false });
    if (invalid) return json({ error: invalid }, 400);

    const user = await verifyUser(env, { studentId, password });
    if (!user) return json({ error: 'invalid credentials' }, 401);

    const { token } = await createSession(env, user);
    return json({
      ok: true,
      token,
      profile: { student_id: user.student_id, student_name: user.student_name },
    });
  }

  if (request.method === 'GET' && pathname === '/auth/me') {
    const token = readBearerToken(request);
    const found = await getSessionByToken(env, token);
    if (!found) return json({ error: 'unauthorized' }, 401);

    return json({
      ok: true,
      profile: {
        student_id: found.session.student_id,
        student_name: found.session.student_name,
      },
    });
  }

  if (request.method === 'POST' && pathname === '/auth/logout') {
    const token = readBearerToken(request);
    if (token) await revokeSession(env, token);
    return json({ ok: true });
  }

  return json({ error: 'Not Found' }, 404);
}