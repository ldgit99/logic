/**
 * services/analytics.js
 * 집계 계산 — Summary, 개입 위험점수, 오개념 취약도 (C5 태스크)
 *
 * 지표 계산 규칙 (plan-instructor.md §4):
 *   Bloom 성취율   = 해당 레벨 정답수 / 해당 레벨 총문항수
 *   오개념 취약도  = (오답 빈도 + 힌트 과다 + 재시도 과다) 가중 합
 *   개입 위험점수  = 반복오답률 + 힌트의존도 + 미완료세션비율 + 최근하락추세
 *   피드백 품질점수 = Feed Up/Back/Forward 존재 + 구체적 행동 지시 포함
 */

// ── Summary ───────────────────────────────────────────────────────

/**
 * @param {object[]} submissions
 * @returns {{ totalSubmissions, avgScore, riskStudentCount, topWeakConcept, chapterBreakdown[] }}
 */
export function calcSummary(submissions) {
  const n = submissions.length;
  if (n === 0) {
    return { totalSubmissions: 0, avgScore: null, riskStudentCount: 0, topWeakConcept: null, chapterBreakdown: [] };
  }

  const scoreSum = submissions.reduce((acc, s) => acc + (s.score ?? 0), 0);
  const avgScore = Math.round((scoreSum / n) * 10) / 10;

  // 위험 학생: 점수 < 60 또는 위험점수 >= 70
  const riskStudents = submissions.filter((s) => (s.score ?? 100) < 60);
  const riskStudentCount = new Set(riskStudents.map((s) => s.student_id)).size;

  // 최다 취약개념
  const conceptCount = {};
  for (const s of submissions) {
    for (const c of (s.weak_concepts || [])) {
      conceptCount[c] = (conceptCount[c] || 0) + 1;
    }
  }
  const topWeakConcept = Object.entries(conceptCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  // 챕터별 완료 수
  const chapterMap = {};
  for (const s of submissions) {
    const ch = s.chapter_id || '?';
    chapterMap[ch] = (chapterMap[ch] || 0) + 1;
  }
  const chapterBreakdown = Object.entries(chapterMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([chapterId, count]) => ({ chapterId, count }));

  return { totalSubmissions: n, avgScore, riskStudentCount, topWeakConcept, chapterBreakdown };
}

// ── 개입 위험점수 ─────────────────────────────────────────────────

/**
 * 학생별 개입 우선순위를 계산하여 위험점수 내림차순으로 반환한다.
 * @param {object[]} submissions
 * @returns {object[]} interventions 배열
 */
export function calcInterventions(submissions) {
  // 학생별 집계
  const studentMap = {};
  for (const s of submissions) {
    const id = s.student_id;
    if (!studentMap[id]) {
      studentMap[id] = {
        studentId: id,
        studentName: s.student_name,
        chapterId: s.chapter_id,
        scores: [],
        weakConceptsAll: [],
        lastSubmittedAt: s.submitted_at,
      };
    }
    const entry = studentMap[id];
    entry.scores.push(s.score ?? 0);
    entry.weakConceptsAll.push(...(s.weak_concepts || []));
    if ((s.submitted_at || '') > (entry.lastSubmittedAt || '')) {
      entry.lastSubmittedAt = s.submitted_at;
      entry.chapterId = s.chapter_id;
    }
  }

  return Object.values(studentMap)
    .map((entry) => {
      const riskScore = calcRiskScore(entry);
      const weakConcepts = dedupeTopN(entry.weakConceptsAll, 5);
      return { ...entry, riskScore, weakConcepts, weakConceptsAll: undefined };
    })
    .sort((a, b) => b.riskScore - a.riskScore);
}

function calcRiskScore(entry) {
  const { scores } = entry;
  if (scores.length === 0) return 0;

  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;

  // 반복 오답률 (40점 만점): 낮은 점수일수록 위험
  const failRate = scores.filter((s) => s < 60).length / scores.length;
  const failScore = Math.round(failRate * 40);

  // 최근 하락 추세 (20점 만점): 마지막 점수 < 이전 평균
  let trendScore = 0;
  if (scores.length >= 2) {
    const recent = scores[scores.length - 1];
    const prevAvg = scores.slice(0, -1).reduce((a, b) => a + b, 0) / (scores.length - 1);
    if (recent < prevAvg - 10) trendScore = 20;
    else if (recent < prevAvg) trendScore = 10;
  }

  // 평균 점수 기여 (40점 만점)
  const avgScore = Math.round(Math.max(0, (100 - avg) / 100 * 40));

  return Math.min(100, failScore + trendScore + avgScore);
}

// ── 오개념 취약도 ─────────────────────────────────────────────────

/**
 * 개념별 취약 학생 수 + 챕터 분포를 집계한다.
 * @param {object[]} submissions
 * @returns {object[]} concepts 배열 (count 내림차순)
 */
export function calcConcepts(submissions) {
  const conceptMap = {};

  for (const s of submissions) {
    const ch = s.chapter_id || '?';
    for (const concept of (s.weak_concepts || [])) {
      if (!conceptMap[concept]) {
        conceptMap[concept] = { concept, count: 0, students: new Set(), chapterMap: {} };
      }
      conceptMap[concept].count++;
      conceptMap[concept].students.add(s.student_id);
      conceptMap[concept].chapterMap[ch] = (conceptMap[concept].chapterMap[ch] || 0) + 1;
    }
  }

  return Object.values(conceptMap)
    .map((c) => ({
      concept: c.concept,
      count: c.students.size, // 학생 수 기준
      chapterBreakdown: Object.entries(c.chapterMap)
        .sort(([, a], [, b]) => b - a)
        .map(([chapterId, count]) => ({ chapterId, count })),
    }))
    .sort((a, b) => b.count - a.count);
}

// ── 유틸 ──────────────────────────────────────────────────────────

function dedupeTopN(arr, n) {
  const count = {};
  for (const item of arr) count[item] = (count[item] || 0) + 1;
  return Object.entries(count)
    .sort(([, a], [, b]) => b - a)
    .slice(0, n)
    .map(([k]) => k);
}
