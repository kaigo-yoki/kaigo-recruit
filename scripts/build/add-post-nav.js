/**
 * 全ブログ記事に前後ナビゲーション + ブログ一覧リンクを追加するスクリプト
 * 既存の「トップページへ戻る」リンクをナビゲーションセクションに置き換え
 */
const fs = require('fs');
const path = require('path');

const POSTS_DIR = path.join(__dirname, '..', '..', 'posts');

// 追加するCSS
const NAV_CSS = `
.post-nav{margin-top:40px;display:flex;flex-direction:column;gap:12px;}
.post-nav-links{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
.post-nav-link{display:flex;align-items:center;gap:10px;padding:16px 18px;background:#fff;border:2px solid rgba(255,107,157,.08);border-radius:16px;text-decoration:none;transition:all .3s;min-height:72px;}
.post-nav-link:hover{border-color:rgba(255,107,157,.2);transform:translateY(-2px);box-shadow:0 8px 24px rgba(0,0,0,.06);}
.post-nav-link.prev{justify-content:flex-start;}
.post-nav-link.next{justify-content:flex-end;text-align:right;}
.post-nav-arrow{font-size:18px;color:#FF6B9D;flex-shrink:0;font-weight:900;}
.post-nav-info{display:flex;flex-direction:column;gap:2px;overflow:hidden;min-width:0;}
.post-nav-label{font-size:10px;font-weight:700;color:#B2BEC3;letter-spacing:.08em;}
.post-nav-title{font-size:13px;font-weight:700;color:#2D3436;line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}
.post-nav-list{display:flex;align-items:center;justify-content:center;gap:8px;padding:14px 24px;background:linear-gradient(135deg,#FFF0F5,#FFF3E8);border:2px solid rgba(255,107,157,.1);border-radius:50px;text-decoration:none;font-size:14px;font-weight:800;color:#FF6B9D;transition:all .25s;}
.post-nav-list:hover{background:linear-gradient(135deg,#FF6B9D,#FF8C42);color:#fff;transform:translateY(-2px);box-shadow:0 6px 20px rgba(255,107,157,.3);}
@media(max-width:480px){.post-nav-links{grid-template-columns:1fr;}.post-nav-link.next{text-align:left;justify-content:flex-start;}}
`;

// 追加するJS
const NAV_JS = `
<script>
(function(){
  const currentFile = location.pathname.split('/').pop();
  fetch('./posts.json?_t='+Date.now()).then(r=>r.json()).then(posts=>{
    const idx = posts.findIndex(p=>p.file===currentFile);
    if(idx===-1) return;
    const prev = idx < posts.length-1 ? posts[idx+1] : null;
    const next = idx > 0 ? posts[idx-1] : null;
    const navEl = document.getElementById('post-nav');
    if(!navEl) return;
    let html = '<div class="post-nav-links">';
    if(prev){
      html += '<a class="post-nav-link prev" href="'+prev.file+'">' +
        '<span class="post-nav-arrow">←</span>' +
        '<div class="post-nav-info"><span class="post-nav-label">前の記事</span>' +
        '<span class="post-nav-title">'+prev.title+'</span></div></a>';
    } else {
      html += '<div></div>';
    }
    if(next){
      html += '<a class="post-nav-link next" href="'+next.file+'">' +
        '<div class="post-nav-info"><span class="post-nav-label">次の記事</span>' +
        '<span class="post-nav-title">'+next.title+'</span></div>' +
        '<span class="post-nav-arrow">→</span></a>';
    } else {
      html += '<div></div>';
    }
    html += '</div>';
    html += '<a href="../blog.html" class="post-nav-list">📝 ブログ一覧を見る</a>';
    navEl.innerHTML = html;
  }).catch(()=>{});
})();
</script>`;

// 処理
const files = fs.readdirSync(POSTS_DIR).filter(f => f.endsWith('.html'));
let updated = 0;

for (const file of files) {
  const filePath = path.join(POSTS_DIR, file);
  let content = fs.readFileSync(filePath, 'utf-8');
  
  // 既にpost-navが追加済みならスキップ
  if (content.includes('post-nav')) {
    console.log(`Skip (already has nav): ${file}`);
    continue;
  }

  // 1. CSSを追加（</style>の前に挿入）
  content = content.replace('</style>', NAV_CSS + '</style>');

  // 2. CTA boxの前に post-nav を挿入
  content = content.replace(
    /<\/div>\s*\n\s*<div class="cta-box">/,
    `</div>\n  <div class="post-nav" id="post-nav"></div>\n  <div class="cta-box">`
  );

  // 3. 「採用トップページへ戻る」リンクを変更
  content = content.replace(
    /<a href="\.\.\/?" class="back">.*?<\/a>/,
    '<a href="../blog.html" class="back">📝 ブログ一覧へ</a>'
  );

  // 4. </body>の前にJSを追加
  content = content.replace('</body>', NAV_JS + '\n</body>');

  fs.writeFileSync(filePath, content, 'utf-8');
  updated++;
  console.log(`Updated: ${file}`);
}

console.log(`\nDone! Updated ${updated} post(s).`);
