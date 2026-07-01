/**
 * 訪問看護 研修進捗管理 - Google Sheets バックエンド v1.0
 * 修了証発行時の自動記録と、進捗確認ページ（kenshu-kango-shinchoku.html）へのデータ提供
 * ※ 訪問介護版とは別事業のため、別スプレッドシートで運用します。
 *
 * ▼ セットアップ手順（約5分）
 * 1. Google Drive で新しいスプレッドシートを作成
 *    名前例：「訪問看護 研修進捗管理_2026」
 * 2. メニュー「拡張機能」→「Apps Script」をクリック
 * 3. 「Code.gs」の内容を全削除し、このファイルの内容を全部コピペ → 保存
 * 4. 上部の関数選択で「setup」を選んで ▶実行（初回は権限の承認が必要）
 *    → 「看護師名簿」「修了記録」「設定」シートが自動作成される
 *    → 「設定」シートの B1 に閲覧キーが自動生成される
 * 5. 「デプロイ」→「新しいデプロイ」
 *    - 種類：ウェブアプリ
 *    - 次のユーザーとして実行：自分（info@kaigo-yoki.jp）
 *    - アクセスできるユーザー：全員
 *    → 「デプロイ」→ 表示された「ウェブアプリのURL」をコピー
 * 6. scripts/cert-config-kango.js の KENSHU_PROGRESS_CONFIG.endpoint にURLを貼り付け
 *    （ClaudeにURLを伝えれば、設定からデプロイまで実施します）
 * 7. 「看護師名簿」シートに職員を記入（氏名／所属／状態=在籍）
 *
 * ▼ 進捗の確認方法
 * https://kaigo-recruit.vercel.app/kenshu-kango-shinchoku を開いて、
 * 「設定」シート B1 の閲覧キーを入力する
 */

const ROSTER_SHEET = '看護師名簿';
const LOG_SHEET = '修了記録';
const CONFIG_SHEET = '設定';

const ROSTER_HEADERS = ['氏名', '所属', '状態'];
const LOG_HEADERS = ['記録日時', '氏名', '研修名', 'ページ', '修了日'];

function getSS() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

// スプレッドシートは 'YYYY-MM-DD' 文字列を日付型に自動変換するため、読み出し時に文字列へ戻す
function asDateStr(v) {
  if (v instanceof Date) return Utilities.formatDate(v, 'Asia/Tokyo', 'yyyy-MM-dd');
  return String(v || '').trim();
}

/** 初期セットアップ：シート作成＋閲覧キー生成（再実行しても既存データは消えません） */
function setup() {
  const ss = getSS();

  let roster = ss.getSheetByName(ROSTER_SHEET);
  if (!roster) {
    roster = ss.insertSheet(ROSTER_SHEET);
    roster.appendRow(ROSTER_HEADERS);
    roster.getRange(1, 1, 1, ROSTER_HEADERS.length)
      .setFontWeight('bold').setBackground('#0E7C86').setFontColor('#ffffff');
    roster.setFrozenRows(1);
    roster.appendRow(['伊福 いつよ（記入例・削除可）', '訪問看護', '在籍']);
    roster.setColumnWidth(1, 160);
    roster.setColumnWidth(2, 120);
  }

  let log = ss.getSheetByName(LOG_SHEET);
  if (!log) {
    log = ss.insertSheet(LOG_SHEET);
    log.appendRow(LOG_HEADERS);
    log.getRange(1, 1, 1, LOG_HEADERS.length)
      .setFontWeight('bold').setBackground('#2E9E6B').setFontColor('#ffffff');
    log.setFrozenRows(1);
    log.setColumnWidth(1, 160);
    log.setColumnWidth(3, 320);
  }

  let config = ss.getSheetByName(CONFIG_SHEET);
  if (!config) {
    config = ss.insertSheet(CONFIG_SHEET);
    config.getRange('A1').setValue('閲覧キー（進捗確認ページで入力）').setFontWeight('bold');
    config.getRange('B1').setValue(Utilities.getUuid().slice(0, 8));
    config.getRange('A2').setValue('※ このキーを知っている人だけが進捗を閲覧できます。変更も可能です。');
    config.setColumnWidth(1, 280);
  }

  return '設定完了。閲覧キー: ' + config.getRange('B1').getValue();
}

/** 修了記録の受信（研修ページの修了証発行時に自動POSTされる） */
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    if (data.action !== 'log') return jsonOut({ status: 'error', message: 'unknown action' });

    const name = String(data.name || '').trim();
    const training = String(data.training || '').trim();
    const path = String(data.path || '').trim();
    const date = String(data.date || '').trim();
    if (!name || !training) return jsonOut({ status: 'error', message: 'name/training required' });

    const ss = getSS();
    let sheet = ss.getSheetByName(LOG_SHEET);
    if (!sheet) { setup(); sheet = ss.getSheetByName(LOG_SHEET); }

    // 同じ人×同じ研修×同じ日の重複は記録しない（発行ボタン連打対策）
    const lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      const checkRows = Math.min(lastRow - 1, 200);
      const recent = sheet.getRange(lastRow - checkRows + 1, 2, checkRows, 4).getValues();
      const dup = recent.some(r =>
        String(r[0]).trim() === name && String(r[2]).trim() === path && asDateStr(r[3]) === date
      );
      if (dup) return jsonOut({ status: 'ok', dedup: true });
    }

    sheet.appendRow([new Date(), name, training, path, date]);
    return jsonOut({ status: 'ok' });
  } catch (err) {
    return jsonOut({ status: 'error', message: String(err) });
  }
}

/** 進捗データの取得（進捗確認ページから閲覧キー付きで呼ばれる） */
function doGet(e) {
  try {
    const action = e.parameter.action || '';
    if (action !== 'progress') return jsonOut({ status: 'error', message: 'unknown action' });

    const ss = getSS();
    const config = ss.getSheetByName(CONFIG_SHEET);
    const validKey = config ? String(config.getRange('B1').getValue()).trim() : '';
    if (!validKey || String(e.parameter.key || '').trim() !== validKey) {
      return jsonOut({ status: 'unauthorized', message: '閲覧キーが違います' });
    }

    const staff = [];
    const roster = ss.getSheetByName(ROSTER_SHEET);
    if (roster && roster.getLastRow() > 1) {
      roster.getRange(2, 1, roster.getLastRow() - 1, 3).getValues().forEach(r => {
        const name = String(r[0]).trim();
        if (name) staff.push({ name: name, dept: String(r[1]).trim(), status: String(r[2]).trim() || '在籍' });
      });
    }

    const records = [];
    const log = ss.getSheetByName(LOG_SHEET);
    if (log && log.getLastRow() > 1) {
      log.getRange(2, 1, log.getLastRow() - 1, 5).getValues().forEach(r => {
        records.push({
          ts: r[0] instanceof Date ? r[0].toISOString() : String(r[0]),
          name: String(r[1]).trim(),
          training: String(r[2]).trim(),
          path: String(r[3]).trim(),
          date: asDateStr(r[4])
        });
      });
    }

    return jsonOut({ status: 'ok', staff: staff, records: records });
  } catch (err) {
    return jsonOut({ status: 'error', message: String(err) });
  }
}

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/** 動作テスト：実行すると修了記録にテスト行が1件追加される */
function testLog() {
  const e = { postData: { contents: JSON.stringify({
    action: 'log', name: 'テスト 花子', training: 'テスト研修', path: '/kango-trainings/test', date: '2026-07-01'
  }) } };
  Logger.log(doPost(e).getContent());
}
