import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

// 送信先メールアドレス
const RECIPIENT_EMAIL = 'takasaki19841121@gmail.com';

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error('RESEND_API_KEY is not configured');
    }
    const resend = new Resend(apiKey);

    const { studentName, analysis, imageUrl } = await request.json();
    console.log('Sending results for:', studentName);

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
    <div class="section">
      <h3>【V】価値観の分析</h3>
      <pre>${analysis.values || '未実施'}</pre>
    </div>

    <div class="section talents">
      <h3>【T】才能の分析</h3>
      <pre>${analysis.talents || '未実施'}</pre>
    </div>

    <div class="section passion">
      <h3>【P】情熱の分析</h3>
      <pre>${analysis.passion || '未実施'}</pre>
    </div>

    <div class="section final">
      <h3>【総合分析】やりたいこと（V × T × P）</h3>
      <pre>${mainAnalysis || '未実施'}</pre>
    </div>

    ${imageUrl ? `
    <div class="image-container">
      <h3 style="color: #333;">ビジョン画像</h3>
      <img src="${imageUrl}" alt="Generated vision">
    </div>
    ` : ''}
  </div>
</body>
</html>
`;

    // プレーンテキスト版
    const textContent = `
================================================================================
自己分析結果 - ${studentName}
実施日: ${timestamp}
================================================================================

【価値観の分析】
${analysis.values || '未実施'}

--------------------------------------------------------------------------------

【才能の分析】
${analysis.talents || '未実施'}

--------------------------------------------------------------------------------

【情熱の分析】
${analysis.passion || '未実施'}

--------------------------------------------------------------------------------

【総合分析・やりたいことの導出】
${mainAnalysis || '未実施'}

================================================================================
${imageUrl ? `\nビジョン画像URL: ${imageUrl}` : ''}
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
