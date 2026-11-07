// Gemini 분류기. 명세 기준 + practice.json 예시를 프롬프트로 주고 JSON으로 답을 받는다.
// 정답 30문장(answer.json)은 프롬프트에 넣지 않는다. 넣으면 채점이 부풀기 때문.
import { CATEGORIES, URGENCIES, EMOTIONS } from './labels.js';
import { loadJson } from './data.js';

// 고를 수 있는 모델 목록. 지금은 저렴하고 한도가 넉넉한 Flash-Lite만 연다.
export const MODELS = [
  { id: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash-Lite (저렴 · 한도 넉넉)' },
];
export const DEFAULT_MODEL = MODELS[0].id;

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';
const TIMEOUT_MS = 60_000;

const SPEC = `너는 디스플레이 회로설계와 반도체(DDI·PMIC·TCON 등) 업무에서 오가는 사내 요청·상담 문장을 분류한다.
각 문장을 칸(요청 성격) · 긴급도 · 감정으로 분류하고, 판단 이유를 쓴다.

## 칸 (6개)
- 불량대응: 불량·고장·이상 현상의 원인 분석이나 조치를 요청한다
- 자료요청: 데이터·문서·시뮬레이션 결과·회로도 등 자료를 달라고 한다
- 일정납기: 일정·납기·출하·샘플 입고 시점을 묻거나 조정한다
- 사양변경: 스펙·회로·핀맵 등 설계를 바꿔 달라고 하거나 변경을 알린다
- 기술문의: 동작 원리·설계 방법·호환 여부 등을 묻는다
- 결과공유: 평가·분석·회의 결과를 알리거나 결과에 대한 반응(감사·불만)을 전한다
- 두 칸에 걸치는 문장은 상대가 최종적으로 해 달라는 일 기준으로 하나를 고르고, 다른 후보를 alt_category에 적는다. 걸치지 않으면 alt_category는 "없음".

## 긴급도 (3단계)
- 높음: 지금 일을 못 하거나 피해가 번진다
- 낮음: 문의 · 요청
- 보통: 높음·낮음에 해당하지 않는 나머지 전부 (기본값)
- 높음과 낮음 기준을 먼저 보고, 어느 쪽에도 해당하지 않으면 보통으로 둔다.

## 감정 (3가지)
- 좋음: 감사·만족·호의가 드러난다
- 나쁨: 불만·짜증·걱정·불신이 드러난다
- 기타: 중립이거나 감정이 드러나지 않는다
- 감정은 말하는 사람의 태도 기준이다. 결과가 좋은 소식이라도 담담하게 전하면 기타.

## 출력
- 입력 문장마다 결과 하나. idx는 입력 번호 그대로.
- reason은 한국어 1~2문장. 문장 속 어떤 표현을 근거로 칸·긴급도·감정을 골랐는지 쓴다.
- 문장에 반말·오타가 있어도 뜻으로 판단한다.`;

let systemText = null;
function getSystemText() {
  if (!systemText) {
    const examples = loadJson('data/practice.json')
      .map((r) => `- "${r.문장}" → 칸=${r.칸}, 다른칸후보=${r.다른칸후보 ?? '없음'}, 긴급도=${r.긴급도}, 감정=${r.감정}`)
      .join('\n');
    systemText = `${SPEC}\n\n## 예시 (연습 데이터)\n${examples}`;
  }
  return systemText;
}

const RESPONSE_SCHEMA = {
  type: 'ARRAY',
  items: {
    type: 'OBJECT',
    properties: {
      idx: { type: 'INTEGER' },
      category: { type: 'STRING', enum: CATEGORIES },
      alt_category: { type: 'STRING', enum: [...CATEGORIES, '없음'] },
      urgency: { type: 'STRING', enum: URGENCIES },
      emotion: { type: 'STRING', enum: EMOTIONS },
      reason: { type: 'STRING' },
    },
    required: ['idx', 'category', 'alt_category', 'urgency', 'emotion', 'reason'],
    propertyOrdering: ['idx', 'reason', 'category', 'alt_category', 'urgency', 'emotion'],
  },
};

// 문장 여러 개를 한 번의 호출로 분류한다 (30문장 채점도 호출 1번).
export async function classifyGemini(sentences, model, apiKey) {
  const userText =
    '다음 문장들을 분류해라.\n' + sentences.map((s, i) => `${i + 1}. ${s.replace(/\s+/g, ' ')}`).join('\n');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res;
  try {
    res = await fetch(`${ENDPOINT}/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: getSystemText() }] },
        contents: [{ role: 'user', parts: [{ text: userText }] }],
        generationConfig: { responseMimeType: 'application/json', responseSchema: RESPONSE_SCHEMA },
      }),
      signal: controller.signal,
    });
  } catch (e) {
    throw new Error(e.name === 'AbortError' ? 'Gemini 응답이 너무 늦어 중단했습니다' : `Gemini 연결 실패: ${e.message}`);
  } finally {
    clearTimeout(timer);
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = data?.error?.message || res.statusText;
    if (res.status === 429) throw new Error(`Gemini 사용 한도를 넘었습니다. 잠시 후 다시 시도해 주세요. (${msg})`);
    throw new Error(`Gemini 오류 ${res.status}: ${msg}`);
  }

  const text = (data?.candidates?.[0]?.content?.parts || [])
    .filter((p) => !p.thought && typeof p.text === 'string')
    .map((p) => p.text)
    .join('');
  let items;
  try {
    items = JSON.parse(text);
  } catch {
    const why = data?.candidates?.[0]?.finishReason || data?.promptFeedback?.blockReason || '알 수 없음';
    throw new Error(`Gemini 답을 읽지 못했습니다 (사유: ${why})`);
  }

  const byIdx = new Map(items.map((it) => [it.idx, it]));
  return sentences.map((_, i) => {
    const it = byIdx.get(i + 1);
    if (!it) return null;
    const alt = it.alt_category === '없음' || it.alt_category === it.category ? null : it.alt_category;
    return { 칸: it.category, 다른칸후보: alt, 긴급도: it.urgency, 감정: it.emotion, 이유: it.reason };
  });
}
