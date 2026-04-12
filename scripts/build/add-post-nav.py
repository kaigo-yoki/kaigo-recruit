#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""全ブログ記事に前後ナビゲーション + ブログ一覧リンクを追加"""
import os, re, glob

POSTS_DIR = './posts'

NAV_CSS = """
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
"""

NAV_JS = """<script>
(function(){
  var currentFile = location.pathname.split('/').pop();
  fetch('./posts.json?_t='+Date.now()).then(function(r){return r.json()}).then(function(posts){
    var idx = -1;
    for(var i=0;i<posts.length;i++){if(posts[i].file===currentFile){idx=i;break;}}
    if(idx===-1) return;
    var prev = idx < posts.length-1 ? posts[idx+1] : null;
    var next = idx > 0 ? posts[idx-1] : null;
    var navEl = document.getElementById('post-nav');
    if(!navEl) return;
    var html = '<div class="post-nav-links">';
    if(prev){
      html += '<a class="post-nav-link prev" href="'+prev.file+'">' +
        '<span class="post-nav-arrow">\\u2190</span>' +
        '<div class="post-nav-info"><span class="post-nav-label">\\u524d\\u306e\\u8a18\\u4e8b</span>' +
        '<span class="post-nav-title">'+prev.title+'</span></div></a>';
    } else {
      html += '<div></div>';
    }
    if(next){
      html += '<a class="post-nav-link next" href="'+next.file+'">' +
        '<div class="post-nav-info"><span class="post-nav-label">\\u6b21\\u306e\\u8a18\\u4e8b</span>' +
        '<span class="post-nav-title">'+next.title+'</span></div>' +
        '<span class="post-nav-arrow">\\u2192</span></a>';
    } else {
      html += '<div></div>';
    }
    html += '</div>';
    html += '<a href="../blog.html" class="post-nav-list">\\ud83d\\udcdd \\u30d6\\u30ed\\u30b0\\u4e00\\u89a7\\u3092\\u898b\\u308b</a>';
    navEl.innerHTML = html;
  }).catch(function(){});
})();
<\/script>"""

updated = 0
for f in sorted(glob.glob(os.path.join(POSTS_DIR, '*.html'))):
    content = open(f, 'r', encoding='utf-8').read()
    if 'post-nav' in content:
        print(f'Skip: {os.path.basename(f)}')
        continue
    
    # 1. CSS追加
    content = content.replace('</style>', NAV_CSS + '</style>')
    
    # 2. CTA boxの前にpost-navを挿入
    content = re.sub(
        r'(</div>\s*\n\s*<div class="cta-box">)',
        '</div>\n  <div class="post-nav" id="post-nav"></div>\n  <div class="cta-box">',
        content,
        count=1
    )
    
    # 3. 戻るリンクを変更
    content = re.sub(
        r'<a href="\.\./?" class="back">.*?</a>',
        '<a href="../blog.html" class="back">\U0001f4dd \u30d6\u30ed\u30b0\u4e00\u89a7\u3078</a>',
        content
    )
    
    # 4. </body>の前にJS追加（エスケープを正しく処理）
    nav_js_fixed = NAV_JS.replace('<\\/script>', '</script>')
    content = content.replace('</body>', nav_js_fixed + '\n</body>')
    
    open(f, 'w', encoding='utf-8').write(content)
    updated += 1
    print(f'Updated: {os.path.basename(f)}')

print(f'\nDone! Updated {updated} post(s).')
