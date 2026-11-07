// 규칙 분류기의 minLen · minDocs · minRatio 를 practice.json 만으로 정한다.
// 방법: leave-one-out — 연습 문장을 하나씩 빼고 나머지로 낱말을 뽑아 뺀 문장을 맞혀 본다.
//       칸 · 긴급도 · 감정 따로, 맞힌 개수가 가장 많은 조합을 고른다 (같으면 목록에서 먼저 나온 조합).
// answer.json 은 열지 않는다.
// 실행: npm run tune:rules  →  lib/rule-params.js 를 새로 쓴다.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadJson } from '../lib/data.js';
import { DIMENSIONS, learnKeywords, predictField } from '../lib/rules.js';

const GRID = {
  minLen: [1, 2, 3],
  minDocs: [1, 2, 3],
  minRatio: [0.5, 0.6, 0.7, 0.8, 0.9, 1.0],
};

const rows = loadJson('data/practice.json');

function looHits(field, p) {
  let hit = 0;
  for (let i = 0; i < rows.length; i++) {
    const train = rows.filter((_, j) => j !== i);
    const model = { [field]: { params: p, keywords: learnKeywords(train, field, DIMENSIONS[field].learn, p) } };
    if (predictField(model, field, rows[i].문장).label === rows[i][field]) hit++;
  }
  return hit;
}

const chosen = {};
const loo = {};
for (const field of Object.keys(DIMENSIONS)) {
  let best = null;
  for (const minLen of GRID.minLen)
    for (const minDocs of GRID.minDocs)
      for (const minRatio of GRID.minRatio) {
        const p = { minLen, minDocs, minRatio };
        const hits = looHits(field, p);
        if (!best || hits > best.hits) best = { p, hits };
      }
  chosen[field] = best.p;
  loo[field] = `${best.hits}/${rows.length}`;
  console.log(`${field}: ${JSON.stringify(best.p)}  leave-one-out ${best.hits}/${rows.length}`);
}

const out = {
  measuredOn: new Date().toISOString().slice(0, 10),
  data: `data/practice.json (${rows.length}문장)`,
  method: 'leave-one-out, 칸·긴급도·감정 따로, 맞힌 개수 최대 (같으면 목록에서 먼저 나온 조합)',
  grid: GRID,
  looHits: loo,
  chosen,
};
const file = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'lib', 'rule-params.js');
fs.writeFileSync(
  file,
  `// scripts/tune-rules.js 가 만든 파일. 손으로 고치지 말고 npm run tune:rules 로 다시 만든다.\nexport default ${JSON.stringify(out, null, 2)};\n`,
);
console.log(`→ ${path.relative(process.cwd(), file)}`);
