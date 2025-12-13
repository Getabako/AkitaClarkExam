import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { Readable } from 'stream';

// サービスアカウントの認証情報
const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
  scopes: ['https://www.googleapis.com/auth/drive'],
});

const drive = google.drive({ version: 'v3', auth });

// 指定のフォルダID
const PARENT_FOLDER_ID = '1fTDO5U57S2POAwOWWhtg8z84e23oL_1W';

async function findOrCreateFolder(folderName: string): Promise<string> {
  // 既存のフォルダを検索
  const searchResponse = await drive.files.list({
    q: `name='${folderName}' and '${PARENT_FOLDER_ID}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id, name)',
  });

  if (searchResponse.data.files && searchResponse.data.files.length > 0) {
    return searchResponse.data.files[0].id!;
  }

  // フォルダが存在しない場合は作成
  const createResponse = await drive.files.create({
    requestBody: {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [PARENT_FOLDER_ID],
    },
    fields: 'id',
  });

  return createResponse.data.id!;
}

async function uploadFile(
  folderId: string,
  fileName: string,
  content: string | Buffer,
  mimeType: string
): Promise<string> {
  const media = {
    mimeType,
    body: Readable.from(typeof content === 'string' ? Buffer.from(content, 'utf-8') : content),
  };

  const response = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [folderId],
    },
    media,
    fields: 'id, webViewLink',
  });

  return response.data.webViewLink || '';
}

export async function POST(request: NextRequest) {
  try {
    const { studentName, analysis, imageUrl } = await request.json();

    // 生徒名のフォルダを作成または取得
    const folderId = await findOrCreateFolder(studentName);

    // 分析結果をテキストファイルとして保存
    const timestamp = new Date().toISOString().split('T')[0];
    const analysisFileName = `分析結果_${timestamp}.txt`;

    const analysisContent = `
================================================================================
自己分析結果 - ${studentName}
実施日: ${new Date().toLocaleDateString('ja-JP')}
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
${analysis.final || '未実施'}

================================================================================
`;

    await uploadFile(folderId, analysisFileName, analysisContent, 'text/plain');

    // 画像をダウンロードして保存
    if (imageUrl) {
      try {
        const imageResponse = await fetch(imageUrl);
        const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
        await uploadFile(folderId, `ビジョン画像_${timestamp}.png`, imageBuffer, 'image/png');
      } catch (imageError) {
        console.error('Image upload error:', imageError);
      }
    }

    return NextResponse.json({
      success: true,
      message: `結果を「${studentName}」フォルダに保存しました`
    });
  } catch (error) {
    console.error('Drive save error:', error);
    return NextResponse.json(
      { error: 'Failed to save to Drive', details: String(error) },
      { status: 500 }
    );
  }
}
