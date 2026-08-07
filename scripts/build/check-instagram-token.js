/**
 * Instagram 長期アクセストークン（60日有効）の残日数チェック。
 *
 * 環境変数:
 *   INSTAGRAM_ACCESS_TOKEN       長期トークン
 *   INSTAGRAM_TOKEN_ISSUED_AT    発行日（YYYY-MM-DD）。GitHub Actions Variables 経由
 *
 * 出力（GITHUB_OUTPUT が定義されていれば）:
 *   should_alert=true/false
 *   days_remaining=<整数>
 *   alert_title=<タイトル>
 *   alert_body=<本文>
 *
 * 残14日以下になったら should_alert=true。
 */

const fs = require('fs');

const TOKEN_LIFETIME_DAYS = 60;
const ALERT_THRESHOLD_DAYS = 14;

function parseDate(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ''));
  if (!m) return null;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

function daysBetween(a, b) {
  const ms = b.getTime() - a.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

function emitOutput(kv) {
  const out = process.env.GITHUB_OUTPUT;
  if (out) {
    const lines = Object.entries(kv).map(([k, v]) => {
      const s = String(v);
      if (s.includes('\n')) {
        const delim = `EOF_${Math.random().toString(36).slice(2)}`;
        return `${k}<<${delim}\n${s}\n${delim}`;
      }
      return `${k}=${s}`;
    });
    fs.appendFileSync(out, lines.join('\n') + '\n');
  }
  for (const [k, v] of Object.entries(kv)) console.log(`${k}=${v}`);
}

async function debugTokenOnline(token) {
  if (!process.env.META_APP_ID || !process.env.META_APP_SECRET) return null;
  try {
    const appAccessToken = `${process.env.META_APP_ID}|${process.env.META_APP_SECRET}`;
    const url = new URL('https://graph.facebook.com/debug_token');
    url.searchParams.set('input_token', token);
    url.searchParams.set('access_token', appAccessToken);
    const res = await fetch(url.toString());
    if (!res.ok) return null;
    const json = await res.json();
    return json.data || null;
  } catch (_e) {
    return null;
  }
}

async function main() {
  const issuedAt = parseDate(process.env.INSTAGRAM_TOKEN_ISSUED_AT);
  const token = process.env.INSTAGRAM_ACCESS_TOKEN;

  if (!token) {
    emitOutput({
      should_alert: true,
      days_remaining: -1,
      alert_title: '【緊急】Instagram自動投稿トークン未設定',
      alert_body: 'INSTAGRAM_ACCESS_TOKEN secret が未設定です。INSTAGRAM_SETUP.md ステップ4〜5を実施してください。',
    });
    return;
  }

  let daysRemaining = null;
  let source = '不明';

  const debugInfo = await debugTokenOnline(token);
  if (debugInfo && debugInfo.expires_at) {
    const expiresAt = new Date(debugInfo.expires_at * 1000);
    daysRemaining = daysBetween(new Date(), expiresAt);
    source = `Meta debug_token (expires_at=${expiresAt.toISOString()})`;
  } else if (issuedAt) {
    const now = new Date();
    const elapsed = daysBetween(issuedAt, now);
    daysRemaining = TOKEN_LIFETIME_DAYS - elapsed;
    source = `発行日からの経過日数（INSTAGRAM_TOKEN_ISSUED_AT=${process.env.INSTAGRAM_TOKEN_ISSUED_AT}）`;
  } else {
    emitOutput({
      should_alert: true,
      days_remaining: -1,
      alert_title: '【警告】Instagramトークン残日数を判定できない',
      alert_body: 'INSTAGRAM_TOKEN_ISSUED_AT が未設定で、Meta debug_token API も使えない状態です。INSTAGRAM_SETUP.md ステップ5の Variables 設定を確認してください。',
    });
    return;
  }

  const shouldAlert = daysRemaining <= ALERT_THRESHOLD_DAYS;
  const alertBody = shouldAlert
    ? [
        `Instagram自動投稿用の長期アクセストークンが**残${daysRemaining}日**で失効します。`,
        '',
        '## 対応手順（5分）',
        '',
        '1. `INSTAGRAM_SETUP.md` のステップ4を実行（curlコマンドで新しい長期トークンを取得）',
        '2. リポジトリSettings → Secrets → `INSTAGRAM_ACCESS_TOKEN` を新トークンで更新',
        '3. Variables → `INSTAGRAM_TOKEN_ISSUED_AT` を本日の日付に更新',
        '4. このIssueをクローズ',
        '',
        `判定元: ${source}`,
      ].join('\n')
    : `残${daysRemaining}日（しきい値${ALERT_THRESHOLD_DAYS}日まで余裕あり）`;

  emitOutput({
    should_alert: String(shouldAlert),
    days_remaining: daysRemaining,
    alert_title: `Instagramトークン期限切れ警告（残${daysRemaining}日）`,
    alert_body: alertBody,
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
