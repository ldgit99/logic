import { getSessionByToken } from '../services/studentAuth.js';
import {
  getLatestSessionForStudentChapter,
  getSessionScope,
  listSessionMessages,
} from '../services/storage.js';

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

async function requireStudentSession(request, env) {
  const token = readBearerToken(request);
  if (!token) return { error: json({ error: 'unauthorized' }, 401) };
  const found = await getSessionByToken(env, token);
  if (!found) return { error: json({ error: 'unauthorized' }, 401) };
  return { session: found.session };
}

export async function handleSessions(request, env, pathname, url) {
  if (request.method === 'GET' && pathname === '/sessions/latest') {
    const auth = await requireStudentSession(request, env);
    if (auth.error) return auth.error;

    const chapterId = String(url.searchParams.get('chapter_id') || '').trim();
    if (!chapterId) return json({ error: 'missing chapter_id' }, 400);

    const latest = await getLatestSessionForStudentChapter(env, auth.session.student_id, chapterId);
    return json({ session: latest || null });
  }

  const msgMatch = pathname.match(/^\/sessions\/([^/]+)\/messages$/);
  if (request.method === 'GET' && msgMatch) {
    const auth = await requireStudentSession(request, env);
    if (auth.error) return auth.error;

    const sessionId = decodeURIComponent(msgMatch[1] || '');
    if (!sessionId) return json({ error: 'invalid session_id' }, 400);

    const scope = await getSessionScope(env, sessionId);
    if (!scope) return json({ error: 'not found' }, 404);
    if (scope.student_id !== auth.session.student_id) {
      return json({ error: 'forbidden' }, 403);
    }

    const messages = await listSessionMessages(env, sessionId);
    return json({
      session_id: sessionId,
      chapter_id: scope.chapter_id,
      updated_at: scope.updated_at || '',
      messages,
    });
  }

  return json({ error: 'Not Found' }, 404);
}
