// 공개 링크라서 한 사람이 Gemini를 마구 부르지 못하게 막는 간단한 제한.
// 서버 인스턴스 메모리에만 기록하므로 완벽하지 않다. 실제 비용 상한은 Google 쪽 예산 설정으로 건다.
const WINDOW_MS = 10 * 60 * 1000;
const MAX_CALLS = 20;
const hits = new Map();

export function allowGeminiCall(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_CALLS) {
    hits.set(ip, recent);
    return false;
  }
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return true;
}
