# social/ — Instagram 投稿素材

GitHub Actions（`.github/workflows/daily-instagram.yml`）が毎日ここに投稿素材を書き出します。

```
social/
  2027-01-20/
    slide-01.png … slide-NN.png   投稿画像（1080x1350 / 4:5）
    caption.txt                    キャプション本文＋ハッシュタグ
    meta.json                      モード・出典・投稿状態（published 等）
```

- `meta.mode` … `recruit`（週次の求人カルーセル）/ `daily`（ブログ流用）
- `meta.published` … Instagramへ投稿済みかどうか
- 画像は `https://kaigo-yoki.jp/recruit/social/<日付>/slide-XX.png` で公開され、
  Instagram Graph API がそこから取得して投稿します。

## 関連
- 生成: `scripts/build/generate-instagram.js`（`npm run generate-instagram`）
- 画像化: `scripts/build/render-slides.js` ＋ `scripts/build/ig-template.js`
- 求人カルーセルの固定内容: `scripts/build/ig-recruit-deck.js`
- 投稿: `scripts/build/ig-publish.js`（`npm run ig-publish`）
- Meta設定手順: `docs/instagram-setup.md`

`_` で始まるディレクトリ（`social/_sample` 等）はテスト用で、Gitには追跡されません。
