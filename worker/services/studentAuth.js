const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days
const PBKDF2_ITERATIONS = 100000;

function userKey(studentId) {
  return `auth:user:${studentId}`;
}

function sessionKey(tokenHash) {
  return `auth:sess:${tokenHash}`;
}

function toBase64(bytes) {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function fromBase64(text) {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function randomBytes(length = 16) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

function randomToken() {
  const bytes = randomBytes(32);
  return toBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export async function sha256Hex(input) {
  const enc = new TextEncoder();
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(String(input)));
  const arr = Array.from(new Uint8Array(digest));
  return arr.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function hashPassword(password, saltB64) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: fromBase64(saltB64),
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    key,
    256,
  );
  return toBase64(new Uint8Array(bits));
}

export async function getUserByStudentId(env, studentId) {
  const raw = await env.SUBMISSIONS.get(userKey(studentId));
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function createUser(env, { studentId, studentName, password, email }) {
  const exists = await getUserByStudentId(env, studentId);
  if (exists) return { error: 'USER_EXISTS' };

  const salt = toBase64(randomBytes(16));
  const passwordHash = await hashPassword(password, salt);
  const user = {
    student_id: studentId,
    student_name: studentName,
    salt,
    password_hash: passwordHash,
    email: String(email || ''),
    created_at: new Date().toISOString(),
  };

  await env.SUBMISSIONS.put(userKey(studentId), JSON.stringify(user));
  return { user };
}

export async function verifyUser(env, { studentId, password }) {
  const user = await getUserByStudentId(env, studentId);
  if (!user) return null;
  const computed = await hashPassword(password, user.salt);
  if (computed !== user.password_hash) return null;
  return user;
}

export async function createSession(env, user) {
  const token = randomToken();
  const tokenHash = await sha256Hex(token);
  const now = Date.now();
  const expiresAt = new Date(now + SESSION_TTL_SECONDS * 1000).toISOString();

  const session = {
    student_id: user.student_id,
    student_name: user.student_name,
    created_at: new Date(now).toISOString(),
    expires_at: expiresAt,
  };

  await env.SUBMISSIONS.put(sessionKey(tokenHash), JSON.stringify(session), {
    expirationTtl: SESSION_TTL_SECONDS,
  });

  return { token, session };
}

export async function getSessionByToken(env, token) {
  if (!token) return null;
  const tokenHash = await sha256Hex(token);
  const raw = await env.SUBMISSIONS.get(sessionKey(tokenHash));
  if (!raw) return null;
  try {
    const session = JSON.parse(raw);
    if (!session?.student_id || !session?.student_name) return null;
    return { tokenHash, session };
  } catch {
    return null;
  }
}

export async function revokeSession(env, token) {
  if (!token) return;
  const tokenHash = await sha256Hex(token);
  await env.SUBMISSIONS.delete(sessionKey(tokenHash));
}