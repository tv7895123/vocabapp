// 每頁放幾個單字卡（想改版面密度就改這裡）
const PER_PAGE = 3;
// 索引每頁放幾個單字
const INDEX_PER_PAGE = 90;
// 要不要顯示 A–Z 索引頁（已經有上方的主題下拉選單可以跳轉，單字多了索引會太長，先關掉）
const SHOW_INDEX = false;
// 資料裡沒有寫 source 時，顯示的名稱
const NO_SOURCE = '未標示';
// 測驗設定畫面的預設題數
const DEFAULT_QUIZ_COUNT = 10;

const $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const reEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// 朗讀功能（瀏覽器內建 Web Speech API，免安裝、免金鑰）
const canSpeak = 'speechSynthesis' in window;
function speak(text) {
  if (!canSpeak) return;
  speechSynthesis.cancel(); // 先停掉上一句，避免排隊愈唸愈慢
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'en-US';
  u.rate = 0.9; // 給小朋友聽，稍微放慢
  speechSynthesis.speak(u);
}
// 用 data-say 屬性存要唸的文字，事件委派到 #app，一次綁定就好
function bindSpeech() {
  if (!canSpeak) { document.body.classList.add('no-speech'); return; }
  $('#app').addEventListener('click', e => {
    const btn = e.target.closest('.say');
    if (btn) speak(btn.dataset.say);
  });
}
function sayBtn(text) {
  return '<button type="button" class="say" data-say="' + esc(text) + '" aria-label="朗讀">🔊</button>';
}

function getJSON(url) {
  return fetch(url).then(r => {
    if (!r.ok) throw new Error(url + '（' + r.status + '）');
    return r.json();
  });
}

/* ---------------- 資料 ---------------- */
// 所有單字攤平成一份清單：{ w: 單字資料, subject: 主題, source: 來源 }
// 來源優先順序：單字自己的 source → 檔案的 source → 「未標示」
let ALL = [];
let SOURCES = []; // 有哪些來源（依出現順序）

function flatten(files) {
  ALL = [];
  files.forEach(d => {
    (d.words || []).forEach(w => {
      ALL.push({ w: w, subject: d.subject, source: w.source || d.source || NO_SOURCE });
    });
  });
  SOURCES = Array.from(new Set(ALL.map(r => r.source)));
}
// 依來源、主題篩選；不傳（或傳空字串）代表不限
const recs = (src, subs) => ALL.filter(r => (!src || r.source === src) && (!subs || subs.includes(r.subject)));

/* ---------------- 單字頁 ---------------- */
function cardHTML(r, id, showSrc) {
  const w = r.w;
  const re = new RegExp('\\b' + reEsc(w.word) + '\\w*', 'gi');
  const hl = t => esc(t).replace(re, m => '<mark>' + m + '</mark>');
  const rel = (label, cls, arr) =>
    arr && arr.length ? '<span class="' + cls + '">' + label + '</span> ' + arr.map(esc).join('、') : '';
  const relHTML = [rel('近義詞', 'syn', w.synonyms), rel('反義詞', 'ant', w.antonyms)].filter(Boolean).join('　');
  const exHTML = (w.examples || []).map(e =>
    '<li>' + hl(e.en) + sayBtn(e.en) + '<span class="cn">' + esc(e.zh) + '</span></li>').join('');
  return '<section class="card" id="' + id + '" data-q="' + esc((w.word + ' ' + w.zh).toLowerCase()) + '">' +
    '<div class="w"><span class="en">' + esc(w.word) + '</span>' + sayBtn(w.word) +
    (w.kk ? '<span class="kk">[' + esc(w.kk) + ']</span>' : '') +
    (w.pos ? '<span class="pos">' + esc(w.pos) + '</span>' : '') +
    (showSrc ? '<span class="srcTag">' + esc(r.source) + '</span>' : '') + '</div>' +
    '<div class="zh">' + esc(w.zh) + '</div>' +
    (relHTML ? '<div class="rel">' + relHTML + '</div>' : '') +
    '<ul class="ex">' + exHTML + '</ul></section>';
}

// 依目前選的來源，重新產生所有頁面與主題下拉選單
function render() {
  const src = $('#src').value; // 空字串 = 全部來源
  const showSrc = SOURCES.length > 1;

  // 依主題分組（維持出現順序）
  const groups = [];
  const at = new Map();
  recs(src).forEach(r => {
    if (!at.has(r.subject)) { at.set(r.subject, groups.length); groups.push({ subject: r.subject, words: [] }); }
    groups[at.get(r.subject)].words.push(r);
  });

  // 1. 依主題（subject）切成每頁 PER_PAGE 個單字
  const pages = [];
  groups.forEach(g => {
    for (let i = 0; i < g.words.length; i += PER_PAGE) {
      pages.push({ subject: g.subject, first: i === 0, words: g.words.slice(i, i + PER_PAGE) });
    }
  });
  const total = pages.reduce((n, p) => n + p.words.length, 0);
  const idxPages = SHOW_INDEX ? Math.max(1, Math.ceil(total / INDEX_PER_PAGE)) : 0;

  // 2. 單字頁（頁碼從索引頁之後開始）
  let n = 0;
  const entries = [];
  const subjectPage = {};
  const wordHTML = pages.map((p, i) => {
    const pg = idxPages + 1 + i;
    if (p.first) subjectPage[p.subject] = pg;
    const cards = p.words.map(r => {
      const id = 'w' + (n++);
      entries.push({ word: r.w.word, id: id, pg: pg });
      return cardHTML(r, id, showSrc);
    }).join('');
    return '<article class="page"' + (p.first ? ' id="sub-' + esc(p.subject) + '"' : '') + '>' +
      '<div class="head"><span>國小英語單字</span><span>' + esc(p.subject) + '</span></div>' +
      cards + '<div class="foot">' + pg + '</div></article>';
  }).join('');

  // 3. 索引頁（主題目錄 + A–Z 單字，含頁碼）— 目前關閉，改用上方的主題下拉選單
  let idxHTML = '';
  if (SHOW_INDEX) {
    const subjectsHTML = '<div class="subjects">' + groups.map(g =>
      '<a href="#sub-' + esc(g.subject) + '">' + esc(g.subject) + '（p.' + subjectPage[g.subject] + '）</a>').join('') + '</div>';
    const sorted = entries.slice().sort((a, b) => a.word.toLowerCase().localeCompare(b.word.toLowerCase()));
    for (let k = 0; k < idxPages; k++) {
      const part = sorted.slice(k * INDEX_PER_PAGE, (k + 1) * INDEX_PER_PAGE);
      idxHTML += '<article class="page index"><div class="head"><span>國小英語單字</span><span>索引</span></div>' +
        (k === 0 ? subjectsHTML : '') +
        '<div class="idx">' + part.map(e =>
          '<a href="#' + e.id + '"><span>' + esc(e.word) + '</span><i></i><span>' + e.pg + '</span></a>').join('') + '</div>' +
        '<div class="foot">' + (k + 1) + '</div></article>';
    }
  }

  $('#app').innerHTML = idxHTML + wordHTML;

  // 4. 主題下拉選單只列出目前來源有的主題
  $('#sub').innerHTML = '<option value="">跳到主題</option>' +
    groups.map(g => '<option value="' + esc(g.subject) + '">' + esc(g.subject) + '</option>').join('');

  applySearch();
}

function applySearch() {
  const q = $('#q').value.trim().toLowerCase();
  document.querySelectorAll('.card').forEach(c => { c.hidden = !!q && !c.dataset.q.includes(q); });
  document.querySelectorAll('.page:not(.index)').forEach(p => { p.hidden = !p.querySelector('.card:not([hidden])'); });
  document.querySelectorAll('.index').forEach(p => { p.hidden = !!q; });
}

// 工具列：來源選單（超過一個來源才顯示）、主題跳轉、搜尋、列印
function initToolbar() {
  const srcSel = $('#src');
  if (SOURCES.length > 1) {
    srcSel.innerHTML = '<option value="">全部來源</option>' +
      SOURCES.map(s => '<option value="' + esc(s) + '">' + esc(s) + '</option>').join('');
    srcSel.hidden = false;
    srcSel.onchange = render;
  }
  const sel = $('#sub');
  sel.onchange = () => {
    const t = document.getElementById('sub-' + sel.value);
    if (t) t.scrollIntoView();
    sel.value = '';
  };
  $('#q').oninput = applySearch;
  $('#pr').onclick = () => window.print();
}

/* ---------------- 隨機測驗 ---------------- */
const QTYPES = [
  { id: 'en2zh', label: '看英文選中文' },
  { id: 'zh2en', label: '看中文選英文' },
  { id: 'listen', label: '聽發音選單字' }
];
const shuffle = a => {
  a = a.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
};

// 測驗狀態：cfg 設定、pool 出題範圍、count 題數、list 題目、i 目前第幾題
const qz = { cfg: null, pool: [], count: 0, list: [], i: 0, score: 0, wrong: [], done: false };

// 為每個單字出一題，並隨機挑一種題型；干擾選項先從出題範圍挑，不夠再從全部單字補
function makeQuestions(items, pool, types) {
  return items.map(r => {
    const type = types[Math.floor(Math.random() * types.length)];
    const text = x => type === 'en2zh' ? x.w.zh : x.w.word;
    const answer = text(r);
    const seen = new Set([answer]);
    const options = [answer];
    [pool, ALL].forEach(from => {
      shuffle(from).forEach(x => {
        if (options.length >= 4) return;
        const t = text(x);
        if (seen.has(t)) return;
        seen.add(t);
        options.push(t);
      });
    });
    return { r: r, type: type, answer: answer, options: shuffle(options) };
  });
}

function readCfg() {
  const q = $('#qs-src');
  return {
    src: q ? q.value : '',
    subs: Array.from(document.querySelectorAll('input[name=qsub]:checked')).map(x => x.value),
    types: Array.from(document.querySelectorAll('input[name=qt]:checked')).map(x => x.value)
  };
}

function updateInfo() {
  const cfg = readCfg();
  const size = recs(cfg.src, cfg.subs).length;
  const num = $('#qs-n');
  num.max = Math.max(1, size);
  if (+num.value > size) num.value = Math.max(1, size);
  $('#qs-info').textContent = '範圍內共 ' + size + ' 個單字';
}

// 來源改變時，重新列出該來源的主題（預設全選）
function refreshSubs() {
  const q = $('#qs-src');
  const counts = new Map();
  recs(q ? q.value : '').forEach(r => counts.set(r.subject, (counts.get(r.subject) || 0) + 1));
  $('#qs-subs').innerHTML = Array.from(counts).map(e =>
    '<label class="chk"><input type="checkbox" name="qsub" value="' + esc(e[0]) + '" checked> ' +
    esc(e[0]) + '（' + e[1] + '）</label>').join('');
  updateInfo();
}

function quizSetup() {
  const multi = SOURCES.length > 1;
  const cur = $('#src').value; // 預設沿用頁面目前選的來源
  $('#qz-body').innerHTML =
    '<h2>隨機測驗</h2>' +
    (multi ? '<label class="qf">來源<select id="qs-src"><option value="">全部來源</option>' +
      SOURCES.map(s => '<option value="' + esc(s) + '"' + (s === cur ? ' selected' : '') + '>' + esc(s) + '</option>').join('') +
      '</select></label>' : '') +
    '<fieldset class="qf"><legend>主題（可多選）</legend><div id="qs-subs"></div>' +
    '<div class="qmini"><button type="button" data-act="all">全選</button><button type="button" data-act="none">全不選</button></div></fieldset>' +
    '<fieldset class="qf"><legend>題型（可多選）</legend>' +
    QTYPES.map(t => {
      const off = t.id === 'listen' && !canSpeak;
      return '<label class="chk"><input type="checkbox" name="qt" value="' + t.id + '"' + (off ? ' disabled' : ' checked') + '> ' +
        t.label + (off ? '（此瀏覽器不支援發音）' : '') + '</label>';
    }).join('') + '</fieldset>' +
    '<label class="qf">題數<input type="number" id="qs-n" min="1" value="' + DEFAULT_QUIZ_COUNT + '"></label>' +
    '<p class="qinfo" id="qs-info"></p>' +
    '<p class="qerr" id="qs-err" role="alert"></p>' +
    '<div class="qact"><button type="button" class="qbtn pri" data-act="go">開始測驗</button>' +
    '<button type="button" class="qbtn" data-act="close">取消</button></div>';
  refreshSubs();
}

function startQuiz(cfg, pool, items) {
  qz.cfg = cfg;
  qz.pool = pool;
  qz.list = makeQuestions(items, pool, cfg.types);
  qz.i = 0;
  qz.score = 0;
  qz.wrong = [];
  showQ();
}

function showQ() {
  const q = qz.list[qz.i];
  const w = q.r.w;
  qz.done = false;
  const ask = {
    en2zh: '這個單字是什麼意思？',
    zh2en: '哪一個單字是這個意思？',
    listen: '聽聽看，你聽到哪個單字？'
  }[q.type];
  const prompt =
    q.type === 'en2zh' ? '<div class="qword">' + esc(w.word) + sayBtn(w.word) + '</div>' +
      (w.kk ? '<div class="qkk">[' + esc(w.kk) + ']</div>' : '') :
    q.type === 'zh2en' ? '<div class="qzh">' + esc(w.zh) + '</div>' :
    '<button type="button" class="qbtn qplay" data-act="play">🔊 播放發音</button>';
  $('#qz-body').innerHTML =
    '<div class="qmeta"><span>第 ' + (qz.i + 1) + ' / ' + qz.list.length + ' 題</span><span>答對 ' + qz.score + '</span></div>' +
    '<p class="qask">' + ask + '</p>' + prompt +
    '<div class="opts">' + q.options.map((t, i) =>
      '<button type="button" class="opt" data-act="ans" data-i="' + i + '">' + esc(t) + '</button>').join('') + '</div>' +
    '<div class="qfb" id="qfb" aria-live="polite"></div>';
  if (q.type === 'listen') speak(w.word);
}

function showResult() {
  const n = qz.list.length;
  const wrongHTML = qz.wrong.length
    ? '<h3>再複習一下這些單字</h3><ul class="qwrong">' + qz.wrong.map(r =>
        '<li><b>' + esc(r.w.word) + '</b>' + sayBtn(r.w.word) +
        (r.w.kk ? ' <span class="qkk">[' + esc(r.w.kk) + ']</span>' : '') + '　' + esc(r.w.zh) + '</li>').join('') + '</ul>'
    : '<p class="good">全部答對，太棒了！</p>';
  $('#qz-body').innerHTML =
    '<h2>測驗結果</h2>' +
    '<p class="qscore">答對 <b>' + qz.score + '</b> / ' + n + ' 題</p>' + wrongHTML +
    '<div class="qact">' +
    (qz.wrong.length ? '<button type="button" class="qbtn pri" data-act="retry">只重測錯的題</button>' : '') +
    '<button type="button" class="qbtn' + (qz.wrong.length ? '' : ' pri') + '" data-act="again">再測一次</button>' +
    '<button type="button" class="qbtn" data-act="setup">回設定</button>' +
    '<button type="button" class="qbtn" data-act="close">關閉</button></div>';
}

// 對話框內按鈕的動作（依 data-act 分派）
const QA = {
  close() { $('#qz').close(); },
  setup() { quizSetup(); },
  all() { document.querySelectorAll('input[name=qsub]').forEach(x => { x.checked = true; }); updateInfo(); },
  none() { document.querySelectorAll('input[name=qsub]').forEach(x => { x.checked = false; }); updateInfo(); },
  go() {
    const cfg = readCfg();
    const err = $('#qs-err');
    if (!cfg.subs.length) { err.textContent = '請至少選一個主題。'; return; }
    if (!cfg.types.length) { err.textContent = '請至少選一種題型。'; return; }
    if (ALL.length < 2) { err.textContent = '單字太少，至少需要 2 個單字才能出選擇題。'; return; }
    const pool = recs(cfg.src, cfg.subs);
    let n = parseInt($('#qs-n').value, 10);
    if (!(n >= 1)) { err.textContent = '請輸入題數（至少 1 題）。'; return; }
    n = Math.min(n, pool.length);
    qz.count = n;
    startQuiz(cfg, pool, shuffle(pool).slice(0, n));
  },
  play() { speak(qz.list[qz.i].r.w.word); },
  ans(btn) {
    if (qz.done) return;
    qz.done = true;
    const q = qz.list[qz.i];
    const w = q.r.w;
    const ok = q.options[+btn.dataset.i] === q.answer;
    if (ok) qz.score++;
    else if (!qz.wrong.includes(q.r)) qz.wrong.push(q.r);
    document.querySelectorAll('#qz-body .opt').forEach(o => {
      o.disabled = true;
      if (q.options[+o.dataset.i] === q.answer) o.classList.add('ok');
      else if (o === btn) o.classList.add('bad');
    });
    const last = qz.i === qz.list.length - 1;
    $('#qfb').innerHTML =
      '<p class="' + (ok ? 'good' : 'miss') + '">' + (ok ? '答對了！' : '答錯了') + '</p>' +
      '<p class="qans"><b>' + esc(w.word) + '</b>' + sayBtn(w.word) +
      (w.kk ? ' <span class="qkk">[' + esc(w.kk) + ']</span>' : '') + '　' + esc(w.zh) + '</p>' +
      '<button type="button" class="qbtn pri" data-act="next">' + (last ? '看結果' : '下一題') + '</button>';
    $('#qfb [data-act=next]').focus();
  },
  next() {
    qz.i++;
    if (qz.i < qz.list.length) showQ(); else showResult();
  },
  retry() { startQuiz(qz.cfg, qz.pool, shuffle(qz.wrong)); },
  again() { startQuiz(qz.cfg, qz.pool, shuffle(qz.pool).slice(0, qz.count)); }
};

function initQuiz() {
  if (typeof HTMLDialogElement !== 'function') return; // 太舊的瀏覽器沒有 <dialog>，就不顯示測驗按鈕
  const dlg = $('#qz');
  dlg.addEventListener('click', e => {
    const say = e.target.closest('.say');
    if (say) { speak(say.dataset.say); return; }
    const b = e.target.closest('[data-act]');
    if (b && QA[b.dataset.act]) QA[b.dataset.act](b);
  });
  dlg.addEventListener('change', e => {
    if (e.target.id === 'qs-src') refreshSubs();
    else if (e.target.name === 'qsub') updateInfo();
  });
  dlg.addEventListener('close', () => { if (canSpeak) speechSynthesis.cancel(); });
  const btn = $('#qz-open');
  btn.hidden = false;
  btn.onclick = () => { quizSetup(); dlg.showModal(); };
}

async function main() {
  try {
    bindSpeech();
    const m = await getJSON('data/manifest.json');
    const files = await Promise.all(m.subjects.map(s => getJSON('data/' + s + '.json')));
    flatten(files);
    if (!ALL.length) throw new Error('資料裡沒有任何單字');
    initToolbar();
    initQuiz();
    render();
  } catch (e) {
    $('#app').innerHTML = '<p class="err">讀取資料失敗：' + esc(e.message) +
      '<br>請確認 data 資料夾與 manifest.json 都在，並且用網址（http）開啟，不要直接雙擊 index.html。</p>';
  }
}
main();
