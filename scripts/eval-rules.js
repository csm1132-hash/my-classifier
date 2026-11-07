// 규칙 분류기를 정답 30문장(data/answer.json)으로 채점하고, 잰 조건과 함께 출력한다.
// practice.json 은 규칙이 낱말을 뽑은 데이터라 여기서 채점하지 않는다 (연습 점수는 lib/rule-params.js 의 looHits).
// 실행: npm run eval:rules   (-v 를 붙이면 틀린 문장 목록)
import { classifyRules } from '../lib/rules.js';
import { loadJson } from '../lib/data.js';
import PARAMS from '../lib/rule-params.js';

const verbose = process.argv.includes('-v');
const FIELDS = ['칸', '긴급도', '감정'];
const rows = loadJson('data/answer.json');
const hit = { 칸: 0, 긴급도: 0, 감정: 0, 모두: 0 };

for (const r of rows) {
  const p = classifyRules(r.문장);
  const ok = FIELDS.filter((f) => p[f] === r[f]);
  for (const f of ok) hit[f]++;
  if (ok.length === 3) hit.모두++;
  if (verbose && ok.length < 3) {
    console.log(`${r.id} 정답 ${r.칸}/${r.긴급도}/${r.감정}  규칙 ${p.칸}/${p.긴급도}/${p.감정}`);
    console.log(`     ${r.문장}\n     ${p.이유}`);
  }
}

const n = rows.length;
const fmt = (k) => `${k} ${hit[k]}/${n} (${Math.round((hit[k] / n) * 100)}%)`;
console.log(`조건: 규칙 분류기, 낱말 출처 data/practice.json, 파라미터 측정일 ${PARAMS.measuredOn ?? '미측정'}, 채점일 ${new Date().toISOString().slice(0, 10)}, data/answer.json ${n}문장, 1회 (규칙은 매번 같은 결과)`);
console.log(['칸', '긴급도', '감정', '모두'].map(fmt).join('  '));
