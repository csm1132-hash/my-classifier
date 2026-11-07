const CATEGORIES = ['불량대응', '자료요청', '일정납기', '사양변경', '기술문의', '결과공유'];
const URGENCIES = ['높음', '보통', '낮음'];
const EMOTIONS = ['좋음', '나쁨', '기타'];
const FIELDS = ['칸', '긴급도', '감정'];

const $ = (sel) => document.querySelector(sel);

// 사용자 입력이 섞이므로 innerHTML 대신 요소를 직접 만든다.
function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') el.className = v;
    else if (v !== undefined && v !== null) el.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

async function api(path, options) {
  const res = await fetch(path, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `서버 오류 (${res.status})`);
  return data;
}

/* ---------- 개인정보 가리기 (mask.js) ---------- */

function maskSummary(found) {
  return Object.entries(found).filter(([, n]) => n > 0).map(([k, n]) => `${k} ${n}개`).join(', ');
}

function updateMaskPreview(text) {
  const box = $('#mask-preview');
  const { text: masked, found } = window.maskPersonalInfo(text);
  const summary = maskSummary(found);
  box.hidden = !summary;
  if (summary) box.replaceChildren(h('b', {}, `보내기 전에 가림: ${summary}`), h('br'), masked);
}

/* ---------- 모델 자동 전환 안내 ---------- */

// 첫 모델이 실패해 다른 모델로 바꿔 시도했을 때만 안내 문구를 만든다.
function attemptNote(attempts) {
  if (!attempts || attempts.length < 2) return '';
  const failed = attempts.filter((a) => !a.ok).map((a) => `${a.model}(${a.error})`);
  const last = attempts[attempts.length - 1];
  return `자동 전환: ${failed.join(' → ')}${last.ok ? ` → ${last.model}로 받음` : ''}`;
}

/* ---------- 문장 하나 분류 ---------- */

const state = { rule: null, gemini: null };

function labelsView(r) {
  return h('dl', { class: 'labels' },
    h('dt', {}, '칸'),
    h('dd', {},
      h('span', { class: 'chip cat' }, r.칸),
      r.다른칸후보 ? h('span', { class: 'chip alt' }, `다른칸후보 ${r.다른칸후보}`) : null),
    h('dt', {}, '긴급도'),
    h('dd', {}, h('span', { class: `chip ${r.긴급도}` }, r.긴급도)),
    h('dt', {}, '감정'),
    h('dd', {}, h('span', { class: `chip ${r.감정}` }, r.감정)),
  );
}

function renderCard(id, result, error) {
  const body = $(`#${id} .card-body`);
  body.replaceChildren();
  if (result) {
    body.append(labelsView(result), h('p', { class: 'reason' }, result.이유));
  } else {
    body.append(h('p', { class: 'error' }, error || '결과가 없습니다'));
  }
}

function fillSelect(sel, options, includeNone = false) {
  sel.replaceChildren(
    ...(includeNone ? [h('option', { value: '' }, '없음')] : []),
    ...options.map((o) => h('option', { value: o }, o)),
  );
}

function setFix(r) {
  if (!r) return;
  $('#fix-칸').value = r.칸;
  $('#fix-다른칸후보').value = r.다른칸후보 || '';
  $('#fix-긴급도').value = r.긴급도;
  $('#fix-감정').value = r.감정;
  updateDiff();
}

function currentFix() {
  return {
    칸: $('#fix-칸').value,
    다른칸후보: $('#fix-다른칸후보').value || null,
    긴급도: $('#fix-긴급도').value,
    감정: $('#fix-감정').value,
  };
}

function updateDiff() {
  const mine = currentFix();
  const parts = [];
  for (const [name, r] of [['규칙과', state.rule], ['Gemini와', state.gemini]]) {
    if (!r) continue;
    const diff = FIELDS.filter((f) => r[f] !== mine[f]);
    parts.push(`${name} ${diff.length ? `다른 항목: ${diff.join(', ')}` : '모두 같음'}`);
  }
  $('#fix-diff').textContent = parts.join(' · ');
}

async function classify(text) {
  const btn = $('#run');
  btn.disabled = true;
  btn.textContent = '분류하는 중…';
  try {
    const data = await api('/api/classify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sentences: [text], model: $('#model').value }),
    });
    state.rule = data.rule[0];
    state.gemini = data.gemini ? data.gemini[0] : null;
    $('#result-sentence').textContent = text;
    $('#gemini-model-name').textContent = state.gemini?.model || data.model;
    renderCard('card-rule', state.rule);
    renderCard('card-gemini', state.gemini, data.geminiError || 'Gemini가 이 문장에 답하지 않았습니다');
    const note = attemptNote(data.attempts);
    if (note && state.gemini) $('#card-gemini .card-body').append(h('p', { class: 'fallback' }, note));
    setFix(state.gemini || state.rule);
    $('#result').hidden = false;
    $('#result').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (e) {
    alert(e.message);
  } finally {
    btn.disabled = false;
    btn.textContent = '분류하기';
  }
}

/* ---------- 정답 30문장 채점 ---------- */

const exam = { items: [], gemini: null };

function cell(pred, gold) {
  if (!pred) return h('td', { class: 'muted' }, '—');
  return h('td', {}, ...FIELDS.flatMap((f, i) => [
    i ? ' · ' : '',
    h('span', { class: pred[f] === gold[f] ? '' : 'miss', title: pred[f] === gold[f] ? '' : `정답: ${gold[f]}` }, pred[f]),
  ]));
}

function renderExam() {
  const tbody = $('#exam tbody');
  tbody.replaceChildren(...exam.items.map((it, i) => {
    const g = exam.gemini?.[i] ?? null;
    const allOk = FIELDS.every((f) => it.rule[f] === it.정답[f]) && (!exam.gemini || (g && FIELDS.every((f) => g[f] === it.정답[f])));
    return h('tr', { class: allOk ? 'all-ok' : '' },
      h('td', { class: 'id' }, it.id),
      h('td', {}, it.문장),
      h('td', {}, FIELDS.map((f) => it.정답[f]).join(' · ')),
      cell(it.rule, it.정답),
      exam.gemini ? cell(g, it.정답) : h('td', { class: 'muted' }, '채점 전'));
  }));

  const score = (preds) => {
    const n = exam.items.length;
    const fmt = (k) => `${k}/${n} (${Math.round((k / n) * 100)}%)`;
    const hit = (f) => exam.items.filter((it, i) => preds[i] && preds[i][f] === it.정답[f]).length;
    const all = exam.items.filter((it, i) => preds[i] && FIELDS.every((f) => preds[i][f] === it.정답[f])).length;
    return [...FIELDS.map((f) => fmt(hit(f))), fmt(all)];
  };
  const rows = [['규칙', score(exam.items.map((it) => it.rule))]];
  rows.push(['Gemini', exam.gemini ? score(exam.gemini) : ['—', '—', '—', '—']]);
  $('#score tbody').replaceChildren(...rows.map(([name, vals]) => h('tr', {}, h('td', {}, name), vals.map((v) => h('td', {}, v)))));
}

async function loadExam() {
  try {
    const data = await api('/api/answers');
    exam.items = data.items;
    renderExam();
  } catch (e) {
    $('#exam tbody').replaceChildren(h('tr', {}, h('td', { colspan: 5, class: 'error' }, `정답 문장을 불러오지 못했습니다: ${e.message}`)));
  }
}

async function runExam() {
  if (!exam.items.length) return;
  const btn = $('#exam-run');
  const status = $('#exam-status');
  btn.disabled = true;
  status.textContent = 'Gemini가 30문장을 푸는 중… (보통 10~30초)';
  try {
    const data = await api('/api/classify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sentences: exam.items.map((it) => it.문장), model: $('#model').value }),
    });
    if (!data.gemini) throw new Error(data.geminiError || 'Gemini 결과가 없습니다');
    exam.gemini = data.gemini;
    renderExam();
    const missing = data.gemini.filter((g) => !g).length;
    const used = [...new Set(data.gemini.filter(Boolean).map((g) => g.model))].join(', ');
    const note = attemptNote(data.attempts);
    status.textContent = `${used}로 채점했어요.${missing ? ` ${missing}문장은 답이 없어 틀린 것으로 셌어요.` : ''}${note ? ` (${note})` : ''}`;
  } catch (e) {
    status.textContent = e.message;
  } finally {
    btn.disabled = false;
  }
}

/* ---------- 시작 ---------- */

async function init() {
  fillSelect($('#fix-칸'), CATEGORIES);
  fillSelect($('#fix-다른칸후보'), CATEGORIES, true);
  fillSelect($('#fix-긴급도'), URGENCIES);
  fillSelect($('#fix-감정'), EMOTIONS);
  for (const id of ['#fix-칸', '#fix-다른칸후보', '#fix-긴급도', '#fix-감정']) $(id).addEventListener('change', updateDiff);
  document.querySelectorAll('[data-fill]').forEach((b) =>
    b.addEventListener('click', () => setFix(state[b.dataset.fill])));

  const input = $('#input');
  input.addEventListener('input', () => {
    $('#count').textContent = `${input.value.length} / 300`;
    updateMaskPreview(input.value);
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); $('#form').requestSubmit(); }
  });
  $('#form').addEventListener('submit', (e) => {
    e.preventDefault();
    // 서버로는 가린 문장만 보낸다
    const text = window.maskPersonalInfo(input.value.trim()).text;
    if (text) classify(text);
  });
  $('#exam-run').addEventListener('click', runExam);

  try {
    const cfg = await api('/api/classify');
    $('#model').replaceChildren(...cfg.models.map((m) => h('option', { value: m.id }, m.label)));
    $('#model').value = cfg.defaultModel;
    if (!cfg.geminiReady) $('#exam-status').textContent = '서버에 Gemini 키가 아직 없어 규칙 결과만 나옵니다.';
  } catch {
    $('#model').replaceChildren(h('option', { value: '' }, '모델 목록을 불러오지 못함'));
  }
  loadExam();
}

init();
