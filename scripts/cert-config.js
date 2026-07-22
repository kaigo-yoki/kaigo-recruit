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

  // 圏外・電波不良で送信できなかった記録を端末に預かり、次に研修ページを開いたときに送り直す。
  // 現場では利用者宅で受講することが多く、その場で失敗すると記録が永久に失われるため。
  var QUEUE = 'kenshu_pending_records';
  window.__kenshuQueue = function (endpoint, payload) {
    try {
      var q = JSON.parse(localStorage.getItem(QUEUE) || '[]');
      q.push({ endpoint: endpoint, payload: payload });
      localStorage.setItem(QUEUE, JSON.stringify(q.slice(-20)));
    } catch (e) { /* 保存できない端末では諦める（修了証は出ている） */ }
  };
  window.__kenshuPost = function (endpoint, payload) {
    var ctrl = typeof AbortController === 'function' ? new AbortController() : null;
    // 応答が返らないまま「送信しています…」で固まらないよう打ち切る
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, 20000) : null;
    var opt = {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }
    };
    if (ctrl) opt.signal = ctrl.signal;
    return fetch(endpoint, opt).then(function (res) {
      if (timer) clearTimeout(timer);
      // HTTPエラーを成功と取り違えないよう、まず状態を確かめる
      if (!res.ok) throw new Error('HTTP ' + res.status);
      // 本文が読めなくてもGASには届いており記録は残るので成功として扱う
      return res.json().catch(function () { return { status: 'ok', unreadable: true }; });
    }).then(function (j) {
      if (!j || j.status !== 'ok') throw new Error(j && j.message ? j.message : 'rejected');
      return j;
    }).catch(function (e) {
      if (timer) clearTimeout(timer);
      throw e;
    });
  };
  // 預かっている記録があれば、ページを開いたときに静かに送り直す
  (function flush() {
    var q;
    try { q = JSON.parse(localStorage.getItem(QUEUE) || '[]'); } catch (e) { return; }
    if (!q.length) return;
    try { localStorage.removeItem(QUEUE); } catch (e) { }
    q.forEach(function (item) {
      window.__kenshuPost(item.endpoint, item.payload)
        .catch(function () { window.__kenshuQueue(item.endpoint, item.payload); });
    });
  })();

  var orig = window.generateCert;
  if (typeof orig !== 'function') return;
  window.generateCert = function () {
    orig.apply(this, arguments);
    try {
      var cfg = window.KENSHU_PROGRESS_CONFIG;
      var nameEl = document.getElementById('certName');
      var name = nameEl ? nameEl.value.trim() : '';
      if (!name) return; // 名前未入力（orig側が既にバリデーション済み）
      if (!cfg || !cfg.endpoint) return; // 記録先未設定なら何も表示しない

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
      var payload = {
        action: 'log',
        name: name,
        training: title,
        // 翻訳版ページは KENSHU_LOG_PATH に日本語版のパスを設定し、進捗上は同じ研修として扱う
        // どのURL経由（kaigo-yoki.jp/recruit・vercel.app）でも同じ研修として記録されるよう正規化
        path: (window.KENSHU_LOG_PATH || location.pathname).replace(/^\/recruit/, '').replace(/\.html$/, ''),
        date: dateStr
      };

      window.__kenshuShowStatus('pending', '⏳ 受講記録を会社に送信しています…');
      // Content-Type を text/plain にすることでpreflight回避（talent.html と同方式）
      window.__kenshuPost(cfg.endpoint, payload).then(function () {
        // 送信済みの記憶は成功を確かめてから。先に立てると、応答待ちの再操作で
        // 「送信済みです」と出たまま実際には届いていない状態になる。
        window.__kenshuLogged = dedupKey;
        window.__kenshuShowStatus('ok', '✅ 受講記録を会社に送信しました');
      }).catch(function () {
        window.__kenshuQueue(cfg.endpoint, payload);
        window.__kenshuShowStatus('err', '⚠️ いま記録を送信できませんでした。この端末に保存したので、電波の良い場所で研修ページを開けば自動で送られます');
      });
    } catch (e) { /* 記録失敗でも修了証発行は妨げない */ }
  };
})();
