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
  const researchRows = submissions.map(buildStudentChapterMetrics);
  const productiveStruggleAvg = averageOf(researchRows, 'productive_struggle_index');
  const hintDependencyAvg = averageOf(researchRows, 'hint_dependency_index');
  const reflectionQualityAvg = averageOf(researchRows, 'reflection_quality_index');
  const persistenceAvg = averageOf(researchRows, 'persistence_index');

  return {
    totalSubmissions: n,
    avgScore,
    riskStudentCount,
    topWeakConcept,
    chapterBreakdown,
    avgHintRequests,
    partialRate,
    productiveStruggleAvg,
    hintDependencyAvg,
    reflectionQualityAvg,
    persistenceAvg,
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

export function buildResearchExport(submissions, reflections = []) {
  const reflectionMap = Object.fromEntries(
    reflections.map((item) => [makeStudentChapterKey(item.student_id, item.chapter_id), item]),
  );

  const studentChapterRows = submissions.map((submission) => {
    const reflection = reflectionMap[makeStudentChapterKey(submission.student_id, submission.chapter_id)] || null;
    return buildStudentChapterMetrics(submission, reflection);
  });

  const attemptRows = submissions.flatMap((submission) => buildAttemptRows(submission));
  const reflectionRows = reflections.map((reflection) => {
    const key = makeStudentChapterKey(reflection.student_id, reflection.chapter_id);
    const linkedSubmission = submissions.find((item) => makeStudentChapterKey(item.student_id, item.chapter_id) === key) || null;
    return buildReflectionMetrics(reflection, linkedSubmission);
  });

  const summary = {
    total_student_chapter_rows: studentChapterRows.length,
    total_attempt_rows: attemptRows.length,
    total_reflection_rows: reflectionRows.length,
    avg_score: averageOf(studentChapterRows, 'score'),
    avg_productive_struggle_index: averageOf(studentChapterRows, 'productive_struggle_index'),
    avg_hint_dependency_index: averageOf(studentChapterRows, 'hint_dependency_index'),
    avg_self_explanation_index: averageOf(studentChapterRows, 'self_explanation_index'),
    avg_misconception_repair_rate: averageOf(studentChapterRows, 'misconception_repair_rate'),
    avg_reflection_quality_index: averageOf(studentChapterRows, 'reflection_quality_index'),
    avg_persistence_index: averageOf(studentChapterRows, 'persistence_index'),
  };

  return {
    summary,
    studentChapterRows,
    attemptRows,
    reflectionRows,
  };
}

function buildStudentChapterMetrics(submission, reflection = null) {
  const metrics = submission?.chat_metrics || {};
  const trace = Array.isArray(submission?.assessment_trace) ? submission.assessment_trace : [];
  const totalQuestions = Number(submission?.total_count || trace.length || 0);
  const partialCount = trace.filter((item) => normalizeJudgment(item?.judgment) === 'partial').length;
  const incorrectCount = trace.filter((item) => normalizeJudgment(item?.judgment) === 'incorrect').length;
  const correctCount = trace.filter((item) => normalizeJudgment(item?.judgment) === 'correct').length;
  const hintCount = Number(metrics.hint_request_count || 0);
  const turnCount = Number(metrics.user_message_count || metrics.turn_count || 0);
  const avgUserLen = Number(metrics.average_user_message_length || 0);
  const blockedCount = Number(metrics.blocked_learning_question_count || 0);
  const weakConcepts = Array.isArray(submission?.weak_concepts) ? submission.weak_concepts : [];
  const reflectionMetrics = reflection ? buildReflectionMetrics(reflection, submission) : null;

  const productiveStruggleIndex = clampIndex(
    ((partialCount + correctCount) / Math.max(totalQuestions, 1)) * 45
    + Math.min(hintCount, 4) * 5
    + (avgUserLen >= 40 ? 15 : avgUserLen >= 20 ? 8 : 0)
    - Math.min(blockedCount, 3) * 8,
  );

  const hintDependencyIndex = clampIndex(
    (hintCount / Math.max(totalQuestions, 1)) * 45
    + (incorrectCount / Math.max(totalQuestions, 1)) * 35
    + (blockedCount * 10),
  );

  const selfExplanationIndex = clampIndex(
    (avgUserLen >= 80 ? 35 : avgUserLen >= 40 ? 22 : avgUserLen >= 20 ? 10 : 0)
    + lexicalSelfExplanationScore(submission?.messages || []) * 10
    + (partialCount > 0 ? 15 : 0),
  );

  const misconceptionRepairRate = round1(
    totalQuestions
      ? ((partialCount + correctCount) / totalQuestions) * 100
      : 0,
  );

  const reflectionQualityIndex = reflectionMetrics?.reflection_quality_index ?? 0;
  const persistenceIndex = clampIndex(
    (submission?.score ?? 0) * 0.4
    + Math.min(turnCount, 8) * 5
    + (reflection ? 15 : 0)
    + (totalQuestions > 0 ? (trace.length / totalQuestions) * 20 : 0),
  );

  return {
    student_id: String(submission?.student_id || ''),
    student_name: String(submission?.student_name || ''),
    chapter_id: String(submission?.chapter_id || ''),
    session_id: String(submission?.session_id || ''),
    submitted_at: String(submission?.submitted_at || ''),
    score: Number(submission?.score || 0),
    correct_count: Number(submission?.correct_count || 0),
    total_count: totalQuestions,
    turn_count: turnCount,
    hint_count: hintCount,
    avg_user_len: avgUserLen,
    blocked_question_count: blockedCount,
    partial_rate: round1(totalQuestions ? (partialCount / totalQuestions) * 100 : 0),
    productive_struggle_index: productiveStruggleIndex,
    hint_dependency_index: hintDependencyIndex,
    self_explanation_index: selfExplanationIndex,
    misconception_repair_rate: misconceptionRepairRate,
    reflection_submitted: reflection ? 1 : 0,
    reflection_quality_index: reflectionQualityIndex,
    persistence_index: persistenceIndex,
    weak_concepts_count: weakConcepts.length,
    weak_concepts: weakConcepts.join('|'),
  };
}

function buildAttemptRows(submission) {
  const trace = Array.isArray(submission?.assessment_trace) ? submission.assessment_trace : [];
  return trace.map((item, index) => {
    const hints = Array.isArray(item?.hints_used)
      ? item.hints_used.length
      : Number(item?.hint_count || item?.hint_requests || 0);
    const answer = String(
      item?.student_answer
      || item?.answer
      || item?.response
      || item?.last_user_message
      || '',
    );
    return {
      student_id: String(submission?.student_id || ''),
      student_name: String(submission?.student_name || ''),
      chapter_id: String(submission?.chapter_id || ''),
      session_id: String(submission?.session_id || ''),
      question_order: index + 1,
      question_id: String(item?.question_id || `${submission?.chapter_id || ''}-${index + 1}`),
      concept: String(item?.concept || item?.focus_concept || ''),
      question_text: String(item?.question || item?.prompt || ''),
      judgment: normalizeJudgment(item?.judgment),
      advance: item?.advance ? 1 : 0,
      next_action: String(item?.next_action || ''),
      hint_count: hints,
      attempt_count: Number(item?.attempt_count || item?.attempts || 1),
      answer_length: answer.length,
      timestamp: String(item?.timestamp || submission?.submitted_at || ''),
    };
  });
}

function buildReflectionMetrics(reflection, submission = null) {
  const answers = Array.isArray(reflection?.answers) ? reflection.answers.map((value) => String(value || '')) : [];
  const q1 = answers[0] || '';
  const q2 = answers[1] || '';
  const q3 = answers[2] || '';
  const goalSetting = hasAny(q1, ['목표', '이해', '학습', '도달', '익히']);
  const strategyUse = hasAny(q1 + q3, ['복습', '반복', '정리', '연습', '노트', '질문']);
  const errorAwareness = hasAny(q2, ['헷갈', '실수', '오답', '부족', '틀']);
  const actionPlan = calcKeywordScore(q3, ['계획', '실천', '다음', '복습', '연습', '시간', '매일', '주', '문제']) >= 2;
  const transferPlan = hasAny(q3, ['다음 장', '다른 문제', '응용', '적용', '다음에는']);
  const conceptReferenceCount = countConceptReferences(q2, submission?.weak_concepts || []);
  const reflectionQualityIndex = clampIndex(
    (goalSetting ? 20 : 0)
    + (strategyUse ? 20 : 0)
    + (errorAwareness ? 20 : 0)
    + (actionPlan ? 25 : 0)
    + (transferPlan ? 15 : 0),
  );

  return {
    student_id: String(reflection?.student_id || ''),
    student_name: String(reflection?.student_name || ''),
    chapter_id: String(reflection?.chapter_id || ''),
    saved_at: String(reflection?.saved_at || ''),
    is_deleted: reflection?.is_deleted ? 1 : 0,
    q1_goal_setting: goalSetting ? 1 : 0,
    q1_strategy_use: strategyUse ? 1 : 0,
    q2_error_awareness: errorAwareness ? 1 : 0,
    q2_concept_reference_count: conceptReferenceCount,
    q3_action_plan: actionPlan ? 1 : 0,
    q3_transfer_plan: transferPlan ? 1 : 0,
    reflection_quality_index: reflectionQualityIndex,
    linked_score: Number(submission?.score || 0),
    linked_weak_concepts: Array.isArray(submission?.weak_concepts) ? submission.weak_concepts.join('|') : '',
    q1_text: q1,
    q2_text: q2,
    q3_text: q3,
  };
}

function normalizeJudgment(value) {
  const text = String(value || '').trim().toLowerCase();
  if (text === 'partial') return 'partial';
  if (text === 'correct') return 'correct';
  return 'incorrect';
}

function lexicalSelfExplanationScore(messages = []) {
  const userTexts = Array.isArray(messages)
    ? messages
      .filter((item) => String(item?.role || '') === 'user')
      .map((item) => String(item?.content || ''))
    : [];
  if (!userTexts.length) return 0;
  const joined = userTexts.join(' ');
  return calcKeywordScore(joined, ['왜', '왜냐', '즉', '따라서', '왜 그런지', '의미', '차이', '설명']);
}

function countConceptReferences(text, concepts = []) {
  const source = String(text || '');
  const validConcepts = Array.isArray(concepts) ? concepts : [];
  if (!source || !validConcepts.length) return 0;
  return validConcepts.reduce((count, concept) => (
    source.includes(String(concept || '')) ? count + 1 : count
  ), 0);
}

function hasAny(text, keywords) {
  const source = String(text || '');
  return keywords.some((keyword) => source.includes(keyword));
}

function calcKeywordScore(text, keywords) {
  const source = String(text || '');
  return keywords.reduce((score, keyword) => (
    source.includes(keyword) ? score + 1 : score
  ), 0);
}

function makeStudentChapterKey(studentId, chapterId) {
  return `${String(studentId || '')}::${String(chapterId || '')}`;
}

function clampIndex(value) {
  return Math.max(0, Math.min(100, round1(value)));
}

function round1(value) {
  const num = Number(value || 0);
  return Math.round(num * 10) / 10;
}

function averageOf(rows, key) {
  if (!Array.isArray(rows) || rows.length === 0) return 0;
  return round1(rows.reduce((sum, row) => sum + Number(row?.[key] || 0), 0) / rows.length);
}
