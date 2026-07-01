/**
 * 研修ページの読み上げ機能（ブラウザ標準の音声合成 / Web Speech API）
 * - 右下に読み上げコントロールを自動で挿入
 * - 初期速度 1.5倍（0.8 / 1.0 / 1.5 / 2.0 に切替可）
 * - 本文（リード文＋各セクション）を読み上げる。修了証エリアは除外。
 * - 長文はブラウザの音声途切れを避けるため文単位で分割してキュー再生。
 */
(function () {
  if (!('speechSynthesis' in window)) return; // 非対応ブラウザでは何もしない
  var synth = window.speechSynthesis;

  // ---- 読み上げ対象テキストの収集 ----
  function collectChunks() {
    var parts = [];
    var lead = document.querySelector('.header .lead');
    if (lead && lead.innerText) parts.push(lead.innerText);
    document.querySelectorAll('.sec').forEach(function (sec) {
      if (sec.classList.contains('cert-area')) return; // 修了証エリアは読まない
      var t = (sec.innerText || '').trim();
      if (t) parts.push(t);
    });
    // 文単位に分割（。！？改行で区切る。lookbehind不使用で互換性重視）
    var out = [];
    parts.forEach(function (p) {
      p.replace(/([。！？\n])/g, '$1').split('').forEach(function (s) {
        s = s.replace(/\s+/g, ' ').trim();
        if (s) out.push(s);
      });
    });
    return out;
  }

  var chunks = [];
  var idx = 0;
  var rate = 1.5;
  var state = 'idle'; // idle | playing | paused
  var RATES = [0.8, 1.0, 1.5, 2.0];

  // ---- UI 構築 ----
  var style = document.createElement('style');
  style.textContent =
    '#ra-bar{position:fixed;right:14px;bottom:16px;z-index:9999;display:flex;gap:6px;align-items:center;' +
    'background:#0E7C86;color:#fff;border-radius:40px;padding:7px 10px 7px 14px;box-shadow:0 6px 20px rgba(0,0,0,.22);' +
    "font-family:inherit;font-size:14px;}" +
    '#ra-bar button{border:none;background:rgba(255,255,255,.16);color:#fff;font-family:inherit;font-weight:700;' +
    'cursor:pointer;border-radius:30px;padding:7px 12px;font-size:13px;line-height:1;transition:background .15s;}' +
    '#ra-bar button:hover{background:rgba(255,255,255,.3);}' +
    '#ra-play{background:#fff;color:#0E7C86;}' +
    '#ra-play:hover{background:#EAF3F4;}' +
    '#ra-speed{min-width:44px;}' +
    '@media print{#ra-bar{display:none;}}';
  document.head.appendChild(style);

  var bar = document.createElement('div');
  bar.id = 'ra-bar';
  bar.innerHTML =
    '<button id="ra-play" aria-label="読み上げ再生・一時停止">🔊 読み上げ</button>' +
    '<button id="ra-stop" aria-label="停止" title="停止" style="display:none;">■</button>' +
    '<button id="ra-speed" aria-label="読み上げ速度" title="速度を変更">1.5x</button>';
  document.body.appendChild(bar);

  var playBtn = document.getElementById('ra-play');
  var stopBtn = document.getElementById('ra-stop');
  var speedBtn = document.getElementById('ra-speed');

  function updateUI() {
    speedBtn.textContent = rate + 'x';
    if (state === 'playing') { playBtn.textContent = '⏸ 一時停止'; stopBtn.style.display = ''; }
    else if (state === 'paused') { playBtn.textContent = '▶ 再開'; stopBtn.style.display = ''; }
    else { playBtn.textContent = '🔊 読み上げ'; stopBtn.style.display = 'none'; }
  }

  function speakNext() {
    if (idx >= chunks.length) { state = 'idle'; updateUI(); return; }
    var u = new SpeechSynthesisUtterance(chunks[idx]);
    u.lang = 'ja-JP';
    u.rate = rate;
    u.onend = function () { if (state === 'playing') { idx++; speakNext(); } };
    u.onerror = function () { if (state === 'playing') { idx++; speakNext(); } };
    synth.speak(u);
  }

  function start() {
    synth.cancel();
    chunks = collectChunks();
    idx = 0;
    state = 'playing';
    updateUI();
    speakNext();
  }

  playBtn.addEventListener('click', function () {
    if (state === 'idle') { start(); }
    else if (state === 'playing') { synth.pause(); state = 'paused'; updateUI(); }
    else if (state === 'paused') { synth.resume(); state = 'playing'; updateUI(); }
  });

  stopBtn.addEventListener('click', function () {
    synth.cancel(); state = 'idle'; idx = 0; updateUI();
  });

  speedBtn.addEventListener('click', function () {
    var i = RATES.indexOf(rate);
    rate = RATES[(i + 1) % RATES.length];
    updateUI();
    // 再生中なら現在の文から新しい速度で読み直す
    if (state === 'playing') { synth.cancel(); speakNext(); }
  });

  // ページ離脱時に読み上げを止める
  window.addEventListener('beforeunload', function () { synth.cancel(); });
  window.addEventListener('pagehide', function () { synth.cancel(); });

  updateUI();
})();
