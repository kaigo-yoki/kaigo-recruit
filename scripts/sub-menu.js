/* サブページ共通ヘッダー＆ハンバーガーメニュー */
(function(){

  /* ── CSS注入 ── */
  var css = document.createElement('style');
  css.textContent = `
/* SHARED HEADER */
.sh-header{position:sticky;top:0;z-index:100;background:rgba(255,255,255,.95);backdrop-filter:blur(20px);border-bottom:2px solid rgba(255,107,157,.15);padding:12px 32px;display:flex;align-items:center;justify-content:space-between;}
.sh-back{display:flex;align-items:center;gap:6px;font-size:14px;font-weight:700;color:#FF6B9D;text-decoration:none;transition:color .25s;flex-shrink:0;}
.sh-back:hover{color:#FF8C42;}
.sh-nav{display:flex;align-items:center;gap:6px;}
.sh-nav a{font-size:12px;font-weight:700;color:#636E72;text-decoration:none;padding:8px 16px;border-radius:50px;transition:all .25s;white-space:nowrap;}
.sh-nav a:hover{background:#FFF0F5;color:#FF6B9D;}
.sh-nav .sh-cta{background:linear-gradient(135deg,#FF6B9D,#FF8C42);color:#fff!important;padding:8px 20px;box-shadow:0 2px 10px rgba(255,107,157,.3);}
.sh-nav .sh-cta:hover{transform:translateY(-1px);box-shadow:0 4px 16px rgba(255,107,157,.4);}

/* HAMBURGER */
.sh-ham{display:none;background:none;border:none;cursor:pointer;width:40px;height:40px;align-items:center;justify-content:center;border-radius:12px;transition:background .25s;z-index:200;flex-shrink:0;}
.sh-ham span,.sh-ham span::before,.sh-ham span::after{display:block;width:20px;height:2px;background:#2D3436;border-radius:2px;transition:all .3s;}
.sh-ham span{position:relative;}
.sh-ham span::before,.sh-ham span::after{content:"";position:absolute;left:0;}
.sh-ham span::before{top:-6px;}
.sh-ham span::after{top:6px;}
.sh-ham.open span{background:transparent;}
.sh-ham.open span::before{transform:rotate(45deg);top:0;}
.sh-ham.open span::after{transform:rotate(-45deg);top:0;}

/* OVERLAY & SLIDE MENU */
.sh-overlay{display:none;position:fixed;inset:0;z-index:150;background:rgba(0,0,0,.4);backdrop-filter:blur(3px);opacity:0;transition:opacity .3s;}
.sh-overlay.open{display:block;opacity:1;}
.sh-menu{position:fixed;top:0;right:-100%;width:min(320px,85vw);height:100vh;z-index:160;background:#fff;box-shadow:-8px 0 32px rgba(0,0,0,.1);transition:right .35s cubic-bezier(.22,1,.36,1);display:flex;flex-direction:column;overflow-y:auto;}
.sh-menu.open{right:0;}
.sh-menu-head{display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:2px solid rgba(255,107,157,.08);}
.sh-menu-head span{font-size:14px;font-weight:800;color:#2D3436;}
.sh-menu-close{background:none;border:none;cursor:pointer;width:36px;height:36px;display:flex;align-items:center;justify-content:center;border-radius:50%;transition:background .25s;font-size:20px;color:#636E72;}
.sh-menu-close:hover{background:#FFF0F5;color:#FF6B9D;}
.sh-menu-body{flex:1;padding:12px 16px 32px;display:flex;flex-direction:column;gap:2px;}
.sh-menu a{font-size:15px;font-weight:700;color:#2D3436;text-decoration:none;padding:14px 20px;border-radius:14px;transition:all .25s;display:flex;align-items:center;gap:10px;}
.sh-menu a:hover,.sh-menu a:active{background:#FFF0F5;color:#FF6B9D;}
.sh-menu .sh-menu-cta{margin-top:8px;background:linear-gradient(135deg,#FF6B9D,#FF8C42);color:#fff;font-weight:800;font-size:15px;box-shadow:0 6px 24px rgba(255,107,157,.3);padding:16px 24px;justify-content:center;border-radius:50px;}
.sh-menu .sh-menu-cta:hover{transform:translateY(-2px);}
.sh-menu .sh-divider{height:1px;background:linear-gradient(90deg,rgba(255,107,157,.15),transparent);margin:6px 16px;}
@media(max-width:900px){.sh-nav{display:none!important;}.sh-ham{display:flex;}}
`;
  document.head.appendChild(css);

  /* ── ヘッダーを探す or 作成 ── */
  var existingHeader = document.querySelector('.header, header, .site-header');
  if (!existingHeader) return;

  // 既存のヘッダー内容をクリアして統一ヘッダーに置換
  existingHeader.className = 'sh-header';
  existingHeader.innerHTML = '';

  // ← 採用トップへ リンク
  var backLink = document.createElement('a');
  backLink.className = 'sh-back';
  backLink.href = './';
  backLink.textContent = '← 採用トップへ';
  existingHeader.appendChild(backLink);

  // PCナビゲーション
  var nav = document.createElement('div');
  nav.className = 'sh-nav';
  nav.innerHTML = '<a href="./shindan.html">適性診断</a><a href="./kenshu.html">研修</a><a href="./career-path.html">処遇改善・キャリアパス</a><a href="./contact.html" class="sh-cta">📝 お問い合わせ</a>';
  existingHeader.appendChild(nav);

  /* ── ハンバーガーボタン ── */
  var btn = document.createElement('button');
  btn.className = 'sh-ham';
  btn.setAttribute('aria-label', 'メニュー');
  btn.innerHTML = '<span></span>';
  existingHeader.appendChild(btn);

  /* ── オーバーレイ ── */
  var overlay = document.createElement('div');
  overlay.className = 'sh-overlay';
  document.body.appendChild(overlay);

  /* ── スライドメニュー ── */
  var menu = document.createElement('div');
  menu.className = 'sh-menu';
  menu.innerHTML = '<div class="sh-menu-head"><span>メニュー</span><button class="sh-menu-close" aria-label="閉じる">✕</button></div><div class="sh-menu-body"><a href="./">🏠 採用トップへ</a><div class="sh-divider"></div><a href="./kenshu.html">📚 研修制度</a><a href="./career-path.html">💰 処遇改善・キャリアパス</a><a href="./shindan.html">🔮 適性診断</a><div class="sh-divider"></div><a href="./contact.html" class="sh-menu-cta">📝 お問い合わせ・応募</a></div>';
  document.body.appendChild(menu);

  /* ── イベント ── */
  function openMenu(){
    btn.classList.add('open');
    menu.classList.add('open');
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  function closeMenu(){
    btn.classList.remove('open');
    menu.classList.remove('open');
    overlay.classList.remove('open');
    document.body.style.overflow = '';
  }
  btn.addEventListener('click', function(){ menu.classList.contains('open') ? closeMenu() : openMenu(); });
  overlay.addEventListener('click', closeMenu);
  menu.querySelector('.sh-menu-close').addEventListener('click', closeMenu);
  menu.querySelectorAll('a').forEach(function(a){ a.addEventListener('click', closeMenu); });

})();
