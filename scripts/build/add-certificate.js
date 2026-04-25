#!/usr/bin/env node
/**
 * 全研修ページに修了証書機能を追加するスクリプト
 * - 名前入力欄
 * - 修了証書（名前・研修名・日付入り）
 * - info@kaigo-yoki.jp へのメール送信ボタン
 */

const fs = require('fs');
const path = require('path');

const TRAININGS_DIR = path.join(__dirname, '..', '..', 'trainings');
const INDIVIDUAL_DIR = path.join(__dirname, '..', '..', 'individual-training');

// 追加するCSS
const CERTIFICATE_CSS = `
.cert-section{display:none;text-align:center;padding:30px 20px;max-width:600px;margin:0 auto;}
.cert-section.show{display:block;animation:fadeUp .6s ease;}
.cert-name-input{margin-bottom:24px;}
.cert-name-input label{display:block;font-size:14px;font-weight:700;color:var(--text,#2C2C2C);margin-bottom:8px;}
.cert-name-input input{width:100%;max-width:320px;padding:14px 20px;border:3px solid #DDD;border-radius:14px;font-size:16px;font-family:inherit;font-weight:700;text-align:center;outline:none;transition:border-color .3s;}
.cert-name-input input:focus{border-color:var(--warm,#F9A826);}
.cert-generate-btn{display:inline-block;padding:14px 40px;background:linear-gradient(135deg,#F9A826,#FF8F00);color:#fff;border:none;border-radius:50px;font-size:16px;font-weight:800;font-family:inherit;cursor:pointer;box-shadow:0 4px 16px rgba(249,168,38,.3);transition:all .3s;margin-bottom:16px;}
.cert-generate-btn:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(249,168,38,.4);}
.cert-generate-btn:disabled{opacity:.4;cursor:default;transform:none;}
.cert-card{display:none;background:linear-gradient(135deg,#FFFDF0,#FFF8E1);border:4px double #D4A017;border-radius:20px;padding:40px 30px;margin:24px auto;max-width:520px;position:relative;overflow:hidden;box-shadow:0 8px 32px rgba(212,160,23,.15);}
.cert-card.show{display:block;animation:fadeUp .6s ease;}
.cert-card::before{content:'';position:absolute;inset:8px;border:2px solid rgba(212,160,23,.25);border-radius:14px;pointer-events:none;}
.cert-card-badge{display:inline-block;background:linear-gradient(135deg,#D4A017,#F5D060);color:#fff;padding:6px 24px;border-radius:30px;font-size:12px;font-weight:800;letter-spacing:3px;margin-bottom:16px;}
.cert-card-title{font-size:28px;font-weight:900;color:#D4A017;margin-bottom:8px;letter-spacing:2px;}
.cert-card-name{font-size:24px;font-weight:900;color:#1A1A2E;margin:20px 0 8px;padding:8px 0;border-bottom:2px solid rgba(212,160,23,.3);}
.cert-card-name span{font-size:14px;font-weight:500;color:#666;}
.cert-card-theme{font-size:15px;font-weight:700;color:#4A4A68;margin:12px 0;line-height:1.6;}
.cert-card-date{font-size:13px;color:#888;margin-top:16px;}
.cert-card-org{margin-top:20px;font-size:14px;font-weight:700;color:#1A1A2E;}
.cert-card-org small{display:block;font-size:11px;font-weight:400;color:#888;margin-top:2px;}
.cert-card-seal{position:absolute;bottom:20px;right:20px;width:60px;height:60px;border-radius:50%;border:3px solid #D4A017;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:900;color:#D4A017;line-height:1.2;text-align:center;}
.cert-actions{display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin-top:20px;}
.cert-mail-btn{display:inline-flex;align-items:center;gap:8px;padding:14px 32px;background:linear-gradient(135deg,#4CAF7D,#43A047);color:#fff;border:none;border-radius:50px;font-size:14px;font-weight:800;font-family:inherit;cursor:pointer;box-shadow:0 4px 16px rgba(76,175,125,.3);transition:all .3s;text-decoration:none;}
.cert-mail-btn:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(76,175,125,.4);}
.cert-back-btn{display:inline-flex;align-items:center;gap:6px;padding:12px 24px;background:none;border:2px solid #DDD;border-radius:50px;font-size:13px;font-weight:700;color:#666;cursor:pointer;font-family:inherit;transition:all .3s;text-decoration:none;}
.cert-back-btn:hover{border-color:#999;color:#333;}
`;

// 追加するHTML（</body>直前に挿入）
function getCertificateHTML() {
  return `
<!-- 修了証書セクション -->
<div class="cert-section" id="certSection">
  <div style="font-size:64px;margin-bottom:12px;">🎓</div>
  <h2 style="font-size:24px;font-weight:900;color:var(--primary,#2D5A8E);margin-bottom:8px;">研修完了おめでとうございます！</h2>
  <p style="font-size:14px;color:#666;margin-bottom:24px;">修了証書を発行します。お名前を入力してください。</p>
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
      有限会社 陽気<br>訪問介護 ようき
      <small>沖縄県南城市佐敷津波古1354-1</small>
    </div>
    <div class="cert-card-seal">修了<br>認定</div>
  </div>

  <div class="cert-actions" id="certActions" style="display:none;">
    <a class="cert-mail-btn" id="certMailBtn" href="#">✉️ 修了報告メールを送信</a>
    <a class="cert-back-btn" href="../kenshu.html">📚 研修一覧へ戻る</a>
    <a class="cert-back-btn" href="../">🏠 トップページ</a>
  </div>
</div>
`;
}

// 追加するJS
function getCertificateJS(trainingTitle) {
  // エスケープ
  const escaped = trainingTitle.replace(/'/g, "\\'").replace(/"/g, '\\"');
  return `
// === 修了証書機能 ===
const TRAINING_TITLE = "${escaped}";

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
  document.getElementById('certDisplayTheme').textContent = '上記の者は「' + TRAINING_TITLE + '」研修を修了したことを証します。';
  document.getElementById('certDisplayDate').textContent = '修了日: ' + dateStr;

  document.getElementById('certCard').classList.add('show');
  document.getElementById('certActions').style.display = 'flex';

  // メールリンク生成
  const subject = encodeURIComponent('【研修修了報告】' + TRAINING_TITLE + ' - ' + name);
  const body = encodeURIComponent(
    '訪問介護ようき 管理者様\\n\\n' +
    '研修修了のご報告をいたします。\\n\\n' +
    '受講者名: ' + name + '\\n' +
    '研修テーマ: ' + TRAINING_TITLE + '\\n' +
    '修了日: ' + dateStr + '\\n\\n' +
    '以上、ご確認をお願いいたします。'
  );
  document.getElementById('certMailBtn').href = 'mailto:info@kaigo-yoki.jp?subject=' + subject + '&body=' + body;
}

// nextPage を拡張: 最終ページで「完了！」を押したら証書セクション表示
const _origNextPage = nextPage;
nextPage = function() {
  if (currentPage >= totalPages) {
    showCertSection();
  } else {
    _origNextPage();
  }
};
`;
}

function getTrainingTitle(html) {
  // <title>からテーマ名を抽出
  const match = html.match(/<title>([^<]+)<\/title>/);
  if (!match) return '研修';
  let title = match[1];
  // 「訪問介護」「ようき」「個別研修」「法定研修」などを除去してテーマ名だけ取得
  title = title.replace(/\s*[|｜]\s*訪問介護.*$/g, '');
  title = title.replace(/^訪問介護\s*/g, '');
  title = title.replace(/^新人向け\s*/g, '');
  title = title.replace(/^リーダー向け\s*/g, '');
  title = title.replace(/^管理者向け\s*/g, '');
  return title.trim();
}

function processFile(filePath) {
  let html = fs.readFileSync(filePath, 'utf8');

  // すでに追加済みならスキップ
  if (html.includes('cert-section')) {
    console.log(`  ✓ スキップ（追加済み）: ${path.basename(filePath)}`);
    return;
  }

  const trainingTitle = getTrainingTitle(html);

  // 1. CSS追加 (</style>直前)
  html = html.replace('</style>', CERTIFICATE_CSS + '</style>');

  // 2. HTML追加 (</body>直前)
  html = html.replace('</body>', getCertificateHTML() + '</body>');

  // 3. JS追加 (</script>の最後の出現の直前)
  const lastScriptEnd = html.lastIndexOf('</script>');
  if (lastScriptEnd !== -1) {
    html = html.slice(0, lastScriptEnd) + getCertificateJS(trainingTitle) + html.slice(lastScriptEnd);
  }

  fs.writeFileSync(filePath, html, 'utf8');
  console.log(`  ✅ 追加完了: ${path.basename(filePath)} (テーマ: ${trainingTitle})`);
}

// 法定研修
console.log('📚 法定研修ページに修了証書機能を追加中...');
const trainingFiles = fs.readdirSync(TRAININGS_DIR).filter(f => f.endsWith('.html'));
trainingFiles.forEach(f => processFile(path.join(TRAININGS_DIR, f)));

// 個別研修
console.log('\n🎓 個別研修ページに修了証書機能を追加中...');
const individualFiles = fs.readdirSync(INDIVIDUAL_DIR).filter(f => f.endsWith('.html'));
individualFiles.forEach(f => processFile(path.join(INDIVIDUAL_DIR, f)));

console.log('\n✅ 全研修ページへの修了証書機能追加が完了しました！');
