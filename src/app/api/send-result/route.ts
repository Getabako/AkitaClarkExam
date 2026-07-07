import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

// 送信先メールアドレス
const RECIPIENT_EMAIL = 'ifjuku@gmail.com';

interface AnswerWithQuestion {
  questionId: string;
  question: string;
  answer: string;
}

// Google Apps Script経由でスプレッドシートに記録
async function saveToSpreadsheet(payload: {
  studentName: string;
  answers: AnswerWithQuestion[];
  analysis: { values?: string; talents?: string; passion?: string; final?: string };
  firstAction: string;
  supportPreferenceLabel: string;
  diagnosisType: string;
  yaritaikoto: string;
  status: string;
  qaLog: string;
}): Promise<boolean> {
  const webhookUrl = process.env.GAS_WEBHOOK_URL;
  if (!webhookUrl) {
    console.warn('GAS_WEBHOOK_URL is not configured; skipping spreadsheet save');
    return false;
  }
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      redirect: 'follow',
    });
    if (!response.ok) {
      console.error('Spreadsheet save failed:', response.status, await response.text());
      return false;
    }
    return true;
  } catch (error) {
    console.error('Spreadsheet save error:', error);
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error('RESEND_API_KEY is not configured');
    }
    const resend = new Resend(apiKey);

    const {
      studentName, analysis, firstAction, supportPreferenceLabel, answers,
      diagnosisType, yaritaikoto, status, qaLog,
    } = await request.json();

    // スプレッドシートへ記録（失敗してもメール送信は続行）
    const sheetSaved = await saveToSpreadsheet({
      studentName,
      answers: answers || [],
      analysis: analysis || {},
      firstAction,
      supportPreferenceLabel,
      diagnosisType: diagnosisType || '',
      yaritaikoto: yaritaikoto || '',
      status: status || '',
      qaLog: qaLog || '',
    });
    console.log('Spreadsheet saved:', sheetSaved);
    console.log('Sending results for:', studentName, 'Support preference:', supportPreferenceLabel);

    const timestamp = new Date().toLocaleDateString('ja-JP');
    const analysisText = analysis.final || '';
    const mainAnalysis = analysisText.split('===画像プロンプト===')[0].replace('===分析===', '').trim();

    // HTMLメール本文を作成
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #004097, #01654d); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
    .section { background: white; padding: 20px; margin: 15px 0; border-radius: 8px; border-left: 4px solid #004097; }
    .section h3 { color: #004097; margin-top: 0; }
    .section.talents { border-left-color: #01654d; }
    .section.talents h3 { color: #01654d; }
    .section.passion { border-left-color: #666; }
    .section.final { background: #333; color: white; border-left: none; }
    .section.final h3 { color: white; }
    .image-container { text-align: center; margin: 20px 0; }
    .image-container img { max-width: 100%; border-radius: 10px; }
    pre { white-space: pre-wrap; word-wrap: break-word; margin: 0; font-family: inherit; }
  </style>
</head>
<body>
  <div class="header">
    <h1 style="margin: 0;">自己分析結果</h1>
    <p style="margin: 10px 0 0 0; opacity: 0.9;">${studentName} さん - ${timestamp}</p>
  </div>
  <div class="content">
    <div class="section" style="border-left-color: #0ea5e9; background: #f0f9ff;">
      <h3 style="color: #0369a1;">診断タイプ</h3>
      <pre>${diagnosisType || '未記録'}${status ? `（ステータス: ${status}）` : ''}</pre>
    </div>

    ${yaritaikoto ? `
    <div class="section" style="border-left-color: #16a34a; background: #f0fdf4;">
      <h3 style="color: #15803d;">現時点の「やりたいこと」</h3>
      <pre>${yaritaikoto}</pre>
    </div>
    ` : ''}

    ${qaLog ? `
    <div class="section">
      <h3>今回の質問と回答</h3>
      <pre>${qaLog}</pre>
    </div>
    ` : ''}

    ${analysis?.values ? `
    <div class="section">
      <h3>【V】価値観の分析</h3>
      <pre>${analysis.values}</pre>
    </div>

    <div class="section talents">
      <h3>【T】才能の分析</h3>
      <pre>${analysis.talents || '未実施'}</pre>
    </div>

    <div class="section passion">
      <h3>【P】情熱の分析</h3>
      <pre>${analysis.passion || '未実施'}</pre>
    </div>
    ` : ''}

    <div class="section final">
      <h3>${analysis?.values ? '【総合分析】やりたいこと（V × T × P）' : '【分析結果】'}</h3>
      <pre>${mainAnalysis || '未実施'}</pre>
    </div>

    <div class="section" style="border-left-color: #f59e0b; background: #fffbeb;">
      <h3 style="color: #d97706;">今日のファーストアクション</h3>
      <pre>${firstAction || '未入力'}</pre>
    </div>

    <div class="section" style="border-left-color: #8b5cf6; background: #f5f3ff;">
      <h3 style="color: #7c3aed;">今後の関わり方についての意思表示</h3>
      <pre>${supportPreferenceLabel || '未選択'}</pre>
    </div>
  </div>
</body>
</html>
`;

    // プレーンテキスト版
    const textContent = `
================================================================================
自己分析結果 - ${studentName}
実施日: ${timestamp}
診断タイプ: ${diagnosisType || '未記録'}${status ? `（ステータス: ${status}）` : ''}
================================================================================
${yaritaikoto ? `
【現時点の「やりたいこと」】
${yaritaikoto}

--------------------------------------------------------------------------------
` : ''}${qaLog ? `
【今回の質問と回答】
${qaLog}

--------------------------------------------------------------------------------
` : ''}${analysis?.values ? `
【価値観の分析】
${analysis.values}

--------------------------------------------------------------------------------

【才能の分析】
${analysis.talents || '未実施'}

--------------------------------------------------------------------------------

【情熱の分析】
${analysis.passion || '未実施'}

--------------------------------------------------------------------------------
` : ''}
【分析結果】
${mainAnalysis || '未実施'}

--------------------------------------------------------------------------------

【今日のファーストアクション】
${firstAction || '未入力'}

--------------------------------------------------------------------------------

【今後の関わり方についての意思表示】
${supportPreferenceLabel || '未選択'}

================================================================================
`;

    // メール送信
    const { data, error } = await resend.emails.send({
      from: 'Clark Exam <onboarding@resend.dev>',
      to: [RECIPIENT_EMAIL],
      subject: `【自己分析結果】${studentName} さん - ${timestamp}`,
      html: htmlContent,
      text: textContent,
    });

    if (error) {
      console.error('Resend error:', error);
      throw new Error(error.message);
    }

    console.log('Email sent successfully:', data);
    return NextResponse.json({
      success: true,
      message: `結果を先生にメールで送信しました`
    });
  } catch (error) {
    console.error('Email send error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: 'メール送信に失敗しました: ' + errorMessage },
      { status: 500 }
    );
  }
}
