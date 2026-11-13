// 쉬운 블로그 글쓰기 - 화면 동작
// 순서: 카테고리/주제 → 제목 → 본문 → 네이버용 복사

const $ = (id) => document.getElementById(id);
const STORE_KEY = 'easy-blog-draft-v1';
const GOAL_CHARS = 1500; // 공백 제외 권장 글자 수
const BANNED = ['최고', '최저가', '100%', '무조건', '완치', '보장', '1위', '대박', '부작용 없', '즉시 효과', '기적'];

let cat = 'food';

/* ---------- 1단계: 카테고리 ---------- */
function renderCats() {
  $('cats').innerHTML = '';
  for (const [id, t] of Object.entries(TEMPLATES)) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = `${t.icon} ${t.name}`;
    b.className = id === cat ? 'on' : '';
    b.onclick = () => { cat = id; renderCats(); refresh(); };
    $('cats').appendChild(b);
  }
}

const fill = (s, topic) => s.replaceAll('{주제}', topic);

function start() {
  const topic = $('topic').value.trim();
  if (!topic) { $('topic').focus(); toast('주제를 먼저 적어주세요', true); return; }
  if ($('body').value.trim() && !confirm('지금 쓰던 본문을 새 글 틀로 바꿀까요?')) return;

  const t = TEMPLATES[cat];
  renderTitles(t.titles.map((x) => fill(x, topic)));
  $('body').value = fill(t.body, topic);
  $('tags').value = makeTags(topic, t.tags);
  refresh();
  $('title').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function makeTags(topic, base) {
  const words = topic.split(/\s+/).filter((w) => w.length > 1);
  const all = [topic.replace(/\s+/g, ''), ...words, ...base];
  return [...new Set(all)].slice(0, 10).map((w) => '#' + w).join(' ');
}

/* ---------- ChatGPT: 질문 만들기 ---------- */
const TONES = {
  friendly: '친근한 네이버 이웃 말투 (~했어요, ~더라고요). 직접 다녀오고 써본 사람처럼 자연스럽게',
  info: '깔끔하고 정리된 정보 전달 말투 (~합니다, ~입니다)'
};

function buildPrompt(topic) {
  const t = TEMPLATES[cat];
  const heads = t.body.split('\n').filter((l) => l.startsWith('■')).map((l) => l.trim()).join(' / ');
  const memo = $('memo').value.trim();
  return [
    '너는 네이버 블로그 글을 쓰는 블로거야. 아래 조건으로 블로그 글 1편을 써줘.',
    '',
    `주제: ${topic}`,
    `글 종류: ${t.name}`,
    `말투: ${TONES[$('tone').value] || TONES.friendly}`,
    memo ? `꼭 넣을 내용(내 실제 경험): ${memo}` : '',
    '',
    '[형식 규칙 - 꼭 지켜줘]',
    '1. 첫 줄은 "제목: "으로 시작하는 블로그 제목 1개 (검색 키워드가 앞쪽에 오게)',
    '2. 소제목은 줄 맨 앞에 ■ 를 붙여줘. 예) ■ 메뉴 & 가격',
    '3. 사진 넣을 자리는 한 줄에 [사진] 이라고만 써줘. 4~6군데',
    '4. 문단 사이에는 빈 줄 1개, 한 문단은 2~3문장으로 짧게',
    '5. 마크다운 기호(#, **, -, 표)는 쓰지 마',
    '6. 본문은 공백 제외 1,500자 이상',
    '7. 과장 표현(최고, 무조건, 100%, 1위 등)은 쓰지 마',
    '8. 확실하지 않은 가격·주소·영업시간은 [[확인 필요]] 라고 표시해줘',
    '9. 맨 마지막 줄에 태그 10개를 #태그 형식으로 한 줄에 써줘',
    heads ? `\n참고할 소제목 구성: ${heads}` : ''
  ].filter((l, i, arr) => l !== '' || arr[i - 1] !== '').join('\n').trim();
}

// 클릭 순간에 바로 복사 (새 탭이 열리기 전에 해야 브라우저가 막지 않음)
function copyTextNow(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.cssText = 'position:fixed;left:-9999px;top:0';
  document.body.appendChild(ta);
  ta.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch { ok = false; }
  ta.remove();
  return ok;
}

// [글쓰기] → 질문을 복사해 두고, 질문이 들어간 ChatGPT를 새 탭으로 연다
function writeWithGpt() {
  const topic = $('topic').value.trim();
  if (!topic) { $('topic').focus(); return toast('주제를 먼저 적어주세요', true); }
  const prompt = buildPrompt(topic);
  copyTextNow(prompt);
  const win = window.open('https://chatgpt.com/?q=' + encodeURIComponent(prompt), '_blank');
  if (win) win.opener = null; // 열린 탭이 이 화면을 건드리지 못하게
  toast(win === null
    ? '새 탭이 막혔어요. chatgpt.com 을 열고 Ctrl+V 하세요 (질문 복사됨)'
    : 'ChatGPT가 열렸어요! 답변이 끝나면 복사해서 아래에 붙여넣으세요', win === null);
}

/* ---------- ChatGPT: 답변 가져오기 ---------- */
function cleanGpt(raw) {
  let title = '', tags = '';
  let lines = raw.replace(/\r\n?/g, '\n').split('\n').map((l) => l.replace(/\s+$/, ''));

  // 마크다운 기호 정리
  lines = lines
    .filter((l) => !/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(l))          // 구분선 삭제
    .map((l) => l
      .replace(/\*\*(.+?)\*\*/g, '$1').replace(/__(.+?)__/g, '$1')   // 굵게 기호
      .replace(/`/g, '')
      .replace(/^\s*>\s?/, '')                                       // 인용 기호
      .replace(/^\s*[-*•]\s+/, '· '));                               // 목록 기호

  // 제목: "제목:" 줄, 또는 맨 처음 나오는 "# " 큰제목
  const ti = lines.findIndex((l) => /^\s*(#+\s*)?제목\s*[:：]/.test(l));
  if (ti >= 0) {
    title = lines[ti].replace(/^\s*(#+\s*)?제목\s*[:：]\s*/, '').trim();
    // 제목 위의 "물론이죠! 아래는 ~입니다" 같은 인사말은 버림 (짧을 때만)
    const above = lines.slice(0, ti).filter((l) => l.trim()).length;
    lines = above <= 3 ? lines.slice(ti + 1) : (lines.splice(ti, 1), lines);
  } else {
    const first = lines.findIndex((l) => l.trim());
    if (first >= 0 && /^#\s+/.test(lines[first])) { title = lines[first].replace(/^#\s+/, '').trim(); lines.splice(first, 1); }
  }

  // 태그: 맨 끝쪽의 "#단어 #단어" 줄
  for (let i = lines.length - 1; i >= 0; i--) {
    const l = lines[i].trim();
    if (!l) continue;
    if (/^(태그\s*[:：]\s*)?(#[^\s#]+\s*){2,}$/.test(l)) { tags = l.replace(/^태그\s*[:：]\s*/, ''); lines.splice(i, 1); }
    break;
  }

  lines = lines.map((l) => {
    const t = l.trim();
    if (/^#{1,6}\s+/.test(t)) return `\n■ ${t.replace(/^#{1,6}\s+/, '').replace(/^■\s*/, '')}\n`; // ## 소제목 → ■
    if (t.startsWith('■')) return `\n${t}\n`;
    if (/^[\[(（]?\s*(사진|이미지|📷)[^\])）]*[\])）]?$/.test(t)) return '\n[사진]\n';           // 사진 자리 통일
    return l;
  });

  const body = lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  return { title: title.replace(/^["“]|["”]$/g, ''), body, tags };
}

function importGpt() {
  const raw = $('gptPaste').value;
  if (!raw.trim()) { $('gptPaste').focus(); return toast('ChatGPT 답변을 먼저 붙여넣어 주세요', true); }
  if ($('body').value.trim() && !confirm('지금 쓰던 본문을 ChatGPT 글로 바꿀까요?')) return;

  const { title, body, tags } = cleanGpt(raw);
  $('body').value = body;
  if (title) {
    $('title').value = title;
    $('titleList').innerHTML = '<p class="hint">ChatGPT가 만든 제목을 넣었어요. 아래에서 고쳐도 돼요.</p>';
  }
  $('tags').value = tags || makeTags($('topic').value.trim() || title, TEMPLATES[cat].tags);
  $('gptPaste').value = '';
  refresh();
  toast('글을 가져왔어요! 노란 칸이 있으면 확인해 주세요');
  $('body').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

/* ---------- 2단계: 제목 ---------- */
function renderTitles(list) {
  const box = $('titleList');
  box.innerHTML = '';
  list.forEach((text, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = text;
    b.onclick = () => {
      $('title').value = text;
      box.querySelectorAll('button').forEach((x) => x.classList.remove('on'));
      b.classList.add('on');
      refresh();
    };
    box.appendChild(b);
    if (i === 0) b.click();
  });
}

/* ---------- 3단계: 본문 도구 ---------- */
function insertAtCursor(text) {
  const ta = $('body');
  const s = ta.selectionStart, e = ta.selectionEnd;
  ta.value = ta.value.slice(0, s) + text + ta.value.slice(e);
  ta.selectionStart = ta.selectionEnd = s + text.length;
  ta.focus();
  refresh();
}

function runChecks(body) {
  const out = [];
  const chars = body.replace(/\s/g, '').length;
  out.push(chars >= GOAL_CHARS
    ? ['ok', `글자 수 ${chars.toLocaleString()}자 (공백 제외) — 충분해요`]
    : ['warn', `글자 수 ${chars.toLocaleString()}자 / 권장 ${GOAL_CHARS.toLocaleString()}자 이상`]);

  const todo = (body.match(/\[\[[\s\S]*?\]\]/g) || []).length;
  if (todo) out.push(['warn', `아직 안 채운 칸이 ${todo}개 있어요 (노란색 표시)`]);

  const photos = (body.match(/\[사진\]/g) || []).length;
  out.push(photos >= 3 ? ['ok', `사진 자리 ${photos}개`] : ['warn', `사진 자리 ${photos}개 — 3개 이상 넣으면 좋아요`]);

  const bad = BANNED.filter((w) => body.includes(w));
  if (bad.length) out.push(['warn', `과장 광고로 보일 수 있는 말: ${bad.join(', ')}`]);

  $('checks').innerHTML = out.map(([c, m]) => `<div class="chk ${c}">${c === 'ok' ? '✅' : '⚠️'} ${m}</div>`).join('');
  return { todo };
}

/* ---------- 본문 → HTML 변환 ---------- */
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const fullBody = () => $('body').value;

// forPreview=true 면 안 채운 칸을 노랗게 표시
function toHtml(body, forPreview) {
  const align = $('center').checked ? 'center' : 'left';
  const p = (inner, extra = '') => `<p style="text-align:${align};${extra}">${inner}</p>`;

  return body.split(/\n\s*\n/).map((block) => block.trim()).filter(Boolean).map((block) => {
    if (block === '[사진]') {
      return p('📷 여기에 사진을 넣어주세요', 'color:#999;background:#f2f2f2;padding:24px 0;');
    }
    if (block.startsWith('■')) {
      return p(`<b>${esc(block)}</b>`, 'font-size:1.1em;');
    }
    let html = esc(block).replace(/\n/g, '<br>');
    if (forPreview) html = html.replace(/\[\[([\s\S]*?)\]\]/g, '<span class="todo">[[$1]]</span>');
    return p(html);
  }).join('');
}

/* ---------- 4단계: 복사 ---------- */
async function copyRich(html, plain) {
  try {
    await navigator.clipboard.write([new ClipboardItem({
      'text/html': new Blob([html], { type: 'text/html' }),
      'text/plain': new Blob([plain], { type: 'text/plain' })
    })]);
    return true;
  } catch {
    // 예전 방식: 숨긴 영역을 선택해서 복사
    const div = document.createElement('div');
    div.innerHTML = html;
    div.style.cssText = 'position:fixed;left:-9999px;top:0';
    document.body.appendChild(div);
    const range = document.createRange();
    range.selectNodeContents(div);
    const sel = getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    const ok = document.execCommand('copy');
    sel.removeAllRanges();
    div.remove();
    return ok;
  }
}

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; }
  catch { return copyRich(esc(text), text); }
}

async function copyBody() {
  const body = fullBody();
  if (!body.trim()) return toast('본문이 비어 있어요', true);
  const { todo } = runChecks($('body').value);
  if (todo && !confirm(`아직 안 채운 칸이 ${todo}개 있어요. 그래도 복사할까요?`)) return;
  const ok = await copyRich(toHtml(body, false), body);
  toast(ok ? '본문 복사 완료! 네이버 본문칸에 Ctrl+V 하세요' : '복사에 실패했어요. 다시 눌러주세요', !ok);
}

let toastTimer;
function toast(msg, bad) {
  const t = $('toast');
  t.textContent = msg;
  t.style.color = bad ? 'var(--warn)' : 'var(--ok)';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.textContent = ''; }, 4000);
}

/* ---------- 화면 갱신 & 자동 저장 ---------- */
function refresh() {
  runChecks($('body').value);
  $('pvTitle').textContent = $('title').value || '제목이 여기에 보여요';
  $('preview').innerHTML = toHtml(fullBody(), true) || '<p class="hint">본문 미리보기</p>';
  save();
}

function save() {
  const data = { cat, topic: $('topic').value, title: $('title').value, body: $('body').value,
    tags: $('tags').value, center: $('center').checked, tone: $('tone').value, memo: $('memo').value };
  try { localStorage.setItem(STORE_KEY, JSON.stringify(data)); } catch { /* 저장 못 해도 계속 동작 */ }
}

function load() {
  try {
    const d = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
    if (!d) return;
    if (TEMPLATES[d.cat]) cat = d.cat;
    $('topic').value = d.topic || '';
    $('title').value = d.title || '';
    $('body').value = d.body || '';
    $('tags').value = d.tags || '';
    $('center').checked = d.center !== false;
    if (TONES[d.tone]) $('tone').value = d.tone;
    $('memo').value = d.memo || '';
  } catch { /* 무시 */ }
}

/* ---------- 시작 ---------- */
load();
renderCats();
refresh();

$('btnStart').onclick = start;
$('topic').addEventListener('keydown', (e) => { if (e.key === 'Enter') start(); });
$('btnPhoto').onclick = () => insertAtCursor('\n\n[사진]\n\n');
$('btnHead').onclick = () => insertAtCursor('\n\n■ 소제목\n\n');
['title', 'body', 'tags', 'topic'].forEach((id) => $(id).addEventListener('input', refresh));
$('center').addEventListener('change', refresh);
$('tone').addEventListener('change', save);
$('memo').addEventListener('input', save);
$('btnWrite').onclick = writeWithGpt;
$('btnImport').onclick = importGpt;

$('cpTitle').onclick = async () => {
  if (!$('title').value.trim()) return toast('제목이 비어 있어요', true);
  toast(await copyText($('title').value.trim()) ? '제목 복사 완료!' : '복사 실패', false);
};
$('cpBody').onclick = copyBody;
$('cpTags').onclick = async () => {
  if (!$('tags').value.trim()) return toast('태그가 비어 있어요', true);
  toast(await copyText($('tags').value.trim()) ? '태그 복사 완료! 발행 창 태그칸에 붙여넣기' : '복사 실패', false);
};
