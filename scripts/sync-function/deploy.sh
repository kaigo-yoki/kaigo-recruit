#!/bin/bash
# スポジョブ不足データ連携 Cloud Function デプロイ
# 使い方:  bash scripts/sync-function/deploy.sh
#          → 管理パスコードを聞かれたら入力（画面に出ません）
set -e

export PATH="$HOME/google-cloud-sdk/bin:$PATH"
export CLOUDSDK_PYTHON="$HOME/miniconda3/bin/python3"

PROJ=kaigo-yoki-houkan-2026
SA="gcs-to-spojob@${PROJ}.iam.gserviceaccount.com"
SRC=/Users/miyuki/kaigo-recruit/kaigo-recruit/scripts/sync-function
GAS_URL=https://script.google.com/macros/s/AKfycbwGN5kU3ojFQYdhtsHDxK4e98qHeRoJu7LKohoPOm3TO14VDAo1jW68qrNqkoqiA3Nh/exec

if [ -n "$1" ]; then
  GAS_KEY="$1"
else
  printf "管理パスコードを入力: "
  read -rs GAS_KEY
  echo
fi
if [ -z "$GAS_KEY" ]; then echo "パスコードが空です。中止します。"; exit 1; fi

echo "==> [A] バケット読み取り権限をSAに付与"
gcloud storage buckets add-iam-policy-binding gs://kaigo-yoki-houkan-sched-data \
  --member="serviceAccount:${SA}" --role="roles/storage.objectViewer"

echo "==> [B] 必要なAPIを有効化"
gcloud services enable cloudfunctions.googleapis.com run.googleapis.com \
  cloudbuild.googleapis.com artifactregistry.googleapis.com --project="$PROJ"

echo "==> [C] Cloud Functionをデプロイ（数分かかります）"
gcloud functions deploy spojob-shortage-sync \
  --gen2 --runtime=python312 --region=asia-northeast1 \
  --source="$SRC" \
  --entry-point=sync_shortage \
  --trigger-http --no-allow-unauthenticated \
  --service-account="$SA" \
  --set-env-vars="GAS_URL=${GAS_URL},GAS_KEY=${GAS_KEY}" \
  --project="$PROJ"

echo
echo "==> 完了。上の 'url:' を控えてください。"
