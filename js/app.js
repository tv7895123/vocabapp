// 每頁放幾個單字卡（想改版面密度就改這裡）
const PER_PAGE = 3;
// 索引每頁放幾個單字
const INDEX_PER_PAGE = 90;
// 要不要顯示 A–Z 索引頁（已經有上方的週次下拉選單可以跳轉，單字多了索引會太長，先關掉）
const SHOW_INDEX = false;

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

function cardHTML(w, id) {
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
    (w.pos ? '<span class="pos">' + esc(w.pos) + '</span>' : '') + '</div>' +
    '<div class="zh">' + esc(w.zh) + '</div>' +
    (relHTML ? '<div class="rel">' + relHTML + '</div>' : '') +
    '<ul class="ex">' + exHTML + '</ul></section>';
}

function build(data) {
  // 1. 依週次切成每頁 PER_PAGE 個單字
  const pages = [];
  data.forEach(d => {
    for (let i = 0; i < d.words.length; i += PER_PAGE) {
      pages.push({ week: d.week, first: i === 0, words: d.words.slice(i, i + PER_PAGE) });
    }
  });
  const total = pages.reduce((n, p) => n + p.words.length, 0);
  const idxPages = SHOW_INDEX ? Math.max(1, Math.ceil(total / INDEX_PER_PAGE)) : 0;

  // 2. 單字頁（頁碼從索引頁之後開始）
  let n = 0;
  const entries = [];
  const weekPage = {};
  const wordHTML = pages.map((p, i) => {
    const pg = idxPages + 1 + i;
    if (p.first) weekPage[p.week] = pg;
    const cards = p.words.map(w => {
      const id = 'w' + (n++);
      entries.push({ word: w.word, id: id, pg: pg });
      return cardHTML(w, id);
    }).join('');
    return '<article class="page"' + (p.first ? ' id="wk-' + esc(p.week) + '"' : '') + '>' +
      '<div class="head"><span>國小英語單字</span><span>' + esc(p.week) + '</span></div>' +
      cards + '<div class="foot">' + pg + '</div></article>';
  }).join('');

  // 3. 索引頁（週次目錄 + A–Z 單字，含頁碼）— 目前關閉，改用上方的週次下拉選單
  let idxHTML = '';
  if (SHOW_INDEX) {
    const weeksHTML = '<div class="weeks">' + data.filter(d => weekPage[d.week]).map(d =>
      '<a href="#wk-' + esc(d.week) + '">' + esc(d.week) + '（p.' + weekPage[d.week] + '）</a>').join('') + '</div>';
    const sorted = entries.slice().sort((a, b) => a.word.toLowerCase().localeCompare(b.word.toLowerCase()));
    for (let k = 0; k < idxPages; k++) {
      const part = sorted.slice(k * INDEX_PER_PAGE, (k + 1) * INDEX_PER_PAGE);
      idxHTML += '<article class="page index"><div class="head"><span>國小英語單字</span><span>索引</span></div>' +
        (k === 0 ? weeksHTML : '') +
        '<div class="idx">' + part.map(e =>
          '<a href="#' + e.id + '"><span>' + esc(e.word) + '</span><i></i><span>' + e.pg + '</span></a>').join('') + '</div>' +
        '<div class="foot">' + (k + 1) + '</div></article>';
    }
  }

  $('#app').innerHTML = idxHTML + wordHTML;

  // 4. 工具列：週次跳轉、搜尋、列印
  const sel = $('#wk');
  data.filter(d => weekPage[d.week]).forEach(d => {
    const o = document.createElement('option');
    o.value = d.week;
    o.textContent = d.week;
    sel.appendChild(o);
  });
  sel.onchange = () => {
    const t = document.getElementById('wk-' + sel.value);
    if (t) t.scrollIntoView();
    sel.value = '';
  };
  $('#q').oninput = e => {
    const q = e.target.value.trim().toLowerCase();
    document.querySelectorAll('.card').forEach(c => { c.hidden = !!q && !c.dataset.q.includes(q); });
    document.querySelectorAll('.page:not(.index)').forEach(p => { p.hidden = !p.querySelector('.card:not([hidden])'); });
    document.querySelectorAll('.index').forEach(p => { p.hidden = !!q; });
  };
  $('#pr').onclick = () => window.print();
}

async function main() {
  try {
    bindSpeech();
    const m = await getJSON('data/manifest.json');
    const data = await Promise.all(m.weeks.map(w => getJSON('data/' + w + '.json')));
    build(data);
  } catch (e) {
    $('#app').innerHTML = '<p class="err">讀取資料失敗：' + esc(e.message) +
      '<br>請確認 data 資料夾與 manifest.json 都在，並且用網址（http）開啟，不要直接雙擊 index.html。</p>';
  }
}
main();
