#!/usr/bin/env node
/**
 * 法定研修の翻訳版ページ生成スクリプト（ミャンマー語・フィリピン語）
 * - translated-content-my.json / translated-content-tl.json を読み込み、
 *   trainings/{id}-my.html / {id}-tl.html を生成する
 * - スタイル・構成は restraint-my.html / restraint-tl.html と同一
 * - 修了記録は KENSHU_LOG_PATH により日本語版と同じ研修として扱われる
 *
 * 使い方: node scripts/build/generate-translated.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const OUT = path.join(ROOT, 'trainings');

const LANGS = {
  my: {
    htmlLang: 'my',
    fontImport: "@import url('https://fonts.googleapis.com/css2?family=Zen+Maru+Gothic:wght@400;700;900&family=Noto+Sans+Myanmar:wght@400;700&display=swap');",
    fontFamily: "'Noto Sans Myanmar', 'Zen Maru Gothic', sans-serif",
    lineHeight: '2',
    langLabel: 'မြန်မာ',
    suffixJa: 'ミャンマー語版で受講',
    versionJa: 'ミャンマー語版',
    learnH: 'ဤသင်တန်းတွင် လေ့လာရမည့်အရာ',
    quizH: '✏️ မေးခွန်းများ',
    quizWord: 'မေးခွန်း',
    nums: ['၁', '၂', '၃', '၄', '၅'],
    secNum: i => `${['၁', '၂', '၃', '၄', '၅'][i]}။ `,
    certH: '🎓 သင်တန်း ပြီးပါပြီ!',
    certInstr: 'နာမည်ကို ရေးပြီး အောင်လက်မှတ် ထုတ်ပါ။',
    certNote: 'ဝန်ထမ်းစာရင်းတွင် ပါသည့်အတိုင်း ရေးပါ（職員名簿と同じ名前で）',
    placeholder: 'ဥပမာ: MAR YAR OO',
    btnGen: '📜 အောင်လက်မှတ် ထုတ်မည်',
    btnMail: '✉️ ပြီးစီးကြောင်း အီးမေးလ် ပို့မည်（修了報告メール）',
    boxLabels: { law: '📘', ng: '⚠️ မလုပ်ရ (NG)', ok: '👍 မှန်ကန်သော နည်းလမ်း', warn: '⚠️ သတိ' }
  },
  tl: {
    htmlLang: 'fil',
    fontImport: "@import url('https://fonts.googleapis.com/css2?family=Zen+Maru+Gothic:wght@400;700;900&display=swap');",
    fontFamily: "'Zen Maru Gothic', sans-serif",
    lineHeight: '1.9',
    langLabel: 'Filipino',
    suffixJa: 'フィリピン語版で受講',
    versionJa: 'フィリピン語版',
    learnH: 'Matututunan sa pagsasanay na ito',
    quizH: '✏️ Quiz',
    quizWord: 'Tanong',
    nums: ['1', '2', '3', '4', '5'],
    secNum: i => `${i + 1}. `,
    certH: '🎓 Congratulations! Tapos na ang pagsasanay!',
    certInstr: 'Isulat ang pangalan mo at i-issue ang certificate.',
    certNote: 'Isulat ito katulad ng nakasulat sa staff list（職員名簿と同じ名前で）',
    placeholder: 'Halimbawa: ITOKAZU JOANNA',
    btnGen: '📜 I-issue ang certificate',
    btnMail: '✉️ Ipadala ang completion report（修了報告メール）',
    boxLabels: { law: '📘', ng: '⚠️ Bawal (NG)', ok: '👍 Tamang paraan', warn: '⚠️ Tandaan' }
  }
};

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
// <strong>のみ許可した簡易マークアップ（**text**）
function md(s) {
  return esc(s).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
}

function jaPageHref(t) {
  return t.logPath === '/rinri-kenshu' ? '../rinri-kenshu.html' : `./${t.id}.html`;
}

function langSwitch(t, lang) {
  const ja = `<a href="${jaPageHref(t)}">日本語</a>`;
  const my = lang === 'my' ? '<strong>မြန်မာ</strong>' : `<a href="./${t.id}-my.html">မြန်မာ</a>`;
  const tl = lang === 'tl' ? '<strong>Filipino</strong>' : `<a href="./${t.id}-tl.html">Filipino</a>`;
  return `<div class="lang-switch">🌐 ${ja}｜${my}｜${tl}</div>`;
}

function sectionHTML(sec, idx, L) {
  const points = (sec.points || []).map(p => `    <li>${md(p)}</li>`).join('\n');
  const boxes = (sec.boxes || []).map(b => {
    const label = b.b ? `${L.boxLabels[b.type] || ''} ${b.b}`.trim() : L.boxLabels[b.type] || '';
    return `  <div class="box box-${b.type === 'warn' ? 'ng' : b.type}"><b>${md(label)}</b>${md(b.t)}</div>`;
  }).join('\n');
  const swaps = (sec.swaps || []).map(s =>
    `  <div class="swap"><span class="from">${esc(s.from)}</span> → <span class="to">${esc(s.to)}</span></div>`
  ).join('\n');
  const lead = sec.lead ? `  <p style="font-size:14px;">${md(sec.lead)}</p>\n` : '';
  return `<div class="sec">
  <h2>${L.secNum(idx)}${esc(sec.h)}</h2>
  <div class="ja-label">${esc(sec.ja)}</div>
${lead}${points ? `  <ul class="points">\n${points}\n  </ul>\n` : ''}${boxes}${boxes && swaps ? '\n' : ''}${swaps}
</div>`;
}

function quizHTML(t, L) {
  const items = t.quiz.map((q, i) => {
    const opts = q.opts.map((o, j) =>
      `    <button class="quiz-opt" onclick="checkQuiz(this,${o.ok ? 'true' : 'false'})">${'ABC'[j]}. ${md(o.t)}</button>`
    ).join('\n');
    return `  <div class="quiz-box">
    <div class="quiz-q">${L.quizWord} ${L.nums[i]} — ${md(q.q)}</div>
${opts}
    <div class="quiz-fb">${md(q.fb)}</div>
  </div>`;
  }).join('\n\n');
  return `<div class="sec">
  <h2>${L.quizH}</h2>
  <div class="ja-label">確認クイズ</div>

${items}
</div>`;
}

function buildPage(t, lang) {
  const L = LANGS[lang];
  const trainingTitleJs = `${t.jaFull}（${L.suffixJa}）`;
  const sections = t.sections.map((s, i) => sectionHTML(s, i, L)).join('\n\n');
  const intro = t.intro.map(p => `    <li>${md(p)}</li>`).join('\n');
  const titleHTML = t.title.map(esc).join('<br>');

  return `<!DOCTYPE html>
<html lang="${L.htmlLang}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(t.title.join(' '))} | ${esc(t.jaFull)}（${L.versionJa}）</title>
<meta name="description" content="${esc(t.jaFull)}の${L.versionJa}。訪問介護ようき（有限会社 陽気）の法定研修コンテンツ。">
<link rel="canonical" href="https://kaigo-yoki.jp/recruit/trainings/${t.id}-${lang}">
<link rel="icon" type="image/png" href="../favicon.png">
<style>
${L.fontImport}

:root {
  --primary: #2D5A8E;
  --accent: #E8594F;
  --warm: #F9A826;
  --green: #4CAF7D;
  --bg: #FFF8F0;
  --text: #2C2C2C;
}
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: ${L.fontFamily};
  background: var(--bg); color: var(--text);
  padding: 20px 14px 60px; line-height: ${L.lineHeight};
}
.wrap { max-width: 720px; margin: 0 auto; }
.lang-switch { text-align: center; font-size: 13px; margin-bottom: 14px; }
.lang-switch a { color: var(--primary); font-weight: 700; margin: 0 8px; }
.header {
  background: linear-gradient(135deg, #FF6B35, #F7C948);
  border-radius: 18px; padding: 30px 22px; text-align: center; color: #fff; margin-bottom: 20px;
}
.header .badge { display: inline-block; background: var(--accent); padding: 5px 20px; border-radius: 30px; font-size: 12px; font-weight: 700; margin-bottom: 12px; }
.header h1 { font-size: clamp(20px, 5vw, 30px); font-weight: 700; line-height: 1.7; text-shadow: 0 2px 8px rgba(0,0,0,.2); }
.header .ja { font-size: 13px; opacity: .95; margin-top: 8px; font-family: 'Zen Maru Gothic', sans-serif; }
.sec {
  background: #fff; border: 2px solid #EEE; border-radius: 16px;
  padding: 22px 20px; margin-bottom: 18px; box-shadow: 0 2px 10px rgba(0,0,0,.05);
}
.sec h2 { font-size: 18px; color: var(--primary); font-weight: 700; margin-bottom: 4px; }
.sec .ja-label { font-size: 12px; color: #999; font-family: 'Zen Maru Gothic', sans-serif; margin-bottom: 12px; }
.points { list-style: none; }
.points li { padding: 8px 0 8px 34px; position: relative; border-bottom: 1px solid #F2F2F2; font-size: 15px; }
.points li::before {
  content: '✓'; position: absolute; left: 0; top: 12px; width: 22px; height: 22px;
  background: var(--green); color: #fff; border-radius: 50%;
  display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700;
}
.box { border-radius: 12px; padding: 14px 16px; margin: 12px 0; font-size: 14px; }
.box-ng { background: #FFEBEE; border-left: 5px solid var(--accent); }
.box-ok { background: #E8F5E9; border-left: 5px solid var(--green); }
.box-law { background: #E8EAF6; border-left: 5px solid #3F51B5; }
.box b { display: block; margin-bottom: 4px; }
.swap { background: #F5F5F5; border-radius: 10px; padding: 10px 14px; margin: 8px 0; font-size: 14px; }
.swap .from { color: var(--accent); font-weight: 700; }
.swap .to { color: #2E7D32; font-weight: 700; }
.quiz-box { border: 3px solid var(--primary); border-radius: 14px; padding: 18px; margin: 14px 0; background: #fff; }
.quiz-q { font-weight: 700; color: var(--primary); margin-bottom: 12px; font-size: 15px; }
.quiz-opt {
  display: block; width: 100%; text-align: left; padding: 12px 14px; margin-bottom: 8px;
  background: #F5F5F5; border: 2px solid #DDD; border-radius: 10px;
  font-family: inherit; font-size: 14px; cursor: pointer; line-height: 1.8;
}
.quiz-opt.correct { background: #E8F5E9; border-color: var(--green); }
.quiz-opt.wrong { background: #FFEBEE; border-color: var(--accent); }
.quiz-fb { display: none; margin-top: 10px; padding: 12px; border-radius: 8px; font-size: 13px; }
.quiz-fb.show { display: block; }
.cert-area { text-align: center; }
.cert-area input {
  width: 100%; max-width: 320px; padding: 13px 18px; border: 3px solid #DDD; border-radius: 12px;
  font-size: 16px; font-family: inherit; font-weight: 700; text-align: center; outline: none; margin: 10px 0;
}
.cert-area input:focus { border-color: var(--warm); }
.btn-gen {
  display: inline-block; padding: 13px 38px; background: linear-gradient(135deg, #F9A826, #FF8F00);
  color: #fff; border: none; border-radius: 50px; font-size: 15px; font-weight: 700; font-family: inherit; cursor: pointer;
}
.cert-card {
  display: none; background: linear-gradient(135deg, #FFFDF0, #FFF8E1); border: 4px double #D4A017;
  border-radius: 18px; padding: 30px 22px; margin: 18px auto; max-width: 480px;
}
.cert-card.show { display: block; }
.cert-card .c-title { font-size: 22px; font-weight: 900; color: #D4A017; letter-spacing: 2px; font-family: 'Zen Maru Gothic', sans-serif; }
.cert-card .c-name { font-size: 22px; font-weight: 700; margin: 14px 0 6px; border-bottom: 2px solid rgba(212,160,23,.3); padding-bottom: 8px; }
.cert-card .c-body { font-size: 13px; color: #4A4A68; margin: 10px 0; }
.cert-card .c-org { font-size: 13px; font-weight: 700; margin-top: 14px; font-family: 'Zen Maru Gothic', sans-serif; }
.btn-mail {
  display: none; margin: 8px auto 0; padding: 13px 30px; background: linear-gradient(135deg, #4CAF7D, #43A047);
  color: #fff; border-radius: 50px; font-size: 14px; font-weight: 700; text-decoration: none;
}
.btn-mail.show { display: inline-block; }
.footer { text-align: center; font-size: 13px; margin-top: 26px; }
.footer a { color: var(--primary); margin: 0 8px; }
</style>
</head>
<body>
<div class="wrap">

${langSwitch(t, lang)}

<div class="header">
  <div class="badge">訪問介護 法定研修</div>
  <h1>${titleHTML}</h1>
  <div class="ja">${esc(t.jaFull)}（${L.versionJa}）</div>
</div>

<div class="sec">
  <h2>${L.learnH}</h2>
  <div class="ja-label">この研修で学ぶこと</div>
  <ul class="points">
${intro}
  </ul>
</div>

${sections}

${quizHTML(t, L)}

<div class="sec cert-area">
  <h2>${L.certH}</h2>
  <div class="ja-label">修了証の発行</div>
  <p style="font-size:14px;">${L.certInstr}<br><small>${L.certNote}</small></p>
  <input type="text" id="certName" placeholder="${L.placeholder}" autocomplete="name">
  <br>
  <button class="btn-gen" id="certGenBtn" onclick="generateCert()">${L.btnGen}</button>

  <div class="cert-card" id="certCard">
    <div class="c-title">研修修了証</div>
    <div class="c-name" id="certDisplayName"></div>
    <div class="c-body" id="certDisplayBody"></div>
    <div class="c-org">有限会社 陽気<br>訪問介護 ようき</div>
  </div>

  <a class="btn-mail" id="certMailBtn" href="#">${L.btnMail}</a>
</div>

<div class="footer">
  <a href="../kenshu.html">📚 研修一覧</a>｜<a href="${jaPageHref(t)}">🇯🇵 日本語版</a>
</div>
</div>

<script>
const TRAINING_TITLE = ${JSON.stringify(trainingTitleJs)};
// 進捗記録上は日本語版と同じ研修として扱う
window.KENSHU_LOG_PATH = ${JSON.stringify(t.logPath)};

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
  fb.style.background = isCorrect ? '#E8F5E9' : '#FFEBEE';
}

function generateCert() {
  const nameInput = document.getElementById('certName');
  const name = nameInput.value.trim();
  if (!name) { nameInput.style.borderColor = '#E8594F'; nameInput.focus(); return; }
  nameInput.style.borderColor = '#4CAF7D';

  const today = new Date();
  const dateStr = today.getFullYear() + '年' + (today.getMonth() + 1) + '月' + today.getDate() + '日';
  document.getElementById('certDisplayName').textContent = name;
  document.getElementById('certDisplayBody').textContent = '上記の者は「' + ${JSON.stringify(t.ja)} + '」研修（' + ${JSON.stringify(L.versionJa)} + '）を修了したことを証します。 修了日: ' + dateStr;
  document.getElementById('certCard').classList.add('show');

  // メールリンク生成（宛先は ../scripts/cert-config.js で一元管理）
  const mailCfg = window.CERT_MAIL_CONFIG || { to: 'rina@kaigo-yoki.jp', cc: 'info@kaigo-yoki.jp', honorific: '施設長 様' };
  const subject = encodeURIComponent('【研修修了報告】' + TRAINING_TITLE + ' - ' + name);
  const body = encodeURIComponent(
    mailCfg.honorific + '\\n\\n' +
    '研修修了のご報告をいたします。\\n\\n' +
    '受講者名: ' + name + '\\n' +
    '研修テーマ: ' + TRAINING_TITLE + '\\n' +
    '修了日: ' + dateStr + '\\n\\n' +
    '以上、ご確認をお願いいたします。'
  );
  document.getElementById('certMailBtn').href = 'mailto:' + mailCfg.to + '?cc=' + mailCfg.cc + '&subject=' + subject + '&body=' + body;
  document.getElementById('certMailBtn').classList.add('show');
}
</script>
<script src="../scripts/cert-config.js"></script>
</body>
</html>
`;
}

// ===== 実行 =====
let total = 0;
for (const lang of ['my', 'tl']) {
  const dataPath = path.join(__dirname, `translated-content-${lang}.json`);
  if (!fs.existsSync(dataPath)) { console.log(`スキップ: ${dataPath} がありません`); continue; }
  const trainings = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  for (const t of trainings) {
    const out = path.join(OUT, `${t.id}-${lang}.html`);
    fs.writeFileSync(out, buildPage(t, lang), 'utf8');
    console.log(`OK: trainings/${t.id}-${lang}.html`);
    total++;
  }
}
console.log(`${total} ページ生成完了`);
