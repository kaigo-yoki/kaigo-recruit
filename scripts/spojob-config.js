// 陽気スポジョブ（スポット人材マッチング）共通設定
// scripts/spojob-backend.gs をデプロイしたウェブアプリURLと、LINEログイン用のLIFF IDを設定する。
// 未設定（空文字）の間は、各ページはサンプルデータで動作する（モックのまま壊れない）。
window.SPOJOB_CONFIG = {
  // GAS（spojob-backend.gs）のウェブアプリURL。デプロイ後に貼り付け（ClaudeにURLを伝えれば設定します）
  gasUrl: 'https://script.google.com/macros/s/AKfycbwGN5kU3ojFQYdhtsHDxK4e98qHeRoJu7LKohoPOm3TO14VDAo1jW68qrNqkoqiA3Nh/exec',
  // LINEログイン用 LIFF ID（LINE Developers で発行）。LIFFページ（shifts.html/register.html）で使う
  liffId: '2010446173-3yG3n6NX',
  // 施設側の管理パスコード（GASの「設定」シート B1 と同じ値）。dashboard/募集作成/承認で使う
  adminKey: ''
};

// 設定済みかの簡易判定（ページ側で「ライブ or サンプル」を切り替える用）
window.SPOJOB_READY = function () {
  return !!(window.SPOJOB_CONFIG && window.SPOJOB_CONFIG.gasUrl);
};
