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
  function readQueue() {
    try { var q = JSON.parse(localStorage.getItem(QUEUE) || '[]'); return q.length ? q : []; }
    catch (e) { return []; }
  }
  function writeQueue(q) {
    try { localStorage.setItem(QUEUE, JSON.stringify(q.slice(-20))); } catch (e) { }
  }
  // 再送をあきらめた記録の置き場。法定研修の実施記録は運営指導で提示するものなので、
  // 消えたことに気づけない状態を作らないため、捨てずにここへ移して警告を出し続ける。
  var FAILED = 'kenshu_failed_records';
  function readFailed() {
    try { var q = JSON.parse(localStorage.getItem(FAILED) || '[]'); return q.length ? q : []; }
    catch (e) { return []; }
  }
  function writeFailed(q) {
    try { localStorage.setItem(FAILED, JSON.stringify(q.slice(-20))); } catch (e) { }
  }
  window.__kenshuQueue = function (endpoint, payload, tries) {
    var q = readQueue();
    var p = payload;
    // 同じ人・同じ研修・同じ日を何度も積まない
    var same = function (x) {
      return x.payload && x.payload.name === p.name && x.payload.path === p.path && x.payload.date === p.date;
    };
    var n = (tries || 0) + 1;
    q = q.filter(function (x) { return !same(x); });
    // 何度送っても通らない記録は再送をあきらめる（ここで書き戻さないと古い項目が
    // 残り、研修ページを開くたびに永久に送信を試み続けてしまう）。ただし黙って
    // 捨てず、控えへ移して受講者と管理者に知らせる。
    if (n > 5) {
      writeQueue(q);
      var f = readFailed();
      if (!f.some(same)) { f.push({ payload: p, at: new Date().toISOString() }); writeFailed(f); }
      if (window.__kenshuShowFailed) window.__kenshuShowFailed();
      return;
    }
    q.push({ endpoint: endpoint, payload: p, tries: n });
    writeQueue(q);
  };
  // 送れなかった記録が残っていれば、ページを開くたびに画面の一番上で知らせる。
  // 受講者が気づかないまま記録だけが失われるのを防ぐのが目的。
  window.__kenshuShowFailed = function () {
    var f = readFailed();
    if (!f.length || !document.body) return;
    var el = document.getElementById('kenshuFailedNotice');
    if (!el) {
      el = document.createElement('div');
      el.id = 'kenshuFailedNotice';
      el.setAttribute('role', 'alert');
      el.style.cssText = 'padding:12px 16px;font-size:13px;font-weight:700;line-height:1.8;' +
        'background:#FCEDEA;color:#C0392B;border-bottom:3px solid #C0392B;';
      document.body.insertBefore(el, document.body.firstChild);
    }
    // 氏名は受講者本人の入力値。textContent で組み立て、HTMLとして解釈させない。
    el.textContent = '';
    var head = document.createElement('div');
    head.textContent = '⚠️ 会社へ送信できなかった受講記録が ' + f.length + ' 件あります。';
    el.appendChild(head);
    f.forEach(function (x) {
      var row = document.createElement('div');
      row.textContent = '　・' + (x.payload.date || '') + '　' + (x.payload.name || '') + '　' + (x.payload.training || '');
      el.appendChild(row);
    });
    var tail = document.createElement('div');
    tail.textContent = 'お手数ですが「✉️ 修了報告メール」を送るか、管理者へこの内容をお伝えください。';
    el.appendChild(tail);
    // 連絡が済むまで消えないが、済んだ人が消せないと毎回出続けて邪魔になる。
    // 押した本人の意思で消す（自動では消さない）。
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = '管理者へ連絡したので消す';
    btn.style.cssText = 'margin-top:8px;padding:6px 14px;font-size:12px;font-weight:700;' +
      'color:#C0392B;background:#fff;border:1px solid #C0392B;border-radius:8px;cursor:pointer;';
    btn.addEventListener('click', function () {
      writeFailed([]);
      if (el.parentNode) el.parentNode.removeChild(el);
    });
    el.appendChild(btn);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', window.__kenshuShowFailed);
  else window.__kenshuShowFailed();

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
    // 修了証発行の直後にメールアプリへ移ることが多く、遷移で送信が中断されるのを防ぐ
    try { opt.keepalive = true; } catch (e) { }
    return fetch(endpoint, opt).then(function (res) {
      if (timer) clearTimeout(timer);
      // HTTPエラーを成功と取り違えないよう、まず状態を確かめる
      if (!res.ok) throw new Error('HTTP ' + res.status);
      // 応答をJSONとして読み取れないときは、記録できていない可能性がある。
      // デプロイの失効・ログイン要求・実行回数の上限に達したとき、Googleは
      // 200のままHTMLのエラーページを返すため、200だけを根拠に成功と決めつけない。
      // 二重に届いてもGAS側が同じ人・同じ研修・同じ日を弾くので、
      // 「成功と誤って記録を捨てる」より「失敗として端末に預かる」ほうが安全。
      return res.json().catch(function () { throw new Error('応答を読み取れませんでした'); });
    }).then(function (j) {
      if (!j || j.status !== 'ok') throw new Error(j && j.message ? j.message : 'rejected');
      return j;
    }).catch(function (e) {
      if (timer) clearTimeout(timer);
      throw e;
    });
  };
  // 預かっている記録があれば、ページを開いたときに静かに送り直す。
  // 送信できたものだけを取り除く。先に消すと、応答を待つ間にページを閉じられたとき
  // （弱い電波でまさに起きやすい）記録が端末からも消えてしまう。
  (function flush() {
    var q = readQueue();
    if (!q.length) return;
    q.forEach(function (item) {
      window.__kenshuPost(item.endpoint, item.payload).then(function () {
        var cur = readQueue().filter(function (x) {
          return !(x.payload && item.payload && x.payload.name === item.payload.name &&
            x.payload.path === item.payload.path && x.payload.date === item.payload.date);
        });
        writeQueue(cur);
      }).catch(function () {
        window.__kenshuQueue(item.endpoint, item.payload, item.tries || 1);
      });
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
        window.__kenshuShowStatus('err', '⚠️ いま記録を送信できませんでした。この端末に保存したので、電波の良い場所で研修ページを開けば自動で送られます。念のため「✉️ 修了報告メール」も送っておくと確実です');
      });
    } catch (e) { /* 記録失敗でも修了証発行は妨げない */ }
  };
})();
