# Google Apps Script セットアップガイド

歯科医院AI診断システムのGAS（Google Apps Script）設定手順です。

## 概要

このシステムは以下の機能を提供します：

1. **スプレッドシート一覧管理** - 診断データを自動でスプレッドシートに保存
2. **PDFアドバイスシート生成** - 診断結果と具体策をPDF化
3. **自動メール送信** - 指定のメールアドレスからPDF添付でメール送信

## セットアップ手順

### ステップ1: Googleスプレッドシートを作成

1. [Google スプレッドシート](https://sheets.google.com) を開く
2. 「空白」をクリックして新規作成
3. 名前を「AI診断データ」などに変更
4. URLからスプレッドシートIDをコピー
   - URL例: `https://docs.google.com/spreadsheets/d/XXXXXXXXXXXXX/edit`
   - `XXXXXXXXXXXXX` の部分がスプレッドシートID

### ステップ2: Google Driveフォルダを作成（PDF保存用）

1. [Google ドライブ](https://drive.google.com) を開く
2. 「新規」→「フォルダ」をクリック
3. 「AI診断PDF」などの名前でフォルダを作成
4. 作成したフォルダを開く
5. URLからフォルダIDをコピー
   - URL例: `https://drive.google.com/drive/folders/YYYYYYYYYYYY`
   - `YYYYYYYYYYYY` の部分がフォルダID

### ステップ3: Google Apps Scriptプロジェクトを作成

1. [Google Apps Script](https://script.google.com) を開く
2. 「新しいプロジェクト」をクリック
3. プロジェクト名を「AI診断システム」に変更

### ステップ4: コードをコピー

以下の3つのファイルを作成してください：

#### 4-1. Code.gs（メインスクリプト）

1. デフォルトの `Code.gs` を開く
2. `gas/Code.gs` の内容をすべてコピー＆ペースト
3. **設定を更新**:
   ```javascript
   const CONFIG = {
     SPREADSHEET_ID: 'ステップ1でコピーしたID',
     SHEET_NAME: '診断データ一覧',
     SENDER_NAME: '歯科医院地域一番実践会',
     ADMIN_EMAIL: 'あなたのメールアドレス',
     PDF_FOLDER_ID: 'ステップ2でコピーしたID'
   };
   ```

#### 4-2. PDFTemplate.html

1. 「ファイル」→「+」→「HTML」をクリック
2. ファイル名を `PDFTemplate` に設定
3. `gas/PDFTemplate.html` の内容をコピー＆ペースト

#### 4-3. EmailTemplate.html

1. 「ファイル」→「+」→「HTML」をクリック
2. ファイル名を `EmailTemplate` に設定
3. `gas/EmailTemplate.html` の内容をコピー＆ペースト

### ステップ5: Webアプリとしてデプロイ

1. 「デプロイ」→「新しいデプロイ」をクリック
2. 「種類の選択」で「ウェブアプリ」を選択
3. 設定:
   - **説明**: 「AI診断API」
   - **次のユーザーとして実行**: 「自分」
   - **アクセスできるユーザー**: 「全員」
4. 「デプロイ」をクリック
5. 初回はアクセス許可を求められるので「許可」
6. 表示されるウェブアプリのURLをコピー
   - URL例: `https://script.google.com/macros/s/ZZZZZZZZZZZ/exec`

### ステップ6: フロントエンドに連携

フロントエンドの `app.js` に以下を追加:

```javascript
// GAS WebアプリのURL
const GAS_WEBAPP_URL = 'ステップ5でコピーしたURL';

// 診断結果をGASに送信する関数
async function sendToGAS(formData, recommendations) {
  const payload = {
    ...formData,
    recommendations: recommendations,
    timestamp: new Date().toISOString()
  };

  try {
    const response = await fetch(GAS_WEBAPP_URL, {
      method: 'POST',
      mode: 'no-cors', // CORSを回避
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    console.log('GAS送信完了');
    return { success: true };
  } catch (error) {
    console.error('GAS送信エラー:', error);
    return { success: false, error: error.message };
  }
}

// 診断完了時に呼び出し
// submitForm関数内で呼び出す
// await sendToGAS(AppState.formData, recommendations);
```

## 指定のメールアドレスから送信する方法

GASはデフォルトでスクリプト実行者のGmailアドレスから送信されます。
別のアドレスから送信するには、以下の方法があります：

### 方法1: Gmailエイリアスを使用（推奨）

1. Gmailを開く → 設定 → 「アカウントとインポート」
2. 「他のメールアドレスを追加」をクリック
3. 送信元として使用したいアドレスを追加
4. 確認メールが届くので認証
5. `Code.gs` で以下のように設定:

```javascript
GmailApp.sendEmail(data.userEmail, subject, plainBody, {
  name: CONFIG.SENDER_NAME,
  from: 'your-alias@example.com', // エイリアスアドレス
  htmlBody: htmlBody,
  attachments: [pdfBlob]
});
```

### 方法2: Google Workspaceのグループアドレスを使用

1. Google Admin → グループ → 新規グループ作成
2. グループメールアドレスを設定（例: info@your-domain.com）
3. GASを実行するアカウントをグループに追加
4. 上記と同様に `from` パラメータを設定

## テスト実行

1. GASエディタで `testProcessDiagnosis` 関数を選択
2. 「実行」ボタンをクリック
3. ログを確認して正常動作を確認

## トラブルシューティング

### 「権限がありません」エラー

- スプレッドシートIDが正しいか確認
- GASの実行ユーザーがスプレッドシートにアクセスできるか確認

### メールが送信されない

- Gmail APIが有効になっているか確認
- 管理者メールアドレスが正しいか確認
- GmailのAPI呼び出し制限に達していないか確認

### PDFが生成されない

- Google DriveのAPI権限を確認
- フォルダIDが正しいか確認

## データフロー図

```
[フロントエンド]
      ↓ POST (JSON)
[GAS WebApp - doPost()]
      ↓
[saveToSpreadsheet()] → [スプレッドシート一覧]
      ↓
[generatePDFAdviceSheet()] → [PDF生成]
      ↓
[savePDFToDrive()] → [Google Drive保存]
      ↓
[sendEmailToUser()] → [ユーザーへメール送信（PDF添付）]
      ↓
[sendAdminNotification()] → [管理者へ通知]
```

## ファイル構成

```
gas/
├── Code.gs           # メインスクリプト
├── PDFTemplate.html  # PDFアドバイスシートテンプレート
├── EmailTemplate.html # メールテンプレート
└── SETUP.md          # このセットアップガイド
```

## セキュリティ考慮事項

- スプレッドシートは適切なユーザーのみにアクセス権限を設定
- GAS WebAppは必要最小限のアクセス権限で実行
- 個人情報を含むデータの取り扱いに注意
- 定期的にアクセスログを確認
