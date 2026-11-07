// GET /api/answers → 정답 30문장과 각 문장의 규칙 분류 결과 (정확도 참고용)
import { loadJson } from '../lib/data.js';
import { classifyRules } from '../lib/rules.js';

export function GET() {
  const items = loadJson('data/answer.json').map((r) => ({
    id: r.id,
    문장: r.문장,
    정답: { 칸: r.칸, 긴급도: r.긴급도, 감정: r.감정 },
    rule: classifyRules(r.문장),
  }));
  return Response.json({ items });
}
