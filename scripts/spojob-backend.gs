/**
 * 陽気スポジョブ（スポット人材マッチング）- Google Sheets バックエンド v1.0（MVP）
 * 登録 / 募集作成 / 募集一覧 / 応募 / 承認・却下 / LINE通知 を担う。
 * 訪問看護スケジュール割り当てPJの不足枠をスポット看護師で埋めるための受け皿。
 *
 * ▼ セットアップ手順
 * 1. Google Drive で新しいスプレッドシートを作成（名前例：「陽気スポジョブ_2026」）
 * 2. メニュー「拡張機能」→「Apps Script」→ Code.gs を全削除し、このファイルを全部コピペ → 保存
 * 3. 上部の関数選択で「setup」を選んで ▶実行（初回は権限承認）
 *    → 「登録者」「募集」「応募」「勤務実績」「時給マスタ」「シフトパターン」「設定」シートが自動作成
 *    → 「設定」シート B1 に管理パスコードが自動生成される
 * 4. LINE通知を使う場合：LINE Developers で Messaging API チャネルを作成し、
 *    チャネルアクセストークン（長期）を「設定」シート B2 に貼り付け
 * 5. LINEログイン（LIFF）：LINEログインチャネルで LIFF アプリを作成し、
 *    エンドポイントURL に https://kaigo-yoki.jp/recruit/spojob/shifts.html を設定。LIFF ID を控える
 * 6. 「デプロイ」→「新しいデプロイ」→ ウェブアプリ
 *    - 次のユーザーとして実行：自分（info@kaigo-yoki.jp）
 *    - アクセスできるユーザー：全員
 *    → 表示された「ウェブアプリのURL」をコピー
 * 7. scripts/spojob-config.js に gasUrl / liffId / adminKey（=B1）を設定
 *    （ClaudeにURL・LIFF IDを伝えれば設定します）
 *
 * ▼ 認証の考え方
 * - 働き手：LIFFで取得した line_user_id で本人を識別（パスワード不要）
 * - 施設側：管理パスコード（設定シートB1）を key として送る
 *
 * ▼ 前日リマインド（任意）
 * - 関数 installReminderTrigger を1回だけ ▶実行 すると、毎日18時に sendReminders が自動実行され、
 *   翌日の確定（承認）シフトの担当者へLINEでリマインドが届く（要：LINEトークン設定＆通知有効）
 */

const SH_WORKER  = '登録者';
const SH_SHIFT   = '募集';
const SH_APPLY   = '応募';
const SH_RECORD  = '勤務実績';
const SH_WAGE    = '時給マスタ';
const SH_PATTERN = 'シフトパターン';
const SH_CONFIG  = '設定';

const H_WORKER  = ['line_user_id','氏名','ふりがな','職種','保有資格','経験年数','電話','シェアフル経由','登録日','ステータス','累計勤務時間','累計ボーナス','資格確認状態','本人確認状態','マイナンバー収集状態'];
const H_SHIFT   = ['募集ID','サービス','施設','日付','シフトパターン','開始','終了','職種','夜勤フラグ','オンコールフラグ','必要人数','確定人数','時給','業務内容','資格要件','ステータス','連携元','作成日時'];
const H_APPLY   = ['応募ID','募集ID','line_user_id','氏名','応募日時','ステータス'];
const H_RECORD  = ['実績ID','募集ID','line_user_id','シフトパターン','実働開始','実働終了','実働時間','待機区分','待機手当','時給','支給額','確定フラグ','対象月'];
const H_WAGE    = ['サービス','区分','時給'];
const H_PATTERN = ['サービス','パターン','開始','終了','実働','区分'];

const TZ = 'Asia/Tokyo';

function getSS() { return SpreadsheetApp.getActiveSpreadsheet(); }
function nowStr() { return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm:ss'); }
function asDateStr(v) {
  if (v instanceof Date) return Utilities.formatDate(v, TZ, 'yyyy-MM-dd');
  return String(v || '').trim();
}
// スプレッドシートが "8:00" を時刻値(1899年の日付)に自動変換するため、読み出し時に H:mm 文字列へ戻す
function asTimeStr(v) {
  if (v instanceof Date) return Utilities.formatDate(v, TZ, 'H:mm');
  return String(v || '').trim();
}
function newId(prefix) { return prefix + Utilities.formatDate(new Date(), TZ, 'yyMMddHHmmss') + Math.floor(Math.random() * 90 + 10); }

/** 初期セットアップ：シート作成＋マスタ初期値＋管理パスコード生成（再実行しても既存データは消えません） */
function setup() {
  const ss = getSS();
  mkSheet(ss, SH_WORKER,  H_WORKER,  '#2D5A8E');
  mkSheet(ss, SH_SHIFT,   H_SHIFT,   '#4A8FD4');
  mkSheet(ss, SH_APPLY,   H_APPLY,   '#4CAF7D');
  mkSheet(ss, SH_RECORD,  H_RECORD,  '#8888A0');
  const wage = mkSheet(ss, SH_WAGE, H_WAGE, '#D4A017');
  if (wage.getLastRow() === 1) {
    wage.getRange(2, 1, 4, 3).setValues([
      ['訪問看護', '日勤', 2200],
      ['訪問看護', 'オンコール実働', 2200],
      ['訪問介護ようき', '日勤', 1400],
      ['訪問介護ようき', '夜勤', 1500],
    ]);
  }
  const pat = mkSheet(ss, SH_PATTERN, H_PATTERN, '#FF8C42');
  if (pat.getLastRow() === 1) {
    pat.getRange(2, 1, 8, 6).setValues([
      ['訪問看護', '午前', '08:00', '13:00', 5.0, '日勤'],
      ['訪問看護', '午後', '13:00', '18:00', 5.0, '日勤'],
      ['訪問看護', '1日', '08:00', '17:00', 8.0, '日勤'],
      ['訪問看護', 'オンコール', '', '', '', '待機'],
      ['訪問介護ようき', '早番', '06:00', '13:00', 7.0, '日勤'],
      ['訪問介護ようき', '遅番', '13:00', '18:00', 5.0, '日勤'],
      ['訪問介護ようき', '日勤(通し)', '08:00', '17:00', 8.0, '日勤'],
      ['訪問介護ようき', '夜勤', '16:30', '08:30', 16, '夜勤'],
    ]);
  }
  let cfg = ss.getSheetByName(SH_CONFIG);
  if (!cfg) {
    cfg = ss.insertSheet(SH_CONFIG);
    cfg.getRange('A1').setValue('管理パスコード（施設側ログイン）').setFontWeight('bold');
    cfg.getRange('B1').setValue(Utilities.getUuid().slice(0, 8));
    cfg.getRange('A2').setValue('LINEチャネルアクセストークン（Messaging API）').setFontWeight('bold');
    cfg.getRange('A3').setValue('LIFF ID（参考）').setFontWeight('bold');
    cfg.getRange('A4').setValue('通知有効（1=ON / 0=OFF）').setFontWeight('bold');
    cfg.getRange('B4').setValue(1);
    cfg.setColumnWidth(1, 320); cfg.setColumnWidth(2, 360);
  }
  return '設定完了。管理パスコード: ' + cfg.getRange('B1').getValue();
}

function mkSheet(ss, name, headers, color) {
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(headers);
    sh.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground(color).setFontColor('#ffffff');
    sh.setFrozenRows(1);
  }
  return sh;
}

/* ───────────────── 設定アクセス ───────────────── */
function cfgVal(row) {
  const cfg = getSS().getSheetByName(SH_CONFIG);
  return cfg ? String(cfg.getRange(row, 2).getValue()).trim() : '';
}
function adminKey() { return cfgVal(1); }
function lineToken() { return cfgVal(2); }
function notifyOn() { return cfgVal(4) !== '0'; }
function requireAdmin(key) { const k = adminKey(); return k && String(key || '').trim() === k; }

/* ───────────────── シート読み出しヘルパー ───────────────── */
function readRows(name) {
  const sh = getSS().getSheetByName(name);
  if (!sh || sh.getLastRow() < 2) return { sh: sh, headers: [], rows: [] };
  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  const values = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
  const rows = values.map((v, i) => {
    const o = { _row: i + 2 };
    headers.forEach((h, c) => { o[h] = v[c]; });
    return o;
  });
  return { sh: sh, headers: headers, rows: rows };
}
function setCell(sh, row, headers, col, val) {
  const idx = headers.indexOf(col);
  if (idx >= 0) sh.getRange(row, idx + 1).setValue(val);
}

/* ───────────────── POST（更新系） ───────────────── */
function doPost(e) {
  try {
    const d = JSON.parse(e.postData.contents);
    const action = d.action || '';
    switch (action) {
      case 'register':     return register(d);
      case 'apply':        return apply(d);
      case 'cancel':       return cancelApply(d);
      case 'create_shift': return createShift(d);
      case 'approve':      return decide(d, '承認');
      case 'reject':       return decide(d, '却下');
      case 'record_work':  return recordWork(d);
      case 'set_status':   return setShiftStatus(d);
      case 'verify_worker':return verifyWorker(d);
      case 'unapprove':    return unapprove(d);
      default:             return jsonOut({ status: 'error', message: 'unknown action: ' + action });
    }
  } catch (err) {
    return jsonOut({ status: 'error', message: String(err) });
  }
}

/** 働き手の新規登録 / 更新（line_user_id で本人特定） */
function register(d) {
  const uid = String(d.line_user_id || '').trim();
  const name = String(d.name || '').trim();
  if (!uid || !name) return jsonOut({ status: 'error', message: 'line_user_id/name required' });
  const { sh, headers, rows } = readRows(SH_WORKER);
  const sheet = sh || mkSheet(getSS(), SH_WORKER, H_WORKER, '#2D5A8E');
  const rec = [uid, name, d.kana || '', d.job || '', d.license || '', d.years || '', d.tel || '',
               d.via_sharefull ? 'はい' : 'いいえ', asDateStr(new Date()), '有効', 0, 0,
               '未提出', '未確認', '未収集'];   // 資格確認 / 本人確認 / マイナンバー（番号本体はシステム外で管理）
  const exist = rows.find(r => String(r['line_user_id']).trim() === uid);
  if (exist) {
    // 既存は氏名〜電話・職種だけ更新（累計は維持）
    const H = headers.length ? headers : H_WORKER;
    ['氏名','ふりがな','職種','保有資格','経験年数','電話'].forEach((c, i) => {
      setCell(sheet, exist._row, H, c, [name, d.kana||'', d.job||'', d.license||'', d.years||'', d.tel||''][i]);
    });
    return jsonOut({ status: 'ok', updated: true });
  }
  sheet.appendRow(rec);
  return jsonOut({ status: 'ok', registered: true });
}

/** 募集へ応募（同一募集の重複＋同日・時間帯の重複＝ダブルブッキングを防止） */
function apply(d) {
  const uid = String(d.line_user_id || '').trim();
  const sid = String(d.shift_id || '').trim();
  if (!uid || !sid) return jsonOut({ status: 'error', message: 'line_user_id/shift_id required' });

  const worker = readRows(SH_WORKER).rows.find(r => String(r['line_user_id']).trim() === uid);
  if (!worker) return jsonOut({ status: 'error', message: '未登録です。先に登録してください', need_register: true });

  const sd = readRows(SH_SHIFT);
  const target = sd.rows.find(r => String(r['募集ID']).trim() === sid);
  if (!target) return jsonOut({ status: 'error', message: '募集が見つかりません' });

  const ap = readRows(SH_APPLY);
  // 自分の有効な応募（応募中／承認／完了）
  const mine = ap.rows.filter(r => String(r['line_user_id']).trim() === uid
                                   && ['応募中', '承認', '完了'].indexOf(String(r['ステータス']).trim()) >= 0);
  if (mine.some(r => String(r['募集ID']).trim() === sid)) return jsonOut({ status: 'ok', already: true });

  // 同日・時間帯の重複チェック（夜勤の翌日跨ぎも考慮した絶対時間で判定）
  const tIv = shiftInterval(asDateStr(target['日付']), asTimeStr(target['開始']), asTimeStr(target['終了']));
  const shiftById = {}; sd.rows.forEach(r => shiftById[String(r['募集ID']).trim()] = r);
  const conflict = mine.some(r => {
    const s = shiftById[String(r['募集ID']).trim()]; if (!s) return false;
    const iv = shiftInterval(asDateStr(s['日付']), asTimeStr(s['開始']), asTimeStr(s['終了']));
    return tIv && iv && tIv.s < iv.e && iv.s < tIv.e;   // 区間が重なる
  });
  if (conflict) return jsonOut({ status: 'error', conflict: true,
    message: '同じ時間帯に応募済み／確定済みのシフトがあります。先に取消してからご応募ください。' });

  const sheet = ap.sh || mkSheet(getSS(), SH_APPLY, H_APPLY, '#4CAF7D');
  sheet.appendRow([newId('A'), sid, uid, worker['氏名'], nowStr(), '応募中']);
  return jsonOut({ status: 'ok', applied: true });
}

/** 日付＋開始/終了を「絶対分（epoch日×1440＋分）」の区間に変換。夜勤(翌/跨ぎ)は終了に+1440 */
function shiftInterval(dateStr, start, end) {
  const toMin = t => { t = String(t).replace('翌', ''); const m = t.split(':'); return m.length === 2 ? (+m[0]) * 60 + (+m[1]) : NaN; };
  const ms = Date.parse(String(dateStr) + 'T00:00:00');
  let s = toMin(start), e = toMin(end);
  if (isNaN(ms) || isNaN(s) || isNaN(e)) return null;
  const day = Math.round(ms / 86400000);
  if (String(end).indexOf('翌') >= 0 || e <= s) e += 1440;
  return { s: day * 1440 + s, e: day * 1440 + e };
}

/** 応募キャンセル（本人）。apply_id（推奨）または shift_id＋uid で特定。応募中だけでなく確定（承認）も取消可。承認の取消時は枠を再募集に戻す */
function cancelApply(d) {
  const uid = String(d.line_user_id || '').trim();
  const aid = String(d.apply_id || '').trim();
  const sid = String(d.shift_id || '').trim();
  const ap = readRows(SH_APPLY);
  const row = ap.rows.find(r => String(r['line_user_id']).trim() === uid
                                && ['応募中', '承認'].indexOf(String(r['ステータス']).trim()) >= 0
                                && (aid ? String(r['応募ID']).trim() === aid : String(r['募集ID']).trim() === sid));
  if (!row) return jsonOut({ status: 'error', message: '取消できる応募が見つかりません（既に取消済み／勤務済みの可能性）' });
  const wasApproved = String(row['ステータス']).trim() === '承認';
  setCell(ap.sh, row._row, ap.headers, 'ステータス', 'キャンセル');
  if (wasApproved) reopenShift(String(row['募集ID']).trim());
  return jsonOut({ status: 'ok', canceled: true, was_approved: wasApproved });
}

/** 確定枠を1つ戻す：確定人数を-1し、締切だった枠を必要人数を下回ったら募集中に戻す */
function reopenShift(sid) {
  const sd = readRows(SH_SHIFT);
  const s = sd.rows.find(r => String(r['募集ID']).trim() === sid);
  if (!s) return;
  const filled = Math.max(0, Number(s['確定人数'] || 0) - 1);
  setCell(sd.sh, s._row, sd.headers, '確定人数', filled);
  if (String(s['ステータス']).trim() === '締切' && filled < Number(s['必要人数'] || 1))
    setCell(sd.sh, s._row, sd.headers, 'ステータス', '募集中');
}

/** 施設側：承認（確定）の取消（管理キー必須）。確定を解除し枠を再募集に戻して本人へLINE通知 */
function unapprove(d) {
  if (!requireAdmin(d.key)) return jsonOut({ status: 'unauthorized' });
  const aid = String(d.apply_id || '').trim();
  const ap = readRows(SH_APPLY);
  const a = ap.rows.find(r => String(r['応募ID']).trim() === aid);
  if (!a || String(a['ステータス']).trim() !== '承認') return jsonOut({ status: 'error', message: '確定中の応募が見つかりません' });
  setCell(ap.sh, a._row, ap.headers, 'ステータス', 'キャンセル');
  const sid = String(a['募集ID']).trim();
  reopenShift(sid);
  if (notifyOn()) {
    const sd = readRows(SH_SHIFT);
    const s = sd.rows.find(r => String(r['募集ID']).trim() === sid) || {};
    const when = `${asDateStr(s['日付'])} ${asTimeStr(s['開始'])}〜${asTimeStr(s['終了'])}`;
    linePush(String(a['line_user_id']).trim(), `【確定取消のお知らせ】${when}（${s['サービス']}・${s['職種']}）の確定が取り消されました。ご迷惑をおかけし申し訳ありません。`);
  }
  return jsonOut({ status: 'ok' });
}

/** 募集作成（施設側・管理キー必須）＋ 該当職種の登録者へ新着通知 */
function createShift(d) {
  if (!requireAdmin(d.key)) return jsonOut({ status: 'unauthorized' });
  const sheet = getSS().getSheetByName(SH_SHIFT) || mkSheet(getSS(), SH_SHIFT, H_SHIFT, '#4A8FD4');
  const id = newId('R');
  const wage = d.wage || lookupWage(d.service, d.night ? '夜勤' : '日勤');
  sheet.appendRow([id, d.service || '訪問看護', d.facility || '', asDateStr(d.date), d.pattern || '',
                   d.start || '', d.end || '', d.job || '看護師', d.night ? 1 : '', d.oncall ? 1 : '',
                   Number(d.need || 1), 0, wage, d.duty || '', d.license_req || '', '募集中', d.source || '', nowStr()]);
  // 新着通知（該当職種の有効な登録者へ）
  let notified = 0;
  if (notifyOn()) notified = pushNewShift({ service: d.service, facility: d.facility, date: asDateStr(d.date),
                                            pattern: d.pattern, start: d.start, end: d.end, job: d.job || '看護師', wage: wage });
  return jsonOut({ status: 'ok', shift_id: id, notified: notified });
}

/** 承認 / 却下（施設側・管理キー必須）→ 応募者へLINE通知 */
function decide(d, kind) {
  if (!requireAdmin(d.key)) return jsonOut({ status: 'unauthorized' });
  const aid = String(d.apply_id || '').trim();
  const ap = readRows(SH_APPLY);
  const a = ap.rows.find(r => String(r['応募ID']).trim() === aid);
  if (!a) return jsonOut({ status: 'error', message: 'apply not found' });

  // 看護師は資格確認（確認済）後でないと承認＝勤務確定できない（労務方針）
  if (kind === '承認') {
    const w = readRows(SH_WORKER).rows.find(r => String(r['line_user_id']).trim() === String(a['line_user_id']).trim());
    if (w && String(w['職種']).trim() === '看護師' && String(w['資格確認状態'] || '').trim() !== '確認済') {
      return jsonOut({ status: 'error', need_verify: true,
        message: '看護師は資格確認（確認済）後でないと承認できません。先に「資格・本人確認」を行ってください。' });
    }
  }
  setCell(ap.sh, a._row, ap.headers, 'ステータス', kind);

  const sd = readRows(SH_SHIFT);
  const s = sd.rows.find(r => String(r['募集ID']).trim() === String(a['募集ID']).trim());
  if (kind === '承認' && s) {
    const filled = Number(s['確定人数'] || 0) + 1;
    setCell(sd.sh, s._row, sd.headers, '確定人数', filled);
    if (filled >= Number(s['必要人数'] || 1)) setCell(sd.sh, s._row, sd.headers, 'ステータス', '締切');
  }
  if (notifyOn() && s) {
    const when = `${asDateStr(s['日付'])} ${asTimeStr(s['開始'])}〜${asTimeStr(s['終了'])}`;
    const msg = kind === '承認'
      ? `【確定】${when} ${s['施設']} ${s['職種']}のシフトが確定しました！当日よろしくお願いします。`
      : `【お知らせ】${when} の募集は今回マッチしませんでした。次の募集もぜひご応募ください。`;
    linePush(String(a['line_user_id']).trim(), msg);
  }
  return jsonOut({ status: 'ok', decided: kind });
}

/** 資格・本人確認の完了を記録（施設側・管理キー必須）。免許証/身分証の写しを確認したら押す＝資格確認状態・本人確認状態を「確認済」に */
function verifyWorker(d) {
  if (!requireAdmin(d.key)) return jsonOut({ status: 'unauthorized' });
  const uid = String(d.line_user_id || '').trim();
  const w = readRows(SH_WORKER);
  const wr = w.rows.find(r => String(r['line_user_id']).trim() === uid);
  if (!wr) return jsonOut({ status: 'error', message: 'worker not found' });
  setCell(w.sh, wr._row, w.headers, '資格確認状態', '確認済');
  setCell(w.sh, wr._row, w.headers, '本人確認状態', '確認済');
  return jsonOut({ status: 'ok' });
}

/** 募集ステータス変更（施設側・管理キー必須）：募集中⇄締切、または中止。中止時は応募中／承認の応募をキャンセルし本人へLINE通知 */
function setShiftStatus(d) {
  if (!requireAdmin(d.key)) return jsonOut({ status: 'unauthorized' });
  const sid = String(d.shift_id || '').trim();
  const ns = String(d.status || '').trim();   // 募集中 / 締切 / 中止
  if (['募集中', '締切', '中止'].indexOf(ns) < 0) return jsonOut({ status: 'error', message: 'invalid status' });
  const sd = readRows(SH_SHIFT);
  const s = sd.rows.find(r => String(r['募集ID']).trim() === sid);
  if (!s) return jsonOut({ status: 'error', message: 'shift not found' });
  setCell(sd.sh, s._row, sd.headers, 'ステータス', ns);

  let notified = 0;
  if (ns === '中止') {
    const ap = readRows(SH_APPLY);
    const when = `${asDateStr(s['日付'])} ${asTimeStr(s['開始'])}〜${asTimeStr(s['終了'])}`;
    ap.rows.forEach(r => {
      if (String(r['募集ID']).trim() === sid && ['応募中', '承認'].indexOf(String(r['ステータス']).trim()) >= 0) {
        setCell(ap.sh, r._row, ap.headers, 'ステータス', 'キャンセル');
        if (notifyOn() && linePush(String(r['line_user_id']).trim(),
            `【募集中止のお知らせ】${when}（${s['サービス']}・${s['職種']}）の募集は中止になりました。ご応募ありがとうございました。`)) notified++;
      }
    });
  }
  return jsonOut({ status: 'ok', new_status: ns, notified: notified });
}

/** 勤務実績を記録し、登録者の累計勤務時間を加算。100時間ごとにボーナス自動判定＆LINE通知（施設側・管理キー必須） */
function recordWork(d) {
  if (!requireAdmin(d.key)) return jsonOut({ status: 'unauthorized' });
  const aid = String(d.apply_id || '').trim();
  const ap = readRows(SH_APPLY);
  const a = ap.rows.find(r => String(r['応募ID']).trim() === aid);
  if (!a) return jsonOut({ status: 'error', message: 'apply not found' });
  if (String(a['ステータス']).trim() !== '承認') return jsonOut({ status: 'error', message: '承認済みの応募のみ記録できます' });
  const uid = String(a['line_user_id']).trim(), sid = String(a['募集ID']).trim();

  // 重複記録の防止（同じ募集×同じ人）
  const rec = readRows(SH_RECORD);
  if (rec.rows.some(r => String(r['募集ID']).trim() === sid && String(r['line_user_id']).trim() === uid))
    return jsonOut({ status: 'ok', already: true });

  const sd = readRows(SH_SHIFT);
  const s = sd.rows.find(r => String(r['募集ID']).trim() === sid) || {};
  const wage = Number(s['時給'] || 0);
  const hours = (d.hours != null && d.hours !== '') ? Number(d.hours)
              : patternHours(s['サービス'], s['シフトパターン'], asTimeStr(s['開始']), asTimeStr(s['終了']));
  const standby = String(d.standby || '').trim();              // '平日' / '日祝' / '' （オンコール待機）
  const standbyPay = standby === '日祝' ? 4000 : (standby === '平日' ? 2000 : 0);
  const pay = Math.round(hours * wage) + standbyPay;
  const month = asDateStr(s['日付']).slice(0, 7);

  const recSheet = rec.sh || mkSheet(getSS(), SH_RECORD, H_RECORD, '#8888A0');
  recSheet.appendRow([newId('W'), sid, uid, s['シフトパターン'] || '', asTimeStr(s['開始']), asTimeStr(s['終了']),
                      hours, standby, standbyPay, wage, pay, true, month]);
  setCell(ap.sh, a._row, ap.headers, 'ステータス', '完了');

  // 累計勤務時間の加算 ＋ 100時間ボーナス判定
  const w = readRows(SH_WORKER);
  const wr = w.rows.find(r => String(r['line_user_id']).trim() === uid);
  let bonus = 0;
  if (wr) {
    const oldH = Number(wr['累計勤務時間'] || 0), newH = oldH + hours;
    setCell(w.sh, wr._row, w.headers, '累計勤務時間', newH);
    const milestones = Math.floor(newH / 100) - Math.floor(oldH / 100);
    if (milestones > 0) {
      bonus = milestones * 10000;
      setCell(w.sh, wr._row, w.headers, '累計ボーナス', Number(wr['累計ボーナス'] || 0) + bonus);
    }
    if (notifyOn()) {
      linePush(uid, `お疲れさまでした。${asDateStr(s['日付'])} の勤務（${hours}時間・${yen(pay)}）を記録しました。`);
      if (bonus > 0) linePush(uid, `🎉 累計${Math.floor(newH / 100) * 100}時間達成！ボーナス${yen(bonus)}をプレゼントします。`);
    }
  }
  return jsonOut({ status: 'ok', hours: hours, pay: pay, bonus: bonus });
}

/** シフトパターンの実働時間を返す（マスタ優先、無ければ開始-終了から算出。翌日跨ぎ対応） */
function patternHours(service, pattern, start, end) {
  const p = readRows(SH_PATTERN).rows.find(r => String(r['サービス']).trim() === String(service).trim()
                                               && String(r['パターン']).trim() === String(pattern).trim());
  if (p && p['実働'] !== '' && !isNaN(Number(p['実働']))) return Number(p['実働']);
  const toMin = t => { t = String(t).replace('翌', ''); const m = t.split(':'); return m.length === 2 ? (+m[0]) * 60 + (+m[1]) : NaN; };
  let sMin = toMin(start), eMin = toMin(end);
  if (isNaN(sMin) || isNaN(eMin)) return 0;
  if (String(end).indexOf('翌') >= 0 || eMin <= sMin) eMin += 24 * 60;
  return Math.round((eMin - sMin) / 60 * 10) / 10;
}

/** 金額を ¥1,234 形式に */
function yen(n) { return '¥' + Number(n || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ','); }

/* ───────────────── GET（参照系） ───────────────── */
function doGet(e) {
  try {
    const action = e.parameter.action || '';
    switch (action) {
      case 'ping':         return jsonOut({ status: 'ok', service: 'spojob', ts: nowStr() });
      case 'shifts':       return listShifts(e);
      case 'mypage':       return myPage(e);
      case 'masters':      return masters();
      case 'admin_shifts': return adminShifts(e);
      case 'applications': return listApplications(e);
      case 'payroll':      return payroll(e);
      default:             return jsonOut({ status: 'error', message: 'unknown action: ' + action });
    }
  } catch (err) {
    return jsonOut({ status: 'error', message: String(err) });
  }
}

/** 募集中の一覧（働き手向け）。?job=看護師 で絞り込み、?uid= で応募済み判定 */
function listShifts(e) {
  const job = String(e.parameter.job || '').trim();
  const uid = String(e.parameter.uid || '').trim();
  const sd = readRows(SH_SHIFT);
  const applied = {};
  if (uid) readRows(SH_APPLY).rows.forEach(r => {
    if (String(r['line_user_id']).trim() === uid && ['応募中','承認'].includes(String(r['ステータス']).trim()))
      applied[String(r['募集ID']).trim()] = true;
  });
  const list = sd.rows
    .filter(r => String(r['ステータス']).trim() === '募集中')
    .filter(r => !job || String(r['職種']).trim() === job)
    .map(r => ({
      shift_id: String(r['募集ID']).trim(), service: r['サービス'], facility: r['施設'], date: asDateStr(r['日付']),
      pattern: r['シフトパターン'], start: asTimeStr(r['開始']), end: asTimeStr(r['終了']), job: r['職種'],
      night: !!r['夜勤フラグ'], oncall: !!r['オンコールフラグ'], wage: Number(r['時給'] || 0),
      duty: r['業務内容'], license_req: r['資格要件'],
      seats: Math.max(0, Number(r['必要人数'] || 0) - Number(r['確定人数'] || 0)),
      applied: !!applied[String(r['募集ID']).trim()]
    }))
    .filter(x => x.seats > 0)
    .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
  return jsonOut({ status: 'ok', shifts: list });
}

/** 働き手マイページ：自分の応募＋累計（?uid=必須） */
function myPage(e) {
  const uid = String(e.parameter.uid || '').trim();
  if (!uid) return jsonOut({ status: 'error', message: 'uid required' });
  const worker = readRows(SH_WORKER).rows.find(r => String(r['line_user_id']).trim() === uid);
  if (!worker) return jsonOut({ status: 'ok', registered: false });
  const sd = readRows(SH_SHIFT);
  const shiftById = {}; sd.rows.forEach(r => shiftById[String(r['募集ID']).trim()] = r);
  const apps = readRows(SH_APPLY).rows
    .filter(r => String(r['line_user_id']).trim() === uid)
    .map(r => {
      const s = shiftById[String(r['募集ID']).trim()] || {};
      return { apply_id: String(r['応募ID']).trim(), shift_id: String(r['募集ID']).trim(), status: String(r['ステータス']).trim(),
               date: asDateStr(s['日付']), facility: s['施設'], pattern: s['シフトパターン'],
               start: asTimeStr(s['開始']), end: asTimeStr(s['終了']), wage: Number(s['時給'] || 0) };
    });
  const hours = Number(worker['累計勤務時間'] || 0);
  return jsonOut({ status: 'ok', registered: true, name: worker['氏名'], job: worker['職種'],
                   total_hours: hours, bonus_count: Math.floor(hours / 100), to_next: 100 - (hours % 100),
                   applications: apps });
}

/** マスタ（時給・シフトパターン）を返す（募集作成フォーム用） */
function masters() {
  const wage = readRows(SH_WAGE).rows.map(r => ({ service: r['サービス'], kind: r['区分'], wage: Number(r['時給'] || 0) }));
  const pat = readRows(SH_PATTERN).rows.map(r => ({ service: r['サービス'], pattern: r['パターン'],
                start: asTimeStr(r['開始']), end: asTimeStr(r['終了']), hours: r['実働'], kind: r['区分'] }));
  return jsonOut({ status: 'ok', wages: wage, patterns: pat });
}

/** 施設側：全募集＋応募数（?key=管理キー必須） */
function adminShifts(e) {
  if (!requireAdmin(e.parameter.key)) return jsonOut({ status: 'unauthorized' });
  const apCount = {};
  readRows(SH_APPLY).rows.forEach(r => {
    const sid = String(r['募集ID']).trim();
    if (!apCount[sid]) apCount[sid] = { 応募中: 0, 承認: 0 };
    const st = String(r['ステータス']).trim();
    if (apCount[sid][st] != null) apCount[sid][st]++;
  });
  const list = readRows(SH_SHIFT).rows.map(r => {
    const sid = String(r['募集ID']).trim();
    return { shift_id: sid, service: r['サービス'], facility: r['施設'], date: asDateStr(r['日付']),
             pattern: r['シフトパターン'], start: asTimeStr(r['開始']), end: asTimeStr(r['終了']), job: r['職種'],
             need: Number(r['必要人数'] || 0), filled: Number(r['確定人数'] || 0), status: String(r['ステータス']).trim(),
             pending: (apCount[sid] || {}).応募中 || 0, approved: (apCount[sid] || {}).承認 || 0 };
  });
  return jsonOut({ status: 'ok', shifts: list });
}

/** 施設側：ある募集の応募者一覧（?key=&shift_id=） */
function listApplications(e) {
  if (!requireAdmin(e.parameter.key)) return jsonOut({ status: 'unauthorized' });
  const sid = String(e.parameter.shift_id || '').trim();
  const workerById = {};
  readRows(SH_WORKER).rows.forEach(r => workerById[String(r['line_user_id']).trim()] = r);
  const list = readRows(SH_APPLY).rows
    .filter(r => !sid || String(r['募集ID']).trim() === sid)
    .map(r => {
      const w = workerById[String(r['line_user_id']).trim()] || {};
      return { apply_id: String(r['応募ID']).trim(), shift_id: String(r['募集ID']).trim(),
               uid: String(r['line_user_id']).trim(),
               name: r['氏名'], job: w['職種'] || '', license: w['保有資格'] || '', years: w['経験年数'] || '',
               cert_status: String(w['資格確認状態'] || '未提出').trim(),
               applied_at: String(r['応募日時']), status: String(r['ステータス']).trim() };
    });
  return jsonOut({ status: 'ok', applications: list });
}

/** 月次支給集計（施設側・管理キー必須）：勤務実績を対象月で絞り、働き手ごとに件数・実働時間・待機手当・支給額を合算 */
function payroll(e) {
  if (!requireAdmin(e.parameter.key)) return jsonOut({ status: 'unauthorized' });
  const month = String(e.parameter.month || '').trim();
  const workerById = {};
  readRows(SH_WORKER).rows.forEach(r => workerById[String(r['line_user_id']).trim()] = r);
  const agg = {};
  readRows(SH_RECORD).rows.forEach(r => {
    if (month && String(r['対象月'] || '').trim() !== month) return;
    const uid = String(r['line_user_id']).trim();
    if (!agg[uid]) agg[uid] = { uid: uid, count: 0, hours: 0, standby: 0, pay: 0 };
    agg[uid].count++;
    agg[uid].hours += Number(r['実働時間'] || 0);
    agg[uid].standby += Number(r['待機手当'] || 0);
    agg[uid].pay += Number(r['支給額'] || 0);
  });
  const rows = Object.keys(agg).map(uid => {
    const w = workerById[uid] || {}, a = agg[uid];
    return { name: w['氏名'] || uid, job: w['職種'] || '', count: a.count,
             hours: Math.round(a.hours * 10) / 10, standby: a.standby, pay: a.pay };
  }).sort((x, y) => y.pay - x.pay);
  const total = { count: 0, hours: 0, standby: 0, pay: 0 };
  rows.forEach(r => { total.count += r.count; total.hours += r.hours; total.standby += r.standby; total.pay += r.pay; });
  total.hours = Math.round(total.hours * 10) / 10;
  return jsonOut({ status: 'ok', month: month, rows: rows, total: total });
}

/* ───────────────── LINE 通知 ───────────────── */
function linePush(to, text) {
  const token = lineToken();
  if (!token || !to) return false;
  try {
    UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push', {
      method: 'post', contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + token },
      payload: JSON.stringify({ to: to, messages: [{ type: 'text', text: text }] }),
      muteHttpExceptions: true
    });
    return true;
  } catch (err) { return false; }
}

/** 新着募集を該当職種の有効な登録者へ一斉通知。戻り＝通知人数 */
function pushNewShift(s) {
  const link = '\n▶ 詳細・応募はLINEから';
  const text = `【新着シフト】${s.date} ${s.start || ''}〜${s.end || ''} ${s.facility || ''}\n${s.job} ¥${s.wage}/時${link}`;
  let n = 0;
  readRows(SH_WORKER).rows.forEach(r => {
    if (String(r['ステータス']).trim() === '有効' && String(r['職種']).trim() === s.job) {
      if (linePush(String(r['line_user_id']).trim(), text)) n++;
    }
  });
  return n;
}

/** 前日リマインド：翌日の確定（承認）シフトの担当者へLINE通知。時間主導トリガー（毎日）で実行する想定。戻り＝通知件数 */
function sendReminders() {
  if (!notifyOn()) return 0;
  const tomorrow = Utilities.formatDate(new Date(Date.now() + 86400000), TZ, 'yyyy-MM-dd');
  const shifts = readRows(SH_SHIFT).rows.filter(r => asDateStr(r['日付']) === tomorrow);
  if (!shifts.length) return 0;
  const apps = readRows(SH_APPLY).rows;
  let n = 0;
  shifts.forEach(s => {
    const sid = String(s['募集ID']).trim();
    const when = `${asDateStr(s['日付'])} ${asTimeStr(s['開始'])}〜${asTimeStr(s['終了'])}`;
    apps.forEach(r => {
      if (String(r['募集ID']).trim() === sid && String(r['ステータス']).trim() === '承認') {
        if (linePush(String(r['line_user_id']).trim(),
            `【明日のシフト】${when}（${s['サービス']}・${s['職種']}）です。お気をつけてお越しください。`)) n++;
      }
    });
  });
  return n;
}

/** 前日リマインドを毎日18時に自動実行するトリガーを登録（初回1回だけ実行。重複登録は防止） */
function installReminderTrigger() {
  ScriptApp.getProjectTriggers().forEach(t => { if (t.getHandlerFunction() === 'sendReminders') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('sendReminders').timeBased().everyDays(1).atHour(18).create();
  return '前日リマインドのトリガーを毎日18時に登録しました。';
}

function lookupWage(service, kind) {
  const w = readRows(SH_WAGE).rows.find(r => String(r['サービス']).trim() === String(service).trim()
                                              && String(r['区分']).trim() === String(kind).trim());
  return w ? Number(w['時給'] || 0) : 0;
}

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/* ───────────────── 動作テスト ───────────────── */
function testFlow() {
  Logger.log(setup());
  Logger.log(register({ action: 'register', line_user_id: 'U_test', name: 'テスト 花子', job: '看護師', license: '正看護師' }).getContent());
  const c = JSON.parse(createShift({ action: 'create_shift', key: adminKey(), service: '訪問看護', facility: 'ホーム1',
            date: '2026-06-25', pattern: '午前', start: '08:00', end: '13:00', job: '看護師', need: 1, duty: 'バイタル・服薬' }).getContent());
  Logger.log(JSON.stringify(c));
  Logger.log(apply({ action: 'apply', line_user_id: 'U_test', shift_id: c.shift_id }).getContent());
  Logger.log(listShifts({ parameter: { job: '看護師', uid: 'U_test' } }).getContent());
}
