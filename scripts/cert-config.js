// 研修修了報告メールの宛先設定（全研修ページ共通）
// 施設長の交代などで宛先が変わったら、このファイルだけ修正すればOK
window.CERT_MAIL_CONFIG = {
  to: 'rina@kaigo-yoki.jp',   // 施設長
  cc: 'info@kaigo-yoki.jp',   // 本部（控え）
  honorific: '施設長 様'       // メール冒頭の宛名
};

// 研修進捗の自動記録（Google スプレッドシート連携）
// endpoint には scripts/kenshu-progress.gs をデプロイしたウェブアプリURLを設定する。
// 未設定（空文字）の間は記録せず、修了証発行は通常どおり動作する。
window.KENSHU_PROGRESS_CONFIG = {
  endpoint: 'https://script.google.com/macros/s/AKfycbx-kNzYLAfzzu1Swee5EYVsLWQZfsHHgJ0pxAXfA_DHQpTQ5BvByZfqFQ7XwT1mxX4p/exec'
};

// 修了証発行（generateCert）をフックして、発行時に進捗を自動送信する。
// このファイルは各研修ページの最後で読み込まれるため、ページ側の定義を上書きできる。
(function () {
  var orig = window.generateCert;
  if (typeof orig !== 'function') return;
  window.generateCert = function () {
    orig.apply(this, arguments);
    try {
      var cfg = window.KENSHU_PROGRESS_CONFIG;
      if (!cfg || !cfg.endpoint) return;
      var nameEl = document.getElementById('certName');
      var name = nameEl ? nameEl.value.trim() : '';
      if (!name) return;
      var title = (typeof TRAINING_TITLE !== 'undefined') ? TRAINING_TITLE : document.title;
      var d = new Date();
      var dateStr = d.getFullYear() + '-' +
        String(d.getMonth() + 1).padStart(2, '0') + '-' +
        String(d.getDate()).padStart(2, '0');
      var dedupKey = name + '|' + location.pathname + '|' + dateStr;
      if (window.__kenshuLogged === dedupKey) return;
      window.__kenshuLogged = dedupKey;
      // Content-Type を text/plain にすることでpreflight回避（talent.html と同方式）
      fetch(cfg.endpoint, {
        method: 'POST',
        body: JSON.stringify({
          action: 'log',
          name: name,
          training: title,
          // 翻訳版ページは KENSHU_LOG_PATH に日本語版のパスを設定し、進捗上は同じ研修として扱う
          path: window.KENSHU_LOG_PATH || location.pathname,
          date: dateStr
        }),
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }
      }).catch(function () {});
    } catch (e) { /* 記録失敗でも修了証発行は妨げない */ }
  };
})();
