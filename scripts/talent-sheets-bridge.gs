/**
 * ようきタレント診断 - Google Sheets バックエンド v2.1
 * クレペリン式3クール（60秒×3＋休憩5秒×2＝190秒）対応
 *
 * ▼ セットアップ手順
 * 1. Google Drive で新しいスプレッドシートを作成
 *    名前例：「ようきタレント診断_結果_2026」
 * 2. メニューの「拡張機能」→「Apps Script」をクリック
 * 3. 「Code.gs」の内容を全削除し、このファイルの内容を全部コピペ
 * 4. 上部メニュー「保存」アイコン
 * 5. 上部メニュー「デプロイ」→「新しいデプロイ」
 *    - 種類：ウェブアプリ
 *    - 説明：ようきタレント診断 v2.1（3クール）
 *    - 次のユーザーとして実行：自分（info@kaigo-yoki.jp）
 *    - アクセスできるユーザー：全員
 *    → 「デプロイ」をクリック
 * 6. 表示された「ウェブアプリのURL」をコピー
 * 7. talent.html の SHEETS_CONFIG.url にそのURLを貼り付け
 * 8. 動作確認：Apps Script上部の関数選択で「testAppend」を選び▶実行
 *    → スプレッドシートに「回答」シートが作成され、テスト行が追加されればOK
 *
 * ▼ v2.1での変更点
 * - 計算テストを60秒×3クールに拡張
 * - HEADERS に C1/C2/C3 正解数・持久性ギャップ・曲線型 を追加
 * - 既存シートに新規列を追加する場合は、HEADERS に合わせて手動で列を追加してください
 */

// v2.1で新シートに切替（旧「回答」シートはv1のデータ保管用に残す）
const SHEET_NAME = '回答_v21';

const HEADERS = [
  'timestamp', '氏名', '所属', '職種', '勤続年数', '年代', '雇用形態',
  // 個性5項目 (Big Five)
  '開放性', '誠実性', '外向性', '協調性', '情緒安定性',
  // 計算テスト・基本指標 (5)
  '計算正解(合計)', '計算誤答(合計)', '計算解答数(合計)', 'FP率(%)', '平均応答(ms)',
  // 3クール推移 (5) — クレペリン式持久性
  'C1正解', 'C2正解', 'C3正解', '持久性ギャップ(%)', 'クール間安定度',
  // 曲線型 (2)
  '曲線型', '曲線コード',
  // 1クール内作業曲線 (5)
  '前半20s', '中盤20s', '後半20s', 'フェーズ安定度', 'フェーズ傾向(%)',
  // 処理タイプ (2)
  '処理タイプ', 'タイプコード',
  // 配属推奨 TOP3 (3)
  '配属推奨1位', '配属推奨2位', '配属推奨3位',
  // 派生スコア (3)
  '管理者適性', '共感性スコア', 'ストレス耐性',
  // 生データ (3)
  'answers_json', 'cycle_results_json', 'user_agent'
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
    const cy = data.cycleAnalysis || {};
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
      // 3クール推移
      num(cy.c1), num(cy.c2), num(cy.c3), num(cy.gap), num(cy.cycleStability),
      // 曲線型
      cy.curveType || '', cy.curveCode || '',
      // 1クール内作業曲線
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
      JSON.stringify(data.cycleResults || []),
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
  const cy = data.cycleAnalysis || {};
  const isHighMgr = (data.mgrScore || 0) >= 75;
  const isLowStress = (data.stressScore || 0) < 50;
  const isEndurance = cy.curveCode === 'ENDURANCE' || cy.curveCode === 'HIGH_FLAT';
  const isFatigue = cy.curveCode === 'FATIGUE';
  const isLowFlat = cy.curveCode === 'LOW_FLAT';

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
  body += '3クール推移（クレペリン式持久性）\n';
  body += 'クール1: ' + (cy.c1 || 0) + ' 問\n';
  body += 'クール2: ' + (cy.c2 || 0) + ' 問\n';
  body += 'クール3: ' + (cy.c3 || 0) + ' 問\n';
  body += '持久性ギャップ(C1→C3): ' + (cy.gap >= 0 ? '+' : '') + (cy.gap || 0) + '%\n';
  body += '曲線型: ' + (cy.curveType || '') + '\n\n';
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
  if (isEndurance) {
    body += '【持久性高】3クール通じて持続力あり。夜勤・長時間業務・リーダー候補として有望です。\n\n';
  }
  if (isFatigue) {
    body += '【疲労型】時間とともに作業量が低下。短時間シフトや休憩設計が成果につながります。\n\n';
  }
  if (isLowFlat) {
    body += '【要注意】3クール全て低水準。業務分担の工夫や得意分野への配置転換を推奨。\n\n';
  }

  body += '詳細はスプレッドシートでご確認ください。\n';
  body += sheetUrl + '\n\n';
  body += '---\n';
  body += '有限会社陽気 ようきタレント診断 v2.1（3クール）';

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
      service: 'ようきタレント診断 Sheets Bridge v2.1 (3-cycle)',
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
        calc: { correct: 75, error: 9, total: 84, fpRate: 10.7, avgDt: 1800 },
        cycleResults: [
          { cycle:1, correct:24, error:3, total:27 },
          { cycle:2, correct:26, error:3, total:29 },
          { cycle:3, correct:25, error:3, total:28 }
        ],
        cycleAnalysis: { c1:24, c2:26, c3:25, gap:4, curveType:'標準型', curveCode:'STANDARD', cycleStability:92 },
        phaseAnalysis: { phase1: 8, phase2: 9, phase3: 8, stability: 88, trend: 0 },
        processType: { type: '標準・バランス型', desc: '安定したペースで業務を遂行できるタイプ', code: 'STANDARD' },
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
