// 訪問看護 研修 修了報告メールの宛先設定（訪問看護ページ共通）
// ※ 介護版（cert-config.js）とは別事業なので設定を分けている。
//    看護管理者が確定したら to をそのアドレスに変更する。
window.CERT_MAIL_CONFIG = {
  to: 'itsuyo@kaigo-yoki.jp',      // 訪問看護 管理者（伊福いつよ）
  cc: 'info@kaigo-yoki.jp',        // 本部（嶺井代表・控え）
  honorific: '訪問看護 管理者 様'   // メール冒頭の宛名
};

// 訪問看護 研修進捗の自動記録（介護とは別のスプレッドシート／GASを想定）
// endpoint 未設定（空文字）の間は記録せず、修了証発行は通常どおり動作する。
window.KENSHU_PROGRESS_CONFIG = {
  endpoint: 'https://script.google.com/macros/s/AKfycbzPTsul5M9nP26V8tcGMEHsWjRksN8bEameebmx92OM-kgGWiaCtldTyVwvbHU7ktaO/exec'
};

// 修了証発行（generateCert）をフックして、発行時に進捗を自動送信する。
// このファイルは各研修ページの最後で読み込まれるため、ページ側の定義を上書きできる。
(function () {
  // 受講者に記録の状態（送信中／成功／失敗）を表示する共通ヘルパー
  window.__kenshuShowStatus = function (kind, msg) {
    var el = document.getElementById('kenshuRecStatus');
    if (!el) {
      el = document.createElement('div');
      el.id = 'kenshuRecStatus';
      el.setAttribute('role', 'status');
      el.style.cssText = 'margin:12px auto;max-width:480px;font-size:13px;font-weight:700;text-align:center;padding:10px 14px;border-radius:10px;line-height:1.6;';
      var card = document.getElementById('certCard');
      var mail = document.getElementById('certMailBtn');
      if (card && card.parentNode) card.parentNode.insertBefore(el, card.nextSibling);
      else if (mail && mail.parentNode) mail.parentNode.insertBefore(el, mail);
      else (document.getElementById('certSection') || document.body).appendChild(el);
    }
    var palette = { pending: ['#EEF3F3', '#5B6E72'], ok: ['#E8F5E9', '#2E7D32'], err: ['#FCEDEA', '#C0392B'] };
    var c = palette[kind] || palette.pending;
    el.textContent = msg;
    el.style.background = c[0];
    el.style.color = c[1];
  };

  var orig = window.generateCert;
  if (typeof orig !== 'function') return;
  window.generateCert = function () {
    orig.apply(this, arguments);
    try {
      var cfg = window.KENSHU_PROGRESS_CONFIG;
      var nameEl = document.getElementById('certName');
      var name = nameEl ? nameEl.value.trim() : '';
      if (!name) return;
      if (!cfg || !cfg.endpoint) return;

      var title = (typeof TRAINING_TITLE !== 'undefined') ? TRAINING_TITLE : document.title;
      var d = new Date();
      var dateStr = d.getFullYear() + '-' +
        String(d.getMonth() + 1).padStart(2, '0') + '-' +
        String(d.getDate()).padStart(2, '0');
      var dedupKey = name + '|' + location.pathname + '|' + dateStr;
      if (window.__kenshuLogged === dedupKey) {
        window.__kenshuShowStatus('ok', '✅ 受講記録はすでに送信済みです');
        return;
      }
      window.__kenshuLogged = dedupKey;

      window.__kenshuShowStatus('pending', '⏳ 受講記録を会社に送信しています…');
      fetch(cfg.endpoint, {
        method: 'POST',
        body: JSON.stringify({
          action: 'log',
          name: name,
          training: title,
          // どのURL経由（kaigo-yoki.jp/recruit・vercel.app）でも同じ研修として記録されるよう正規化
          path: (window.KENSHU_LOG_PATH || location.pathname).replace(/^\/recruit/, '').replace(/\.html$/, ''),
          date: dateStr
        }),
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }
      }).then(function (res) {
        return res.json().catch(function () { return { status: 'ok', unreadable: true }; });
      }).then(function (j) {
        if (j && j.status === 'ok') {
          window.__kenshuShowStatus('ok', '✅ 受講記録を会社に送信しました');
        } else {
          window.__kenshuLogged = null;
          window.__kenshuShowStatus('err', '⚠️ 受講記録を送信できませんでした。もう一度「修了証を発行」を押してください');
        }
      }).catch(function () {
        window.__kenshuLogged = null;
        window.__kenshuShowStatus('err', '⚠️ 通信エラーで記録を送信できませんでした。電波の良い場所でもう一度お試しください');
      });
    } catch (e) { /* 記録失敗でも修了証発行は妨げない */ }
  };
})();
