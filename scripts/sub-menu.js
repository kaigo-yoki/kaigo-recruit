/* サブページ用ハンバーガーメニュー */
(function(){
  // CSS注入
  var css = document.createElement('style');
  css.textContent = `
.hamburger{display:none;background:none;border:none;cursor:pointer;width:40px;height:40px;align-items:center;justify-content:center;border-radius:12px;transition:background .25s;z-index:200;flex-shrink:0;}
.hamburger span,.hamburger span::before,.hamburger span::after{display:block;width:20px;height:2px;background:#2D3436;border-radius:2px;transition:all .3s;}
.hamburger span{position:relative;}
.hamburger span::before,.hamburger span::after{content:"";position:absolute;left:0;}
.hamburger span::before{top:-6px;}
.hamburger span::after{top:6px;}
.hamburger.open span{background:transparent;}
.hamburger.open span::before{transform:rotate(45deg);top:0;}
.hamburger.open span::after{transform:rotate(-45deg);top:0;}
.mm-overlay{display:none;position:fixed;inset:0;z-index:150;background:rgba(0,0,0,.4);backdrop-filter:blur(3px);opacity:0;transition:opacity .3s;}
.mm-overlay.open{display:block;opacity:1;}
.mobile-menu{position:fixed;top:0;right:-100%;width:min(320px,85vw);height:100vh;z-index:160;background:#fff;box-shadow:-8px 0 32px rgba(0,0,0,.1);transition:right .35s cubic-bezier(.22,1,.36,1);display:flex;flex-direction:column;overflow-y:auto;}
.mobile-menu.open{right:0;}
.mm-header{display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:2px solid rgba(255,107,157,.08);}
.mm-header span{font-size:14px;font-weight:800;color:#2D3436;}
.mm-close{background:none;border:none;cursor:pointer;width:36px;height:36px;display:flex;align-items:center;justify-content:center;border-radius:50%;transition:background .25s;font-size:20px;color:#636E72;}
.mm-close:hover{background:#FFF0F5;color:#FF6B9D;}
.mm-body{flex:1;padding:12px 16px 32px;display:flex;flex-direction:column;gap:2px;}
.mobile-menu a{font-size:15px;font-weight:700;color:#2D3436;text-decoration:none;padding:14px 20px;border-radius:14px;transition:all .25s;display:flex;align-items:center;gap:10px;}
.mobile-menu a:hover,.mobile-menu a:active{background:#FFF0F5;color:#FF6B9D;}
.mobile-menu .mm-cta{margin-top:8px;background:linear-gradient(135deg,#FF6B9D,#FF8C42);color:#fff;font-weight:800;font-size:15px;box-shadow:0 6px 24px rgba(255,107,157,.3);padding:16px 24px;justify-content:center;border-radius:50px;}
.mobile-menu .mm-cta:hover{transform:translateY(-2px);}
.mobile-menu .mm-divider{height:1px;background:linear-gradient(90deg,rgba(255,107,157,.15),transparent);margin:6px 16px;}
@media(max-width:900px){.hamburger{display:flex;}}
`;
  document.head.appendChild(css);

  // ハンバーガーボタンをヘッダーに追加
  var header = document.querySelector('header, .header, [class*="header"]');
  if (!header) return;
  var btn = document.createElement('button');
  btn.className = 'hamburger';
  btn.id = 'hamburger';
  btn.setAttribute('aria-label', 'メニュー');
  btn.innerHTML = '<span></span>';
  header.appendChild(btn);

  // オーバーレイ
  var overlay = document.createElement('div');
  overlay.className = 'mm-overlay';
  overlay.id = 'mm-overlay';
  document.body.appendChild(overlay);

  // メニュー本体
  var menu = document.createElement('div');
  menu.className = 'mobile-menu';
  menu.id = 'mobile-menu';
  menu.innerHTML = `
    <div class="mm-header"><span>メニュー</span><button class="mm-close" id="mm-close" aria-label="閉じる">✕</button></div>
    <div class="mm-body">
      <a href="./">🏠 トップへ戻る</a>
      <div class="mm-divider"></div>
      <a href="./shindan.html">🔮 適性診断</a>
      <a href="./kenshu.html">📚 研修制度</a>
      <a href="./career-path.html">💰 処遇改善・キャリアパス</a>
      <a href="./blog.html">📝 ブログ</a>
      <a href="./vacancy.html">🏠 空床情報</a>
      <div class="mm-divider"></div>
      <a href="./contact.html" class="mm-cta">📝 お問い合わせ・応募</a>
    </div>
  `;
  document.body.appendChild(menu);

  // イベント
  function toggleMenu(){
    btn.classList.toggle('open');
    menu.classList.toggle('open');
    overlay.classList.toggle('open');
    document.body.style.overflow = menu.classList.contains('open') ? 'hidden' : '';
  }
  function closeMenu(){
    btn.classList.remove('open');
    menu.classList.remove('open');
    overlay.classList.remove('open');
    document.body.style.overflow = '';
  }
  btn.addEventListener('click', toggleMenu);
  overlay.addEventListener('click', closeMenu);
  menu.querySelector('.mm-close').addEventListener('click', closeMenu);
  menu.querySelectorAll('a').forEach(function(a){ a.addEventListener('click', closeMenu); });
})();
