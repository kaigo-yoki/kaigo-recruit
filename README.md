# kaigo-recruit

デイサービスはいさい 採用特設ページ。

---

## 🧪 CI / 開発ルール

### PRサイズ警告（`.github/workflows/pr-size.yml`）

PR作成時に **実質コード差分** をチェックし、**1,500行を超えると `size/XL` ラベル＋警告コメント** を自動付与します（**blockはしません**。マージは可能）。

- 8エージェント並行運用で main 履歴・PRサイズが累積爆発するのを防ぐためのソフトガード
- 自動生成・非コードファイルは差分カウントから除外：`package-lock.json` / `node_modules/` / `posts/`（自動生成ブログ）/ `images/` / `data/` / `_tmp/` / `_internal/` / 画像各種 / `qr_*` ほか
- 閾値：XS≤50 / S≤200 / M≤500 / L≤1,500 / XL>1,500
- ルール根拠：内部メモリ `feedback_pr_size_and_commit_hygiene`（1PR≤1,500行、診断・revert・空commitはfeature branchで隔離）

XL警告が出たら、**PR分割** を検討するか、PR description に「一塊で意味がある理由」を明示してください。
