#!/bin/bash
# 不足データを今すぐクラウドから同期する（訪看スケジュールを更新したら、これを1回実行）
# GCS シェアフル枠_YYYYMM.json を読み → 変換 → スポジョブGASへ保存 → ダッシュボードに自動反映
export PATH="$HOME/google-cloud-sdk/bin:$PATH"
export CLOUDSDK_PYTHON="$HOME/miniconda3/bin/python3"
gcloud functions call spojob-shortage-sync --gen2 --region=asia-northeast1 \
  --project=kaigo-yoki-houkan-2026 --quiet
echo
echo "→ 完了。ダッシュボードを開くと最新の不足枠が表示されます。"
