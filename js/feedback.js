const LOCAL_ORIGIN_WITH_SLASH = window.location.origin.endsWith('/') ? window.location.origin : `${window.location.origin}/`;

const WORKER_URLS = [
  'https://logic-proxy.dongkuklee99.workers.dev/',
  'https://logic.dongkuklee99.workers.dev/',
  ...(window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1') ? [LOCAL_ORIGIN_WITH_SLASH] : []),
];

export async function generateFeedback(chapterData, messages, snapshot = {}) {
  let lastError = null;

  for (const url of WORKER_URLS) {
    try {
      const base = url.endsWith('/') ? url.slice(0, -1) : url;
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('feedback timeout')), 30000));
      const res = await Promise.race([
        fetch(`${base}/chat/feedback`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chapter: chapterData,
            messages,
            memorySummary: snapshot.memorySummary || {},
            chatMetrics: snapshot.qualityMetrics || {},
            assessmentTrace: snapshot.assessmentTrace || [],
            totalQuestions: chapterData.formativeAssessment?.totalQuestions ?? 0,
          }),
        }),
        timeoutPromise,
      ]);

      if (!res.ok) throw new Error(`Feedback API error ${res.status}: ${await res.text()}`);

      const data = await res.json();
      const content = data?.choices?.[0]?.message?.content;
      if (!content) throw new Error('Empty feedback response');
      return JSON.parse(content);
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error('Feedback generation failed');
}
