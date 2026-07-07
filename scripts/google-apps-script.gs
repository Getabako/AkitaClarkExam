/**
 * AkitaClarkExam → スプレッドシート記録用 Google Apps Script (v3)
 *
 * 機能:
 *  - doPost: 診断結果をシートに1行追記
 *  - doGet:  ?name=〇〇 で同じ名前の過去記録を検索して返す（リピーター判定用）
 *
 * 【設置手順】
 * 1. 対象のスプレッドシートを開く
 *    https://docs.google.com/spreadsheets/d/1zx3qlsWtymvJWmCKBjqEsi2KPR32WbON6p9fgBKrNOY/edit
 * 2. メニュー「拡張機能」→「Apps Script」を開く
 * 3. このファイルの中身を全部貼り付けて保存
 * 4. 右上「デプロイ」→「デプロイを管理」→ 鉛筆アイコン →
 *    バージョン「新バージョン」→「デプロイ」（URLは変わらない）
 *    ※新しいデプロイを作った場合はURLが変わるので、Vercelの GAS_WEBHOOK_URL も更新すること
 */

// 回答のquestionIdと列の並び順
var QUESTION_IDS = ['v1', 'v2', 'v3', 'v4', 't1', 't2', 't3', 'p1', 'p2'];

var HEADERS = [
  '送信日時',
  '名前',
  'V1: 気持ちいい状態',
  'V2: 尊敬する人物',
  'V3: 社会への不満',
  'V4: ピンチへの助言',
  'T1: 充実した経験',
  'T2: 他人にイラッとすること',
  'T3: 言われる短所',
  'P1: 夢中になること',
  'P2: 理由なく好きなもの',
  '価値観の分析',
  '才能の分析',
  '情熱の分析',
  '総合分析（やりたいこと）',
  'ファーストアクション',
  '今後の関わり方',
  '診断タイプ',
  'やりたいこと',
  'ステータス',
  'セッションQ&A'
];

// 名前の表記ゆれ対策（空白除去）
function normalizeName(name) {
  return String(name || '').replace(/[\s　]+/g, '');
}

// ヘッダー行を最新の列構成に揃える
function ensureHeaders(sheet) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
    return;
  }
  // 旧バージョンのシートに新しい列が無ければ追加
  var lastCol = sheet.getLastColumn();
  if (lastCol < HEADERS.length) {
    var missing = HEADERS.slice(lastCol);
    sheet.getRange(1, lastCol + 1, 1, missing.length).setValues([missing]).setFontWeight('bold');
  }
}

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
    ensureHeaders(sheet);

    // 回答をquestionIdで引けるようにする
    var answerMap = {};
    (data.answers || []).forEach(function(a) {
      answerMap[a.questionId] = a.answer || '';
    });

    // timestampが指定されていればそれを使う（過去分の遡り登録用）
    var timestamp = data.timestamp || Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss');
    var analysis = data.analysis || {};

    var row = [timestamp, data.studentName || ''];
    QUESTION_IDS.forEach(function(id) {
      row.push(answerMap[id] || '');
    });
    row.push(
      analysis.values || '',
      analysis.talents || '',
      analysis.passion || '',
      (analysis.final || '').trim(),
      data.firstAction || '',
      data.supportPreferenceLabel || '',
      data.diagnosisType || '',
      data.yaritaikoto || '',
      data.status || '',
      data.qaLog || ''
    );

    sheet.appendRow(row);

    return ContentService.createTextOutput(JSON.stringify({ success: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: String(error) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// 名前で過去記録を検索（新しい順に最大3件返す）
function doGet(e) {
  try {
    var name = normalizeName(e.parameter.name);
    if (!name) {
      return ContentService.createTextOutput(JSON.stringify({ found: false, records: [] }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      return ContentService.createTextOutput(JSON.stringify({ found: false, records: [] }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var values = sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues();
    var records = [];

    values.forEach(function(row) {
      if (normalizeName(row[1]) !== name) return;
      var ts = row[0];
      if (ts instanceof Date) {
        ts = Utilities.formatDate(ts, 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss');
      }
      records.push({
        timestamp: String(ts),
        name: String(row[1]),
        values: String(row[11] || ''),
        talents: String(row[12] || ''),
        passion: String(row[13] || ''),
        final: String(row[14] || ''),
        firstAction: String(row[15] || ''),
        supportPreferenceLabel: String(row[16] || ''),
        diagnosisType: String(row[17] || ''),
        yaritaikoto: String(row[18] || ''),
        status: String(row[19] || ''),
        qaLog: String(row[20] || '')
      });
    });

    // 新しい順に最大3件
    records.reverse();
    records = records.slice(0, 3);

    return ContentService.createTextOutput(JSON.stringify({ found: records.length > 0, records: records }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ found: false, records: [], error: String(error) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
