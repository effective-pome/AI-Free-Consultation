# AI診断システム セットアップガイド

## 目次
1. [Googleスプレッドシートの作成](#1-googleスプレッドシートの作成)
2. [Google Apps Scriptの設定](#2-google-apps-scriptの設定)
3. [app.jsの設定](#3-appjsの設定)
4. [スプレッドシートの設定シート](#4-スプレッドシートの設定シート)
5. [動作確認](#5-動作確認)

---

## 1. Googleスプレッドシートの作成

### 手順

1. [Google スプレッドシート](https://sheets.google.com) を開く
2. 「空白」をクリックして新規スプレッドシートを作成
3. 名前を「歯科医院AI診断データ」などに変更
4. **URLからスプレッドシートIDをコピー**

```
https://docs.google.com/spreadsheets/d/【ここがスプレッドシートID】/edit
```

例: `1ABC123xyz...` の部分

---

## 2. Google Apps Scriptの設定

### 手順

1. スプレッドシートのメニューから「拡張機能」→「Apps Script」を選択
2. デフォルトのコードを全て削除
3. `gas-code.js` の内容を全てコピー＆ペースト
4. **CONFIG部分を編集:**

```javascript
const CONFIG = {
  // ↓ ここにスプレッドシートIDを入力
  SPREADSHEET_ID: 'あなたのスプレッドシートID',

  // シート名（変更不要）
  SHEETS: {
    DIAGNOSIS: '診断データ',
    SUPPORT: 'サポート申込',
    SETTINGS: '設定'
  },

  // メール設定
  EMAIL: {
    FROM_NAME: '歯科医院地域一番実践会',
    ADMIN_EMAIL: 'admin@example.com'  // ← あなたの管理者メールに変更
  }
};
```

5. 保存（Ctrl+S または Cmd+S）

### 設定シートの初期化

1. Apps Scriptエディタで関数を選択:「initializeSettingsSheet」
2. 「実行」ボタンをクリック
3. 権限の承認を求められたら「許可」

### デプロイ

1. 右上の「デプロイ」→「新しいデプロイ」
2. 歯車アイコン → 「ウェブアプリ」を選択
3. 設定:
   - 説明: 「AI診断システム」
   - 実行ユーザー: 「自分」
   - アクセス権限: 「全員」
4. 「デプロイ」をクリック
5. **表示されたWebアプリのURLをコピー**

```
https://script.google.com/macros/s/AKfycb.../exec
```

---

## 3. app.jsの設定

`app.js` の20行目付近を編集:

```javascript
// 変更前
const GAS_WEBAPP_URL = 'YOUR_GAS_WEBAPP_URL_HERE';

// 変更後
const GAS_WEBAPP_URL = 'https://script.google.com/macros/s/AKfycb.../exec';
```

---

## 4. スプレッドシートの設定シート

スプレッドシートの「設定」シートを開き、B列に値を入力:

| A列（設定名） | B列（設定値） | 説明 |
|--------------|--------------|------|
| ccRecipients | email1@example.com,email2@example.com | CC送信先（カンマ区切り） |
| schedulingUrl | https://calendar.google.com/... | Googleカレンダー日程調整URL |
| adminEmail | admin@example.com | 管理者メール |

### Googleカレンダー日程調整URLの取得方法

1. [Google カレンダー](https://calendar.google.com) を開く
2. 左メニューの「予約スケジュール」をクリック
3. 「予約ページを作成」または既存のページを選択
4. 「共有」→「予約ページリンク」をコピー
5. 上記の `schedulingUrl` に貼り付け

---

## 5. 動作確認

### チェックリスト

- [ ] スプレッドシートIDをGASコードに設定
- [ ] `initializeSettingsSheet` を実行
- [ ] GASをデプロイ
- [ ] WebアプリURLを `app.js` に設定
- [ ] 設定シートに `ccRecipients` と `schedulingUrl` を入力

### テスト方法

1. 診断フォームを開く
2. 各項目を入力して診断を実行
3. スプレッドシートに「診断データ」シートが作成され、データが追加されることを確認
4. 「無料サポート」の送信ボタンをクリック
5. スプレッドシートに「サポート申込」シートが作成されることを確認
6. メールが送信されることを確認

---

## トラブルシューティング

### データが保存されない

1. GASのURLが正しいか確認
2. デプロイが「ウェブアプリ」として公開されているか確認
3. アクセス権限が「全員」になっているか確認

### メールが送信されない

1. GASの実行ログを確認（「実行数」メニュー）
2. MailAppの送信制限（1日100通）に達していないか確認
3. 送信先メールアドレスが正しいか確認

### 設定が読み込まれない

1. 設定シートの名前が「設定」になっているか確認
2. A列の設定名が正確か確認（大文字小文字注意）
3. GASを再デプロイ

---

## ファイル構成

```
AI-Free-Consultation/
├── index.html          # メインHTML
├── app.js              # メインJS（GAS_WEBAPP_URLを設定）
├── styles.css          # スタイルシート
├── knowledge-base.js   # 診断ロジック・データベース
├── gas-code.js         # GASにコピーするコード
└── SETUP_GUIDE.md      # このファイル
```

---

## 設定値一覧

| 項目 | ファイル | 行 | 設定内容 |
|-----|---------|----|---------|
| GAS WebアプリURL | app.js | 20行目 | `GAS_WEBAPP_URL` |
| スプレッドシートID | gas-code.js (GAS内) | 10行目 | `SPREADSHEET_ID` |
| 管理者メール | gas-code.js (GAS内) | 22行目 | `ADMIN_EMAIL` |
| CC送信先 | スプレッドシート | 設定シート | `ccRecipients` |
| 日程調整URL | スプレッドシート | 設定シート | `schedulingUrl` |
