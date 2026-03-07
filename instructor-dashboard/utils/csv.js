/**
 * utils/csv.js
 * 제출 목록을 CSV로 내보내기 (순수 클라이언트, 라이브러리 불필요)
 */

const COLUMNS = [
  { key: (s) => s.student_id || s.studentId || '', label: '학번' },
  { key: (s) => s.student_name || s.studentName || '', label: '이름' },
  { key: (s) => s.chapter_id || s.chapterId || '', label: '챕터' },
  { key: (s) => s.score ?? '', label: '점수' },
  { key: (s) => s.correctCount || s.correct_count || '', label: '정답수' },
  { key: (s) => s.totalCount || s.total_count || '', label: '총문항' },
  { key: (s) => (s.weakConcepts || s.weak_concepts || []).join(' / '), label: '취약개념' },
  { key: (s) => s.submitted_at || s.submittedAt || s.timestamp || '', label: '제출시간' },
];

/**
 * @param {object[]} submissions
 */
export function exportCSV(submissions) {
  const header = COLUMNS.map((c) => `"${c.label}"`).join(',');
  const rows = submissions.map((s) =>
    COLUMNS.map((c) => {
      const val = String(c.key(s)).replace(/"/g, '""');
      return `"${val}"`;
    }).join(',')
  );

  const bom = '\uFEFF'; // UTF-8 BOM (한글 엑셀 호환)
  const csv = bom + [header, ...rows].join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const now = new Date();
  const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const filename = `논리회로_형성평가_${dateStr}.csv`;

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
