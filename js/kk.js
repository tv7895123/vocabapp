// ===== 可以自己調整的設定 =====
// 聽音練習預設題數
const DEFAULT_QUIZ_COUNT = 10;
// 朗讀速度：一般 / 慢速（數字越小越慢）
const RATE_NORMAL = 0.9;
const RATE_SLOW = 0.65;
// 子音音標（其餘都當作母音）；出「選音標」題時，母音只和母音比、子音只和子音比
const CONSONANTS = ['ʃ', 'tʃ', 'θ', 'ð', 'ŋ'];

const $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const reEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const shuffle = a => {
  a = a.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
};

// 記住「慢速」「先唸後看」的選擇（瀏覽器不給存就算了，不影響使用）
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* 略過 */ } }
};

function getJSON(url) {
  return fetch(url).then(r => {
    if (!r.ok) throw new Error(url + '（' + r.status + '）');
    return r.json();
  });
}

/* ---------------- 朗讀（瀏覽器內建 Web Speech API，免安裝、免金鑰） ---------------- */
const canSpeak = 'speechSynthesis' in window;
let slow = false;
function speak(text) {
  if (!canSpeak) return;
  speechSynthesis.cancel(); // 先停掉上一句，避免排隊
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'en-US';
  u.rate = slow ? RATE_SLOW : RATE_NORMAL;
  speechSynthesis.speak(u);
}
// 注意：瀏覽器的朗讀不能直接唸音標符號，所以「聽音標」都是唸關鍵字或例字
function sayBtn(text) {
  return '<button type="button" class="say" data-say="' + esc(text) + '" aria-label="朗讀 ' + esc(text) + '">🔊</button>';
}

/* ---------------- 資料 ---------------- */
let SYMS = [];  // 所有音標
let WORDS = []; // 所有單字攤平：{ s: 音標資料, w: 單字資料 }
function load(data) {
  SYMS = data.symbols || [];
  SYMS.forEach((s, i) => { s.idx = i; });
  WORDS = [];
  SYMS.forEach(s => (s.words || []).forEach(w => WORDS.push({ s: s, w: w })));
}

/* ---------------- 版面 ---------------- */
// 會被「先唸後看」蓋住的文字（音標）
const cv = (text, cls) =>
  '<span class="cv ' + (cls || '') + '" tabindex="0" title="點一下顯示音標">' + esc(text) + '</span>';

function cardHTML(w) {
  const re = new RegExp('\\b' + reEsc(w.word) + '\\w*', 'gi');
  const hl = t => esc(t).replace(re, m => '<mark>' + m + '</mark>');
  const ex = (w.examples || []).map(e =>
    '<li>' + hl(e.en) + sayBtn(e.en) + '<span class="cn">' + esc(e.zh) + '</span></li>').join('');
  return '<section class="card"><div class="w"><span class="en">' + esc(w.word) + '</span>' + sayBtn(w.word) +
    cv('[' + w.kk + ']', 'kk') + '<span class="zhi">' + esc(w.zh) + '</span></div>' +
    '<ul class="ex">' + ex + '</ul></section>';
}

function overviewHTML(weeks) {
  const body = weeks.map(wk => {
    const list = SYMS.filter(s => s.week === wk);
    return '<h2 class="wk">第 ' + wk + ' 週</h2><div class="tiles">' + list.map(s =>
      '<div class="tile"><a class="tl" href="#s-' + s.idx + '"><span class="tsym">[' + esc(s.symbol) + ']</span>' +
      '<span class="tkey">' + esc(s.key) + (s.bonus ? '（加碼）' : '') + '</span></a>' + sayBtn(s.key) + '</div>').join('') + '</div>';
  }).join('');
  return '<article class="page kkpage" id="top"><div class="head"><span>KK 音標</span><span>一覽表</span></div>' +
    '<p class="intro">先聽、先唸熟悉的單字，最後才認音標。點音標卡跳到那一頁，點 🔊 聽關鍵字。</p>' +
    body + '<div class="foot">1</div></article>';
}

function symPageHTML(s, pg) {
  return '<article class="page kkpage" id="s-' + s.idx + '">' +
    '<div class="head"><span>KK 音標・第 ' + s.week + ' 週</span><span>[' + esc(s.symbol) + '] ' + esc(s.key) + '</span></div>' +
    '<div class="symhead"><div class="cv symbig" tabindex="0" title="點一下顯示音標">[' + esc(s.symbol) + ']</div>' +
    '<div class="symmeta"><div class="keyrow"><b>關鍵字</b><span class="en">' + esc(s.key) + '</span>' + sayBtn(s.key) +
    (s.bonus ? '<span class="badge">加碼</span>' : '') + '</div>' +
    '<p class="tip"><b>口型</b>　' + esc(s.tip) + '</p>' +
    '<p class="cmp"><b>比一比</b>　' + esc(s.compare) + '</p>' +
    '<button type="button" class="practice" data-week="' + s.week + '">🎧 聽音練習（第 ' + s.week + ' 週）</button></div></div>' +
    s.words.map(cardHTML).join('') + '<div class="foot">' + pg + '</div></article>';
}

function render() {
  const weeks = Array.from(new Set(SYMS.map(s => s.week)));
  $('#app').innerHTML = overviewHTML(weeks) + SYMS.map((s, i) => symPageHTML(s, i + 2)).join('');
  $('#sym').innerHTML = '<option value="">跳到音標</option>' + weeks.map(wk =>
    '<optgroup label="第 ' + wk + ' 週">' + SYMS.filter(s => s.week === wk).map(s =>
      '<option value="' + s.idx + '">[' + esc(s.symbol) + '] ' + esc(s.key) + '</option>').join('') + '</optgroup>').join('');
}

/* ---------------- 工具列與點擊 ---------------- */
function setCover(on) {
  document.body.classList.toggle('covered', on);
  $('#cover').setAttribute('aria-pressed', String(on));
  if (!on) document.querySelectorAll('.cv.show').forEach(e => e.classList.remove('show'));
  store.set('kk-cover', on ? '1' : '0');
}
function setSlow(on) {
  slow = on;
  $('#slow').setAttribute('aria-pressed', String(on));
  store.set('kk-slow', on ? '1' : '0');
}

function initToolbar() {
  $('#cover').onclick = () => setCover(!document.body.classList.contains('covered'));
  $('#slow').onclick = () => setSlow(!slow);
  $('#pr').onclick = () => window.print();
  const sel = $('#sym');
  sel.onchange = () => {
    const t = document.getElementById('s-' + sel.value);
    if (t) t.scrollIntoView();
    sel.value = '';
  };
  setSlow(store.get('kk-slow') === '1');
  setCover(store.get('kk-cover') === '1');
  if (!canSpeak) $('#slow').hidden = true;
}

function bindApp() {
  const app = $('#app');
  const covered = () => document.body.classList.contains('covered');
  app.addEventListener('click', e => {
    const say = e.target.closest('.say');
    if (say) { speak(say.dataset.say); return; }
    const c = e.target.closest('.cv');
    if (c && covered()) { c.classList.toggle('show'); return; }
    const p = e.target.closest('.practice');
    if (p) openQuiz(+p.dataset.week);
  });
  app.addEventListener('keydown', e => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('cv') && covered()) {
      e.preventDefault();
      e.target.classList.toggle('show');
    }
  });
}

/* ---------------- 聽音練習 ---------------- */
const QTYPES = [
  { id: 'listen2sym', label: '聽發音選音標', listen: true },
  { id: 'kk2word', label: '看音標選單字', listen: false },
  { id: 'listen2word', label: '聽發音選單字', listen: true }
];

// 測驗狀態：cfg 設定、pool 出題範圍、count 題數、list 題目、i 目前第幾題
const qz = { cfg: null, pool: [], count: 0, list: [], i: 0, score: 0, wrong: [], done: false };

const isCons = s => CONSONANTS.includes(s.symbol);

// 為一個單字出一題
function makeQ(r, pool, types) {
  const type = types[Math.floor(Math.random() * types.length)];

  if (type === 'listen2sym') {
    // 干擾選項：同類（母音/子音）、而且這個字的音標裡完全沒出現的音標，這樣答案一定只有一個
    const ans = r.s;
    const ok = x => x !== ans && isCons(x) === isCons(ans) && !r.w.kk.includes(x.symbol);
    const poolSyms = Array.from(new Set(pool.map(p => p.s)));
    const ds = [];
    [poolSyms, SYMS].forEach(from => shuffle(from).forEach(x => {
      if (ds.length < 3 && ok(x) && !ds.includes(x)) ds.push(x);
    }));
    const options = shuffle([ans].concat(ds)).map(x => ({ key: x.symbol, label: '[' + x.symbol + ']', sub: x.key }));
    return { r: r, type: type, answer: ans.symbol, options: options };
  }

  // 選單字：干擾選項要和答案的單字、音標都不同；「聽發音」優先挑同一週的字，比較容易聽混
  const seen = new Set([r.w.word]);
  const options = [{ key: r.w.word, label: r.w.word }];
  const sameWeek = WORDS.filter(x => x.s.week === r.s.week);
  const order = type === 'listen2word' ? [sameWeek, pool, WORDS] : [pool, WORDS];
  order.forEach(from => shuffle(from).forEach(x => {
    if (options.length >= 4) return;
    if (seen.has(x.w.word) || x.w.kk === r.w.kk) return;
    seen.add(x.w.word);
    options.push({ key: x.w.word, label: x.w.word });
  }));
  return { r: r, type: type, answer: r.w.word, options: shuffle(options) };
}

function readCfg() {
  return {
    syms: Array.from(document.querySelectorAll('input[name=qsym]:checked')).map(x => +x.value),
    types: Array.from(document.querySelectorAll('input[name=qt]:checked')).map(x => x.value)
  };
}
const poolOf = syms => WORDS.filter(r => syms.includes(r.s.idx));

function updateInfo() {
  const size = poolOf(readCfg().syms).length;
  const num = $('#qs-n');
  num.max = Math.max(1, size);
  if (+num.value > size) num.value = Math.max(1, size);
  $('#qs-info').textContent = '範圍內共 ' + size + ' 個單字';
}

// pre：要預先勾選的音標編號（不傳就全選）
function quizSetup(pre) {
  const sel = pre || SYMS.map(s => s.idx);
  const weeks = Array.from(new Set(SYMS.map(s => s.week)));
  $('#qz-body').innerHTML =
    '<h2>聽音練習</h2>' +
    '<fieldset class="qf"><legend>音標（可多選）</legend>' +
    weeks.map(wk => '<div class="qweek"><span class="qwk">第 ' + wk + ' 週</span>' +
      SYMS.filter(s => s.week === wk).map(s =>
        '<label class="chk"><input type="checkbox" name="qsym" value="' + s.idx + '"' +
        (sel.includes(s.idx) ? ' checked' : '') + '> [' + esc(s.symbol) + ']</label>').join('') + '</div>').join('') +
    '<div class="qmini"><button type="button" data-act="all">全選</button><button type="button" data-act="none">全不選</button></div></fieldset>' +
    '<fieldset class="qf"><legend>題型（可多選）</legend>' +
    QTYPES.map(t => {
      const off = t.listen && !canSpeak;
      return '<label class="chk"><input type="checkbox" name="qt" value="' + t.id + '"' + (off ? ' disabled' : ' checked') + '> ' +
        t.label + (off ? '（此瀏覽器不支援發音）' : '') + '</label>';
    }).join('') + '</fieldset>' +
    '<label class="qf">題數<input type="number" id="qs-n" min="1" value="' + DEFAULT_QUIZ_COUNT + '"></label>' +
    '<p class="qinfo" id="qs-info"></p>' +
    '<p class="qerr" id="qs-err" role="alert"></p>' +
    '<div class="qact"><button type="button" class="qbtn pri" data-act="go">開始練習</button>' +
    '<button type="button" class="qbtn" data-act="close">取消</button></div>';
  updateInfo();
}

function startQuiz(cfg, pool, items) {
  qz.cfg = cfg;
  qz.pool = pool;
  qz.list = items.map(r => makeQ(r, pool, cfg.types));
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
    listen2sym: '聽聽看，這個字裡面有哪一個音？',
    kk2word: '這個音標是哪一個單字？',
    listen2word: '聽聽看，你聽到哪個單字？'
  }[q.type];
  const prompt = q.type === 'kk2word'
    ? '<div class="qword">[' + esc(w.kk) + ']</div>'
    : '<button type="button" class="qbtn qplay" data-act="play">🔊 播放發音</button>';
  $('#qz-body').innerHTML =
    '<div class="qmeta"><span>第 ' + (qz.i + 1) + ' / ' + qz.list.length + ' 題</span><span>答對 ' + qz.score + '</span></div>' +
    '<p class="qask">' + ask + '</p>' + prompt +
    '<div class="opts">' + q.options.map((o, i) =>
      '<button type="button" class="opt" data-act="ans" data-i="' + i + '">' +
      (o.sub ? '<span class="osym">' + esc(o.label) + '</span><small>' + esc(o.sub) + '</small>' : esc(o.label)) +
      '</button>').join('') + '</div>' +
    '<div class="qfb" id="qfb" aria-live="polite"></div>';
  if (q.type !== 'kk2word') speak(w.word);
}

function showResult() {
  const n = qz.list.length;
  const wrongHTML = qz.wrong.length
    ? '<h3>再複習一下這些單字</h3><ul class="qwrong">' + qz.wrong.map(r =>
        '<li><b>' + esc(r.w.word) + '</b>' + sayBtn(r.w.word) +
        ' <span class="qkk">[' + esc(r.w.kk) + ']</span>　' + esc(r.w.zh) + '</li>').join('') + '</ul>'
    : '<p class="good">全部答對，太棒了！</p>';
  $('#qz-body').innerHTML =
    '<h2>練習結果</h2>' +
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
  setup() { quizSetup(qz.cfg ? qz.cfg.syms : null); },
  all() { document.querySelectorAll('input[name=qsym]').forEach(x => { x.checked = true; }); updateInfo(); },
  none() { document.querySelectorAll('input[name=qsym]').forEach(x => { x.checked = false; }); updateInfo(); },
  go() {
    const cfg = readCfg();
    const err = $('#qs-err');
    if (!cfg.syms.length) { err.textContent = '請至少選一個音標。'; return; }
    if (!cfg.types.length) { err.textContent = '請至少選一種題型。'; return; }
    const pool = poolOf(cfg.syms);
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
    const ok = q.options[+btn.dataset.i].key === q.answer;
    if (ok) qz.score++;
    else if (!qz.wrong.includes(q.r)) qz.wrong.push(q.r);
    document.querySelectorAll('#qz-body .opt').forEach(o => {
      o.disabled = true;
      if (q.options[+o.dataset.i].key === q.answer) o.classList.add('ok');
      else if (o === btn) o.classList.add('bad');
    });
    const last = qz.i === qz.list.length - 1;
    const symText = q.type === 'listen2sym' ? '　音標 <b>[' + esc(q.r.s.symbol) + ']</b>' : '';
    $('#qfb').innerHTML =
      '<p class="' + (ok ? 'good' : 'miss') + '">' + (ok ? '答對了！' : '答錯了') + '</p>' +
      '<p class="qans"><b>' + esc(w.word) + '</b>' + sayBtn(w.word) +
      ' <span class="qkk">[' + esc(w.kk) + ']</span>　' + esc(w.zh) + symText + '</p>' +
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

// week 有給就預先勾選那一週的音標；沒給就全選
function openQuiz(week) {
  quizSetup(week ? SYMS.filter(s => s.week === week).map(s => s.idx) : null);
  $('#qz').showModal();
}

function initQuiz() {
  if (typeof HTMLDialogElement !== 'function') return; // 太舊的瀏覽器沒有 <dialog>，就不顯示練習按鈕
  const dlg = $('#qz');
  dlg.addEventListener('click', e => {
    const say = e.target.closest('.say');
    if (say) { speak(say.dataset.say); return; }
    const b = e.target.closest('[data-act]');
    if (b && QA[b.dataset.act]) QA[b.dataset.act](b);
  });
  dlg.addEventListener('change', e => {
    if (e.target.name === 'qsym') updateInfo();
  });
  dlg.addEventListener('close', () => { if (canSpeak) speechSynthesis.cancel(); });
  const btn = $('#qz-open');
  btn.hidden = false;
  btn.onclick = () => openQuiz();
}

async function main() {
  try {
    if (!canSpeak) document.body.classList.add('no-speech');
    load(await getJSON('data/kk.json'));
    if (!SYMS.length) throw new Error('資料裡沒有任何音標');
    render();
    bindApp();
    initToolbar();
    initQuiz();
  } catch (e) {
    $('#app').innerHTML = '<p class="err">讀取資料失敗：' + esc(e.message) +
      '<br>請確認 data/kk.json 在，並且用網址（http）開啟，不要直接雙擊 kk.html。</p>';
  }
}
main();
