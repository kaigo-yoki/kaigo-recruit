const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');

// ===== 設定 =====
const POSTS_DIR = path.join(__dirname, '..', 'posts');
const POSTS_JSON = path.join(POSTS_DIR, 'posts.json');

// ===== テーマプール =====
const THEMES = [
  { title: '未経験から介護職へ！最初の1ヶ月で学んだこと', category: '未経験者向け' },
  { title: '介護の仕事で一番嬉しい瞬間とは？', category: 'やりがい' },
  { title: '介護職の1日の過ごし方を公開！', category: '働き方' },
  { title: '未経験でも安心！介護の基本スキル5選', category: '未経験者向け' },
  { title: '利用者さまとの会話で大切にしていること', category: 'コミュニケーション' },
  { title: '介護職のワークライフバランスのリアル', category: '働き方' },
  { title: '沖縄で介護の仕事をする魅力とは？', category: '沖縄' },
  { title: '在宅医療ケアの現場で求められるスキル', category: '専門知識' },
  { title: '先輩に聞いた！転職してよかったこと', category: 'やりがい' },
  { title: '介護福祉士の資格取得を目指して', category: 'キャリア' },
  { title: '機能訓練って何をするの？初心者にもわかる解説', category: '専門知識' },
  { title: 'チームワークが大切な理由 ー 介護現場から', category: '働き方' },
  { title: '認知症ケアの基本と私たちの取り組み', category: '専門知識' },
  { title: '介護職に向いている人の特徴5つ', category: '未経験者向け' },
  { title: '利用者さまの笑顔をつくるレクリエーション', category: 'やりがい' },
  { title: '在宅医療を支える専門職チームの役割', category: '専門知識' },
  { title: '介護の現場で使える腰痛予防ストレッチ', category: '健康' },
  { title: '20代で介護職を選んだ理由', category: '未経験者向け' },
  { title: 'デイサービスの魅力を現場スタッフが語る', category: 'やりがい' },
  { title: '介護記録の書き方のコツ', category: '専門知識' },
  { title: '南城市の暮らしやすさを紹介します', category: '沖縄' },
  { title: '入浴介助のポイントと心がけていること', category: '専門知識' },
  { title: '介護職の休日の過ごし方', category: '働き方' },
  { title: '専門職としてのスキルアップの道筋', category: 'キャリア' },
  { title: '介護×美容 利用者さまが輝く取り組み', category: 'やりがい' },
  { title: '夏場の介護で気をつけたい熱中症対策', category: '健康' },
  { title: '訪問看護と連携する在宅医療ケアの実際', category: '専門知識' },
  { title: '30代からの介護職キャリアチェンジ体験記', category: '未経験者向け' },
  { title: '利用者さまの声から学んだこと', category: 'やりがい' },
  { title: '特定処遇改善加算って何？わかりやすく解説', category: 'キャリア' },
  { title: '食事介助で気をつけている3つのこと', category: '専門知識' },
  { title: '介護職のやりがいを感じる5つの瞬間', category: 'やりがい' },
  { title: '未経験者が最初に覚えるべき介護用語集', category: '未経験者向け' },
  { title: '沖縄の介護施設で働く魅力ベスト5', category: '沖縄' },
  { title: '医療的ケアに対応する施設の強みとは', category: '専門知識' },
];

// ===== ユーティリティ =====
function getToday() {
  const now = new Date();
  // JST (UTC+9)
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
    // テーマを使い切ったらランダムに再利用
    return THEMES[Math.floor(Math.random() * THEMES.length)];
  }
  return available[Math.floor(Math.random() * available.length)];
}

// ===== 記事生成 =====
async function generateArticle(theme) {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const systemPrompt = `あなたは沖縄県南城市にある介護施設「デイサービスはいさい」（有限会社陽気が運営）のブログ記事を書くライターです。

施設の特徴:
- 専門職集団として安心の在宅医療ケアとサービスを提供
- 胃ろう・気管切開・人工呼吸器など医療的ケアに対応
- 在宅でも安心した医療が受けられる環境づくり
- 特定処遇改善加算算定の事業所
- 未経験からでも専門職として成長できる研修制度

トーンとスタイル:
- 明るく前向きなトーン
- 未経験の20〜30代の求職者にも親しみやすい言葉遣い
- 専門用語は適度に解説を加える
- 具体的なエピソードやシーンを交えて読みやすく
- 絵文字は控えめに（1記事に2〜3個程度）

記事の構成:
- 見出し（h2）を2〜3個使用
- 各セクションは3〜5文程度
- 全体で600〜800文字程度
- 最後に読者への呼びかけ（見学予約への誘導）を入れる`;

  const userPrompt = `以下のテーマでブログ記事を書いてください。

テーマ: 「${theme.title}」
カテゴリ: ${theme.category}

HTML形式で本文のみ出力してください（<article>タグで囲む）。
見出しは<h2>タグ、段落は<p>タグを使ってください。
<article>の外側は不要です。`;

  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.8,
    max_tokens: 2000,
  });

  return response.choices[0].message.content.trim();
}

// ===== HTMLテンプレート =====
function buildPostHTML(title, date, category, bodyContent) {
  const formattedDate = getFormattedDate(date);
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} | デイサービスはいさい ブログ</title>
  <meta name="description" content="${title} - デイサービスはいさいのブログ記事です。">
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@300;400;500;600;700&family=Zen+Maru+Gothic:wght@400;500;700&display=swap" rel="stylesheet">
  <script>
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            'warm': { 50:'#FFF8F0',100:'#FFEFD6',200:'#FFD9A8',300:'#FFC078',400:'#FFA54D',500:'#FF8C26',600:'#E67300' },
            'coral': { 50:'#FFF1EE',100:'#FFE0D9',200:'#FFC1B3',300:'#FFA08D',400:'#FF7F66',500:'#FF5E40' },
            'cream': '#FDF6EC',
          },
          fontFamily: {
            'sans': ['"Noto Sans JP"', 'sans-serif'],
            'round': ['"Zen Maru Gothic"', 'sans-serif'],
          },
        }
      }
    }
  </script>
  <style>
    body { font-family: 'Noto Sans JP', sans-serif; padding-bottom: 80px; }
    .font-round { font-family: 'Zen Maru Gothic', sans-serif; }
    .blog-content h2 { font-family: 'Zen Maru Gothic', sans-serif; font-size: 1.25rem; font-weight: 700; color: #E67300; margin-top: 2rem; margin-bottom: 0.75rem; padding-bottom: 0.5rem; border-bottom: 2px solid #FFEFD6; }
    .blog-content p { color: #4B5563; font-size: 0.95rem; line-height: 1.85; margin-bottom: 1rem; }
    .blog-content ul, .blog-content ol { color: #4B5563; font-size: 0.95rem; line-height: 1.85; margin-bottom: 1rem; padding-left: 1.5rem; }
    .blog-content li { margin-bottom: 0.25rem; }
    .blog-content strong { color: #E67300; }
    .sticky-bar { backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); }
    @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
    .line-btn-shimmer { background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent); background-size: 200% 100%; animation: shimmer 2s infinite; }
  </style>
</head>
<body class="bg-cream text-gray-800">

  <!-- Header -->
  <header class="bg-white shadow-sm sticky top-0 z-40">
    <div class="max-w-3xl mx-auto px-5 py-3 flex items-center justify-between">
      <a href="../index.html" class="font-round font-bold text-warm-600 text-lg hover:text-warm-500 transition-colors">
        ← トップへ戻る
      </a>
      <span class="text-xs text-gray-400 font-round">デイサービスはいさい</span>
    </div>
  </header>

  <!-- Article -->
  <main class="max-w-3xl mx-auto px-5 py-8 md:py-12">
    <!-- Meta -->
    <div class="mb-6">
      <span class="inline-block bg-warm-100 text-warm-600 text-xs font-semibold rounded-full px-3 py-1 mb-3">${category}</span>
      <h1 class="font-round font-bold text-2xl md:text-3xl text-gray-800 leading-snug mb-2">${title}</h1>
      <time class="text-gray-400 text-sm">${formattedDate}</time>
    </div>

    <!-- Content -->
    <div class="blog-content bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-warm-100">
      ${bodyContent}
    </div>

    <!-- CTA -->
    <div class="mt-10 text-center bg-warm-50 rounded-2xl p-6 md:p-8 border border-warm-100">
      <p class="font-round font-bold text-lg text-gray-800 mb-2">デイサービスはいさいに興味がありますか？</p>
      <p class="text-gray-500 text-sm mb-4">見学のお申込みはLINEまたはお電話で受け付けています。</p>
      <a href="#" class="inline-flex items-center justify-center bg-[#06C755] text-white font-bold rounded-full px-8 py-3 text-base shadow-lg hover:bg-[#05b04d] transition-all duration-200 gap-2">
        <svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.349 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/></svg>
        LINEで見学予約
      </a>
      <p class="mt-3 text-gray-400 text-xs">お電話：<a href="tel:0988525255" class="text-warm-500 underline">098-852-5255</a></p>
    </div>

    <!-- Back link -->
    <div class="mt-8 text-center">
      <a href="../index.html" class="text-warm-500 hover:text-warm-600 font-semibold text-sm underline transition-colors">
        ← 採用トップページへ戻る
      </a>
    </div>
  </main>

  <!-- Sticky LINE Button -->
  <div class="fixed bottom-0 left-0 right-0 z-50 sticky-bar bg-white/95 border-t border-gray-200 px-4 py-3 shadow-[0_-4px_20px_rgba(0,0,0,0.1)]">
    <a href="#" class="relative overflow-hidden flex items-center justify-center bg-[#06C755] text-white font-bold rounded-xl py-3.5 text-base shadow-lg hover:bg-[#05b04d] active:scale-[0.98] transition-all duration-200 max-w-lg mx-auto gap-2">
      <div class="line-btn-shimmer absolute inset-0"></div>
      <svg class="w-6 h-6 relative z-10" viewBox="0 0 24 24" fill="currentColor"><path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.349 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/></svg>
      <span class="relative z-10">LINEで見学予約 📩</span>
    </a>
  </div>

</body>
</html>`;
}

// ===== メイン処理 =====
async function main() {
  console.log('📝 ブログ記事の自動生成を開始します...');

  // posts ディレクトリを確認
  if (!fs.existsSync(POSTS_DIR)) {
    fs.mkdirSync(POSTS_DIR, { recursive: true });
  }

  // 今日の日付
  const today = getToday();
  const postFile = path.join(POSTS_DIR, `${today}.html`);

  // 既に今日の記事がある場合はスキップ
  if (fs.existsSync(postFile)) {
    console.log(`⏭️  今日（${today}）の記事は既に存在します。スキップします。`);
    return;
  }

  // テーマを選択
  const usedThemes = getUsedThemes();
  const theme = pickTheme(usedThemes);
  console.log(`📌 テーマ: ${theme.title}（${theme.category}）`);

  // API キーの確認
  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY が設定されていません。');
    console.error('   GitHub リポジトリの Settings → Secrets → Actions に OPENAI_API_KEY を追加してください。');
    process.exit(1);
  }

  // 記事を生成
  console.log('🤖 OpenAI API で記事を生成中...');
  const bodyContent = await generateArticle(theme);

  // HTMLファイルを作成
  const fullHTML = buildPostHTML(theme.title, today, theme.category, bodyContent);
  fs.writeFileSync(postFile, fullHTML, 'utf-8');
  console.log(`✅ 記事ファイルを作成: posts/${today}.html`);

  // posts.json を更新
  let posts = [];
  if (fs.existsSync(POSTS_JSON)) {
    posts = JSON.parse(fs.readFileSync(POSTS_JSON, 'utf-8'));
  }

  // 記事メタデータを追加（先頭に追加 = 新しい順）
  posts.unshift({
    date: today,
    title: theme.title,
    category: theme.category,
    file: `${today}.html`,
  });

  fs.writeFileSync(POSTS_JSON, JSON.stringify(posts, null, 2), 'utf-8');
  console.log('✅ posts.json を更新しました。');
  console.log(`📊 合計記事数: ${posts.length}`);
  console.log('🎉 完了！');
}

main().catch(err => {
  console.error('❌ エラーが発生しました:', err.message);
  process.exit(1);
});
