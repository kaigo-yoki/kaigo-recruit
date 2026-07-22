// 訪問看護 研修 の組織別設定（訪問看護ページ共通）
// ※ 介護版（cert-config.js）とは別事業なので設定を分けている。
//
// ▼ 複数の事業所（グループ会社を含む）に対応
//   同じ研修ページを使いながら、受講者の所属ごとに「記録先スプレッドシート」と
//   「修了報告メールの宛先」を切り替える。法定研修は事業所ごとに実績が必要なため。
//
//   受講者には  ...?org=キー  付きのURLを配る（例: /kango-trainings/kyuhen?org=youki）
//   一度開けば端末に記憶されるので、2回目以降はURLだけでよい。
window.KANGO_ORGS = {
  // 自社（既定）
  youki: {
    label: '訪問看護ようき（有限会社 陽気）',
    to: 'itsuyo@kaigo-yoki.jp',      // 訪問看護 管理者（伊福いつよ）
    cc: 'info@kaigo-yoki.jp',        // 本部（嶺井代表・控え）
    honorific: '訪問看護 管理者 様',
    endpoint: 'https://script.google.com/macros/s/AKfycbzPTsul5M9nP26V8tcGMEHsWjRksN8bEameebmx92OM-kgGWiaCtldTyVwvbHU7ktaO/exec'
  }

  // ▼ グループ会社を追加するときは、下のブロックのコメントを外して3か所を埋める
  //   （先方が kango-progress.gs をデプロイして得た URL と、先方管理者のメール）
  // , group1: {
  //     label: '（グループ会社名）',
  //     to: '（先方管理者のメール）',
  //     cc: 'info@kaigo-yoki.jp',      // 陽気にも控えを送る
  //     honorific: '訪問看護 管理者 様',
  //     endpoint: '（先方のGASウェブアプリURL）'
  //   }
};

// ---- 所属の判定（?org= → 端末の記憶 → 既定 youki）----
(function () {
  var ORGS = window.KANGO_ORGS;
  // ORGS[q] で直接引くと 'constructor' や '__proto__' が組み込みの値に当たってしまい、
  // 記録先が undefined のまま端末に保存されて看護研修が丸ごと壊れる。必ず自前のキーだけを見る。
  function known(k) { return !!k && Object.prototype.hasOwnProperty.call(ORGS, k); }

  var key = null;
  var unknownOrg = '';
  try {
    var q = new URLSearchParams(location.search).get('org');
    if (q) {
      if (known(q)) { key = q; localStorage.setItem('kango_org', q); }
      // 覚えのない所属が指定されたら、黙って自社扱いにしない。
      // 他社の看護師の記録が陽気のシートに入り、報告メールも陽気に飛んでしまうため。
      else unknownOrg = q;
    }
    if (!key && !unknownOrg) key = localStorage.getItem('kango_org');
  } catch (e) { /* localStorage が使えない環境でも動かす */ }
  if (!known(key)) key = 'youki';

  var org = ORGS[key];
  window.KANGO_ORG_KEY = key;
  window.KANGO_ORG = org;
  window.KANGO_ORG_UNKNOWN = unknownOrg;

  window.CERT_MAIL_CONFIG = { to: org.to, cc: org.cc, honorific: org.honorific };
  window.KENSHU_PROGRESS_CONFIG = { endpoint: org.endpoint };

  // 記録先の取り違えを防ぐため、名前入力欄の上に「どこに記録されるか」を明示する
  function showOrgNotice() {
    var input = document.getElementById('certName');
    if (!input || document.getElementById('kangoOrgNotice')) return;
    var el = document.createElement('div');
    el.id = 'kangoOrgNotice';
    var isDefault = (key === 'youki');
    el.style.cssText = 'margin:6px auto 2px;max-width:420px;font-size:12px;font-weight:700;padding:8px 12px;border-radius:10px;line-height:1.6;' +
      (unknownOrg ? 'background:#FCEDEA;color:#C0392B;border:1px solid #C0392B;'
        : isDefault ? 'background:#EEF3F3;color:#5B6E72;'
          : 'background:#FDF4E6;color:#8A5B00;border:1px solid #E8912A;');
    el.textContent = unknownOrg
      ? '⚠️ 所属が特定できません（' + unknownOrg + '）。記録が正しい事業所に届きません。管理者から配布されたURLを開き直してください。'
      : '📋 記録先：' + org.label;
    var host = input.parentNode;
    if (host) host.insertBefore(el, input);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', showOrgNotice);
  else showOrgNotice();
})();

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
  // 訪問先で受講することが多く、その場で失敗すると記録が永久に失われるため。
  var QUEUE = 'kenshu_pending_records_kango';
  function readQueue() {
    try { var q = JSON.parse(localStorage.getItem(QUEUE) || '[]'); return q.length ? q : []; }
    catch (e) { return []; }
  }
  function writeQueue(q) {
    try { localStorage.setItem(QUEUE, JSON.stringify(q.slice(-20))); } catch (e) { }
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
    // 何度送っても通らない記録は捨てる。ここで書き戻さないと古い項目が残り、
    // 研修ページを開くたびに永久に送信を試み続けてしまう。
    if (n > 5) { writeQueue(q); return; }
    q.push({ endpoint: endpoint, payload: p, tries: n });
    writeQueue(q);
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
    // 修了証発行の直後にメールアプリへ移ることが多く、遷移で送信が中断されるのを防ぐ
    try { opt.keepalive = true; } catch (e) { }
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
      if (!name) return;
      if (!cfg || !cfg.endpoint) return;

      // 所属が特定できないときは記録も報告メールも出さない。
      // 記録だけ止めても、報告メールのボタンが陽気宛のまま押せる状態では
      // 他社看護師の氏名が陽気に届いてしまうため、ボタンごと隠す。
      if (window.KANGO_ORG_UNKNOWN) {
        var mailBtn = document.getElementById('certMailBtn');
        if (mailBtn) { mailBtn.classList.remove('show'); mailBtn.style.display = 'none'; }
        window.__kenshuShowStatus('err', '⚠️ 所属が特定できないため、記録も修了報告メールも送れません。管理者から配布されたURLで開き直してください');
        return;
      }

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
        // どのURL経由（kaigo-yoki.jp/recruit・vercel.app）でも同じ研修として記録されるよう正規化
        path: (window.KENSHU_LOG_PATH || location.pathname).replace(/^\/recruit/, '').replace(/\.html$/, ''),
        date: dateStr
      };

      window.__kenshuShowStatus('pending', '⏳ 受講記録を会社に送信しています…');
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
