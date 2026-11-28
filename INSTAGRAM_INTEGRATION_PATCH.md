# Instagram連携 既存ファイル改修パッチ

`INSTAGRAM_SETUP.md` のセットアップを完了してから、本ドキュメントに沿って既存ファイル2つを改修してください。

**所要時間**: 約5分

---

## パッチ1: `package.json` に `sharp` を追加

`dependencies` に `"sharp": "^0.33.0"` を追加し、`scripts` に新規スクリプトを追加します。

### 差分

```diff
   "scripts": {
     "dev": "npx -y serve@latest -l 3000",
     "generate": "node scripts/build/generate-post.js",
+    "extract-meta": "node scripts/build/extract-latest-meta.js",
+    "generate-og": "node scripts/build/generate-og-image.js",
+    "post-instagram": "node scripts/build/post-to-instagram.js",
+    "check-instagram-token": "node scripts/build/check-instagram-token.js",
     "generate:recruit": "POST_MODE=recruit node scripts/build/generate-post.js",
     "generate-training": "node scripts/build/generate-training.js",
     "generate-individual": "node scripts/build/generate-individual.js"
   },
   "dependencies": {
-    "openai": "^4.58.0"
+    "openai": "^4.58.0",
+    "sharp": "^0.33.0"
   }
```

### 適用後の作業

```bash
cd /Users/miyuki/書類/kaigo-recruit
npm install
git add package.json package-lock.json
git commit -m "chore(deps): add sharp for Instagram OG image generation"
```

---

## パッチ2: `daily-blog.yml` の差し替え

新規ファイル `.github/workflows/daily-blog.yml.proposed` を本ファイルとして配置済みです。内容を確認した上で、既存の `daily-blog.yml` を差し替えてください。

### 適用コマンド

```bash
cd /Users/miyuki/書類/kaigo-recruit

# 旧ファイルをバックアップ
cp .github/workflows/daily-blog.yml .github/workflows/daily-blog.yml.backup

# 新ファイルで置き換え
mv .github/workflows/daily-blog.yml.proposed .github/workflows/daily-blog.yml

# 差分確認
diff .github/workflows/daily-blog.yml.backup .github/workflows/daily-blog.yml

# 問題なければバックアップ削除＆コミット
rm .github/workflows/daily-blog.yml.backup
git add .github/workflows/daily-blog.yml
git commit -m "feat(ci): add Instagram auto-post to daily blog workflow"
```

### 差分概要

| 変更点 | 理由 |
|---|---|
| `timeout-minutes: 10 → 20` | Vercelデプロイ90秒待機＋ジッタ最大10分＋投稿APIの計算 |
| `fonts-noto-cjk` を apt-get | OG画像生成で日本語が正常表示される |
| `extract-latest-meta.js` 実行 | posts.jsonの最新記事メタ抽出 |
| `generate-og-image.js` 実行 | タイトル画像PNG生成 |
| `git add posts/` 範囲拡大 | `posts/og/*.png` も対象に含む |
| `sleep 90` | Vercelデプロイ完了待ち |
| `post-to-instagram.js` 実行 | Graph APIで投稿 |

---

## パッチ3（オプション）: トークンチェックワークフローの有効化

既に `.github/workflows/instagram-token-check.yml` が配置済みです。スケジュール起動（毎週日曜AM）が自動で動きますが、初回だけ手動実行で動作確認しておくのを推奨します。

```bash
gh workflow run "Instagram トークン期限チェック" --repo kaigo-yoki/kaigo-recruit
```

---

## 全パッチ適用後の最終チェックリスト

- [ ] `INSTAGRAM_SETUP.md` ステップ1〜5完了（Meta設定＋Secrets登録）
- [ ] `package.json` 改修＆`npm install` 完了
- [ ] `daily-blog.yml` 差し替え完了
- [ ] `git push` でリモートに反映
- [ ] Actions タブで「ブログ自動生成」を手動実行（Run workflow）
- [ ] @youki8131 に投稿されたことを確認
- [ ] `Instagram トークン期限チェック` も手動1回実行
- [ ] 60日後（`INSTAGRAM_TOKEN_ISSUED_AT + 46日後` 以降）の自動Issue通知体制OK

すべて完了すれば**毎日JST9:30前後にブログ自動投稿が始まります**。
