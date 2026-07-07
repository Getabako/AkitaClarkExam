/**
 * AkitaClarkExam → スプレッドシート記録用 Google Apps Script
 *
 * 【設置手順】
 * 1. 対象のスプレッドシートを開く
 *    https://docs.google.com/spreadsheets/d/1zx3qlsWtymvJWmCKBjqEsi2KPR32WbON6p9fgBKrNOY/edit
 * 2. メニュー「拡張機能」→「Apps Script」を開く
 * 3. このファイルの中身を全部貼り付けて保存
 * 4. 右上「デプロイ」→「新しいデプロイ」→ 種類「ウェブアプリ」
 *    - 次のユーザーとして実行: 自分
 *    - アクセスできるユーザー: 全員
 * 5. 発行された「ウェブアプリのURL」(https://script.google.com/macros/s/xxx/exec) をコピー
 * 6. Vercelの環境変数 GAS_WEBHOOK_URL にそのURLを設定して再デプロイ
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
  '画像URL'
];

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];

    // ヘッダーがなければ1行目に作成
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(HEADERS);
      sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
      sheet.setFrozenRows(1);
    }

    // 回答をquestionIdで引けるようにする
    var answerMap = {};
    (data.answers || []).forEach(function(a) {
      answerMap[a.questionId] = a.answer || '';
    });

    var timestamp = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss');
    var analysis = data.analysis || {};

    var row = [timestamp, data.studentName || ''];
    QUESTION_IDS.forEach(function(id) {
      row.push(answerMap[id] || '');
    });
    row.push(
      analysis.values || '',
      analysis.talents || '',
      analysis.passion || '',
      (analysis.final || '').split('===画像プロンプト===')[0].trim(),
      data.firstAction || '',
      data.supportPreferenceLabel || '',
      data.imageUrl || ''
    );

    sheet.appendRow(row);

    return ContentService.createTextOutput(JSON.stringify({ success: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: String(error) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
