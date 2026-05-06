
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
  // 性格 (10)
  '開放性', '誠実性', '外向性', '協調性', '情緒安定性',
  'リーダー志向', '感情労働耐性', '共感性', '夜勤・1人判断適性', 'フットワーク',
  // 価値観 (5)
  'ご利用者貢献', 'チーム協調', '成長機会', '経済安定', 'ワークライフ',
  // エンゲージメント (4)
  '現業務適合', '組織コミット', '定着志向', 'キャリア志向',
  // 計算テスト (5)
  '計算正解', '計算誤答', '計算解答数', 'FP率(%)', '平均応答(ms)',
  // 結果 (5)
  '配属推奨1位', '配属推奨2位', '配属推奨3位',
  '離職リスク', '管理者適性',
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
    const p = data.placement || [];
    const d = data.demo || {};

    const row = [
      data.timestamp || new Date().toISOString(),
      d.name || '', d.home || '', d.position || '',
      d.tenure || '', d.age || '', d.emp || '',
      // 性格 10因子
      num(s.P_O), num(s.P_C), num(s.P_E), num(s.P_A), num(s.P_S),
      num(s.P_Ld), num(s.P_Em), num(s.P_Ep), num(s.P_Ng), num(s.P_Ft),
      // 価値観 5因子
      num(s.V_Cn), num(s.V_Tm), num(s.V_Gr), num(s.V_Sb), num(s.V_Wl),
      // エンゲージメント 4因子
      num(s.E_Ft), num(s.E_Cm), num(s.E_Rt), num(s.E_Cr),
      // 計算テスト
      num(c.correct), num(c.error), num(c.total), num(c.fpRate), num(c.avgDt),
      // 配属推奨 TOP3
      p[0] ? p[0].name : '',
      p[1] ? p[1].name : '',
      p[2] ? p[2].name : '',
      // 離職リスク・管理者適性
      data.retentionRisk || '', num(data.mgrScore),
      // 生データ
      JSON.stringify(data.answers || []),
      data.userAgent || ''
    ];

    sheet.appendRow(row);

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

function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({
      status: 'ok',
      service: 'ようきタレント診断 Sheets Bridge v1.0',
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
        scores: {
          P_O: 70, P_C: 80, P_E: 65, P_A: 75, P_S: 70,
          P_Ld: 60, P_Em: 75, P_Ep: 70, P_Ng: 50, P_Ft: 65,
          V_Cn: 80, V_Tm: 75, V_Gr: 70, V_Sb: 60, V_Wl: 65,
          E_Ft: 75, E_Cm: 80, E_Rt: 75, E_Cr: 70
        },
        calc: { correct: 25, error: 3, total: 28, fpRate: 10.7, avgDt: 1800 },
        placement: [
          { name: 'ホーム介護（日勤中心）', score: 75 },
          { name: '訪問介護', score: 70 },
          { name: '事務・バックオフィス', score: 65 }
        ],
        retentionRisk: 'LOW',
        mgrScore: 70,
        answers: [3, 4, 5, 4, 3],
        userAgent: 'TEST'
      })
    }
  };
  const result = doPost(fakeEvent);
  Logger.log(result.getContent());
}
