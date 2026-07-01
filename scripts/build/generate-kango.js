#!/usr/bin/env node
/**
 * 訪問看護 研修ページ生成スクリプト（臨床トーン）
 * - kango-content.json を読み込み、kango-trainings/{id}.html を生成
 * - デザイン・部品は kango-trainings/kyuhen.html（急変・フィジカル試作）と同一
 * - 修了記録・報告メールは cert-config-kango.js（伊福管理者＋本部）に接続
 *
 * ブロック型スキーマ（section.blocks[]）:
 *   { t:'p', text }                                     段落（**強調**可）
 *   { t:'h3', text }                                    小見出し
 *   { t:'points', items:[...] }                         チェック箇条書き
 *   { t:'callout', kind:'law|alert|tip|warn', title, text?, items?[] }
 *   { t:'table', head:[...], rows:[[...]], dangerCol }  基準値表（dangerCol列を赤字）
 *   { t:'steps', items:[{k,text}] }                     ABC / ISBARC 等の行
 *   { t:'case', tag?, text, q, ans }                    症例カード
 *
 * 使い方: node scripts/build/generate-kango.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const OUT = path.join(ROOT, 'kango-trainings');
const DATA = path.join(__dirname, 'kango-content.json');

function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
// コンテンツは自社作成（信頼済み）。**強調** と、限定した安全なタグ（b/strong/br）のみ許可する。
function md(s) {
  return esc(s)
    .replace(/&lt;(\/?)(b|strong|br)\s*\/?&gt;/g, '<$1$2>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
}
function jesc(s) { return JSON.stringify(String(s)); }

const CALLOUT_TITLE = { law: '📘', alert: '⚠️', tip: '✅', warn: '🟠' };

function renderBlock(b) {
  switch (b.t) {
    case 'p':
      return `  <p>${md(b.text)}</p>`;
    case 'h3':
      return `  <h3>${md(b.text)}</h3>`;
    case 'points':
      return `  <ul class="goal-list">\n${b.items.map(i => `    <li>${md(i)}</li>`).join('\n')}\n  </ul>`;
    case 'callout': {
      const icon = b.icon || CALLOUT_TITLE[b.kind] || '';
      const title = b.title ? `\n    <div class="c-title">${icon} ${esc(b.title)}</div>` : '';
      let body = '';
      if (b.items) body = `\n    <ul>\n${b.items.map(i => `      <li>${md(i)}</li>`).join('\n')}\n    </ul>`;
      else if (b.text) body = `\n    ${md(b.text)}`;
      return `  <div class="callout ${b.kind}">${title}${body}\n  </div>`;
    }
    case 'table': {
      const head = `      <tr>${b.head.map(h => `<th>${esc(h)}</th>`).join('')}</tr>`;
      const rows = b.rows.map(r =>
        `      <tr>${r.map((c, i) => {
          const cls = i === 0 ? ' class="item"' : (i === b.dangerCol ? ' class="danger"' : '');
          return `<td${cls}>${md(c)}</td>`;
        }).join('')}</tr>`
      ).join('\n');
      return `  <table class="vital-table">\n    <thead>\n${head}\n    </thead>\n    <tbody>\n${rows}\n    </tbody>\n  </table>`;
    }
    case 'steps':
      return `  <div class="isbarc">\n${b.items.map(i =>
        `    <div class="isbarc-row"><div class="isbarc-key">${esc(i.k)}</div><div class="isbarc-txt">${md(i.text)}</div></div>`
      ).join('\n')}\n  </div>`;
    case 'case':
      return `  <div class="case">
    <div class="case-tag">${esc(b.tag || '症例で考える')}</div>
    <p>${md(b.text)}</p>
    <p class="q">${md(b.q)}</p>
    <p style="font-size:13px;color:#5B6E72;margin-top:6px;">${md(b.ans)}</p>
  </div>`;
    default:
      return '';
  }
}

function renderSection(s, idx) {
  const blocks = (s.blocks || []).map(renderBlock).join('\n');
  return `<div class="sec">
  <h2><span class="sec-num">${esc(s.n != null ? s.n : (idx + 1))}</span>${esc(s.h)}</h2>
  <div class="ja-sub">${esc(s.sub || '')}</div>
${blocks}
</div>`;
}

function renderChecklist(items) {
  if (!items || !items.length) return '';
  return `<div class="sec">
  <h2><span class="sec-num">✔</span>現場チェックリスト</h2>
  <div class="ja-sub">対応前の確認</div>
  <ul class="checklist">
${items.map(i => `    <li>${md(i)}</li>`).join('\n')}
  </ul>
</div>`;
}

function renderQuiz(quiz) {
  const items = quiz.map((q, i) => {
    const opts = q.opts.map(o =>
      `    <button class="quiz-opt" onclick="checkQuiz(this,${o.ok ? 'true' : 'false'})">${md(o.t)}</button>`
    ).join('\n');
    return `  <div class="quiz-box">
    <div class="quiz-q">Q${i + 1}. ${md(q.q)}</div>
${opts}
    <div class="quiz-fb">${md(q.fb)}</div>
  </div>`;
  }).join('\n');
  return `<div class="sec">
  <h2><span class="sec-num">?</span>確認テスト</h2>
  <div class="ja-sub">全${quiz.length}問</div>
${items}
</div>`;
}

const CSS = `@import url('https://fonts.googleapis.com/css2?family=Zen+Kaku+Gothic+New:wght@400;500;700;900&display=swap');
:root{--primary:#0E7C86;--primary-dark:#095961;--accent:#E0533D;--amber:#E8912A;--ok:#2E9E6B;--ink:#1A2E33;--muted:#5B6E72;--line:#E3EBEC;--bg:#F4F8F8;--panel:#FFFFFF;}
*{margin:0;padding:0;box-sizing:border-box;}
body{font-family:'Zen Kaku Gothic New',sans-serif;background:var(--bg);color:var(--ink);line-height:1.85;padding:20px 14px 70px;-webkit-font-smoothing:antialiased;}
.wrap{max-width:760px;margin:0 auto;}
.header{background:linear-gradient(135deg,var(--primary-dark),var(--primary));border-radius:18px;padding:30px 26px;color:#fff;margin-bottom:22px;position:relative;overflow:hidden;}
.header::after{content:'';position:absolute;right:-30px;top:-30px;width:160px;height:160px;border-radius:50%;background:rgba(255,255,255,.06);}
.header .badge{display:inline-block;background:rgba(255,255,255,.18);padding:5px 16px;border-radius:20px;font-size:12px;font-weight:700;letter-spacing:1px;margin-bottom:12px;}
.header h1{font-size:clamp(21px,4.6vw,30px);font-weight:900;line-height:1.45;position:relative;}
.header .lead{font-size:14px;opacity:.95;margin-top:10px;position:relative;}
.header .meta{font-size:12px;opacity:.8;margin-top:14px;position:relative;}
.sec{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:24px 22px;margin-bottom:16px;box-shadow:0 1px 6px rgba(14,124,134,.05);}
.sec-num{display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:8px;background:var(--primary);color:#fff;font-weight:900;font-size:15px;margin-right:10px;flex-shrink:0;}
.sec h2{font-size:19px;font-weight:900;color:var(--primary-dark);display:flex;align-items:center;margin-bottom:4px;}
.sec .ja-sub{font-size:12px;color:var(--muted);margin:2px 0 16px 40px;}
.sec h3{font-size:15px;font-weight:700;color:var(--ink);margin:18px 0 8px;padding-left:12px;border-left:4px solid var(--primary);}
.sec p{font-size:15px;margin-bottom:10px;}
.goal-list{list-style:none;}
.goal-list li{padding:7px 0 7px 30px;position:relative;font-size:15px;}
.goal-list li::before{content:'✓';position:absolute;left:0;top:7px;width:20px;height:20px;background:var(--ok);color:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;}
.vital-table{width:100%;border-collapse:collapse;margin:12px 0;font-size:14px;}
.vital-table th,.vital-table td{border:1px solid var(--line);padding:9px 10px;text-align:left;}
.vital-table th{background:var(--primary);color:#fff;font-weight:700;}
.vital-table thead th:first-child{border-top-left-radius:8px;}
.vital-table thead th:last-child{border-top-right-radius:8px;}
.vital-table tbody tr:nth-child(even){background:#F6FAFA;}
.vital-table .danger{color:var(--accent);font-weight:700;}
.vital-table .item{font-weight:700;white-space:nowrap;}
.callout{border-radius:10px;padding:14px 16px;margin:14px 0;font-size:14px;}
.callout .c-title{font-weight:900;margin-bottom:6px;display:flex;align-items:center;gap:6px;}
.callout.law{background:#EAF3F4;border-left:5px solid var(--primary);}
.callout.alert{background:#FCEDEA;border-left:5px solid var(--accent);}
.callout.tip{background:#EAF6EF;border-left:5px solid var(--ok);}
.callout.warn{background:#FDF4E6;border-left:5px solid var(--amber);}
.callout ul{margin:4px 0 0 18px;}
.callout li{margin-bottom:3px;}
.case{background:#F7FAFB;border:1px dashed #B9D2D5;border-radius:12px;padding:16px 18px;margin:16px 0;}
.case .case-tag{display:inline-block;background:var(--primary-dark);color:#fff;font-size:11px;font-weight:700;padding:3px 12px;border-radius:12px;margin-bottom:8px;}
.case p{font-size:14px;}
.case .q{font-weight:700;color:var(--primary-dark);margin-top:8px;}
.isbarc{display:grid;gap:8px;margin:12px 0;}
.isbarc-row{display:flex;gap:12px;align-items:flex-start;background:#F6FAFA;border-radius:10px;padding:10px 12px;}
.isbarc-key{flex-shrink:0;min-width:34px;height:34px;padding:0 6px;border-radius:8px;background:var(--primary);color:#fff;font-weight:900;font-size:15px;display:flex;align-items:center;justify-content:center;}
.isbarc-txt{font-size:14px;}
.isbarc-txt b{color:var(--primary-dark);}
.checklist{list-style:none;background:#F7FAFB;border-radius:12px;padding:16px 18px;}
.checklist li{padding:6px 0 6px 30px;position:relative;font-size:14px;border-bottom:1px solid var(--line);}
.checklist li:last-child{border-bottom:none;}
.checklist li::before{content:'□';position:absolute;left:4px;top:5px;color:var(--primary);font-weight:700;font-size:16px;}
.quiz-box{border:2px solid var(--primary);border-radius:12px;padding:18px;margin:14px 0;}
.quiz-q{font-weight:700;color:var(--primary-dark);margin-bottom:12px;font-size:15px;}
.quiz-opt{display:block;width:100%;text-align:left;padding:12px 14px;margin-bottom:8px;background:#F5F5F5;border:2px solid #DDD;border-radius:10px;font-family:inherit;font-size:14px;cursor:pointer;line-height:1.7;}
.quiz-opt:hover{border-color:var(--primary);background:#EAF3F4;}
.quiz-opt.correct{background:#E9F6EF;border-color:var(--ok);}
.quiz-opt.wrong{background:#FCEDEA;border-color:var(--accent);}
.quiz-fb{display:none;margin-top:10px;padding:12px;border-radius:8px;font-size:13px;line-height:1.7;}
.quiz-fb.show{display:block;}
.cert-area{text-align:center;}
.cert-area input{width:100%;max-width:320px;padding:13px 18px;border:2px solid #CFDDDE;border-radius:12px;font-size:16px;font-family:inherit;font-weight:700;text-align:center;outline:none;margin:10px 0;}
.cert-area input:focus{border-color:var(--primary);}
.btn-gen{display:inline-block;padding:13px 40px;background:var(--primary);color:#fff;border:none;border-radius:50px;font-size:15px;font-weight:700;font-family:inherit;cursor:pointer;}
.btn-gen:hover{background:var(--primary-dark);}
.cert-card{display:none;background:#fff;border:3px double var(--primary);border-radius:16px;padding:30px 24px;margin:18px auto;max-width:500px;}
.cert-card.show{display:block;}
.cert-card .c-badge{display:inline-block;background:var(--primary);color:#fff;font-size:11px;font-weight:700;letter-spacing:3px;padding:5px 18px;border-radius:20px;}
.cert-card .c-title{font-size:24px;font-weight:900;color:var(--primary-dark);margin:12px 0 4px;}
.cert-card .c-name{font-size:23px;font-weight:700;margin:16px 0 6px;padding-bottom:8px;border-bottom:2px solid var(--line);}
.cert-card .c-body{font-size:13px;color:var(--muted);margin:10px 0;line-height:1.7;}
.cert-card .c-org{font-size:14px;font-weight:700;margin-top:16px;color:var(--ink);}
.cert-card .c-org small{display:block;font-size:11px;font-weight:400;color:var(--muted);margin-top:2px;}
.btn-mail{display:none;margin:10px auto 0;padding:13px 30px;background:var(--ok);color:#fff;border-radius:50px;font-size:14px;font-weight:700;text-decoration:none;}
.btn-mail.show{display:inline-block;}
.footer{text-align:center;font-size:13px;margin-top:26px;color:var(--muted);}
.footer a{color:var(--primary);margin:0 8px;text-decoration:none;}
.disclaimer{font-size:12px;color:var(--muted);background:#EDF3F3;border-radius:10px;padding:12px 14px;margin-top:18px;line-height:1.7;}`;

function buildPage(t) {
  const sections = t.sections.map(renderSection).join('\n\n');
  const checklist = renderChecklist(t.checklist);
  const quiz = renderQuiz(t.quiz);
  const trainingTitle = `${t.ja} 研修（訪問看護）`;
  const badge = t.cat === '法定' ? '訪問看護 法定研修' : '訪問看護 実務研修';

  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>訪問看護 ${esc(t.ja)} 研修 | 訪問看護ようき</title>
<meta name="description" content="訪問看護における${esc(t.ja)}の研修。訪問看護ようき（有限会社 陽気）の研修コンテンツ。">
<link rel="canonical" href="https://kaigo-yoki.jp/recruit/kango-trainings/${t.id}">
<link rel="icon" type="image/png" href="../favicon.png">
<style>
${CSS}
</style>
</head>
<body>
<div class="wrap">

<div class="header">
  <div class="badge">${badge}</div>
  <h1>${esc(t.title || t.ja)}</h1>
  <div class="lead">${esc(t.lead || '')}</div>
  <div class="meta">訪問看護ようき（有限会社 陽気）／所要時間の目安：${esc(t.minutes || '15〜20分')}</div>
</div>

<div class="sec">
  <h2><span class="sec-num">◎</span>この研修の学習目標</h2>
  <div class="ja-sub">Learning objectives</div>
  <ul class="goal-list">
${t.goals.map(g => `    <li>${md(g)}</li>`).join('\n')}
  </ul>
</div>

${sections}

${checklist ? checklist + '\n\n' : ''}${quiz}

<div class="sec cert-area">
  <h2 style="justify-content:center;"><span class="sec-num">🎓</span>研修修了・修了証の発行</h2>
  <div class="ja-sub" style="margin-left:0;">お名前を入力して修了証を発行し、管理者へ報告メールを送ってください。</div>
  <p style="font-size:13px;color:#5B6E72;">※ お名前は職員名簿と同じ表記でご入力ください。</p>
  <input type="text" id="certName" placeholder="例: 伊福 いつよ" autocomplete="name">
  <br>
  <button class="btn-gen" id="certGenBtn" onclick="generateCert()">📜 修了証を発行する</button>

  <div class="cert-card" id="certCard">
    <div class="c-badge">研 修 修 了 証</div>
    <div class="c-title">研修修了証</div>
    <div class="c-name" id="certDisplayName"></div>
    <div class="c-body" id="certDisplayBody"></div>
    <div class="c-org">有限会社 陽気<br>訪問看護 ようき<small>沖縄県南城市佐敷津波古1354-1</small></div>
  </div>

  <a class="btn-mail" id="certMailBtn" href="#">✉️ 修了報告メールを送信</a>

  <div class="disclaimer">
    本研修は在宅看護における一般的な考え方を整理した教育用コンテンツです。実際の対応は、主治医の指示・各利用者の個別指示書・事業所のマニュアルおよび最新のガイドラインに従ってください。
  </div>
</div>

<div class="footer">
  <a href="../kenshu-kango.html">📚 訪問看護 研修一覧</a>｜<a href="../">🏠 トップページ</a>
</div>
</div>

<script>
const TRAINING_TITLE = ${jesc(trainingTitle)};

function checkQuiz(btn, isCorrect) {
  const box = btn.closest('.quiz-box');
  box.querySelectorAll('.quiz-opt').forEach(o => { o.disabled = true; o.style.pointerEvents = 'none'; });
  if (isCorrect) { btn.classList.add('correct'); }
  else {
    btn.classList.add('wrong');
    box.querySelectorAll('.quiz-opt').forEach(o => { if ((o.getAttribute('onclick') || '').includes('true')) o.classList.add('correct'); });
  }
  const fb = box.querySelector('.quiz-fb');
  fb.classList.add('show');
  fb.style.background = isCorrect ? '#E9F6EF' : '#FCEDEA';
}

function generateCert() {
  const nameInput = document.getElementById('certName');
  const name = nameInput.value.trim();
  if (!name) { nameInput.style.borderColor = '#E0533D'; nameInput.focus(); return; }
  nameInput.style.borderColor = '#0E7C86';

  const today = new Date();
  const dateStr = today.getFullYear() + '年' + (today.getMonth() + 1) + '月' + today.getDate() + '日';
  document.getElementById('certDisplayName').textContent = name + ' 殿';
  document.getElementById('certDisplayBody').textContent =
    '上記の者は「' + ${jesc(t.ja)} + '」研修を修了したことを証します。 修了日: ' + dateStr;
  document.getElementById('certCard').classList.add('show');

  const mailCfg = window.CERT_MAIL_CONFIG || { to: 'itsuyo@kaigo-yoki.jp', cc: 'info@kaigo-yoki.jp', honorific: '訪問看護 管理者 様' };
  const subject = encodeURIComponent('【研修修了報告】' + TRAINING_TITLE + ' - ' + name);
  const body = encodeURIComponent(
    mailCfg.honorific + '\\n\\n' +
    '研修修了のご報告をいたします。\\n\\n' +
    '受講者名: ' + name + '\\n' +
    '研修テーマ: ' + TRAINING_TITLE + '\\n' +
    '修了日: ' + dateStr + '\\n\\n' +
    '以上、ご確認をお願いいたします。'
  );
  let href = 'mailto:' + mailCfg.to + '?';
  if (mailCfg.cc) href += 'cc=' + mailCfg.cc + '&';
  href += 'subject=' + subject + '&body=' + body;
  document.getElementById('certMailBtn').href = href;
  document.getElementById('certMailBtn').classList.add('show');
}
</script>
<script src="../scripts/cert-config-kango.js"></script>
<script src="../scripts/read-aloud.js"></script>
</body>
</html>
`;
}

const trainings = JSON.parse(fs.readFileSync(DATA, 'utf8'));
let n = 0;
for (const t of trainings) {
  fs.writeFileSync(path.join(OUT, `${t.id}.html`), buildPage(t), 'utf8');
  console.log(`OK: kango-trainings/${t.id}.html`);
  n++;
}
console.log(`${n} ページ生成完了`);
