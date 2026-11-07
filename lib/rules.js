// 규칙 분류기. 낱말은 data/practice.json 에서만 뽑는다.
//
// 1. 연습 문장의 어절 앞부분(minLen글자 이상)을 낱말 후보로 본다. '일정을', '일정이' → '일정'
// 2. 어떤 라벨의 문장 minDocs개 이상에 나오고, 그 낱말이 나온 문장 중 minRatio 이상이 그 라벨이면
//    그 라벨의 단서 낱말로 삼는다
// 3. 새 문장에 들어 있는 단서 낱말 개수가 가장 많은 라벨을 고른다
//    - 칸: 단서가 없으면 criteria.json 순서 1번. 점수가 같으면 순서가 앞선 칸, 같은 점수의 다른 칸은 다른칸후보
//    - 긴급도: 높음·낮음 단서만 뽑는다. 어느 쪽도 많지 않으면 보통 (데이터명세: 보통은 기본값)
//    - 감정: 좋음·나쁨 단서만 뽑는다. 어느 쪽도 많지 않으면 기타
// minLen · minDocs · minRatio 는 scripts/tune-rules.js 가 practice.json 으로 재서 lib/rule-params.js 에 적는다.
import { CATEGORIES } from './labels.js';
import { loadJson } from './data.js';
import PARAMS from './rule-params.js';

export const DIMENSIONS = {
  칸: { learn: CATEGORIES, fallback: null },
  긴급도: { learn: ['높음', '낮음'], fallback: '보통' },
  감정: { learn: ['좋음', '나쁨'], fallback: '기타' },
};

const SPLIT = /[\s.,!?~·…"'()[\]{}:;/]+/;

export function features(text, minLen) {
  const out = new Set();
  for (const t of text.toLowerCase().split(SPLIT)) {
    for (let n = minLen; n <= t.length; n++) out.add(t.slice(0, n));
  }
  return out;
}

export function learnKeywords(rows, field, labels, { minLen, minDocs, minRatio }) {
  const df = new Map();
  for (const r of rows) {
    for (const f of features(r.문장, minLen)) {
      if (!df.has(f)) df.set(f, new Map());
      const m = df.get(f);
      m.set(r[field], (m.get(r[field]) || 0) + 1);
    }
  }
  const out = Object.fromEntries(labels.map((l) => [l, []]));
  for (const [f, m] of df) {
    const total = [...m.values()].reduce((a, b) => a + b, 0);
    for (const l of labels) {
      const n = m.get(l) || 0;
      if (n >= minDocs && n / total >= minRatio) out[l].push(f);
    }
  }
  // '일정'과 '일정이'가 둘 다 뽑히면 짧은 쪽만 남긴다 (같은 낱말 이중 계산 방지)
  for (const l of labels) {
    const set = new Set(out[l]);
    out[l] = out[l].filter((f) => {
      for (let n = minLen; n < f.length; n++) if (set.has(f.slice(0, n))) return false;
      return true;
    });
  }
  return out;
}

export function buildModel(rows, params) {
  const model = {};
  for (const [field, dim] of Object.entries(DIMENSIONS)) {
    const p = params[field];
    model[field] = { params: p, keywords: learnKeywords(rows, field, dim.learn, p) };
  }
  return model;
}

function rank(text, field, m) {
  const feats = features(text, m.params.minLen);
  return DIMENSIONS[field].learn
    .map((label, order) => {
      const words = m.keywords[label].filter((k) => feats.has(k));
      return { label, order, score: words.length, words };
    })
    .sort((a, b) => b.score - a.score || a.order - b.order);
}

export function predictField(model, field, text) {
  const ranked = rank(text, field, model[field]);
  const [first, second] = ranked;
  const fallback = DIMENSIONS[field].fallback;
  if (first.score === 0) {
    return { label: fallback ?? first.label, alt: null, words: [], why: fallback ? 'none' : 'none-order' };
  }
  if (fallback && second.score === first.score) {
    return { label: fallback, alt: null, words: [...first.words, ...second.words], why: 'tie' };
  }
  const alt = !fallback && second.score === first.score ? second.label : null;
  return { label: first.label, alt, words: first.words, altWords: alt ? second.words : [], why: 'words' };
}

const quote = (words) => words.map((w) => `‘${w}’`).join(', ');

function reasonFor(field, r) {
  if (r.why === 'none-order') return `단서 낱말이 없어 criteria.json 순서 1번 ${r.label}`;
  if (r.why === 'none') return `단서 낱말이 없어 ${r.label}(기본값)`;
  if (r.why === 'tie') return `${quote(r.words)} 단서가 양쪽으로 비겨서 ${r.label}`;
  let s = `${quote(r.words)} → ${r.label}`;
  if (r.alt) s += ` (${quote(r.altWords)} 때문에 ${r.alt}도 같은 점수)`;
  return s;
}

let runtimeModel = null;
function getModel() {
  if (!runtimeModel) runtimeModel = buildModel(loadJson('data/practice.json'), PARAMS.chosen);
  return runtimeModel;
}

export function classifyRules(text, model) {
  // Array.map(classifyRules)처럼 불려도 두 번째 인자(번호)를 모델로 착각하지 않게 한다
  if (!model || typeof model !== 'object') model = getModel();
  const c = predictField(model, '칸', text);
  const u = predictField(model, '긴급도', text);
  const e = predictField(model, '감정', text);
  return {
    칸: c.label,
    다른칸후보: c.alt,
    긴급도: u.label,
    감정: e.label,
    이유: `칸: ${reasonFor('칸', c)} / 긴급도: ${reasonFor('긴급도', u)} / 감정: ${reasonFor('감정', e)}`,
  };
}
