/**
 * Instagram Graph API でデイサービスはいさい (@youki8131) に画像投稿する。
 *
 * 必須環境変数:
 *   INSTAGRAM_BUSINESS_ACCOUNT_ID  Instagram Business Account ID
 *   INSTAGRAM_ACCESS_TOKEN         長期トークン（60日有効）
 *
 * 入力: posts/og/_latest-meta.json （extract-latest-meta.js が出力したもの）
 *
 * 流れ:
 *   1) image_url を指定してメディアコンテナ作成 → creation_id 取得
 *   2) creation_id でメディア公開
 *
 * 凍結予防:
 *   - 投稿前に 0〜600秒のランダム遅延（GitHub Actionsの実行時刻が毎日同じになるのを防ぐ）
 */

const fs = require('fs');
const path = require('path');

const META_PATH = path.join(__dirname, '..', '..', 'posts', 'og', '_latest-meta.json');
const GRAPH_API_VERSION = 'v19.0';

function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing required env var: ${name}`);
    process.exit(1);
  }
  return v;
}

function buildCaption({ title, excerpt, category }) {
  const baseTags = [
    '介護', '沖縄介護', '南城市', '介護求人',
    'デイサービスはいさい', '介護のお仕事', '介護職', '沖縄',
    '訪問介護', 'グループホーム', '住宅型有料老人ホーム',
  ];
  const categoryTagMap = {
    '沖縄':              ['南城市移住', '沖縄暮らし'],
    'やりがい':           ['介護の魅力', 'やりがいのある仕事'],
    '働き方':             ['働き方改革', 'ワークライフバランス'],
    '専門知識':           ['介護スキル', '介護福祉士'],
    'コミュニケーション': ['介護コミュニケーション'],
    '未経験者向け':       ['介護未経験', '介護転職'],
    'キャリア':           ['介護キャリア', '資格取得支援'],
    '健康':               ['介護現場', '体調管理'],
    '採用情報':           ['介護採用', '介護求人沖縄'],
  };
  const extraTags = categoryTagMap[category] || [];
  const tags = [...baseTags, ...extraTags].map((t) => `#${t}`).join(' ');

  return [
    `${title}`,
    '',
    excerpt,
    '',
    '▼ 続きはプロフィールリンクから',
    '（@youki8131 / kaigo-recruit.vercel.app）',
    '',
    tags,
  ].join('\n');
}

async function delayJitter() {
  const seconds = Math.floor(Math.random() * 600);
  console.log(`[jitter] sleeping ${seconds}s to avoid mechanical posting pattern...`);
  return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
}

async function postJson(url) {
  const res = await fetch(url, { method: 'POST' });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch (_e) { json = { raw: text }; }
  if (!res.ok) {
    const err = new Error(`Graph API error ${res.status}: ${text}`);
    err.status = res.status;
    err.body = json;
    throw err;
  }
  return json;
}

async function createMediaContainer({ igUserId, imageUrl, caption, accessToken }) {
  const url = new URL(`https://graph.facebook.com/${GRAPH_API_VERSION}/${igUserId}/media`);
  url.searchParams.set('image_url', imageUrl);
  url.searchParams.set('caption', caption);
  url.searchParams.set('access_token', accessToken);
  const result = await postJson(url.toString());
  if (!result.id) throw new Error(`No creation_id in response: ${JSON.stringify(result)}`);
  return result.id;
}

async function publishMedia({ igUserId, creationId, accessToken }) {
  const url = new URL(`https://graph.facebook.com/${GRAPH_API_VERSION}/${igUserId}/media_publish`);
  url.searchParams.set('creation_id', creationId);
  url.searchParams.set('access_token', accessToken);
  return postJson(url.toString());
}

async function waitImageReachable(imageUrl, maxAttempts = 12, intervalMs = 10000) {
  for (let i = 1; i <= maxAttempts; i++) {
    try {
      const res = await fetch(imageUrl, { method: 'HEAD' });
      if (res.ok) {
        console.log(`[reach-check] image is reachable (attempt ${i}, status ${res.status})`);
        return true;
      }
      console.log(`[reach-check] attempt ${i}/${maxAttempts}: status ${res.status}`);
    } catch (e) {
      console.log(`[reach-check] attempt ${i}/${maxAttempts}: ${e.message}`);
    }
    if (i < maxAttempts) await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`Image URL did not become reachable: ${imageUrl}`);
}

async function main() {
  const igUserId = requireEnv('INSTAGRAM_BUSINESS_ACCOUNT_ID');
  const accessToken = requireEnv('INSTAGRAM_ACCESS_TOKEN');
  const skipJitter = process.env.INSTAGRAM_SKIP_JITTER === '1';

  if (!fs.existsSync(META_PATH)) {
    console.error('Meta file not found:', META_PATH);
    process.exit(1);
  }
  const meta = JSON.parse(fs.readFileSync(META_PATH, 'utf8'));
  const caption = buildCaption(meta);

  console.log('=== Instagram Post ===');
  console.log('Date    :', meta.date);
  console.log('Title   :', meta.title);
  console.log('Category:', meta.category);
  console.log('Image   :', meta.imageUrl);
  console.log('---');
  console.log(caption);
  console.log('---');

  await waitImageReachable(meta.imageUrl);
  if (!skipJitter) await delayJitter();

  const creationId = await createMediaContainer({
    igUserId, imageUrl: meta.imageUrl, caption, accessToken,
  });
  console.log('Created media container:', creationId);

  await new Promise((r) => setTimeout(r, 5000));

  const publishResult = await publishMedia({ igUserId, creationId, accessToken });
  console.log('Published:', JSON.stringify(publishResult));
  console.log('SUCCESS');
}

if (require.main === module) {
  main().catch((err) => {
    console.error('FAILED:', err.message);
    if (err.body) console.error(JSON.stringify(err.body, null, 2));
    process.exit(1);
  });
}

module.exports = { buildCaption };
