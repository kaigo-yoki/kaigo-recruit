// ========================================================================
// ig-publish.js
// social/<date>/ の素材を Instagram Graph API で公開する（フェーズ3）。
//
// 前提（Meta側の初期設定・詳細は docs/instagram-setup.md）:
//   - @youki8131 をプロアカウント化し Facebookページと連携
//   - Instagram Graph API のアクセス権限つき「長期アクセストークン」
//   - Instagram ビジネスアカウントID
//
// 必要な環境変数:
//   IG_ACCESS_TOKEN   長期アクセストークン
//   IG_USER_ID        Instagram ビジネスアカウントID（数値）
//   IMAGE_BASE_URL    画像の公開URLのベース。末尾に <date>/slide-XX.png が付く
//                     例: https://kaigo-yoki.jp/recruit/social
//   IG_TARGET_DATE    （任意）投稿対象日 YYYY-MM-DD。既定は social 内の最新未投稿
//
// 画像は「公開URLから取得可能」である必要がある（Instagram側が取りに来る）。
// このためコミット→デプロイ後に実行するか、raw.githubusercontent の公開URLを使う。
// ========================================================================

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const SOCIAL_DIR = path.join(ROOT, 'social');
const GRAPH = 'https://graph.facebook.com/v21.0';

function die(msg) { console.error('エラー:', msg); process.exit(1); }

// 最新の未投稿ディレクトリ（YYYY-MM-DD）を探す
function resolveTargetDate() {
  if (process.env.IG_TARGET_DATE) return process.env.IG_TARGET_DATE;
  const dates = fs.readdirSync(SOCIAL_DIR)
    .filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d))
    .sort().reverse();
  for (const d of dates) {
    const metaPath = path.join(SOCIAL_DIR, d, 'meta.json');
    if (!fs.existsSync(metaPath)) continue;
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
    if (!meta.published) return d;
  }
  return null;
}

// 画像URLが公開済み（HTTP 200）になるまで待つ。デプロイ直後の取りこぼし対策。
async function waitForUrl(url, { tries = 30, intervalMs = 10000 } = {}) {
  for (let i = 1; i <= tries; i++) {
    try {
      const res = await fetch(url, { method: 'HEAD' });
      if (res.ok) { console.log(`画像URL 到達確認: ${url}`); return true; }
    } catch { /* まだ未公開 */ }
    if (i < tries) {
      console.log(`  画像URLの公開待ち... (${i}/${tries})`);
      await new Promise(r => setTimeout(r, intervalMs));
    }
  }
  return false;
}

async function graphPost(url) {
  const res = await fetch(url, { method: 'POST' });
  const json = await res.json();
  if (!res.ok || json.error) {
    throw new Error(`Graph API: ${JSON.stringify(json.error || json)}`);
  }
  return json;
}

// 単一画像コンテナを作成 → creation_id
async function createImageContainer(userId, token, imageUrl, { caption, isCarouselItem }) {
  const params = new URLSearchParams({ image_url: imageUrl, access_token: token });
  if (isCarouselItem) params.set('is_carousel_item', 'true');
  if (caption) params.set('caption', caption);
  const json = await graphPost(`${GRAPH}/${userId}/media?${params}`);
  return json.id;
}

async function createCarouselContainer(userId, token, children, caption) {
  const params = new URLSearchParams({
    media_type: 'CAROUSEL',
    children: children.join(','),
    caption: caption || '',
    access_token: token,
  });
  const json = await graphPost(`${GRAPH}/${userId}/media?${params}`);
  return json.id;
}

async function publishContainer(userId, token, creationId) {
  const params = new URLSearchParams({ creation_id: creationId, access_token: token });
  const json = await graphPost(`${GRAPH}/${userId}/media_publish?${params}`);
  return json.id;
}

async function main() {
  const token = process.env.IG_ACCESS_TOKEN;
  const userId = process.env.IG_USER_ID;
  const base = (process.env.IMAGE_BASE_URL || '').replace(/\/$/, '');
  if (!token) die('IG_ACCESS_TOKEN が未設定です');
  if (!userId) die('IG_USER_ID が未設定です');
  if (!base) die('IMAGE_BASE_URL が未設定です');

  const date = resolveTargetDate();
  if (!date) { console.log('未投稿の素材がありません。終了します。'); return; }

  const dir = path.join(SOCIAL_DIR, date);
  const meta = JSON.parse(fs.readFileSync(path.join(dir, 'meta.json'), 'utf-8'));
  if (meta.published) { console.log(`${date} は既に投稿済みです。`); return; }

  const caption = fs.readFileSync(path.join(dir, 'caption.txt'), 'utf-8').trim();
  const images = meta.images.map(name => `${base}/${date}/${name}`);
  console.log(`投稿対象: ${date}（${meta.mode} / ${images.length}枚）`);

  // 先頭画像が公開されるまで待機（最大5分）
  const ready = await waitForUrl(images[0]);
  if (!ready) die(`画像URLが公開されません: ${images[0]}（デプロイ状況とIMAGE_BASE_URLを確認）`);

  let containerId;
  if (images.length === 1) {
    console.log('単一画像として投稿します...');
    containerId = await createImageContainer(userId, token, images[0], { caption });
  } else {
    console.log('カルーセルの子アイテムを作成中...');
    const children = [];
    for (const url of images) {
      const id = await createImageContainer(userId, token, url, { isCarouselItem: true });
      children.push(id);
      console.log('  child:', id);
    }
    console.log('カルーセルコンテナを作成中...');
    containerId = await createCarouselContainer(userId, token, children, caption);
  }

  console.log('公開処理中...', containerId);
  const postId = await publishContainer(userId, token, containerId);

  meta.published = true;
  meta.instagramPostId = postId;
  meta.publishedAt = new Date().toISOString();
  fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify(meta, null, 2), 'utf-8');

  console.log(`✅ 投稿完了！ Instagram post id: ${postId}`);
}

main().catch(err => { console.error('投稿エラー:', err.message); process.exit(1); });
