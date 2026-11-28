# Instagram 自動投稿セットアップ手順書

ブログ自動生成（毎日JST9:00）に連動して、Instagramへ毎日自動投稿する仕組みのセットアップ手順です。

**所要時間**: 約30分（1回だけ）
**前提**: Instagramビジネスアカウント `@youki8131` がFacebookページと連携済みであること

---

## 全体像

```
GitHub Actions (毎日 JST 9:00)
  ↓
ブログ記事自動生成 (既存)
  ↓
タイトル画像1080×1080 自動生成 (新規)
  ↓
git push → Vercelデプロイ (画像URLが公開される)
  ↓
60秒待機
  ↓
Instagram Graph API でメディア作成 → 公開 (新規)
  ↓
@youki8131 に投稿される
```

---

## ステップ1: Meta for Developers でアプリを作成（5分）

1. [https://developers.facebook.com/](https://developers.facebook.com/) にアクセス
2. 右上「マイアプリ」→「アプリを作成」
3. アプリタイプ: **「ビジネス」** を選択
4. アプリ名: `kaigo-yoki-instagram` （任意）
5. 連絡先メール: `info@kaigo-yoki.jp`
6. 「アプリを作成」をクリック
7. ダッシュボード左メニュー「アプリ設定」→「ベーシック」
8. 以下2つの値を**メモ**:
   - **アプリID** (App ID) ← 後で `META_APP_ID` として使用
   - **app secret** (App Secret) ← 「表示」を押してメモ。`META_APP_SECRET`

---

## ステップ2: 「Instagram」プロダクトを追加（3分）

1. アプリダッシュボード左メニュー「プロダクト追加」
2. 「Instagram」の「設定」をクリック
3. 「Instagramアカウントを追加」→ ログインフローで `@youki8131` を選択
4. アクセス権限すべて許可

---

## ステップ3: 必要な4つのIDを取得（10分）

[Graph APIエクスプローラ](https://developers.facebook.com/tools/explorer/) を開きます。

### 3-1. Facebook Page ID を取得

1. ツール右上「Application」を先ほど作成した `kaigo-yoki-instagram` に変更
2. 「User or Page」→「Get User Access Token」をクリック
3. アクセス許可で `pages_show_list`, `pages_read_engagement`, `instagram_basic`, `instagram_content_publish`, `business_management` をチェック
4. 「Generate Access Token」→ Facebookログイン → 認可
5. 取得した短期トークンをコピー（後でステップ4で長期化）
6. GET リクエスト欄に `me/accounts` を入力 → 「Submit」
7. 返ってきたJSONの中から、デイサービスはいさい のFBページの `"id"` をメモ ← `FACEBOOK_PAGE_ID`

### 3-2. Instagram Business Account ID を取得

1. GET リクエスト欄を `{FACEBOOK_PAGE_ID}?fields=instagram_business_account` に変更
   （例: `123456789?fields=instagram_business_account`）
2. 「Submit」
3. 返ってきた `instagram_business_account.id` をメモ ← `INSTAGRAM_BUSINESS_ACCOUNT_ID`

---

## ステップ4: 長期アクセストークン（60日有効）に変換（5分）

ターミナルで以下を実行（`<>` 内を置き換え）:

```bash
curl -G "https://graph.facebook.com/v19.0/oauth/access_token" \
  --data-urlencode "grant_type=fb_exchange_token" \
  --data-urlencode "client_id=<META_APP_ID>" \
  --data-urlencode "client_secret=<META_APP_SECRET>" \
  --data-urlencode "fb_exchange_token=<ステップ3-1で取得した短期トークン>"
```

返ってきた `access_token` の値をメモ ← `INSTAGRAM_ACCESS_TOKEN`（60日有効）

**重要**: このトークンは60日で失効します。本リポジトリの `.github/workflows/instagram-token-check.yml` が毎週日曜AMに残日数をチェックし、残14日以下になったらGitHub Issueを自動作成します。Issue通知が来たら、上記コマンドで再生成→Secrets更新してください。

---

## ステップ5: GitHub Secrets と Variables に登録（5分）

ブラウザで [リポジトリのSecrets設定](https://github.com/kaigo-yoki/kaigo-recruit/settings/secrets/actions) を開く。

### Secrets（暗号化される機密値）に以下4つを追加

| Name | Value |
|---|---|
| `META_APP_ID` | ステップ1のアプリID |
| `META_APP_SECRET` | ステップ1のapp secret |
| `INSTAGRAM_BUSINESS_ACCOUNT_ID` | ステップ3-2のID |
| `INSTAGRAM_ACCESS_TOKEN` | ステップ4の長期トークン |

### Variables（平文・期限管理用）に1つ追加

[Variables タブ](https://github.com/kaigo-yoki/kaigo-recruit/settings/variables/actions) を開く。

| Name | Value |
|---|---|
| `INSTAGRAM_TOKEN_ISSUED_AT` | ステップ4を実行した日付（例: `2026-05-19`） |

---

## ステップ6: 動作確認（5分）

1. リポジトリの [Actions タブ](https://github.com/kaigo-yoki/kaigo-recruit/actions) を開く
2. 左メニュー「ブログ自動生成」を選択
3. 右上「Run workflow」→ 「Run workflow」をクリック
4. 数分待ち、緑のチェックが付いたら成功
5. `@youki8131` のInstagramを確認 → 当日記事が投稿されていればOK

失敗していたらActionsのログを開き、エラー内容を確認。よくあるエラー:

| エラー | 対処 |
|---|---|
| `Invalid OAuth access token` | トークン期限切れ。ステップ4を再実行 |
| `media_url_unavailable` | Vercelデプロイ待ち時間が不足。`daily-blog.yml`の`sleep`を120秒に増やす |
| `permissions` 系 | ステップ3-1のアクセス許可で `instagram_content_publish` が抜けている |

---

## ステップ7: 投稿時刻を変更したい場合

`.github/workflows/daily-blog.yml` の `cron: '0 0 * * *'` を変更します。
- UTC表記なので、JST から9時間引く
- 例: JST 10:00投稿 → UTC 1:00 → `'0 1 * * *'`

---

## 運用ルール（保守）

| 項目 | 頻度 | 作業 |
|---|---|---|
| トークン更新 | 60日ごと | Issue通知が来たらステップ4実行→Secret更新 |
| キャプションのトーン見直し | 月1回 | `scripts/build/post-to-instagram.js` の `buildCaption()` 関数を編集 |
| 投稿停止 | 必要時 | [Actions設定](https://github.com/kaigo-yoki/kaigo-recruit/settings/actions) → Workflow permissions で「ブログ自動生成」を無効化 |

---

## トラブル時の連絡先

- Meta（Instagram）API公式: [https://developers.facebook.com/docs/instagram-api](https://developers.facebook.com/docs/instagram-api)
- Graph APIエクスプローラ: [https://developers.facebook.com/tools/explorer/](https://developers.facebook.com/tools/explorer/)
- アクセストークン情報確認: [https://developers.facebook.com/tools/debug/accesstoken/](https://developers.facebook.com/tools/debug/accesstoken/)
