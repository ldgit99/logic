/**
 * routes/assessments.js
 * POST /assessment — 형성평가 결과 저장 (C2 태스크)
 *
 * KV 키 설계:
 *   assessment:{student_id}:{chapter_id}:{session_id}  → 최신 결과 덮어쓰기
 *   assessmentidx:{submitted_at}:{student_id}:{chapter_id}  → 시간 순 목록
 *
 * 이메일 발송:
 *   body.student_email 이 있고 env.RESEND_API_KEY 가 설정된 경우 자동 발송
 *   설정: wrangler secret put RESEND_API_KEY
 *         wrangler secret put EMAIL_FROM  (예: 논리회로 <noreply@yourdomain.com>)
 */

import { validateAssessment } from '../services/storage.js';

export async function handleAssessments(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'invalid JSON' }, 400);
  }

  const error = validateAssessment(body);
  if (error) return jsonResponse({ error }, 400);

  const key = `assessment:${body.student_id}:${body.chapter_id}:${body.session_id}`;
  const value = JSON.stringify({ ...body, _savedAt: new Date().toISOString() });
  await env.SUBMISSIONS.put(key, value, { expirationTtl: 15552000 });

  // 시간 순 인덱스 (전체 목록 조회용)
  const ts = body.submitted_at || new Date().toISOString();
  const idxKey = `assessmentidx:${ts}:${body.student_id}:${body.chapter_id}`;
  await env.SUBMISSIONS.put(idxKey, key, { expirationTtl: 15552000 });

  // 이메일 발송: 가입 프로필에서 이메일 자동 조회 (실패해도 201 반환)
  if (env.RESEND_API_KEY) {
    (async () => {
      try {
        const userRaw = await env.SUBMISSIONS.get(`auth:user:${body.student_id}`);
        const studentEmail = userRaw ? (JSON.parse(userRaw).email || '') : '';
        if (studentEmail) {
          await sendFeedbackEmail(env, { ...body, student_email: studentEmail });
        }
      } catch (e) {
        console.error('[email]', e);
      }
    })();
  }

  return jsonResponse({ ok: true }, 201);
}

// ── 이메일 발송 (Resend API) ──────────────────────────────────

async function sendFeedbackEmail(env, body) {
  const studentName = body.student_name || '학생';
  const chapterTitle = body.chapter_title || `Ch.${body.chapter_id}`;
  const score = body.score ?? '-';
  const correct = body.correct_count ?? '-';
  const total = body.total_count ?? '-';
  const weakConcepts = (body.weak_concepts || []);
  const feedUp = body.feed_up || '';
  const feedBack = body.feed_back || '';
  const feedForward = body.feed_forward || '';
  const submittedAt = body.submitted_at
    ? new Date(body.submitted_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
    : '';

  const scoreColor = score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#ef4444';

  const weakHtml = weakConcepts.length
    ? `<ul style="margin:6px 0 0 16px;padding:0;">${weakConcepts.map((w) => `<li style="margin-bottom:4px;">${escHtml(w)}</li>`).join('')}</ul>`
    : '<p style="margin:4px 0;color:#6b7280;">없음</p>';

  const html = `
<!DOCTYPE html>
<html lang="ko">
<head><meta charset="UTF-8"><title>형성평가 피드백</title></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:'Apple SD Gothic Neo','Malgun Gothic',sans-serif;">
  <div style="max-width:600px;margin:32px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">

    <div style="background:#2563eb;padding:24px 28px;">
      <h1 style="margin:0;color:#fff;font-size:18px;">디지털 논리회로 — 형성평가 피드백</h1>
      <p style="margin:4px 0 0;color:#bfdbfe;font-size:13px;">${escHtml(chapterTitle)}</p>
    </div>

    <div style="padding:24px 28px;">
      <p style="margin:0 0 16px;font-size:14px;">안녕하세요, <strong>${escHtml(studentName)}</strong>님!</p>
      <p style="margin:0 0 20px;font-size:14px;color:#374151;">
        ${escHtml(chapterTitle)} 형성평가가 완료되었습니다. 아래에서 AI 피드백을 확인하세요.
      </p>

      <!-- 점수 -->
      <div style="background:#f9fafb;border-radius:8px;padding:16px;margin-bottom:20px;text-align:center;">
        <div style="font-size:13px;color:#6b7280;margin-bottom:4px;">최종 점수</div>
        <div style="font-size:36px;font-weight:700;color:${scoreColor};">${score}점</div>
        <div style="font-size:13px;color:#6b7280;">${correct} / ${total} 정답</div>
        ${submittedAt ? `<div style="font-size:11px;color:#9ca3af;margin-top:4px;">제출: ${escHtml(submittedAt)}</div>` : ''}
      </div>

      <!-- Feed Up -->
      ${feedUp ? `
      <div style="margin-bottom:16px;">
        <h3 style="margin:0 0 6px;font-size:14px;font-weight:700;color:#111827;">Feed Up — 학습 목표</h3>
        <p style="margin:0;font-size:13px;line-height:1.6;color:#374151;white-space:pre-wrap;">${escHtml(feedUp)}</p>
      </div>` : ''}

      <!-- Feed Back -->
      ${feedBack ? `
      <div style="margin-bottom:16px;padding:14px;background:#eff6ff;border-left:4px solid #2563eb;border-radius:4px;">
        <h3 style="margin:0 0 6px;font-size:14px;font-weight:700;color:#1e40af;">Feed Back — 현재 이해도</h3>
        <p style="margin:0;font-size:13px;line-height:1.6;color:#1e3a8a;white-space:pre-wrap;">${escHtml(feedBack)}</p>
      </div>` : ''}

      <!-- Feed Forward -->
      ${feedForward ? `
      <div style="margin-bottom:16px;padding:14px;background:#f0fdf4;border-left:4px solid #10b981;border-radius:4px;">
        <h3 style="margin:0 0 6px;font-size:14px;font-weight:700;color:#065f46;">Feed Forward — 다음 학습 방향</h3>
        <p style="margin:0;font-size:13px;line-height:1.6;color:#064e3b;white-space:pre-wrap;">${escHtml(feedForward)}</p>
      </div>` : ''}

      <!-- 취약개념 -->
      <div style="margin-bottom:16px;">
        <h3 style="margin:0 0 6px;font-size:14px;font-weight:700;color:#111827;">취약개념</h3>
        ${weakHtml}
      </div>
    </div>

    <div style="padding:16px 28px;background:#f9fafb;border-top:1px solid #e5e7eb;font-size:12px;color:#9ca3af;">
      본 메일은 디지털 논리회로 학습 시스템에서 자동 발송되었습니다.
    </div>
  </div>
</body>
</html>`;

  const from = env.EMAIL_FROM || 'noreply@resend.dev';
  const subject = `[논리회로] ${chapterTitle} 형성평가 피드백 — ${score}점`;

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [body.student_email],
      subject,
      html,
    }),
  });
}

function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
