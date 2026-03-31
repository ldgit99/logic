function trim(text) {
  return String(text || '').trim();
}

function unique(items, limit = 8) {
  const seen = new Set();
  const out = [];
  for (const item of items || []) {
    const value = trim(item);
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
    if (out.length >= limit) break;
  }
  return out;
}

function buildKnowledgeBlocks(chapter = {}, concept = '') {
  const curated = Array.isArray(chapter.curatedKnowledge) ? chapter.curatedKnowledge : [];
  const notes = Array.isArray(chapter.teachingNotes) ? chapter.teachingNotes : [];
  const examples = Array.isArray(chapter.canonicalExamples) ? chapter.canonicalExamples : [];
  const misconceptions = Array.isArray(chapter.commonMisconceptions) ? chapter.commonMisconceptions : [];
  const blocks = unique([...curated, ...notes, ...examples, ...misconceptions], 12);
  if (!concept) return blocks.slice(0, 8).join('\n');
  const words = concept.split(/[,\s/]+/).map(trim).filter(Boolean);
  const filtered = blocks.filter((block) => words.some((word) => block.includes(word)));
  return (filtered.length ? filtered : blocks).slice(0, 6).join('\n');
}

function summaryText(summary = {}) {
  return [
    `이해한 개념: ${(summary.coveredConcepts || []).join(', ') || '없음'}`,
    `오개념: ${(summary.misconceptions || []).join(', ') || '없음'}`,
    `미해결 질문: ${(summary.pendingQuestions || []).join(' | ') || '없음'}`,
    `최근 학습 목표: ${summary.lastStudentGoal || '없음'}`,
    `최근 평가 결과: ${summary.lastAssessmentResult || '없음'}`,
  ].join('\n');
}

export function buildLearningMessages(body) {
  const chapter = body.chapter || {};
  const objectives = Array.isArray(chapter.objectives) ? chapter.objectives : [];
  const keyConcepts = Array.isArray(chapter.keyConcepts) ? chapter.keyConcepts : [];
  const transcript = Array.isArray(body.transcript)
    ? body.transcript.map((m) => `${m.role === 'user' ? '학생' : 'AI'}: ${trim(m.content)}`).join('\n')
    : '없음';

  const system = [
    `역할: "${chapter.title || '현재 챕터'}" 전담 AI 튜터.`,
    '규칙:',
    '- 한국어로 답한다.',
    '- 현재 챕터의 학습 목표와 지식 블록에 근거한 답만 한다.',
    '- 일반론보다 챕터 예시와 개념 연결을 우선한다.',
    '- 답변은 핵심 설명, 짧은 예시, 확인 질문 순서로 구성한다.',
    '- 반드시 JSON만 반환한다.',
    '{"answer":"string","question_type":"definition|comparison|procedure|example|other","memory_update":{"coveredConcepts":["string"],"misconceptions":["string"],"pendingQuestions":["string"],"lastStudentGoal":"string"}}',
  ].join('\n');

  const user = [
    `[챕터]\n${chapter.title || ''}`,
    `[학습목표]\n${objectives.join('\n') || '없음'}`,
    `[핵심 개념]\n${keyConcepts.join(', ') || '없음'}`,
    `[큐레이션 지식]\n${buildKnowledgeBlocks(chapter) || '없음'}`,
    `[메모리 요약]\n${summaryText(body.memorySummary || {})}`,
    `[최근 대화]\n${transcript || '없음'}`,
    `[학생 질문]\n${trim(body.user_input)}`,
  ].join('\n\n');

  return [{ role: 'system', content: system }, { role: 'user', content: user }];
}

export function buildAssessmentMessages(body) {
  const chapter = body.chapter || {};
  const question = body.question || {};
  const hints = Array.isArray(question.hints) ? question.hints : [];
  const isLast = Boolean(body.is_last_question);

  const system = [
    `역할: ${chapter.title || '현재 챕터'} 형성평가 채점자.`,
    '규칙:',
    '- 현재 한 문항만 평가한다.',
    '- 학생 답변은 모범답안과 문장 표현이 달라도 의미가 맞으면 정답으로 인정한다.',
    '- 주요 개념이나 핵심 원리가 분명히 언급되면 세부 표현, 용어 순서, 예시 차이, 문장 길이 때문에 감점하지 않는다.',
    '- 핵심 개념을 충족하면 기본적으로 correct로 판정한다.',
    '- partial은 일부만 맞았고 중요한 요소가 빠진 경우에만 사용한다.',
    '- 서술형 문항에서는 학생이 핵심 개념을 자신의 말로 설명해도 correct로 인정한다.',
    '- 계산형 문항도 최종 값이나 핵심 계산 원리가 맞으면 중간 표기가 조금 달라도 correct로 인정한다.',
    '- 틀린 부분이 조금 있더라도 맞게 언급한 핵심 개념이 더 중요하면 incorrect보다 correct를 우선 검토한다.',
    '- incorrect이고 남은 힌트가 있으면 advance=false, next_action="retry_same_question".',
    '- incorrect이고 힌트가 없으면 모범답안을 알려주고 advance=true.',
    '- correct 또는 partial이면 advance=true.',
    '- correct 또는 partial이면 weak_concept는 빈 문자열로 둔다.',
    '- feedback은 짧고 따뜻하게 작성하고, 정답이면 맞게 언급한 핵심 개념을 한 문장으로 짚어 준다.',
    '- 반드시 JSON만 반환한다.',
    `{"judgment":"correct|partial|incorrect","confidence":"high|medium|low","feedback":"string","hint":"string","model_answer":"string","weak_concept":"string","advance":true,"next_action":"${isLast ? 'finish_assessment' : 'next_question'}|retry_same_question","memory_update":{"coveredConcepts":["string"],"misconceptions":["string"],"pendingQuestions":["string"],"lastAssessmentResult":"string"}}`,
  ].join('\n');

  const user = [
    `[문항]\n${question.question || ''}`,
    `[개념]\n${question.concept || ''}`,
    `[Bloom]\n${question.bloomLevel || question.bloom || ''}`,
    `[모범답안]\n${question.keyAnswer || question.answer || ''}`,
    `[남은 힌트 수]\n${Math.max(0, Number(body.remaining_hints || 0))}`,
    `[사용 가능한 힌트]\n${hints.map((hint, index) => `${index + 1}. ${hint}`).join('\n') || '없음'}`,
    `[큐레이션 지식]\n${buildKnowledgeBlocks(chapter, question.concept || '') || '없음'}`,
    `[메모리 요약]\n${summaryText(body.memorySummary || {})}`,
    `[학생 답변]\n${trim(body.user_input)}`,
  ].join('\n\n');

  return [{ role: 'system', content: system }, { role: 'user', content: user }];
}

export function buildFeedbackMessages(body) {
  const chapter = body.chapter || {};
  const messages = Array.isArray(body.messages) ? body.messages : [];
  const summary = body.memorySummary || {};
  const metrics = body.chatMetrics || {};
  const chatLog = messages
    .filter((message) => message.role !== 'system')
    .map((message) => `[${message.role === 'user' ? '학생' : 'AI 튜터'}]\n${message.content}`)
    .join('\n\n---\n\n');

  const totalQuestions = Number(chapter.formativeAssessment?.totalQuestions || body.totalQuestions || 0);
  const system = [
    '역할: 디지털 논리회로 형성평가 결과를 검토하는 엄격한 교육 평가자.',
    '규칙:',
    '- 대화 로그, 큐레이션 지식, 세션 요약을 근거로 판단한다.',
    '- weakConcepts는 실제 취약 개념만 넣는다.',
    '- feedUp은 짧은 강점 칭찬, feedBack은 부족 개념과 근거, feedForward는 번호 목록 행동 지침으로 작성한다.',
    '- 반드시 JSON만 반환한다.',
    `{"correctCount":number,"totalCount":${totalQuestions},"score":number,"weakConcepts":["string"],"feedUp":"string","feedBack":"string","feedForward":"string","qualityMetrics":{"rubricCoverage":number,"actionableFeedForward":true,"hintDependency":number,"conversationGrounded":true}}`,
  ].join('\n');

  const user = [
    `[챕터]\n${chapter.title || ''}`,
    `[핵심 개념]\n${(chapter.keyConcepts || []).join(', ') || '없음'}`,
    `[큐레이션 지식]\n${buildKnowledgeBlocks(chapter) || '없음'}`,
    `[메모리 요약]\n${summaryText(summary)}`,
    `[행동 지표]\n총 사용자 발화 수: ${metrics.total_user_messages ?? 0}\n평균 사용자 발화 길이: ${metrics.average_user_message_length ?? 0}\n힌트 요청 수: ${metrics.hint_request_count ?? 0}\n평가 판정 수: ${metrics.assessment_evaluation_count ?? 0}\n부분정답 수: ${metrics.assessment_partial_count ?? 0}`,
    `[평가 trace]\n${JSON.stringify(body.assessmentTrace || [])}`,
    `[대화 로그]\n${chatLog || '없음'}`,
  ].join('\n\n');

  return [{ role: 'system', content: system }, { role: 'user', content: user }];
}
