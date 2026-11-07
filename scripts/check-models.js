// 고를 수 있는 Gemini 모델(lib/gemini.js의 MODELS)이 지금 이 키로 실제로 답하는지 하나씩 점검한다.
// 자동 전환 없이 모델마다 짧은 문장 1개를 한 번씩 보낸다 (모델당 호출 1번).
// 키는 파일에서 읽지 않는다. 실행하는 터미널에서만 넣는다.
//   PowerShell:  $env:GEMINI_API_KEY="키"; npm.cmd run check:models
import { MODELS, classifyGemini } from '../lib/gemini.js';

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.log('GEMINI_API_KEY가 없습니다. 이 터미널에서 $env:GEMINI_API_KEY="키" 를 먼저 입력하세요.');
  process.exit(1);
}

const SENTENCE = '평가 보드 언제 와? 다음주 월요일부터 평가 시작인데';
console.log(`점검일 ${new Date().toISOString().slice(0, 10)} · 모델 ${MODELS.length}개 · 모델당 1회 · 문장 "${SENTENCE}"\n`);

let okCount = 0;
for (const m of MODELS) {
  const t0 = Date.now();
  try {
    const [r] = await classifyGemini([SENTENCE], m.id, apiKey);
    const sec = ((Date.now() - t0) / 1000).toFixed(1);
    if (r) {
      okCount++;
      console.log(`✅ ${m.id.padEnd(24)} ${sec}초  → ${r.칸} / ${r.긴급도} / ${r.감정}`);
    } else {
      console.log(`⚠️ ${m.id.padEnd(24)} ${sec}초  → 응답은 왔지만 답이 비어 있음`);
    }
  } catch (e) {
    const sec = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`❌ ${m.id.padEnd(24)} ${sec}초  → ${e.message}`);
  }
}
console.log(`\n바로 쓸 수 있는 모델: ${okCount}/${MODELS.length}`);
