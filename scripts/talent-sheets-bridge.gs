
 * ようきタレント診断 - Google Sheets バックエンド
 *
 * ▼ セットアップ手順
 * 1. Google Drive で新しいスプレッドシートを作成
 *    名前例：「ようきタレント診断_結果_2026」
 * 2. メニューの「拡張機能」→「Apps Script」をクリック
 * 3. 「Code.gs」の内容を全削除し、このファイルの内容を全部コピペ
 * 4. 上部メニュー「保存」アイコン
 * 5. 上部メニュー「デプロイ」→「新しいデプロイ」
 *    - 種類：ウェブアプリ
 *    - 説明：ようきタレント診断 v1
 *    - 次のユーザーとして実行：自分（info@kaigo-yoki.jp）
 *    - アクセスできるユーザー：全員
 *    → 「デプロイ」をクリック
 * 6. 表示された「ウェブアプリのURL」をコピー/**
 * 7. talent.html の SHEETS_CONFIG.url にそのURLを貼り付け
 * 8. 動作確認：Apps Script上部の関数選択で「testAppend」を選び▶実行
 *    → スプレッドシートに「回答」シートが作成され、テスト行が追加されればOK
 */

const SHEET_NAME = '回答';

const HEADERS = [
  'timestamp', '氏名', '所属', '職種', '勤続年数', '年代', '雇用形態',
  // 個性5項目 (Big Five)
  '開放性', '誠実性', '外向性', '協調性', '情緒安定性',
  // 計算テスト・基本指標 (5)
  '計算正解', '計算誤答', '計算解答数', 'FP率(%)', '平均応答(ms)',
  // 計算テスト・作業曲線 (5)
  '前半20s', '中盤20s', '後半20s', '安定度', '傾向(%)',
  // 処理タイプ (2)
  '処理タイプ', 'タイプコード',
  // 配属推奨 TOP3 (3)
  '配属推奨1位', '配属推奨2位', '配属推奨3位',
  // 派生スコア (3)
  '管理者適性', '共感性スコア', 'ストレス耐性',
  // 生データ (2)
  'answers_json', 'user_agent'
];

function doPost(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) {
      sheet = ss.insertSheet(SHEET_NAME);
      sheet.appendRow(HEADERS);
      sheet.getRange(1, 1, 1, HEADERS.length)
        .setFontWeight('bold')
        .setBackground('#1A6B5C')
        .setFontColor('#ffffff');
      sheet.setFrozenRows(1);
      sheet.setColumnWidth(1, 180);
      sheet.setColumnWidth(2, 120);
    }

    const data = JSON.parse(e.postData.contents);
    const s = data.scores || {};
    const c = data.calc || {};
    const ph = data.phaseAnalysis || {};
    const pt = data.processType || {};
    const p = data.placement || [];
    const d = data.demo || {};

    const row = [
      data.timestamp || new Date().toISOString(),
      d.name || '', d.home || '', d.position || '',
      d.tenure || '', d.age || '', d.emp || '',
      // 個性5項目
      num(s.P_O), num(s.P_C), num(s.P_E), num(s.P_A), num(s.P_S),
      // 計算テスト・基本指標
      num(c.correct), num(c.error), num(c.total), num(c.fpRate), num(c.avgDt),
      // 計算テスト・作業曲線
      num(ph.phase1), num(ph.phase2), num(ph.phase3), num(ph.stability), num(ph.trend),
      // 処理タイプ
      pt.type || '', pt.code || '',
      // 配属推奨 TOP3
      p[0] ? p[0].name : '',
      p[1] ? p[1].name : '',
      p[2] ? p[2].name : '',
      // 派生スコア
      num(data.mgrScore), num(data.empathyScore), num(data.stressScore),
      // 生データ
      JSON.stringify(data.answers || []),
      data.userAgent || ''
    ];

    sheet.appendRow(row);

    // メール通知送信（失敗しても本体処理は継続）
    try {
      notifyByEmail(data);
    } catch (mailErr) {
      Logger.log('メール送信失敗: ' + mailErr.toString());
    }

    return ContentService
      .createTextOutput(JSON.stringify({
        status: 'ok',
        row: sheet.getLastRow(),
        sheet: SHEET_NAME
      }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({
        status: 'error',
        message: err.toString()
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ============================================================
// 受検完了メール通知
// ============================================================
const NOTIFY_TO = 'info@kaigo-yoki.jp';

function notifyByEmail(data) {
  const d = data.demo || {};
  const s = data.scores || {};
  const p = data.placement || [];
  const pt = data.processType || {};
  const isHighMgr = (data.mgrScore || 0) >= 75;
  const isLowStress = (data.stressScore || 0) < 50;

  const subject = isLowStress
    ? '[要注意] ようきタレント診断 受検完了 - ' + (d.name || '')
    : 'ようきタレント診断 受検完了 - ' + (d.name || '');

  const sheetUrl = SpreadsheetApp.getActiveSpreadsheet().getUrl();
  const ts = new Date(data.timestamp || Date.now());
  const tsStr = Utilities.formatDate(ts, 'Asia/Tokyo', 'yyyy/MM/dd HH:mm');

  let body = (d.name || '') + ' 様（' + (d.home || '') + '・' + (d.position || '') + '）が受検を完了されました。\n\n';
  body += '受検日時: ' + tsStr + '\n\n';
  body += '基本情報\n';
  body += '所属: ' + (d.home || '') + '\n';
  body += '職種: ' + (d.position || '') + '\n';
  body += '勤続年数: ' + (d.tenure || '') + '\n';
  body += '年代: ' + (d.age || '') + '\n';
  body += '雇用形態: ' + (d.emp || '') + '\n\n';
  body += '個性5項目スコア\n';
  body += '開放性: ' + (s.P_O || 0) + ' / 100\n';
  body += '誠実性: ' + (s.P_C || 0) + ' / 100\n';
  body += '外向性: ' + (s.P_E || 0) + ' / 100\n';
  body += '協調性: ' + (s.P_A || 0) + ' / 100\n';
  body += '情緒安定性: ' + (s.P_S || 0) + ' / 100\n\n';
  body += '処理タイプ: ' + (pt.type || '') + '\n';
  body += (pt.desc || '') + '\n\n';
  body += '管理者適性: ' + (data.mgrScore || 0) + ' / 100\n';
  body += '配属推奨1位: ' + (p[0] ? p[0].name : '') + '\n';
  body += '配属推奨2位: ' + (p[1] ? p[1].name : '') + '\n';
  body += '配属推奨3位: ' + (p[2] ? p[2].name : '') + '\n\n';

  if (isLowStress) {
    body += '【要注意】情緒安定性スコアが50未満です。ストレスケア・面談をご検討ください。\n\n';
  }
  if (isHighMgr) {
    body += '【管理者候補】管理者適性スコアが75点以上です。育成プログラムをご検討ください。\n\n';
  }

  body += '詳細はスプレッドシートでご確認ください。\n';
  body += sheetUrl + '\n\n';
  body += '---\n';
  body += '有限会社陽気 ようきタレント診断 v2';

  MailApp.sendEmail({
    to: NOTIFY_TO,
    subject: subject,
    body: body,
    name: 'ようきタレント診断'
  });
}

function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({
      status: 'ok',
      service: 'ようきタレント診断 Sheets Bridge v2.0',
      timestamp: new Date().toISOString()
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

function num(v) {
  if (v === null || v === undefined || v === '') return '';
  return v;
}

/**
 * 動作テスト用：Apps Script のエディタで関数選択 → 実行
 * 「回答」シートにテスト行が1行追加されればOK
 */
function testAppend() {
  const fakeEvent = {
    postData: {
      contents: JSON.stringify({
        timestamp: new Date().toISOString(),
        demo: {
          name: 'テスト 太郎',
          home: '本部',
          position: '事務',
          tenure: '1-3',
          age: '30s',
          emp: '正社員'
        },
        scores: { P_O: 70, P_C: 80, P_E: 65, P_A: 75, P_S: 70 },
        calc: { correct: 25, error: 3, total: 28, fpRate: 10.7, avgDt: 1800 },
        phaseAnalysis: { phase1: 8, phase2: 9, phase3: 8, stability: 88, trend: 0 },
        processType: { type: 'シングルタスク集中型', desc: '1つのことに集中して正確に取り組むタイプ', code: 'SINGLE' },
        placement: [
          { name: 'ホーム日勤介護（対人ケア）', score: 75 },
          { name: '訪問看護・施設内看護', score: 70 },
          { name: '事務・バックオフィス', score: 65 }
        ],
        mgrScore: 70,
        empathyScore: 75,
        stressScore: 70,
        answers: [3, 4, 5, 4, 3],
        userAgent: 'TEST'
      })
    }
  };
  const result = doPost(fakeEvent);
  Logger.log(result.getContent());
}
