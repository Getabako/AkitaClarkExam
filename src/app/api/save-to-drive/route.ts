import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { Readable } from 'stream';

// 指定のフォルダID
const PARENT_FOLDER_ID = '1fTDO5U57S2POAwOWWhtg8z84e23oL_1W';

function getAuth() {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  let privateKey = process.env.GOOGLE_PRIVATE_KEY;

  console.log('Service Account Email:', clientEmail ? 'Set' : 'NOT SET');
  console.log('Private Key raw length:', privateKey?.length);

  if (!clientEmail || !privateKey) {
    throw new Error('Missing Google credentials');
  }

  // 様々な形式に対応
  // 1. ダブルクォートで囲まれている場合は除去
  if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
    privateKey = privateKey.slice(1, -1);
  }

  // 2. リテラルな \n を実際の改行に変換
  privateKey = privateKey.replace(/\\n/g, '\n');

  // 3. 既に改行が含まれていない場合（1行になっている場合）の対応
  if (!privateKey.includes('\n')) {
    // BASE64部分を64文字ごとに改行
    const header = '-----BEGIN PRIVATE KEY-----';
    const footer = '-----END PRIVATE KEY-----';
    if (privateKey.includes(header) && privateKey.includes(footer)) {
      const base64 = privateKey.replace(header, '').replace(footer, '').replace(/\s/g, '');
      const chunks = base64.match(/.{1,64}/g) || [];
      privateKey = `${header}\n${chunks.join('\n')}\n${footer}\n`;
    }
  }

  console.log('Private Key processed, starts with:', privateKey.substring(0, 30));

  return new google.auth.GoogleAuth({
    credentials: {
      client_email: clientEmail,
      private_key: privateKey,
    },
    scopes: ['https://www.googleapis.com/auth/drive'],
  });
}

async function findOrCreateFolder(drive: ReturnType<typeof google.drive>, folderName: string): Promise<string> {
  console.log('Finding or creating folder:', folderName);

  // 既存のフォルダを検索
  const searchResponse = await drive.files.list({
    q: `name='${folderName}' and '${PARENT_FOLDER_ID}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id, name)',
  });

  console.log('Search response:', JSON.stringify(searchResponse.data));

  if (searchResponse.data.files && searchResponse.data.files.length > 0) {
    console.log('Found existing folder:', searchResponse.data.files[0].id);
    return searchResponse.data.files[0].id!;
  }

  // フォルダが存在しない場合は作成
  console.log('Creating new folder...');
  const createResponse = await drive.files.create({
    requestBody: {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [PARENT_FOLDER_ID],
    },
    fields: 'id',
  });

  console.log('Created folder:', createResponse.data.id);
  return createResponse.data.id!;
}

async function uploadFile(
  drive: ReturnType<typeof google.drive>,
  folderId: string,
  fileName: string,
  content: string | Buffer,
  mimeType: string
): Promise<string> {
  console.log('Uploading file:', fileName, 'to folder:', folderId);

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

  console.log('Uploaded file:', response.data.id);
  return response.data.webViewLink || '';
}

export async function POST(request: NextRequest) {
  try {
    const { studentName, analysis, imageUrl } = await request.json();
    console.log('Saving results for:', studentName);

    // 認証を取得
    const auth = getAuth();
    const drive = google.drive({ version: 'v3', auth });

    // 生徒名のフォルダを作成または取得
    const folderId = await findOrCreateFolder(drive, studentName);

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

    await uploadFile(drive, folderId, analysisFileName, analysisContent, 'text/plain');

    // 画像をダウンロードして保存
    if (imageUrl) {
      try {
        console.log('Downloading image from:', imageUrl);
        const imageResponse = await fetch(imageUrl);
        const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
        await uploadFile(drive, folderId, `ビジョン画像_${timestamp}.png`, imageBuffer, 'image/png');
      } catch (imageError) {
        console.error('Image upload error:', imageError);
      }
    }

    console.log('Successfully saved to Drive');
    return NextResponse.json({
      success: true,
      message: `結果を「${studentName}」フォルダに保存しました`
    });
  } catch (error) {
    console.error('Drive save error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: 'Driveへの保存に失敗しました: ' + errorMessage },
      { status: 500 }
    );
  }
}
