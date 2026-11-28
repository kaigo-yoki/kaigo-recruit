/**
 * posts.json の先頭エントリ＋HTMLから本文冒頭を抽出し、
 * Instagram投稿スクリプトへ渡すメタデータをJSON出力する。
 *
 * 既存の generate-post.js を改修せず、posts/posts.json と posts/{date}.html から
 * 必要情報を読むだけのスタンドアロン処理。
 *
 * 出力: posts/og/_latest-meta.json
 *   { date, title, category, file, excerpt, imageUrl }
 */

const fs = require('fs');
const path = require('path');

const POSTS_DIR = path.join(__dirname, '..', '..', 'posts');
const POSTS_JSON = path.join(POSTS_DIR, 'posts.json');
const OG_DIR = path.join(POSTS_DIR, 'og');
const META_OUT = path.join(OG_DIR, '_latest-meta.json');
const SITE_BASE = 'https://kaigo-recruit.vercel.app';

function extractExcerpt(html, maxChars = 110) {
  const body = html
    .replace(/<head[\s\S]*?<\/head>/i, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '');

  const articleMatch = body.match(/<article[\s\S]*?<\/article>/i);
  const target = articleMatch ? articleMatch[0] : body;

  const text = target
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + '…';
}

function main() {
  if (!fs.existsSync(POSTS_JSON)) {
    console.error('posts.json not found');
    process.exit(1);
  }
  const posts = JSON.parse(fs.readFileSync(POSTS_JSON, 'utf8'));
  if (!Array.isArray(posts) || posts.length === 0) {
    console.error('posts.json is empty or not an array');
    process.exit(1);
  }

  const latest = posts[0];
  const htmlPath = path.join(POSTS_DIR, latest.file);
  if (!fs.existsSync(htmlPath)) {
    console.error(`HTML file not found: ${htmlPath}`);
    process.exit(1);
  }
  const html = fs.readFileSync(htmlPath, 'utf8');
  const excerpt = extractExcerpt(html);

  const meta = {
    date: latest.date,
    title: latest.title,
    category: latest.category,
    file: latest.file,
    excerpt,
    imageUrl: `${SITE_BASE}/posts/og/${latest.date}.png`,
    postUrl: `${SITE_BASE}/posts/${latest.file}`,
  };

  if (!fs.existsSync(OG_DIR)) {
    fs.mkdirSync(OG_DIR, { recursive: true });
  }
  fs.writeFileSync(META_OUT, JSON.stringify(meta, null, 2), 'utf8');
  console.log('Wrote', META_OUT);
  console.log(JSON.stringify(meta, null, 2));
}

main();
