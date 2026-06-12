#!/usr/bin/env node
/**
 * 修了報告メールの宛先を施設長宛（CC:本部）に変更するスクリプト
 * 宛先の実体は scripts/cert-config.js で一元管理する
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const dirs = ['trainings', 'individual-training'];
const files = dirs.flatMap(d =>
  fs.readdirSync(path.join(ROOT, d)).filter(f => f.endsWith('.html')).map(f => path.join(ROOT, d, f))
);

let ok = 0;
for (const f of files) {
  let html = fs.readFileSync(f, 'utf8');
  const before = html;

  // 1) mailto生成の直前に共通設定の参照を追加
  html = html.replace(
    "  // メールリンク生成\n  const subject =",
    "  // メールリンク生成（宛先は ../scripts/cert-config.js で一元管理）\n" +
    "  const mailCfg = window.CERT_MAIL_CONFIG || { to: 'rina@kaigo-yoki.jp', cc: 'info@kaigo-yoki.jp', honorific: '施設長 様' };\n" +
    "  const subject ="
  );

  // 2) 宛名を施設長に変更
  html = html.replace(
    "    '訪問介護ようき 管理者様\\n\\n' +",
    "    mailCfg.honorific + '\\n\\n' +"
  );

  // 3) 宛先を施設長(To) + 本部(CC)に変更
  html = html.replace(
    "'mailto:info@kaigo-yoki.jp?subject=' + subject + '&body=' + body;",
    "'mailto:' + mailCfg.to + '?cc=' + mailCfg.cc + '&subject=' + subject + '&body=' + body;"
  );

  // 4) 共通設定ファイルの読み込みタグを</body>直前に追加
  const CONFIG_TAG = '<script src="../scripts/cert-config.js"></script>';
  if (!html.includes(CONFIG_TAG)) {
    html = html.replace('</body>', CONFIG_TAG + '\n</body>');
  }

  if (html === before) { console.log('スキップ（変更なし）: ' + f); continue; }
  const checks = [
    html.includes('mailCfg.to'),
    html.includes('mailCfg.honorific'),
    html.includes(CONFIG_TAG),
    !html.includes('mailto:info@kaigo-yoki.jp')
  ];
  if (checks.every(Boolean)) { fs.writeFileSync(f, html); ok++; console.log('OK: ' + path.relative(ROOT, f)); }
  else { console.log('NG 置換不完全: ' + path.relative(ROOT, f) + ' ' + JSON.stringify(checks)); }
}
console.log(`${ok}/${files.length} 件更新`);
