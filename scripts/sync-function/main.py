"""訪看スケジュールPJのGCS不足データ(非PII集計)を読み、スポジョブGASの受け取り口へPOSTする。
Cloud Functions(2nd gen, HTTP)。Cloud Schedulerから月次起動される想定。
GCS読取はアタッチされたサービスアカウント(storage.objectViewer)で行う＝鍵不要。
環境変数: GAS_URL（スポジョブGASの /exec URL）, GAS_KEY（管理パスコード）, BUCKET（任意）。

訪看PJの grid 形式 {grid:{曜日idx:{時刻:人数}}}（曜日idx=Python weekday() 月0〜日6）を、
スポジョブ・ダッシュボードが描画する rows 形式 {rows:[{wd,cap,cells:[{need,peak,avg,max}]}]} へ変換して送る。"""
import os
import json
import datetime
import urllib.request

import functions_framework
from google.cloud import storage

BUCKET = os.environ.get("BUCKET", "kaigo-yoki-houkan-sched-data")
WD = ["月", "火", "水", "木", "金", "土", "日"]  # grid index = Python weekday()（月=0〜日=6）


def to_dashboard(raw):
    """訪看PJの grid 形式を、ダッシュボードが描画する rows 形式に変換する。"""
    bands = raw.get("bands", [])
    grid = raw.get("grid", {}) or {}
    rows = []
    for i in range(7):
        g = grid.get(str(i), {}) or {}
        cells = []
        for b in bands:
            n = int(g.get(b, 0) or 0)  # grid値=その曜日×時間帯の同時派遣の最大＝必要人数
            cells.append({"need": n, "peak": 0, "avg": n, "max": n})  # peak=0で重複注記を出さない
        rows.append({"wd": WD[i], "cap": 2 if i <= 4 else 1, "cells": cells})
    return {
        "available": True,
        "month": raw.get("month"),
        "total": raw.get("total", 0),  # 派遣(シェアフル)訪問の件数
        "rep_count": 0,                # GCSファイルにオフロード情報は無いため0
        "rep_bands": {},
        "bands": bands,
        "rows": rows,
        "source": raw.get("source", ""),
    }


@functions_framework.http
def sync_shortage(request):
    # 当月→翌月の順で シェアフル枠_YYYYMM.json を探す（月境界に強い）
    now = datetime.datetime.utcnow()
    nxt = now.replace(day=28) + datetime.timedelta(days=10)
    months = [now.strftime("%Y%m"), nxt.strftime("%Y%m")]

    client = storage.Client()
    bucket = client.bucket(BUCKET)
    raw_text, used = None, None
    for ym in months:
        blob = bucket.blob("output/シェアフル枠_%s.json" % ym)
        if blob.exists():
            raw_text = blob.download_as_text()
            used = ym
            break
    if raw_text is None:
        return (json.dumps({"status": "error", "message": "no shortage json", "tried": months},
                           ensure_ascii=False), 404, {"Content-Type": "application/json"})

    payload = to_dashboard(json.loads(raw_text))
    data = json.dumps(payload, ensure_ascii=False)
    body = json.dumps({"action": "set_shortage", "key": os.environ["GAS_KEY"], "data": data}).encode("utf-8")
    req = urllib.request.Request(os.environ["GAS_URL"], data=body,
                                 headers={"Content-Type": "text/plain;charset=utf-8"})
    gas_resp = urllib.request.urlopen(req).read().decode("utf-8")
    return (json.dumps({"status": "ok", "month": used, "rows": len(payload["rows"]),
                        "gas": gas_resp[:200]}, ensure_ascii=False), 200,
            {"Content-Type": "application/json"})
