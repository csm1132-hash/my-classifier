# 요청 문장 분류기

사내 요청 문장을 **칸 · 긴급도**(+ 감정)로 나누는 연습용 분류기. 기준은 [데이터명세.md](데이터명세.md)와 [criteria.json](criteria.json), 프로젝트 약속은 [CLAUDE.md](CLAUDE.md).

- 문장을 넣으면 **규칙 분류기**와 **Gemini**의 결과(판단 이유, 다른칸후보 포함)를 나란히 보여 준다
- 보내기 전에 브라우저에서 이름 · 전화번호 · 사번을 가린다 (`public/mask.js`)
- 결과는 화면에서 고쳐 볼 수 있다 (저장하지 않음)
- 정답 30문장(`data/answer.json`)으로 두 분류기의 정확도를 참고용으로 보여 준다
- 입력 문장은 저장하지 않는다

## 폴더

| 경로 | 내용 |
|---|---|
| `public/` | 화면 (index.html, app.js, mask.js, style.css). Vercel이 이 폴더만 공개한다 |
| `api/classify.js` | 문장 분류 (규칙 + Gemini) |
| `api/answers.js` | 정답 30문장 + 규칙 결과 |
| `lib/rules.js` | 규칙 분류기. 낱말은 `data/practice.json`에서만 뽑는다 |
| `lib/rule-params.js` | 규칙 파라미터와 잰 조건 (`npm run tune:rules`가 만듦) |
| `lib/gemini.js` | Gemini 호출, 프롬프트, 고를 수 있는 모델 목록 |
| `data/`, `criteria.json` | 서버 함수만 읽고 링크로는 공개되지 않는다 |

## 로컬에서 보기

Node.js 20 이상, 설치할 패키지 없음. Gemini 키는 **파일에 두지 않고** 실행하는 터미널에서만 넣는다.

```powershell
$env:GEMINI_API_KEY="키"     # 이 터미널 창에서만 유효. 창을 닫으면 사라진다
npm.cmd run dev              # http://localhost:3000  (키를 안 넣으면 규칙 결과만 나옴)
```

```powershell
npm.cmd run tune:rules       # practice.json으로 규칙 파라미터를 다시 잰다
npm.cmd run eval:rules       # 정답 30문장으로 규칙을 채점 (-v: 틀린 문장 목록)
```

## Vercel에 올리기

1. 이 폴더를 GitHub 저장소로 올리고 Vercel에서 Import 한다 (또는 `npx vercel`)
2. Framework Preset은 **Other**, Build Command는 비워 둔다 (`vercel.json`에 설정되어 있음)
3. Project Settings → Environment Variables 에 `GEMINI_API_KEY` 추가 후 재배포

공개 링크라서 누구나 Gemini를 부를 수 있다. 서버에 IP당 호출 제한을 걸어 두었지만 서버 메모리 기준이라 완벽하지 않으니, Google 쪽에서 **예산 상한**을 꼭 걸어 둔다.
