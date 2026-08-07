// ========================================================================
// render-slides.js
// スライドデータ配列 → 各スライドを 1080x1350 の PNG に書き出す。
// ig-template.js のHTMLを Puppeteer で開き、各 .slide 要素を個別に撮影。
// ========================================================================

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const { buildDocument, SLIDE_W, SLIDE_H } = require('./ig-template');

// slides: スライドデータ配列 / outDir: 出力先ディレクトリ
// 戻り値: 生成したPNGの絶対パス配列（スライド順）
async function renderSlides(slides, outDir) {
  if (!slides || !slides.length) throw new Error('slides が空です');
  fs.mkdirSync(outDir, { recursive: true });

  const html = buildDocument(slides);

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--font-render-hinting=none'],
  });
  try {
    const page = await browser.newPage();
    // 高解像度で撮るため deviceScaleFactor=1、要素サイズは実寸1080x1350
    await page.setViewport({ width: SLIDE_W, height: SLIDE_H, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: 'networkidle0' });
    // Webフォント待ちは不要（システムフォント）だが描画安定のため少し待つ
    await page.evaluate(() => document.fonts && document.fonts.ready);

    const handles = await page.$$('.slide');
    const paths = [];
    for (let i = 0; i < handles.length; i++) {
      const file = path.join(outDir, `slide-${String(i + 1).padStart(2, '0')}.png`);
      await handles[i].screenshot({ path: file, type: 'png' });
      paths.push(file);
    }
    return paths;
  } finally {
    await browser.close();
  }
}

module.exports = { renderSlides };

// 単体テスト: `node scripts/build/render-slides.js` でサンプル画像を生成
if (require.main === module) {
  const sample = [
    {
      bg: 'sun', badge: '🎉 2027年2月 新規オープン', swipe: true,
      headline: '資格を、<em>年収とポジション</em>に。',
      body: '施設訪問介護「マナ」\nオープニングスタッフ 20名 募集\n沖縄・南城市',
    },
    {
      bg: 'cream', kicker: 'こんな有資格者の方へ',
      headline: 'その資格、<em>もっと活きる場所</em>が。',
      bullets: [
        { icon: '💸', text: '頑張っても、年収が上がらない' },
        { icon: '🪑', text: '上のポジションが埋まって昇進できない' },
        { icon: '🌀', text: '自分の理想の現場を、つくれない' },
      ],
    },
    {
      bg: 'sun-deep', center: true,
      headline: '施設長・サ責という<em>椅子</em>が、今なら空いている。',
      body: '有資格者が、上を目指せる立ち上げポジション。',
      handle: '@youki8131',
    },
  ];
  const out = path.join(__dirname, '..', '..', 'social', '_sample');
  renderSlides(sample, out)
    .then(p => { console.log('生成:', p.length, '枚 →', out); })
    .catch(e => { console.error(e); process.exit(1); });
}
