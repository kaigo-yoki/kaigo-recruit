#!/usr/bin/env node
/**
 * 障害福祉（居宅介護）法定研修ページ生成スクリプト ― 漫画・ダジャレ風
 * - shougai-content.json を読み込み、shougai-trainings/{id}.html を生成
 * - デザインは介護版（trainings/*.html）と同一。CSSは shougai-style.css を再利用
 * - 修了報告メール・進捗記録は介護と同じ scripts/cert-config.js に接続
 *   （居宅介護＝訪問介護ようきの同じヘルパー・同じ施設長のため集約）
 *
 * コンテンツのブロック型（page.blocks[]）:
 *   {t:'speech', who:'oyaji|sakura|misaki', text}
 *   {t:'gag', text, sub}                      ダジャレ（直後にシーーーンを自動挿入）
 *   {t:'tsukkomi', text}
 *   {t:'box', kind:'law|important|danger|good', title, text}
 *   {t:'scenario', text}
 *   {t:'points', items:[...]}
 *
 * 使い方: node scripts/build/generate-shougai.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const OUT = path.join(ROOT, 'shougai-trainings');
const DATA = path.join(__dirname, 'shougai-content.json');
const CSS = fs.readFileSync(path.join(__dirname, 'shougai-style.css'), 'utf8');

function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
// 自社作成コンテンツ。**強調** と安全なタグ(b/strong/br)のみ許可
function md(s) {
  return esc(s)
    .replace(/&lt;(\/?)(b|strong|br)\s*\/?&gt;/g, '<$1$2>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
}
function jesc(s) { return JSON.stringify(String(s)); }

const WHO = {
  oyaji:  { cls: 'oyaji',    icon: '🧔',   name: 'ダジャレ所長' },
  sakura: { cls: 'student',  icon: '👩',   name: 'さくら' },
  misaki: { cls: 'tsukkomi', icon: '👩‍🦰', name: 'みさき先輩' }
};
const BOX_ICON = { law: '📘', important: '📘', danger: '⚠️', good: '👍' };

function renderBlock(b) {
  switch (b.t) {
    case 'speech': {
      const w = WHO[b.who] || WHO.oyaji;
      const right = (b.who === 'sakura' || b.who === 'misaki') ? ' right' : '';
      return `  <div class="speech${right}"><div class="speech-avatar ${w.cls}">${w.icon}</div><div class="speech-bubble bubble-${w.cls}"><div class="speech-name">${w.name}</div>${md(b.text)}</div></div>`;
    }
    case 'gag':
      return `  <div class="oyaji-gag"><div class="gag-text">${md(b.text)}</div>${b.sub ? `<div class="gag-sub">${md(b.sub)}</div>` : ''}</div>\n  <div class="shiin">シーーーン</div>`;
    case 'tsukkomi':
      return `  <div class="tsukkomi-text">${md(b.text)}</div>`;
    case 'box': {
      const kind = b.kind === 'law' ? 'law' : b.kind;
      const icon = BOX_ICON[b.kind] || '📘';
      return `  <div class="highlight-box ${kind}"><div class="box-title">${icon} ${esc(b.title || '')}</div><div class="box-content">${md(b.text)}</div></div>`;
    }
    case 'scenario':
      return `  <div class="scenario"><div class="scenario-title">📖 こんな場面を想像してみよう</div><p>${md(b.text)}</p></div>`;
    case 'points':
      return `  <ul class="point-list">\n${b.items.map(i => `    <li>${md(i)}</li>`).join('\n')}\n  </ul>`;
    default:
      return '';
  }
}

// 会話・ダジャレ系は manga-panel でまとめ、ボックス類はパネル外に出す（介護版と同じ見た目）
function renderPage(p, n) {
  const inPanel = new Set(['speech', 'gag', 'tsukkomi']);
  let html = '';
  let buf = [];
  const flush = () => {
    if (buf.length) { html += `  <div class="manga-panel">\n${buf.join('\n')}\n  </div>\n`; buf = []; }
  };
  (p.blocks || []).forEach(b => {
    if (inPanel.has(b.t)) buf.push(renderBlock(b));
    else { flush(); html += renderBlock(b) + '\n'; }
  });
  flush();
  return `<div class="page" id="page${n}">
  <div class="page-header">
    <div class="page-chapter">${esc(p.chapter)}</div>
    <div class="page-title">${esc(p.title)}</div>
  </div>
${html}</div>`;
}

function renderTocPage(t) {
  const toc = t.pages.map((p, i) =>
    `    <button class="toc-item" onclick="goToPage(${i + 2})"><span class="toc-num">${i + 1}</span><span class="toc-text">${esc(p.chapter)}: ${esc(p.title)}</span></button>`
  ).join('\n');
  return `<div class="page" id="page1">
  <div class="page-header">
    <div class="page-chapter">はじめに</div>
    <div class="page-title">今日の研修メニュー 📋</div>
  </div>
  <div class="manga-panel">
  <div class="speech"><div class="speech-avatar oyaji">🧔</div><div class="speech-bubble bubble-oyaji"><div class="speech-name">ダジャレ所長</div>今日のテーマは「${esc(t.ja)}」！障害福祉サービス（居宅介護）で働くみんなに必要な法定研修だよ。</div></div>
  <div class="speech right"><div class="speech-avatar student">👩</div><div class="speech-bubble bubble-student"><div class="speech-name">さくら</div>よろしくお願いします！しっかり覚えます。</div></div>
  <div class="speech right"><div class="speech-avatar tsukkomi">👩‍🦰</div><div class="speech-bubble bubble-tsukkomi"><div class="speech-name">みさき先輩</div>所長のダジャレは聞き流していいけど、中身は大事だからね。</div></div>
  </div>
  <div class="highlight-box important"><div class="box-title">📘 研修の目標</div><div class="box-content">${md(t.goal || '')}</div></div>
  <div class="toc">
${toc}
    <button class="toc-item" onclick="goToPage(${t.pages.length + 2})"><span class="toc-num">${t.pages.length + 1}</span><span class="toc-text">確認テスト＆まとめ</span></button>
  </div>
</div>`;
}

function renderQuizPage(t, n) {
  const items = t.quiz.map((q, i) => {
    const opts = q.opts.map(o =>
      `    <button class="quiz-option" onclick="checkQuiz(this, ${o.ok ? 'true' : 'false'})">${md(o.t)}</button>`
    ).join('\n');
    return `  <div class="quiz-box">
    <div class="quiz-question">❓ Q${i + 1} / ${t.quiz.length}: ${md(q.q)}</div>
    <div class="quiz-options">
${opts}
    </div>
    <div class="quiz-feedback">${md(q.fb)}</div>
  </div>`;
  }).join('\n');
  return `<div class="page" id="page${n}">
  <div class="page-header">
    <div class="page-chapter">確認テスト</div>
    <div class="page-title">確認テスト＆まとめ</div>
  </div>
${items}
  <ul class="point-list">
${(t.summary || []).map(s => `    <li>${md(s)}</li>`).join('\n')}
  </ul>
  <div class="completion-message">おつかれさまでした！最後にお名前を入れて修了証を発行してください。</div>
</div>`;
}

function buildPage(t) {
  const total = t.pages.length + 2; // TOC + 章 + クイズ
  const chapters = t.pages.map((p, i) => renderPage(p, i + 2)).join('\n');
  const trainingTitle = `${t.ja}（障害福祉・居宅介護）`;

  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>障害福祉 ${esc(t.ja)} 研修 ${esc(t.subtitle || '')} | 訪問介護ようき</title>
<meta name="description" content="障害福祉サービス（居宅介護）の${esc(t.ja)}研修。訪問介護ようき（有限会社 陽気）の法定研修コンテンツ。">
<link rel="canonical" href="https://kaigo-yoki.jp/recruit/shougai-trainings/${t.id}">
<link rel="icon" type="image/png" href="../favicon.png">
<style>
${CSS}
</style>
</head>
<body>

<!-- TITLE -->
<div class="title-screen" id="titleScreen">
  <div class="title-badge">障害福祉（居宅介護） 法定研修</div>
  <div class="title-main">笑って学ぼう！💥<br>${esc(t.ja)}</div>
  <div class="title-sub">${esc(t.subtitle || '')}<br>※ ギャグのクオリティは保証しません</div>
  <div class="title-characters">
    <div class="title-char">
      <div class="title-char-icon" style="background:#FFF3E0;">🧔</div>
      <div class="title-char-name">ダジャレ所長<br>（おやじ先生）</div>
    </div>
    <div class="title-char">
      <div class="title-char-icon" style="background:#E3F2FD;">👩</div>
      <div class="title-char-name">新人ヘルパー<br>さくらさん</div>
    </div>
    <div class="title-char">
      <div class="title-char-icon" style="background:#F3E5F5;">👩‍🦰</div>
      <div class="title-char-name">ツッコミ担当<br>先輩みさきさん</div>
    </div>
  </div>
  <button class="start-btn" onclick="startTraining()">▶ 研修をはじめる</button>
</div>

<div class="progress-bar" id="progressBar" style="display:none;"><div class="progress-fill" id="progressFill"></div></div>

${renderTocPage(t)}
${chapters}
${renderQuizPage(t, total)}

<div class="nav-bar" id="navBar" style="display:none;">
  <button class="nav-btn prev" id="prevBtn" onclick="prevPage()">◀ 前へ</button>
  <span class="nav-page" id="pageNum">1 / ${total}</span>
  <button class="nav-btn next" id="nextBtn" onclick="nextPage()">次へ ▶</button>
</div>

<script>
let currentPage = 0;
const totalPages = ${total};

function startTraining() {
  document.getElementById('titleScreen').style.display = 'none';
  document.getElementById('progressBar').style.display = 'block';
  document.getElementById('navBar').style.display = 'flex';
  currentPage = 1;
  showPage(currentPage);
}

function showPage(n) {
  document.querySelectorAll('.page').forEach(p => { p.classList.remove('active'); });
  const page = document.getElementById('page' + n);
  if (page) {
    page.classList.add('active');
    page.querySelectorAll('.manga-panel').forEach(p => {
      p.style.animation = 'none';
      p.offsetHeight;
      p.style.animation = '';
    });
  }
  document.getElementById('prevBtn').disabled = (n <= 1);
  document.getElementById('nextBtn').textContent = (n >= totalPages) ? '🎉 完了！' : '次へ ▶';
  document.getElementById('pageNum').textContent = n + ' / ' + totalPages;
  document.getElementById('progressFill').style.width = ((n / totalPages) * 100) + '%';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function nextPage() { if (currentPage < totalPages) { currentPage++; showPage(currentPage); } }
function prevPage() { if (currentPage > 1) { currentPage--; showPage(currentPage); } }
function goToPage(n) { currentPage = n; showPage(n); }

function checkQuiz(btn, isCorrect) {
  const quizBox = btn.closest('.quiz-box');
  const options = quizBox.querySelectorAll('.quiz-option');
  options.forEach(o => { o.disabled = true; o.style.pointerEvents = 'none'; });
  if (isCorrect) {
    btn.classList.add('correct');
    const fb = quizBox.querySelector('.quiz-feedback');
    if (fb) { fb.classList.add('show'); fb.style.background = '#E8F5E9'; }
  } else {
    btn.classList.add('wrong');
    options.forEach(o => { if (o.getAttribute('onclick') && o.getAttribute('onclick').includes('true')) o.classList.add('correct'); });
    const fb = quizBox.querySelector('.quiz-feedback');
    if (fb) { fb.classList.add('show'); fb.style.background = '#FFEBEE'; }
  }
}

// === 修了証書機能 ===
const TRAINING_TITLE = ${jesc(trainingTitle)};

function showCertSection() {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('navBar').style.display = 'none';
  document.getElementById('progressBar').style.display = 'none';
  const cs = document.getElementById('certSection');
  cs.classList.add('show');
  window.scrollTo({top:0,behavior:'smooth'});
}

function generateCert() {
  const nameInput = document.getElementById('certName');
  const name = nameInput.value.trim();
  if (!name) { nameInput.style.borderColor = '#E8594F'; nameInput.focus(); return; }
  nameInput.style.borderColor = '#4CAF7D';

  const today = new Date();
  const dateStr = today.getFullYear() + '年' + (today.getMonth()+1) + '月' + today.getDate() + '日';

  document.getElementById('certDisplayName').innerHTML = name + ' <span>殿</span>';
  document.getElementById('certDisplayTheme').textContent = '上記の者は「' + ${jesc(t.ja)} + '」研修（障害福祉・居宅介護）を修了したことを証します。';
  document.getElementById('certDisplayDate').textContent = '修了日: ' + dateStr;

  document.getElementById('certCard').classList.add('show');
  document.getElementById('certActions').style.display = 'flex';

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
}

// 最終ページで「完了！」→ 修了証セクション
const _origNextPage = nextPage;
nextPage = function() {
  if (currentPage >= totalPages) { showCertSection(); }
  else { _origNextPage(); }
};
</script>

<!-- 修了証書セクション -->
<div class="cert-section" id="certSection">
  <div style="font-size:64px;margin-bottom:12px;">🎓</div>
  <h2 style="font-size:24px;font-weight:900;color:var(--primary,#2D5A8E);margin-bottom:8px;">研修完了おめでとうございます！</h2>
  <p style="font-size:14px;color:#666;margin-bottom:24px;">修了証書を発行します。お名前を入力してください。<br><small>※ 職員名簿と同じ表記でご入力ください</small></p>
  <div class="cert-name-input">
    <label for="certName">受講者名</label>
    <input type="text" id="certName" placeholder="例: 山田 太郎" autocomplete="name">
  </div>
  <button class="cert-generate-btn" id="certGenBtn" onclick="generateCert()">📜 修了証書を発行する</button>

  <div class="cert-card" id="certCard">
    <div class="cert-card-badge">修 了 証 書</div>
    <div class="cert-card-title">研修修了証</div>
    <div class="cert-card-name" id="certDisplayName"></div>
    <div class="cert-card-theme" id="certDisplayTheme"></div>
    <div class="cert-card-date" id="certDisplayDate"></div>
    <div class="cert-card-org">
      有限会社 陽気<br>訪問介護 ようき（障害福祉・居宅介護）
      <small>沖縄県南城市佐敷津波古1354-1</small>
    </div>
    <div class="cert-card-seal">修了<br>認定</div>
  </div>

  <div class="cert-actions" id="certActions" style="display:none;">
    <a class="cert-mail-btn" id="certMailBtn" href="#">✉️ 修了報告メールを送信</a>
    <a class="cert-back-btn" href="../kenshu-shougai.html">📚 研修一覧へ戻る</a>
    <a class="cert-back-btn" href="../">🏠 トップページ</a>
  </div>
</div>
<script src="../scripts/cert-config.js"></script>
<script src="../scripts/read-aloud.js"></script>
</body>
</html>
`;
}

const trainings = JSON.parse(fs.readFileSync(DATA, 'utf8'));
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
let n = 0;
for (const t of trainings) {
  fs.writeFileSync(path.join(OUT, `${t.id}.html`), buildPage(t), 'utf8');
  console.log(`OK: shougai-trainings/${t.id}.html （${t.pages.length}章 / テスト${t.quiz.length}問）`);
  n++;
}
console.log(`${n} ページ生成完了`);
