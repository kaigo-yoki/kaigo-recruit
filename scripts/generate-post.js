const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');

// ===== 設定 =====
const POSTS_DIR = path.join(__dirname, '..', 'posts');
const POSTS_JSON = path.join(POSTS_DIR, 'posts.json');
const SITEMAP_PATH = path.join(__dirname, '..', 'sitemap.xml');
const SITE_URL = 'https://kaigo-recruit.vercel.app';

// ===== テーマプール =====
const THEMES = [
  { title: '未経験から介護職へ！最初の1ヶ月で学んだこと', category: '未経験者向け' },
  { title: '介護の仕事で一番嬉しい瞬間とは？', category: 'やりがい' },
  { title: '介護職の1日の過ごし方を公開！', category: '働き方' },
  { title: '未経験でも安心！介護の基本スキル5選', category: '未経験者向け' },
  { title: '利用者さまとの会話で大切にしていること', category: 'コミュニケーション' },
  { title: '介護職のワークライフバランスのリアル', category: '働き方' },
  { title: '沖縄で介護の仕事をする魅力とは？', category: '沖縄' },
  { title: '訪問介護の現場で求められるスキル', category: '専門知識' },
  { title: '先輩に聞いた！転職してよかったこと', category: 'やりがい' },
  { title: '介護福祉士の資格取得を目指して', category: 'キャリア' },
  { title: '機能訓練って何をするの？初心者にもわかる解説', category: '専門知識' },
  { title: 'チームワークが大切な理由 ー 介護現場から', category: '働き方' },
  { title: '認知症ケアの基本と私たちの取り組み', category: '専門知識' },
  { title: '介護職に向いている人の特徴5つ', category: '未経験者向け' },
  { title: '利用者さまの笑顔をつくるレクリエーション', category: 'やりがい' },
  { title: '訪問介護を支える専門職チームの役割', category: '専門知識' },
  { title: '介護の現場で使える腰痛予防ストレッチ', category: '健康' },
  { title: '20代で介護職を選んだ理由', category: '未経験者向け' },
  { title: 'ホームいこいの魅力を現場スタッフが語る', category: 'やりがい' },
  { title: '介護記録の書き方のコツ', category: '専門知識' },
  { title: '南城市の暮らしやすさを紹介します', category: '沖縄' },
  { title: '入浴介助のポイントと心がけていること', category: '専門知識' },
  { title: '介護職の休日の過ごし方', category: '働き方' },
  { title: '専門職としてのスキルアップの道筋', category: 'キャリア' },
  { title: '夜勤のリアル！実際の過ごし方を紹介', category: '働き方' },
  { title: '夏場の介護で気をつけたい熱中症対策', category: '健康' },
  { title: '訪問介護と連携する在宅ケアの実際', category: '専門知識' },
  { title: '30代からの介護職キャリアチェンジ体験記', category: '未経験者向け' },
  { title: '利用者さまの声から学んだこと', category: 'やりがい' },
  { title: '資格取得全額補助で広がるキャリア', category: 'キャリア' },
  { title: '食事介助で気をつけている3つのこと', category: '専門知識' },
  { title: '介護職のやりがいを感じる5つの瞬間', category: 'やりがい' },
  { title: '未経験者が最初に覚えるべき介護用語集', category: '未経験者向け' },
  { title: '沖縄の介護施設で働く魅力ベスト5', category: '沖縄' },
  { title: '飲みニケーション補助金って？ユニークな福利厚生を紹介', category: '働き方' },
  { title: '口腔ケアの大切さと現場での実践方法', category: '専門知識' },
];

// ===== ユーティリティ =====
function getToday() {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().split('T')[0];
}

function getFormattedDate(dateStr) {
  const [y, m, d] = dateStr.split('-');
  return `${y}年${parseInt(m)}月${parseInt(d)}日`;
}

function getUsedThemes() {
  if (!fs.existsSync(POSTS_JSON)) return [];
  const posts = JSON.parse(fs.readFileSync(POSTS_JSON, 'utf-8'));
  return posts.map(p => p.title);
}

function pickTheme(usedThemes) {
  const available = THEMES.filter(t => !usedThemes.includes(t.title));
  if (available.length === 0) {
    return THEMES[Math.floor(Math.random() * THEMES.length)];
  }
  return available[Math.floor(Math.random() * available.length)];
}

// ===== カテゴリ色マッピング =====
function getCategoryColor(category) {
  const map = {
    '未経験者向け': { bg: '#FFF0F5', color: '#FF6B9D' },
    'やりがい': { bg: '#FFF3E8', color: '#FF8C42' },
    '働き方': { bg: '#E8FAF8', color: '#2BA89F' },
    '専門知識': { bg: '#E6F6FA', color: '#45B7D1' },
    'キャリア': { bg: '#F0EDFF', color: '#A78BFA' },
    '沖縄': { bg: '#FFFBE6', color: '#E6A800' },
    'コミュニケーション': { bg: '#FFF0F5', color: '#FF6B9D' },
    '健康': { bg: '#E8FAF8', color: '#4ECDC4' },
  };
  return map[category] || { bg: '#F0EDFF', color: '#A78BFA' };
}

// ===== 記事生成 =====
async function generateArticle(theme) {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const systemPrompt = `あなたは沖縄県南城市にある介護施設「ホームいこい」（有限会社 陽気が運営、訪問介護 ようき）のブログ記事を書くライターです。

施設の特徴:
- 沖縄県南城市佐敷津波古1354-1に所在
- 訪問介護サービスを提供
- 夜勤者：月給28万〜32万円、日勤常勤：月給23万〜26万円
- 資格取得全額補助制度あり
- 飲みニケーション補助金（月1回5,000円）、ランチ補助金（月1回2,000円）
- 県外研修は会社全額負担
- 未経験からでも丁寧なサポートで成長できる環境
- 多彩なシフトパターン（夜勤・早勤・日勤・遅勤・入浴担当）

トーンとスタイル:
- 明るくポップで前向きなトーン
- 未経験の20〜30代の求職者にも親しみやすい言葉遣い
- 専門用語は適度に解説を加える
- 具体的なエピソードやシーンを交えて読みやすく
- 絵文字は控えめに（1記事に2〜3個程度）

SEO対策:
- 記事中に以下のキーワードを自然な文脈で含めてください（無理に全部入れる必要はありません）:
  介護 求人 沖縄 南城市 未経験 資格取得 訪問介護 介護職 転職 介護福祉士 キャリア 働きやすい
- 見出し（h2）にもキーワードを自然に含めてください
- 読者が検索しそうな疑問や悩みに答える内容を心がけてください

記事の構成:
- 見出し（h2）を2〜3個使用
- 各セクションは3〜5文程度
- 全体で600〜800文字程度
- 最後に読者への呼びかけ（見学やお電話への誘導）を入れる`;

  const userPrompt = `以下のテーマでブログ記事を書いてください。

テーマ: 「${theme.title}」
カテゴリ: ${theme.category}

以下の形式でJSON出力してください（コードブロックなし、純粋なJSONのみ）:
{
  "description": "記事の要約（80〜120文字程度。検索結果に表示されることを意識し、キーワード「介護」「沖縄」「南城市」「求人」などを自然に含めてください）",
  "body": "HTML形式の本文（<article>タグで囲む。見出しは<h2>タグ、段落は<p>タグを使用）"
}`;

  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.8,
    max_tokens: 2000,
  });

  const content = response.choices[0].message.content.trim();
  try {
    const parsed = JSON.parse(content);
    return parsed;
  } catch {
    // フォールバック: JSON解析に失敗した場合は従来の形式として扱う
    return {
      description: `${theme.title} - 沖縄県南城市の訪問介護ようき（有限会社 陽気）のブログ記事です。介護求人・未経験OK。`,
      body: content,
    };
  }
}

// ===== HTMLテンプレート =====
function buildPostHTML(title, date, category, bodyContent, description) {
  const formattedDate = getFormattedDate(date);
  const catColor = getCategoryColor(category);
  const postUrl = `${SITE_URL}/posts/${date}`;
  const metaDescription = description || `${title} - 沖縄県南城市の訪問介護ようき（有限会社 陽気）のブログ。介護求人・未経験OK。`;
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title} | 訪問介護 ようき ブログ</title>
<meta name="description" content="${metaDescription}">
<link rel="canonical" href="${postUrl}">
<meta property="og:title" content="${title} | 訪問介護 ようき ブログ">
<meta property="og:description" content="${metaDescription}">
<meta property="og:type" content="article">
<meta property="og:url" content="${postUrl}">
<meta property="og:image" content="${SITE_URL}/favicon.png">
<meta property="og:site_name" content="訪問介護 ようき 採用サイト">
<meta property="og:locale" content="ja_JP">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${title}">
<meta name="twitter:description" content="${metaDescription}">
<link rel="icon" type="image/png" href="../favicon.png">
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@300;400;500;700;800&family=M+PLUS+Rounded+1c:wght@400;500;700;800&display=swap" rel="stylesheet">
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
body{font-family:'M PLUS Rounded 1c','Noto Sans JP',sans-serif;background:#FAFAFA;color:#2D3436;line-height:1.8;}
header{background:rgba(255,255,255,.92);backdrop-filter:blur(20px);border-bottom:2px solid rgba(255,107,157,.15);padding:12px 24px;position:sticky;top:0;z-index:40;display:flex;align-items:center;justify-content:space-between;max-width:100%;}
header a{font-weight:800;font-size:14px;color:#FF6B9D;text-decoration:none;transition:color .25s;}
header a:hover{color:#FF8C42;}
header span{font-size:11px;color:#B2BEC3;font-weight:500;}
main{max-width:720px;margin:0 auto;padding:40px 24px 120px;}
.meta{margin-bottom:32px;}
.cat{display:inline-block;font-size:11px;font-weight:800;padding:5px 16px;border-radius:50px;margin-bottom:12px;background:${catColor.bg};color:${catColor.color};}
h1{font-size:clamp(22px,4vw,30px);font-weight:900;line-height:1.4;color:#2D3436;margin-bottom:8px;}
time{font-size:13px;color:#B2BEC3;font-weight:500;}
.content{background:#fff;border-radius:24px;padding:32px;border:2px solid rgba(255,107,157,.08);box-shadow:0 4px 20px rgba(0,0,0,.04);}
.content h2{font-size:18px;font-weight:800;color:#FF6B9D;margin:28px 0 12px;padding-bottom:8px;border-bottom:3px solid #FFF0F5;}
.content h2:first-child{margin-top:0;}
.content p{font-size:14px;color:#636E72;line-height:2;margin-bottom:16px;}
.content strong{color:#FF8C42;}
.content ul,.content ol{font-size:14px;color:#636E72;line-height:2;margin-bottom:16px;padding-left:24px;}
.cta-box{margin-top:48px;text-align:center;background:linear-gradient(135deg,#FFF0F5,#FFF3E8);border-radius:24px;padding:40px 24px;border:2px solid rgba(255,107,157,.1);}
.cta-box p.title{font-size:18px;font-weight:800;color:#2D3436;margin-bottom:8px;}
.cta-box p.sub{font-size:13px;color:#636E72;margin-bottom:20px;}
.cta-btn{display:inline-flex;align-items:center;gap:8px;background:linear-gradient(135deg,#FF6B9D,#FF8C42);color:#fff;padding:14px 36px;border-radius:50px;font-size:14px;font-weight:800;text-decoration:none;box-shadow:0 8px 24px rgba(255,107,157,.3);transition:all .25s;}
.cta-btn:hover{transform:translateY(-2px);box-shadow:0 12px 32px rgba(255,107,157,.4);}
.cta-tel{margin-top:12px;font-size:12px;color:#B2BEC3;}
.cta-tel a{color:#FF6B9D;text-decoration:none;font-weight:700;}
.back{display:block;text-align:center;margin-top:32px;font-size:13px;color:#FF6B9D;text-decoration:none;font-weight:700;}
.back:hover{color:#FF8C42;}
.sticky-bar{position:fixed;bottom:0;left:0;right:0;z-index:50;background:rgba(255,255,255,.95);backdrop-filter:blur(12px);border-top:2px solid rgba(255,107,157,.1);padding:12px 16px;}
.sticky-bar a{display:flex;align-items:center;justify-content:center;gap:8px;background:linear-gradient(135deg,#FF6B9D,#FF8C42);color:#fff;font-weight:800;border-radius:16px;padding:14px;font-size:14px;text-decoration:none;max-width:480px;margin:0 auto;box-shadow:0 8px 24px rgba(255,107,157,.3);transition:all .25s;}
.sticky-bar a:hover{transform:translateY(-2px);}
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
</style>
</head>
<body>
<header>
  <a href="../">&#x2190; トップへ戻る</a>
  <span>訪問介護 ようき</span>
</header>
<main>
  <div class="meta">
    <span class="cat">${category}</span>
    <h1>${title}</h1>
    <time>${formattedDate}</time>
  </div>
  <div class="content">
    ${bodyContent}
  </div>
  <div class="post-nav" id="post-nav"></div>
  <div class="cta-box">
    <p class="title">訪問介護 ようきに興味がありますか?</p>
    <p class="sub">見学も大歓迎! まずはお気軽にお電話ください。</p>
    <a href="tel:098-852-5255" class="cta-btn">&#x1F4DE; お電話でお問い合わせ</a>
    <p class="cta-tel"><a href="tel:098-852-5255">098-852-5255</a>（受付 9:00〜18:00）</p>
  </div>
  <a href="../blog.html" class="back">📝 ブログ一覧へ</a>
</main>
<div class="sticky-bar">
  <a href="tel:098-852-5255">&#x1F4DE; 098-852-5255 に電話する</a>
</div>
<script>
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
        '<span class="post-nav-arrow">\u2190</span>' +
        '<div class="post-nav-info"><span class="post-nav-label">前の記事</span>' +
        '<span class="post-nav-title">'+prev.title+'</span></div></a>';
    } else { html += '<div></div>'; }
    if(next){
      html += '<a class="post-nav-link next" href="'+next.file+'">' +
        '<div class="post-nav-info"><span class="post-nav-label">次の記事</span>' +
        '<span class="post-nav-title">'+next.title+'</span></div>' +
        '<span class="post-nav-arrow">\u2192</span></a>';
    } else { html += '<div></div>'; }
    html += '</div>';
    html += '<a href="../blog.html" class="post-nav-list">📝 ブログ一覧を見る</a>';
    navEl.innerHTML = html;
  }).catch(function(){});
})();
</script>
</body>
</html>`;
}

// ===== サイトマップ生成 =====
function generateSitemap(posts) {
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;
  xml += `  <url>\n    <loc>${SITE_URL}/</loc>\n    <changefreq>weekly</changefreq>\n    <priority>1.0</priority>\n  </url>\n`;

  for (const post of posts) {
    xml += `  <url>\n`;
    xml += `    <loc>${SITE_URL}/posts/${post.date}</loc>\n`;
    xml += `    <lastmod>${post.date}</lastmod>\n`;
    xml += `    <changefreq>monthly</changefreq>\n`;
    xml += `    <priority>0.7</priority>\n`;
    xml += `  </url>\n`;
  }

  xml += `</urlset>\n`;
  fs.writeFileSync(SITEMAP_PATH, xml, 'utf-8');
}

// ===== メイン処理 =====
async function main() {
  console.log('ブログ記事の自動生成を開始します...');

  if (!fs.existsSync(POSTS_DIR)) {
    fs.mkdirSync(POSTS_DIR, { recursive: true });
  }

  const today = getToday();
  const postFile = path.join(POSTS_DIR, `${today}.html`);

  if (fs.existsSync(postFile)) {
    console.log(`今日（${today}）の記事は既に存在します。スキップします。`);
    return;
  }

  const usedThemes = getUsedThemes();
  const theme = pickTheme(usedThemes);
  console.log(`テーマ: ${theme.title}（${theme.category}）`);

  if (!process.env.OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY が設定されていません。');
    console.error('GitHub リポジトリの Settings > Secrets > Actions に OPENAI_API_KEY を追加してください。');
    process.exit(1);
  }

  console.log('OpenAI API で記事を生成中...');
  const result = await generateArticle(theme);

  const fullHTML = buildPostHTML(theme.title, today, theme.category, result.body, result.description);
  fs.writeFileSync(postFile, fullHTML, 'utf-8');
  console.log(`記事ファイルを作成: posts/${today}.html`);

  let posts = [];
  if (fs.existsSync(POSTS_JSON)) {
    posts = JSON.parse(fs.readFileSync(POSTS_JSON, 'utf-8'));
  }

  posts.unshift({
    date: today,
    title: theme.title,
    category: theme.category,
    file: `${today}.html`,
  });

  fs.writeFileSync(POSTS_JSON, JSON.stringify(posts, null, 2), 'utf-8');
  console.log('posts.json を更新しました。');

  // サイトマップを再生成
  generateSitemap(posts);
  console.log('sitemap.xml を再生成しました。');

  console.log(`合計記事数: ${posts.length}`);
  console.log('完了!');
}

main().catch(err => {
  console.error('エラーが発生しました:', err.message);
  process.exit(1);
});
