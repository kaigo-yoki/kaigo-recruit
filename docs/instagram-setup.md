# Instagram 自動投稿 セットアップ手順

このリポジトリには、毎日 Instagram（@youki8131）に自動投稿する仕組みが入っています。

- 素材の自動生成（画像＋キャプション）＝ **設定不要**（GitHub Actionsが毎日実行）
- Instagramへの自動公開 ＝ **下記のMeta設定が1回だけ必要**

コードは完成済みです。この手順書のとおり Meta 側を設定し、GitHub に3つの値を登録すれば、完全自動になります。
（アカウント作成・トークン取得・値の登録は、セキュリティ上ご本人での作業をお願いします。）

---

## ステップ0：自動実行ワークフローを設置する（最初に1回）

自動化のGitHub Actionsワークフローは、権限の都合でこのブランチに直接は含めていません。
参考ファイル `docs/daily-instagram.workflow.yml` を、`.github/workflows/daily-instagram.yml`
として追加してコミットしてください（GitHubのWeb UI〔Add file → Create new file〕で
中身をコピペするのが簡単です）。これで毎日JST 9:30に自動実行されます。

---

## 全体像

```
GitHub Actions（毎日 JST 9:30）
  → 素材生成  scripts/build/generate-instagram.js
      ・月曜        = マナ求人カルーセル（8枚・固定）
      ・それ以外    = その日のブログを要約した投稿（3〜5枚）
  → social/<日付>/ に画像＋caption.txt を保存し、リポジトリにコミット
  → デプロイ（既存 deploy.yml）で画像が https://kaigo-yoki.jp/recruit/social/... に公開
  → Instagram Graph API で公開  scripts/build/ig-publish.js
```

---

## ステップ1：Instagram をプロアカウントにする

1. Instagramアプリ →〔設定〕→〔アカウントの種類とツール〕→〔プロアカウントに切り替える〕
2. カテゴリは「ビジネス」を選択（クリエイターでも可）

## ステップ2：Facebookページと連携する

1. Facebookページを1つ用意（なければ作成）
2. Instagram →〔設定〕→〔ページとの連携〕で、そのFacebookページとリンク
   - または Meta Business Suite（business.facebook.com）でまとめて連携

## ステップ3：Meta開発者アプリを作る

1. https://developers.facebook.com/ にログイン →〔マイアプリ〕→〔アプリを作成〕
2. アプリタイプは「ビジネス」
3. 作成後、プロダクトに **Instagram Graph API**（および Facebookログイン）を追加

## ステップ4：アクセストークンと IGユーザーID を取得する

> 推奨は「システムユーザーの無期限トークン」です。長期ユーザートークンは約60日で失効しますが、
> システムユーザートークンは失効しないため、自動運用に向いています。

### A. システムユーザートークン（推奨・無期限）

1. Meta Business Suite →〔ビジネス設定〕→〔ユーザー〕→〔システムユーザー〕→ 追加
2. そのシステムユーザーに、対象の **Facebookページ** と **Instagramアカウント** を「アセット」として割り当て
3.〔トークンを生成〕で、上記アプリを選び、次の権限を付与：
   - `instagram_basic`
   - `instagram_content_publish`
   - `pages_show_list`
   - `pages_read_engagement`
   - `business_management`
4. 生成された文字列が **IG_ACCESS_TOKEN** です

### B. IGユーザーID を調べる

Graph APIエクスプローラ（developers.facebook.com/tools/explorer）で、上記トークンを使って：

```
GET /me/accounts
  → 対象ページの id を控える（page-id）

GET /<page-id>?fields=instagram_business_account
  → 返ってくる instagram_business_account.id が IG_USER_ID（数値）
```

## ステップ5：GitHub に値を登録する

リポジトリ →〔Settings〕→〔Secrets and variables〕→〔Actions〕

**Secrets（秘密・必須）**
| 名前 | 値 |
|---|---|
| `IG_ACCESS_TOKEN` | ステップ4Aのトークン |
| `IG_USER_ID` | ステップ4Bの数値ID |
| `OPENAI_API_KEY` | （既存のブログ生成と同じもの。設定済みなら不要） |

**Variables（任意・公開URLを変える場合のみ）**
| 名前 | 既定値 |
|---|---|
| `IG_IMAGE_BASE_URL` | `https://kaigo-yoki.jp/recruit/social` |

---

## 重要な注意（App Reviewについて）

`instagram_content_publish` は、Metaアプリが **開発モード** の間は
「アプリに役割（管理者/開発者/テスター）を持つユーザー」に紐づくアカウントにのみ投稿できます。

- @youki8131 は自社アカウントなので、**そのアカウントに紐づくFacebookユーザーをアプリのテスターやAdminに追加**すれば、開発モードのまま自動投稿できます。
- 将来、他アカウントへ拡張したい場合や本番モードにする場合は、Metaの **App Review**（審査）が必要です。

まずは自社アカウントのみなので、**開発モードのまま運用開始**できます。

---

## 動作確認

1. GitHub →〔Actions〕→「Instagram 自動投稿」→〔Run workflow〕
   - `publish` を `false` にすると **素材生成のみ**（投稿はしない）。まずはこれで画像を確認。
   - `social/<日付>/` に画像とキャプションができていればOK。
2. 画像に問題なければ、`publish` を `true` で実行 → 実際に投稿されます。
3. 以降は毎日 JST 9:30 に全自動で投稿されます。

## 手動でも使えます（ローカル）

```bash
npm ci
npm run generate-instagram   # social/<今日>/ に素材を生成
```

生成された `social/<日付>/slide-*.png` と `caption.txt` を、
手作業でInstagramに投稿することもできます（半自動運用）。

---

## トラブルシューティング

| 症状 | 対処 |
|---|---|
| 画像URLの公開待ちでタイムアウト | デプロイ（deploy.yml）が動いているか、`IG_IMAGE_BASE_URL` が正しいか確認 |
| `(#10) ... permission` エラー | ステップ5の権限、またはApp Review（開発モードのテスター登録）を確認 |
| トークン失効 | システムユーザートークン（無期限）を使う。ユーザートークンは約60日で失効 |
| 文字化け・フォント崩れ | Actionsのフォント導入ステップ（fonts-noto-cjk）が成功しているか確認 |
