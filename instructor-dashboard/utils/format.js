/**
 * utils/format.js
 * 공통 포맷 유틸리티
 */

export function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function formatDate(isoStr) {
  if (!isoStr) return '-';
  try {
    const d = new Date(isoStr);
    return d.toLocaleString('ko-KR', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  } catch {
    return isoStr;
  }
}

/**
 * 점수에 따른 CSS 클래스 반환
 */
export function scoreColor(score) {
  const n = Number(score);
  if (isNaN(n)) return '';
  if (n >= 80) return 'score-good';
  if (n >= 60) return 'score-warn';
  return 'score-bad';
}

/**
 * 위험점수에 따른 레벨 반환
 * @returns {{ cls: 'high'|'medium'|'low', label: string }}
 */
export function riskLevel(score) {
  const n = Number(score);
  if (isNaN(n)) return { cls: 'low', label: '정상' };
  if (n >= 70) return { cls: 'high', label: '위험' };
  if (n >= 40) return { cls: 'medium', label: '주의' };
  return { cls: 'low', label: '정상' };
}
