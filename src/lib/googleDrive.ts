// Google Drive API統合モジュール（OAuth 2.0認証）
// HeartUpAppの実装を参考に作成

declare global {
  interface Window {
    gapi: {
      load: (api: string, callback: () => void) => void;
      client: {
        init: (config: { apiKey: string; discoveryDocs: string[] }) => Promise<void>;
        getToken: () => { access_token: string } | null;
        setToken: (token: string) => void;
        request: (config: {
          path: string;
          method: string;
          params?: Record<string, string>;
          headers?: Record<string, string>;
          body?: string;
        }) => Promise<{ result: { id: string; name: string } }>;
        drive: {
          files: {
            list: (params: {
              q: string;
              fields: string;
              orderBy?: string;
            }) => Promise<{ result: { files: Array<{ id: string; name: string }> } }>;
            create: (params: {
              resource: { name: string; mimeType: string; parents: string[] };
              fields: string;
            }) => Promise<{ result: { id: string; name: string } }>;
          };
        };
      };
    };
    google: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: string | ((response: { error?: string }) => void);
          }) => {
            requestAccessToken: (config: { prompt: string }) => void;
          };
          revoke: (token: string) => void;
        };
      };
    };
  }
}

class GoogleDriveAPI {
  // Google Cloud Console で取得した値を設定
  private CLIENT_ID = '537186649664-12ft0p2d5a3jkbkpvjoquugfgpoiov86.apps.googleusercontent.com';
  private API_KEY = 'AIzaSyDen7M5YfihnQYaiHtigRvNewb4f6utUbo';
  private SCOPES = 'https://www.googleapis.com/auth/drive.file';
  private DISCOVERY_DOCS = ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'];

  // 保存先フォルダID
  private TARGET_FOLDER_ID = '1fTDO5U57S2POAwOWWhtg8z84e23oL_1W';

  private tokenClient: ReturnType<typeof window.google.accounts.oauth2.initTokenClient> | null = null;
  private gapiInited = false;
  private gisInited = false;
  private isSignedIn = false;

  /**
   * GAPI クライアントを初期化
   */
  private async initializeGapiClient(): Promise<void> {
    await window.gapi.client.init({
      apiKey: this.API_KEY,
      discoveryDocs: this.DISCOVERY_DOCS,
    });
  }

  /**
   * GIS クライアントを初期化
   */
  private initializeGisClient(): void {
    this.tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: this.CLIENT_ID,
      scope: this.SCOPES,
      callback: '', // 後で設定
    });
  }

  /**
   * 初期化処理
   */
  async initialize(): Promise<boolean> {
    return new Promise((resolve) => {
      // GAPI をロード
      if (typeof window.gapi !== 'undefined' && !this.gapiInited) {
        window.gapi.load('client', async () => {
          try {
            await this.initializeGapiClient();
            this.gapiInited = true;
            console.log('GAPI クライアント初期化完了');
            this.checkBothInited(resolve);
          } catch (err) {
            console.error('GAPI クライアント初期化エラー:', err);
            resolve(false);
          }
        });
      } else if (this.gapiInited) {
        this.checkBothInited(resolve);
      }

      // GIS を初期化
      if (typeof window.google !== 'undefined' && !this.gisInited) {
        this.initializeGisClient();
        this.gisInited = true;
        console.log('GIS クライアント初期化完了');
        this.checkBothInited(resolve);
      } else if (this.gisInited) {
        this.checkBothInited(resolve);
      }

      // 3秒後にタイムアウト
      setTimeout(() => {
        if (!this.gapiInited || !this.gisInited) {
          console.error('Google API 初期化タイムアウト');
          resolve(false);
        }
      }, 3000);
    });
  }

  private checkBothInited(resolve: (value: boolean) => void): void {
    if (this.gapiInited && this.gisInited) {
      console.log('Google Drive API: 初期化完了');
      resolve(true);
    }
  }

  /**
   * 認証状態を確認
   */
  isInitialized(): boolean {
    return this.gapiInited && this.gisInited;
  }

  /**
   * ユーザー認証（サインイン）
   */
  async authorize(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.tokenClient) {
        reject(new Error('Google API が初期化されていません'));
        return;
      }

      this.tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: this.CLIENT_ID,
        scope: this.SCOPES,
        callback: (response: { error?: string }) => {
          if (response.error !== undefined) {
            reject(new Error(response.error));
            return;
          }
          this.isSignedIn = true;
          resolve();
        },
      });

      if (window.gapi.client.getToken() === null) {
        // 初回認証 - ポップアップ表示
        this.tokenClient.requestAccessToken({ prompt: 'consent' });
      } else {
        // 既存トークンがある場合は再認証なしでリクエスト
        this.tokenClient.requestAccessToken({ prompt: '' });
      }
    });
  }

  /**
   * 生徒名フォルダを検索または作成
   */
  async getOrCreateStudentFolder(studentName: string): Promise<{ folderId: string; isNew: boolean }> {
    if (!this.isSignedIn) {
      await this.authorize();
    }

    try {
      // 既存のフォルダを検索
      const searchResponse = await window.gapi.client.drive.files.list({
        q: `name = '${studentName}' and '${this.TARGET_FOLDER_ID}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
        fields: 'files(id, name)',
      });

      if (searchResponse.result.files && searchResponse.result.files.length > 0) {
        console.log('既存の生徒フォルダを発見:', searchResponse.result.files[0].name);
        return {
          folderId: searchResponse.result.files[0].id,
          isNew: false,
        };
      }

      // フォルダが存在しない場合は作成
      const createResponse = await window.gapi.client.drive.files.create({
        resource: {
          name: studentName,
          mimeType: 'application/vnd.google-apps.folder',
          parents: [this.TARGET_FOLDER_ID],
        },
        fields: 'id, name',
      });

      console.log('新しい生徒フォルダを作成:', createResponse.result.name);
      return {
        folderId: createResponse.result.id,
        isNew: true,
      };
    } catch (error) {
      console.error('生徒フォルダ作成/取得エラー:', error);
      throw error;
    }
  }

  /**
   * テキストファイルをGoogle Driveにアップロード
   */
  async uploadTextFile(
    fileName: string,
    content: string,
    folderId: string
  ): Promise<{ success: boolean; fileId: string; webViewLink: string }> {
    if (!this.isSignedIn) {
      await this.authorize();
    }

    const fileMetadata = {
      name: fileName,
      mimeType: 'text/plain',
      parents: [folderId],
    };

    const boundary = '-------314159265358979323846';
    const delimiter = '\r\n--' + boundary + '\r\n';
    const closeDelim = '\r\n--' + boundary + '--';

    const multipartRequestBody =
      delimiter +
      'Content-Type: application/json\r\n\r\n' +
      JSON.stringify(fileMetadata) +
      delimiter +
      'Content-Type: text/plain; charset=UTF-8\r\n\r\n' +
      content +
      closeDelim;

    try {
      const response = await window.gapi.client.request({
        path: '/upload/drive/v3/files',
        method: 'POST',
        params: { uploadType: 'multipart' },
        headers: {
          'Content-Type': 'multipart/related; boundary="' + boundary + '"',
        },
        body: multipartRequestBody,
      });

      console.log('Google Drive アップロード成功:', response.result);
      return {
        success: true,
        fileId: response.result.id,
        webViewLink: `https://drive.google.com/file/d/${response.result.id}/view`,
      };
    } catch (error) {
      console.error('Google Drive アップロードエラー:', error);
      throw error;
    }
  }

  /**
   * 分析結果を生徒フォルダに保存
   */
  async saveAnalysisToStudentFolder(
    studentName: string,
    analysis: {
      values?: string;
      talents?: string;
      passion?: string;
      final?: string;
    }
  ): Promise<{ success: boolean; message: string }> {
    try {
      // 生徒フォルダを取得または作成
      const folderInfo = await this.getOrCreateStudentFolder(studentName);

      // 分析結果をテキストファイルとして保存
      const timestamp = new Date().toISOString().split('T')[0];
      const fileName = `分析結果_${timestamp}.txt`;

      const analysisText = analysis.final || '';
      const mainAnalysis = analysisText.split('===画像プロンプト===')[0].replace('===分析===', '').trim();

      const content = `================================================================================
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
${mainAnalysis || '未実施'}

================================================================================
`;

      await this.uploadTextFile(fileName, content, folderInfo.folderId);

      return {
        success: true,
        message: `結果を「${studentName}」フォルダに保存しました`,
      };
    } catch (error) {
      console.error('Google Drive 保存エラー:', error);
      throw error;
    }
  }
}

// シングルトンインスタンス
export const googleDriveAPI = new GoogleDriveAPI();
