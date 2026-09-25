/**
 * 最新ブログ記事のメタデータ（posts/og/_latest-meta.json）から
 * Instagram投稿用のタイトル画像（1080×1080 PNG）を生成する。
 *
 * 依存: sharp（SVG→PNG変換）
 * フォント: GitHub Actions では Noto Sans CJK JP を apt-get で導入
 *           ローカル(macOS) では Hiragino Sans / system_default
 *
 * 出力: posts/og/{date}.png
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const OG_DIR = path.join(__dirname, '..', '..', 'posts', 'og');
const META_PATH = path.join(OG_DIR, '_latest-meta.json');

const WIDTH = 1080;
const HEIGHT = 1080;

// ===== カテゴリ別カラーパレット（介護らしい暖色トーン） =====
const CATEGORY_COLORS = {
  '沖縄':            { from: '#FFB35A', to: '#FF7A3D', accent: '#3A2A1C' },
  'やりがい':         { from: '#FF9F7A', to: '#E8634D', accent: '#3A1B14' },
  '働き方':           { from: '#FFC97A', to: '#E89C3D', accent: '#3A2810' },
  '専門知識':         { from: '#7AB8FF', to: '#3D86E8', accent: '#0C1F3A' },
  'コミュニケーション': { from: '#FFA0C5', to: '#E84D89', accent: '#3A1424' },
  '未経験者向け':     { from: '#A0E87A', to: '#5DB83D', accent: '#16321A' },
  'キャリア':         { from: '#C49BFF', to: '#8B5DE8', accent: '#1F1438' },
  '健康':             { from: '#7AE8C5', to: '#3DB893', accent: '#0E2E26' },
  '採用情報':         { from: '#FFAA7A', to: '#E8703D', accent: '#3A1F10' },
};

const DEFAULT_PALETTE = { from: '#FFB35A', to: '#FF7A3D', accent: '#3A2A1C' };

function pickPalette(category) {
  return CATEGORY_COLORS[category] || DEFAULT_PALETTE;
}

function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * 日本語タイトルを最大行数・最大文字数で折り返す。
 * 句読点・約物の禁則処理は最低限のみ（行頭の「、。」を前行へ送る）。
 */
function wrapTitle(text, maxCharsPerLine, maxLines) {
  const chars = Array.from(text);
  const lines = [];
  let current = '';
  for (const c of chars) {
    if (current.length >= maxCharsPerLine) {
      lines.push(current);
      current = '';
      if (lines.length === maxLines - 1) {
        const rest = chars.slice(chars.indexOf(c)).join('');
        current = rest.length > maxCharsPerLine ? rest.slice(0, maxCharsPerLine - 1) + '…' : rest;
        break;
      }
    }
    current += c;
  }
  if (current && lines.length < maxLines) lines.push(current);

  // 行頭約物送り
  const fixed = [];
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    if (i > 0 && /^[、。」』）]/.test(line)) {
      fixed[fixed.length - 1] += line[0];
      line = line.slice(1);
    }
    fixed.push(line);
  }
  return fixed;
}

function buildSvg({ date, title, category }) {
  const palette = pickPalette(category);
  // タイトル長に応じてフォントサイズと折返し幅を動的決定（はみ出し防止）
  // 88px × 14文字 = 1232px で1080pxを超えるため、フォント別に幅を絞る
  const titleLen = Array.from(title).length;
  let maxCharsPerLine, titleFontSize, maxLines;
  if (titleLen <= 10) {
    maxCharsPerLine = 10; titleFontSize = 96; maxLines = 1;
  } else if (titleLen <= 22) {
    maxCharsPerLine = 11; titleFontSize = 82; maxLines = 2;
  } else if (titleLen <= 33) {
    maxCharsPerLine = 12; titleFontSize = 72; maxLines = 3;
  } else {
    maxCharsPerLine = 13; titleFontSize = 64; maxLines = 3;
  }
  const titleLines = wrapTitle(title, maxCharsPerLine, maxLines);
  const lineHeight = titleFontSize * 1.35;
  const titleBlockHeight = titleLines.length * lineHeight;
  const titleStartY = (HEIGHT - titleBlockHeight) / 2 + titleFontSize * 0.85;

  const fontFamily = "'Noto Sans CJK JP', 'Noto Sans JP', 'Hiragino Sans', 'Yu Gothic', sans-serif";

  const titleTspans = titleLines
    .map((line, i) => {
      const y = titleStartY + i * lineHeight;
      return `<text x="${WIDTH / 2}" y="${y}" text-anchor="middle" font-family="${fontFamily}" font-size="${titleFontSize}" font-weight="900" fill="#ffffff" stroke="${palette.accent}" stroke-width="2" paint-order="stroke">${escapeXml(line)}</text>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${palette.from}"/>
      <stop offset="100%" stop-color="${palette.to}"/>
    </linearGradient>
    <linearGradient id="overlay" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="${palette.accent}" stop-opacity="0"/>
      <stop offset="100%" stop-color="${palette.accent}" stop-opacity="0.35"/>
    </linearGradient>
  </defs>

  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)"/>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#overlay)"/>

  <!-- 装飾円（右上） -->
  <circle cx="${WIDTH - 80}" cy="120" r="200" fill="#ffffff" fill-opacity="0.08"/>
  <circle cx="${WIDTH - 200}" cy="60" r="80" fill="#ffffff" fill-opacity="0.12"/>

  <!-- 日付（右上） -->
  <text x="${WIDTH - 60}" y="80" text-anchor="end" font-family="${fontFamily}" font-size="32" font-weight="700" fill="#ffffff" opacity="0.95">${escapeXml(date)}</text>

  <!-- カテゴリタグ（中央上） -->
  <g transform="translate(${WIDTH / 2}, 200)">
    <rect x="-110" y="-32" width="220" height="56" rx="28" fill="#ffffff" fill-opacity="0.92"/>
    <text x="0" y="8" text-anchor="middle" font-family="${fontFamily}" font-size="28" font-weight="700" fill="${palette.accent}">${escapeXml(category)}</text>
  </g>

  <!-- タイトル本体 -->
  ${titleTspans}

  <!-- ブランド帯（下） -->
  <rect x="0" y="${HEIGHT - 130}" width="${WIDTH}" height="130" fill="${palette.accent}" fill-opacity="0.85"/>
  <text x="60" y="${HEIGHT - 70}" font-family="${fontFamily}" font-size="40" font-weight="900" fill="#ffffff">デイサービスはいさい</text>
  <text x="60" y="${HEIGHT - 28}" font-family="${fontFamily}" font-size="22" font-weight="500" fill="#ffffff" opacity="0.85">沖縄県南城市・介護のお仕事ブログ</text>
  <text x="${WIDTH - 60}" y="${HEIGHT - 48}" text-anchor="end" font-family="${fontFamily}" font-size="22" font-weight="700" fill="#ffffff">@youki8131</text>
</svg>`;
}

async function generateOgImage({ date, title, category, outDir = OG_DIR }) {
  const svg = buildSvg({ date, title, category });
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const outPath = path.join(outDir, `${date}.png`);

  await sharp(Buffer.from(svg))
    .png({ compressionLevel: 9 })
    .resize(WIDTH, HEIGHT)
    .toFile(outPath);

  console.log('Generated OG image:', outPath);
  return outPath;
}

async function main() {
  if (!fs.existsSync(META_PATH)) {
    console.error('Meta file not found. Run extract-latest-meta.js first:', META_PATH);
    process.exit(1);
  }
  const meta = JSON.parse(fs.readFileSync(META_PATH, 'utf8'));
  await generateOgImage(meta);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { generateOgImage, buildSvg };
