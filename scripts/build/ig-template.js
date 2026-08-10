// ========================================================================
// ig-template.js
// Instagram投稿スライド（4:5 / 1080x1350）のブランドHTMLを生成する。
// 採用サイトのサンセットゴールドのブランドを踏襲。
// render-slides.js がこのHTMLをPuppeteerでPNG化する。
// ========================================================================

// スライド1枚のデータ形状（generate-instagram.js / OpenAIが生成）
//   {
//     bg:       'sun' | 'sun-deep' | 'cream',   // 背景バリエーション
//     badge:    '2027年2月 新規オープン',        // 任意・左上のピル
//     kicker:   'こんな有資格者の方へ',          // 任意・小見出し
//     headline: '資格を、<em>年収</em>に。',      // 必須・<em>で蛍光マーカー
//     body:     '本文（1〜2行）',                 // 任意
//     bullets:  [ { icon:'💰', text:'…' }, … ],  // 任意・箇条書き（最大5）
//     footnote: '※ 各種手当込み',                // 任意・小さな注記
//     center:   false,                           // 中央寄せにするか
//     swipe:    true,                            // 「スワイプ →」を出すか
//     handle:   '@youki8131'                     // 任意・下部中央のハンドル
//   }

const SLIDE_W = 1080;
const SLIDE_H = 1350;

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// headline だけは <em> を許可（蛍光マーカー用）。それ以外のタグは除去。
function headlineHTML(s) {
  const escaped = esc(s);
  return escaped.replace(/&lt;em&gt;/g, '<em>').replace(/&lt;\/em&gt;/g, '</em>');
}

function renderBullets(bullets, dark) {
  if (!bullets || !bullets.length) return '';
  const items = bullets.slice(0, 5).map(b => {
    const icon = b.icon ? `<span class="bic">${esc(b.icon)}</span>` : '';
    return `<div class="bitem">${icon}<span>${esc(b.text)}</span></div>`;
  }).join('');
  return `<div class="blist">${items}</div>`;
}

function renderSlide(slide, index, total) {
  const bg = slide.bg || 'sun';
  const cls = ['slide', bg];
  if (slide.center) cls.push('center');

  const badge = slide.badge ? `<span class="badge">${esc(slide.badge)}</span>` : '';
  const kicker = slide.kicker ? `<div class="kicker">${esc(slide.kicker)}</div>` : '';
  const headline = slide.headline ? `<div class="headline">${headlineHTML(slide.headline)}</div>` : '';
  const body = slide.body ? `<div class="body">${esc(slide.body).replace(/\n/g, '<br>')}</div>` : '';
  const bullets = renderBullets(slide.bullets);
  const footnote = slide.footnote ? `<div class="footnote">${esc(slide.footnote)}</div>` : '';
  const handle = slide.handle ? `<div class="handle">${esc(slide.handle)}</div>` : '';
  const pageno = `<span class="snum">${index + 1} / ${total}</span>`;
  const swipe = slide.swipe
    ? `<div class="swipe"><span>スワイプ</span><span class="dot">→</span></div>` : '';

  return `
  <div class="${cls.join(' ')}" data-slide="${index}">
    ${pageno}
    ${badge}
    ${kicker}
    ${headline}
    ${body}
    ${bullets}
    ${footnote}
    ${handle}
    ${swipe}
  </div>`;
}

// スライド配列 → 全スライドを縦に並べた1枚のHTMLドキュメント
function buildDocument(slides) {
  const total = slides.length;
  const body = slides.map((s, i) => renderSlide(s, i, total)).join('\n');

  return `<!DOCTYPE html>
<html lang="ja"><head><meta charset="UTF-8">
<style>
  :root{
    --g1:#F7971E; --g2:#FFA751; --g3:#FFC371; --g4:#FFD89B;
    --ink:#5E3100; --ink2:#7A3E00; --gold:#C9740A;
    --font:"Hiragino Maru Gothic ProN","Noto Sans CJK JP","Noto Sans JP","M PLUS Rounded 1c","Yu Gothic",sans-serif;
  }
  *{box-sizing:border-box;margin:0;padding:0;-webkit-font-smoothing:antialiased}
  body{font-family:var(--font);background:#fff}
  .slide{
    position:relative;width:${SLIDE_W}px;height:${SLIDE_H}px;overflow:hidden;
    color:#fff;display:flex;flex-direction:column;padding:96px 84px;isolation:isolate;
  }
  .slide.center{justify-content:center;text-align:center}
  .snum{position:absolute;top:52px;right:60px;font-size:30px;font-weight:800;color:rgba(255,255,255,.85);letter-spacing:.06em;z-index:3}
  /* 背景バリエーション */
  .sun{background:linear-gradient(150deg,#F7971E 0%,#FFA751 42%,#FFC371 78%,#FFD89B 100%)}
  .sun-deep{background:linear-gradient(155deg,#E9820C 0%,#F7971E 45%,#FFB55E 100%)}
  .cream{background:linear-gradient(160deg,#FFFDF9 0%,#FFF4E2 100%);color:var(--ink)}
  .cream .snum{color:#C9740A}
  .cream .kicker{color:var(--gold)}
  .cream .headline{color:var(--ink)}
  .cream .headline em{background:linear-gradient(transparent 60%,#FFD89B 60%)}
  .cream .body{color:#6E4A1C}
  .cream .footnote{color:#9A6A2E}
  .badge{align-self:flex-start;background:rgba(255,255,255,.94);color:var(--gold);font-size:32px;font-weight:900;padding:16px 34px;border-radius:999px;letter-spacing:.01em;margin-bottom:34px}
  .center .badge{align-self:center}
  .kicker{font-size:36px;font-weight:800;opacity:.96;margin-bottom:22px}
  .headline{font-size:82px;font-weight:900;line-height:1.3;letter-spacing:.01em}
  .headline em{font-style:normal;background:linear-gradient(transparent 58%,rgba(255,255,255,.5) 58%);padding:0 6px}
  .body{font-size:37px;font-weight:700;line-height:1.7;opacity:.97;margin-top:34px}
  .footnote{font-size:27px;font-weight:700;opacity:.9;margin-top:30px}
  .blist{display:flex;flex-direction:column;gap:26px;margin-top:44px}
  .bitem{background:rgba(255,255,255,.17);border:2px solid rgba(255,255,255,.3);border-radius:28px;padding:30px 34px;font-size:41px;font-weight:800;line-height:1.45;display:flex;gap:22px;align-items:flex-start}
  .cream .bitem{background:#fff;color:var(--ink2);border-color:#F3E2C4;box-shadow:0 10px 26px rgba(201,116,10,.1)}
  .bic{flex:0 0 auto;font-size:44px;line-height:1.1}
  .handle{font-size:42px;font-weight:900;margin-top:44px;text-align:center;letter-spacing:.02em}
  .swipe{position:absolute;right:72px;bottom:64px;font-size:34px;font-weight:800;opacity:.95;display:flex;align-items:center;gap:16px;z-index:3}
  .swipe .dot{display:inline-flex;width:74px;height:74px;border-radius:50%;background:rgba(255,255,255,.22);align-items:center;justify-content:center;font-size:40px}
</style></head>
<body>
${body}
</body></html>`;
}

module.exports = { buildDocument, renderSlide, SLIDE_W, SLIDE_H };
