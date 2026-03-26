/**
 * services/analytics.js
 * Aggregations for instructor dashboard.
 */

export function calcSummary(submissions) {
  const n = submissions.length;
  if (n === 0) {
    return {
      totalSubmissions: 0,
      avgScore: null,
      riskStudentCount: 0,
      topWeakConcept: null,
      chapterBreakdown: [],
      avgHintRequests: 0,
      partialRate: 0,
    };
  }

  const scoreSum = submissions.reduce((acc, submission) => acc + (submission.score ?? 0), 0);
  const avgScore = Math.round((scoreSum / n) * 10) / 10;

  const riskStudents = submissions.filter((submission) => (submission.score ?? 100) < 60);
  const riskStudentCount = new Set(riskStudents.map((submission) => submission.student_id)).size;

  const conceptCount = {};
  for (const submission of submissions) {
    for (const concept of (submission.weak_concepts || [])) {
      conceptCount[concept] = (conceptCount[concept] || 0) + 1;
    }
  }
  const topWeakConcept = Object.entries(conceptCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const chapterMap = {};
  for (const submission of submissions) {
    const chapterId = submission.chapter_id || '?';
    if (!chapterMap[chapterId]) chapterMap[chapterId] = { count: 0, scoreSum: 0 };
    chapterMap[chapterId].count += 1;
    chapterMap[chapterId].scoreSum += submission.score ?? 0;
  }
  const chapterBreakdown = Object.entries(chapterMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([chapterId, { count, scoreSum }]) => ({
      chapterId,
      count,
      avgScore: Math.round((scoreSum / count) * 10) / 10,
    }));

  const hintValues = submissions.map((submission) => Number(submission.chat_metrics?.hint_request_count || 0));
  const avgHintRequests = hintValues.length
    ? Math.round((hintValues.reduce((acc, value) => acc + value, 0) / hintValues.length) * 10) / 10
    : 0;

  const traces = submissions.flatMap((submission) => Array.isArray(submission.assessment_trace) ? submission.assessment_trace : []);
  const partialCount = traces.filter((item) => String(item?.judgment || '') === 'partial').length;
  const partialRate = traces.length ? Math.round((partialCount / traces.length) * 1000) / 10 : 0;

  return {
    totalSubmissions: n,
    avgScore,
    riskStudentCount,
    topWeakConcept,
    chapterBreakdown,
    avgHintRequests,
    partialRate,
  };
}

export function calcInterventions(submissions) {
  const studentMap = {};
  for (const submission of submissions) {
    const id = submission.student_id;
    if (!studentMap[id]) {
      studentMap[id] = {
        studentId: id,
        studentName: submission.student_name,
        chapterId: submission.chapter_id,
        scores: [],
        weakConceptsAll: [],
        lastSubmittedAt: submission.submitted_at,
        latestChatMetrics: submission.chat_metrics || {},
      };
    }
    const entry = studentMap[id];
    entry.scores.push(submission.score ?? 0);
    entry.weakConceptsAll.push(...(submission.weak_concepts || []));
    if ((submission.submitted_at || '') > (entry.lastSubmittedAt || '')) {
      entry.lastSubmittedAt = submission.submitted_at;
      entry.chapterId = submission.chapter_id;
      entry.latestChatMetrics = submission.chat_metrics || {};
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
  const failRate = scores.filter((score) => score < 60).length / scores.length;
  const failScore = Math.round(failRate * 40);

  let trendScore = 0;
  if (scores.length >= 2) {
    const recent = scores[scores.length - 1];
    const prevAvg = scores.slice(0, -1).reduce((a, b) => a + b, 0) / (scores.length - 1);
    if (recent < prevAvg - 10) trendScore = 20;
    else if (recent < prevAvg) trendScore = 10;
  }

  const avgScore = Math.round(Math.max(0, ((100 - avg) / 100) * 40));
  const latestMetrics = entry.latestChatMetrics || {};
  const hintPenalty = Math.min(20, Number(latestMetrics.hint_request_count || 0) * 2);
  const blockedPenalty = Math.min(10, Number(latestMetrics.blocked_learning_question_count || 0) * 2);

  return Math.min(100, failScore + trendScore + avgScore + hintPenalty + blockedPenalty);
}

export function calcConcepts(submissions) {
  const conceptMap = {};

  for (const submission of submissions) {
    const chapterId = submission.chapter_id || '?';
    for (const concept of (submission.weak_concepts || [])) {
      if (!conceptMap[concept]) {
        conceptMap[concept] = { concept, count: 0, students: new Set(), chapterMap: {} };
      }
      conceptMap[concept].count += 1;
      conceptMap[concept].students.add(submission.student_id);
      conceptMap[concept].chapterMap[chapterId] = (conceptMap[concept].chapterMap[chapterId] || 0) + 1;
    }
  }

  return Object.values(conceptMap)
    .map((item) => ({
      concept: item.concept,
      count: item.students.size,
      chapterBreakdown: Object.entries(item.chapterMap)
        .sort(([, a], [, b]) => b - a)
        .map(([chapterId, count]) => ({ chapterId, count })),
    }))
    .sort((a, b) => b.count - a.count);
}

function dedupeTopN(items, n) {
  const count = {};
  for (const item of items) count[item] = (count[item] || 0) + 1;
  return Object.entries(count)
    .sort(([, a], [, b]) => b - a)
    .slice(0, n)
    .map(([key]) => key);
}
