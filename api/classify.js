// POST /api/classify  { sentences: string[], model?: string, useGemini?: boolean }
//   → { rule: 결과[], gemini: 결과[] | null, geminiError: string | null, model }
// GET  /api/classify  → 고를 수 있는 모델 목록
// 입력 문장은 저장하지 않는다.
import { classifyRules } from '../lib/rules.js';
import { classifyGemini, MODELS, DEFAULT_MODEL } from '../lib/gemini.js';
import { allowGeminiCall } from '../lib/ratelimit.js';
import { MAX_SENTENCES, MAX_LENGTH } from '../lib/labels.js';

function fail(status, message) {
  return Response.json({ error: message }, { status });
}

export function GET() {
  return Response.json({
    models: MODELS,
    defaultModel: DEFAULT_MODEL,
    geminiReady: Boolean(process.env.GEMINI_API_KEY),
  });
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return fail(400, '요청 형식이 JSON이 아닙니다');
  }

  const raw = Array.isArray(body?.sentences) ? body.sentences : [];
  const sentences = raw.map((s) => String(s ?? '').trim());
  if (sentences.length === 0 || sentences.some((s) => !s)) return fail(400, '분류할 문장을 입력해 주세요');
  if (sentences.length > MAX_SENTENCES) return fail(400, `한 번에 ${MAX_SENTENCES}문장까지만 분류할 수 있습니다`);
  if (sentences.some((s) => s.length > MAX_LENGTH)) return fail(400, `문장은 ${MAX_LENGTH}자까지만 넣을 수 있습니다`);

  const model = body.model || DEFAULT_MODEL;
  if (!MODELS.some((m) => m.id === model)) return fail(400, '고를 수 없는 모델입니다');

  const rule = sentences.map(classifyRules);

  let gemini = null;
  let geminiError = null;
  if (body.useGemini !== false) {
    const apiKey = process.env.GEMINI_API_KEY;
    const ip = (request.headers.get('x-forwarded-for') || 'local').split(',')[0].trim();
    if (!apiKey) {
      geminiError = '서버에 GEMINI_API_KEY가 설정되지 않아 Gemini 분류를 건너뛰었습니다';
    } else if (!allowGeminiCall(ip)) {
      geminiError = '짧은 시간에 요청이 너무 많습니다. 10분쯤 뒤에 다시 시도해 주세요';
    } else {
      try {
        gemini = await classifyGemini(sentences, model, apiKey);
      } catch (e) {
        geminiError = e.message;
      }
    }
  }

  return Response.json({ rule, gemini, geminiError, model });
}
