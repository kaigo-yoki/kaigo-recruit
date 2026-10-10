// ========================================================================
// generate-instagram.js
// 毎日 Instagram 投稿用の素材（スライドPNG＋キャプション）を自動生成する。
//
//   ・週に1回（既定: 月曜）… マナ オープニング求人カルーセル（固定・8枚）
//   ・それ以外の曜日      … その日のブログ記事を要約した軽い投稿（3〜5枚）
//
// 出力先: social/YYYY-MM-DD/
//   slide-01.png … slide-NN.png   投稿画像（1080x1350）
//   caption.txt                    キャプション本文＋ハッシュタグ
//   meta.json                      モード・出典・投稿状態などのメタ情報
//
// 既存のブログ生成（generate-post.js）と同じ構成・同じ OPENAI_API_KEY を使う。
// ========================================================================

const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
const { renderSlides } = require('./render-slides');
const recruitDeck = require('./ig-recruit-deck');

const ROOT = path.join(__dirname, '..', '..');
const POSTS_DIR = path.join(ROOT, 'posts');
const POSTS_JSON = path.join(POSTS_DIR, 'posts.json');
const SOCIAL_DIR = path.join(ROOT, 'social');
const SITE_URL = 'https://kaigo-yoki.jp/recruit';

// 求人カルーセルを投稿する曜日（0=日, 1=月, …）。環境変数で上書き可。
const RECRUIT_DOW = process.env.IG_RECRUIT_DOW != null ? Number(process.env.IG_RECRUIT_DOW) : 1;

// ===== 日付ユーティリティ（JST） =====
function jstNow() {
  return new Date(Date.now() + 9 * 60 * 60 * 1000);
}
function getToday() {
  return jstNow().toISOString().split('T')[0];
}

// ===== ブログ本文の抽出 =====
// posts/<date>.html から見出し・段落の可視テキストを取り出す。
function extractPostText(file) {
  const html = fs.readFileSync(file, 'utf-8');
  const article = (html.match(/<article[\s\S]*?<\/article>/i) || [html])[0];
  const blocks = [];
  const re = /<(h1|h2|p)[^>]*>([\s\S]*?)<\/\1>/gi;
  let m;
  while ((m = re.exec(article)) !== null) {
    const text = m[2].replace(/<[^>]+>/g, '').replace(/&[a-z]+;/gi, ' ').trim();
    if (text) blocks.push({ tag: m[1].toLowerCase(), text });
  }
  return blocks;
}

// 今日（または直近）のブログ記事を1件選ぶ
function pickBlogPost(today) {
  if (!fs.existsSync(POSTS_JSON)) return null;
  const posts = JSON.parse(fs.readFileSync(POSTS_JSON, 'utf-8'));
  if (!posts.length) return null;
  const exact = posts.find(p => p.date === today);
  return exact || posts[0];
}

// ===== OpenAI: ブログ → スライドJSON＋キャプション =====
async function generateDailyContent(post) {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const file = path.join(POSTS_DIR, post.file);
  const blocks = extractPostText(file);
  const source = blocks.map(b => (b.tag === 'p' ? b.text : `【${b.text}】`)).join('\n').slice(0, 1800);

  const systemPrompt = `あなたは沖縄県南城市の介護事業者「有限会社 陽気（訪問介護・訪問看護 ようき）」の
Instagram運用担当です。ブログ記事を、スマホで指を止めてもらえる「軽い縦型カルーセル投稿」に再構成します。

ブランドと文体:
- 明るく・温かく・前向き。20〜40代の介護有資格者・求職者に親しみやすい言葉。
- 誇張や不確かな数字は書かない。ブログ本文にある事実の範囲で書く。
- 各スライドの見出し(headline)は短く力強く（全角14文字以内を目安、改行しない）。

デザイン制約（重要）:
- headline には最重要語句を1箇所だけ <em>…</em> で囲む（蛍光マーカーになる）。<em>は1スライド1回まで。
- bullets の text は全角22文字以内。icon は絵文字1つ。
- 最終スライドは必ず求人への軽い誘導（見学歓迎・DM・プロフィールのリンク）にする。`;

  const userPrompt = `次のブログ記事をもとに、Instagramカルーセル(3〜5枚)を作ってください。
記事タイトル: ${post.title}
カテゴリ: ${post.category}
本文:
${source}

以下の純粋なJSONのみで出力（コードブロックなし）:
{
  "slides": [
    { "bg":"sun",      "badge":"任意", "kicker":"小見出し(任意)", "headline":"見出し<em>強調</em>", "body":"本文(任意/1〜2行)", "bullets":[{"icon":"💡","text":"…"}], "footnote":"注記(任意)", "center":false },
    ...
    { "bg":"sun-deep", "center":true, "headline":"最終: 見学<em>歓迎</em>", "body":"DM・プロフィールのリンクへ", "handle":"@youki8131" }
  ],
  "caption": "投稿キャプション本文（250〜400字。1行目はフック。末尾に応募導線: DM/プロフィールのリンク/☎098-852-5255）",
  "hashtags": ["#介護求人沖縄","#南城市", "..."]
}
制約: slidesは3〜5枚。bgは "sun" / "sun-deep" / "cream" のいずれか。1枚目は必ず swipe を促す表紙にし "swipe":true を付ける。`;

  const res = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.75,
    max_tokens: 1600,
    response_format: { type: 'json_object' },
  });

  const parsed = JSON.parse(res.choices[0].message.content.trim());
  // 安全側の整形
  parsed.slides = (parsed.slides || []).slice(0, 5).map(s => ({
    bg: ['sun', 'sun-deep', 'cream'].includes(s.bg) ? s.bg : 'sun',
    badge: s.badge, kicker: s.kicker, headline: s.headline || '',
    body: s.body, bullets: Array.isArray(s.bullets) ? s.bullets.slice(0, 5) : undefined,
    footnote: s.footnote, center: !!s.center, swipe: !!s.swipe, handle: s.handle,
  }));
  if (parsed.slides[0]) parsed.slides[0].swipe = true;
  return parsed;
}

// ===== キャプション整形（本文＋ハッシュタグ） =====
function buildCaption(body, hashtags, blogUrl) {
  const tags = (hashtags || []).filter(Boolean);
  const parts = [body.trim()];
  if (blogUrl) parts.push(`\n📖 くわしくはブログで：${blogUrl}`);
  if (tags.length) parts.push('\n' + tags.join(' '));
  return parts.join('\n');
}

// ===== メイン =====
async function main() {
  const today = getToday();
  const outDir = path.join(SOCIAL_DIR, today);

  if (fs.existsSync(outDir) && fs.existsSync(path.join(outDir, 'meta.json'))) {
    console.log(`今日（${today}）の素材は既に存在します。スキップします。`);
    return;
  }

  const dow = jstNow().getUTCDay(); // jstNow はUTC表現なのでUTCDayでJSTの曜日になる
  const isRecruit = dow === RECRUIT_DOW;

  let slides, caption, meta;

  if (isRecruit) {
    console.log('モード: 求人カルーセル（週次・固定）');
    slides = recruitDeck.slides;
    caption = buildCaption(recruitDeck.caption, recruitDeck.hashtags, `${SITE_URL}/opening-staff.html`);
    meta = { mode: 'recruit', source: 'opening-staff.html' };
  } else {
    if (!process.env.OPENAI_API_KEY) {
      console.error('OPENAI_API_KEY が設定されていません。');
      process.exit(1);
    }
    const post = pickBlogPost(today);
    if (!post) {
      console.error('ブログ記事が見つかりません。求人カルーセルにフォールバックします。');
      slides = recruitDeck.slides;
      caption = buildCaption(recruitDeck.caption, recruitDeck.hashtags, `${SITE_URL}/opening-staff.html`);
      meta = { mode: 'recruit-fallback', source: 'opening-staff.html' };
    } else {
      console.log(`モード: 日次（ブログ流用） 出典: ${post.file}「${post.title}」`);
      const gen = await generateDailyContent(post);
      slides = gen.slides;
      const blogUrl = `${SITE_URL}/posts/${post.file.replace(/\.html$/, '')}`;
      caption = buildCaption(gen.caption || post.title, gen.hashtags, blogUrl);
      meta = { mode: 'daily', source: post.file, title: post.title, category: post.category };
    }
  }

  console.log('スライドを画像化中...');
  const images = await renderSlides(slides, outDir);
  console.log(`画像 ${images.length} 枚を生成: social/${today}/`);

  fs.writeFileSync(path.join(outDir, 'caption.txt'), caption, 'utf-8');
  fs.writeFileSync(path.join(outDir, 'meta.json'), JSON.stringify({
    date: today,
    ...meta,
    slideCount: images.length,
    images: images.map(p => path.basename(p)),
    published: false,
    generatedAt: new Date().toISOString(),
  }, null, 2), 'utf-8');

  console.log('caption.txt / meta.json を書き出しました。完了！');
}

main().catch(err => {
  console.error('エラー:', err.message);
  process.exit(1);
});
