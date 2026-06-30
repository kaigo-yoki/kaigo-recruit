/* =====================================================================
 *  研修修了の自動記録スクリプト（共通）
 *  ---------------------------------------------------------------------
 *  研修ページの「修了証書を発行する」を押すと、
 *  受講者名・研修テーマ・修了日を Google フォーム経由で
 *  Google スプレッドシートに自動記録します（送り忘れゼロ）。
 *
 *  ▼ 設定は下の CONFIG だけ。Google フォーム作成後に3つ貼り替えるだけです。
 *    （手順は scripts/README_研修記録.md を参照）
 * ===================================================================== */

const TRAINING_RECORD_CONFIG = {
  // Google フォーム「研修 受講記録」の送信先URL（formResponse）
  formAction: "https://docs.google.com/forms/d/e/1FAIpQLSeEgwLXInpMehCeZifjQrRS6whaBAw3iC6PX5_PlAx6QvKr0A/formResponse",

  // 各質問の entry ID
  entryName:  "entry.959886264",   // 受講者名
  entryTheme: "entry.607473849",   // 研修テーマ
  entryDate:  "entry.1470762233",  // 修了日
};

// ---------------------------------------------------------------------
// 内部処理（ここから下は基本さわらなくてOK）
// ---------------------------------------------------------------------

function _trIsConfigured() {
  const c = TRAINING_RECORD_CONFIG;
  return c.formAction.indexOf("PASTE_") === -1
      && c.entryName.indexOf("PASTE_") === -1;
}

function _trTodayStr() {
  const d = new Date();
  return d.getFullYear() + "年" + (d.getMonth() + 1) + "月" + d.getDate() + "日";
}

// 画面に小さな状態表示を出す
function _trSetStatus(msg, color) {
  let el = document.getElementById("trRecordStatus");
  if (!el) {
    el = document.createElement("div");
    el.id = "trRecordStatus";
    el.style.cssText =
      "margin-top:14px;font-size:13px;font-weight:700;text-align:center;";
    const actions = document.getElementById("certActions");
    if (actions && actions.parentNode) {
      actions.parentNode.insertBefore(el, actions);
    } else {
      const sec = document.getElementById("certSection");
      if (sec) sec.appendChild(el);
    }
  }
  el.textContent = msg;
  el.style.color = color || "#4CAF7D";
}

// Google フォームへ送信（記録）
function recordCompletion(name, theme) {
  if (!_trIsConfigured()) {
    console.warn("[training-record] CONFIG 未設定のため自動記録をスキップしました。");
    return;
  }
  const c = TRAINING_RECORD_CONFIG;
  const fd = new FormData();
  fd.append(c.entryName, name);
  fd.append(c.entryTheme, theme);
  fd.append(c.entryDate, _trTodayStr());

  _trSetStatus("受講記録を送信中…", "#888");

  fetch(c.formAction, { method: "POST", mode: "no-cors", body: fd })
    .then(function () {
      _trSetStatus("✅ 受講記録を会社に送信しました（控えにメール送信も可能です）", "#4CAF7D");
    })
    .catch(function () {
      _trSetStatus(
        "⚠️ 自動記録に失敗しました。お手数ですが下の「修了報告メール」を送信してください。",
        "#E8594F"
      );
    });
}

// 既存の generateCert を拡張して、証書発行時に自動記録も行う
(function () {
  function wrap() {
    if (typeof window.generateCert !== "function" || window.generateCert.__wrapped) {
      return false;
    }
    const orig = window.generateCert;
    const wrapped = function () {
      orig.apply(this, arguments);
      try {
        const input = document.getElementById("certName");
        const name = input ? input.value.trim() : "";
        if (!name) return; // 名前未入力なら元の処理が止めているので記録しない
        const theme =
          typeof TRAINING_TITLE !== "undefined" ? TRAINING_TITLE : document.title;
        recordCompletion(name, theme);
      } catch (e) {
        console.warn("[training-record]", e);
      }
    };
    wrapped.__wrapped = true;
    window.generateCert = wrapped;
    return true;
  }

  if (!wrap()) {
    // 念のため、読み込み順がずれた場合に備えてリトライ
    document.addEventListener("DOMContentLoaded", wrap);
  }
})();
