// 研修修了報告メールの宛先設定（全研修ページ共通）
// 施設長の交代などで宛先が変わったら、このファイルだけ修正すればOK
window.CERT_MAIL_CONFIG = {
  to: 'rina@kaigo-yoki.jp',   // 施設長
  cc: 'info@kaigo-yoki.jp',   // 本部（控え）
  honorific: '施設長 様'       // メール冒頭の宛名
};
