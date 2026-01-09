/**
 * 歯科医院AI診断 - Google Apps Script
 * このコードをGoogle Apps Scriptにコピーして使用してください
 */

// ========================================
// 設定
// ========================================
const CONFIG = {
  // スプレッドシートID（URLから取得）
  SPREADSHEET_ID: 'YOUR_SPREADSHEET_ID_HERE',

  // シート名
  SHEETS: {
    DIAGNOSIS: '診断データ',      // 診断結果を保存
    SUPPORT: 'サポート申込',      // 無料サポート申込を保存
    SETTINGS: '設定'              // 各種設定
  },

  // メール設定
  EMAIL: {
    FROM_NAME: '歯科医院地域一番実践会',
    ADMIN_EMAIL: 'admin@example.com'  // 管理者メールアドレス
  }
};

// ========================================
// Webアプリのエントリーポイント
// ========================================

// GETリクエスト処理
function doGet(e) {
  const action = e.parameter.action;

  try {
    switch (action) {
      case 'getSettings':
        return getSettings();
      default:
        return createJsonResponse({ error: 'Unknown action' });
    }
  } catch (error) {
    return createJsonResponse({ error: error.message });
  }
}

// POSTリクエスト処理
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;

    switch (action) {
      case 'saveDiagnosis':
        return saveDiagnosis(data);
      case 'supportRequest':
        return handleSupportRequest(data);
      default:
        return createJsonResponse({ error: 'Unknown action' });
    }
  } catch (error) {
    console.error('doPost error:', error);
    return createJsonResponse({ error: error.message });
  }
}

// ========================================
// 設定取得
// ========================================
function getSettings() {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const settingsSheet = ss.getSheetByName(CONFIG.SHEETS.SETTINGS);

  if (!settingsSheet) {
    return createJsonResponse({ error: 'Settings sheet not found' });
  }

  // 設定シートから値を取得
  // A列: 設定名, B列: 設定値
  const data = settingsSheet.getDataRange().getValues();
  const settings = {};

  for (let i = 1; i < data.length; i++) { // ヘッダー行をスキップ
    const key = data[i][0];
    const value = data[i][1];
    if (key) {
      settings[key] = value;
    }
  }

  // CC宛先をカンマ区切りで配列に変換
  if (settings.ccRecipients) {
    settings.ccRecipients = settings.ccRecipients.split(',').map(email => email.trim()).filter(email => email);
  } else {
    settings.ccRecipients = [];
  }

  return createJsonResponse(settings);
}

// ========================================
// 診断データ保存
// ========================================
function saveDiagnosis(data) {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  let sheet = ss.getSheetByName(CONFIG.SHEETS.DIAGNOSIS);

  // シートがなければ作成
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEETS.DIAGNOSIS);
    // ヘッダー行を追加
    sheet.appendRow([
      'タイムスタンプ',
      'お名前',
      'メールアドレス',
      '医院名',
      '地域',
      '開業年数',
      'ユニット数',
      '新患数',
      '月間医業収入',
      '自費率',
      'キャンセル率',
      'リコール率',
      '優先課題',
      'その他お悩み'
    ]);
  }

  // データを追加
  sheet.appendRow([
    new Date(),
    data.userName || '',
    data.userEmail || '',
    data.clinicName || '',
    data.region || '',
    data.yearsOpen || '',
    data.units || '',
    data.newPatient || '',
    data.totalRevenue || '',
    data.selfPayRate || '',
    data.cancel || '',
    data.recall || '',
    data.priority || '',
    data.otherConcerns || ''
  ]);

  // メール送信
  sendDiagnosisEmail(data);

  return createJsonResponse({ success: true });
}

// ========================================
// 無料サポート申込処理
// ========================================
function handleSupportRequest(data) {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  let sheet = ss.getSheetByName(CONFIG.SHEETS.SUPPORT);

  // シートがなければ作成
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEETS.SUPPORT);
    sheet.appendRow([
      'タイムスタンプ',
      'お名前',
      'メールアドレス',
      '医院名',
      'ステータス'
    ]);
  }

  // データを追加
  sheet.appendRow([
    new Date(),
    data.userName || '',
    data.userEmail || '',
    data.clinicName || '',
    '未対応'
  ]);

  // 日程調整メールを送信
  sendSchedulingEmail(data);

  // 管理者に通知
  sendAdminNotification(data);

  return createJsonResponse({ success: true });
}

// ========================================
// メール送信機能
// ========================================

// 診断結果メール送信
function sendDiagnosisEmail(data) {
  const settings = getSettingsObject();

  const subject = '【AI診断結果】歯科医院経営診断レポート';

  const body = `
${data.userName || 'お客'}様

歯科医院地域一番実践会のAI診断をご利用いただき、ありがとうございます。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
■ 診断結果サマリー
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
医院名: ${data.clinicName || '未入力'}
月間新患数: ${data.newPatient || '未入力'}人
月間医業収入: ${data.totalRevenue || '未入力'}万円
自費率: ${data.selfPayRate || '未入力'}%
キャンセル率: ${data.cancel || '未入力'}%
リコール率: ${data.recall || '未入力'}%

優先課題: ${getPriorityLabel(data.priority)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

詳細な診断結果と改善提案は、診断ページでご確認いただけます。

ご不明点がございましたら、お気軽にお問い合わせください。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
歯科医院地域一番実践会
TEL: 045-440-0322
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;

  // 送信先リスト
  const recipients = [data.userEmail];

  // CC送信
  const ccList = settings.ccRecipients || [];

  try {
    MailApp.sendEmail({
      to: recipients.join(','),
      cc: ccList.join(','),
      subject: subject,
      body: body,
      name: CONFIG.EMAIL.FROM_NAME
    });
  } catch (error) {
    console.error('メール送信エラー:', error);
  }
}

// 日程調整メール送信
function sendSchedulingEmail(data) {
  const settings = getSettingsObject();
  const schedulingUrl = settings.schedulingUrl || '';

  const subject = '【無料サポート】日程調整のご案内';

  const body = `
${data.userName || 'お客'}様

歯科医院地域一番実践会の無料サポートにお申し込みいただき、誠にありがとうございます。

経営コンサルタントによる30分の無料フォローをご提供いたします。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
■ 日程調整
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

下記URLより、ご都合の良い日時をお選びください。

${schedulingUrl ? `▼ 日程を選択する\n${schedulingUrl}` : '担当者より改めてご連絡いたします。'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

■ 無料サポートの内容
・AI診断結果の詳細解説
・貴院の課題に対する具体的なアドバイス
・質疑応答

ご不明点がございましたら、お気軽にお問い合わせください。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
歯科医院地域一番実践会
TEL: 045-440-0322
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;

  // CC送信
  const ccList = settings.ccRecipients || [];

  try {
    MailApp.sendEmail({
      to: data.userEmail,
      cc: ccList.join(','),
      subject: subject,
      body: body,
      name: CONFIG.EMAIL.FROM_NAME
    });
  } catch (error) {
    console.error('日程調整メール送信エラー:', error);
  }
}

// 管理者通知メール
function sendAdminNotification(data) {
  const settings = getSettingsObject();

  const subject = '【新規申込】無料サポート申込がありました';

  const body = `
新規の無料サポート申込がありました。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
■ 申込者情報
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
お名前: ${data.userName || '未入力'}
メールアドレス: ${data.userEmail || '未入力'}
医院名: ${data.clinicName || '未入力'}
申込日時: ${new Date().toLocaleString('ja-JP')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

スプレッドシートで詳細をご確認ください。
`;

  // 管理者と追加の通知先にメール送信
  const adminRecipients = [CONFIG.EMAIL.ADMIN_EMAIL];
  const ccList = settings.ccRecipients || [];

  try {
    MailApp.sendEmail({
      to: adminRecipients.concat(ccList).join(','),
      subject: subject,
      body: body,
      name: CONFIG.EMAIL.FROM_NAME
    });
  } catch (error) {
    console.error('管理者通知エラー:', error);
  }
}

// ========================================
// ユーティリティ関数
// ========================================

// JSON形式のレスポンスを作成
function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// 設定をオブジェクトとして取得（内部用）
function getSettingsObject() {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const settingsSheet = ss.getSheetByName(CONFIG.SHEETS.SETTINGS);

  if (!settingsSheet) {
    return { ccRecipients: [], schedulingUrl: '' };
  }

  const data = settingsSheet.getDataRange().getValues();
  const settings = {};

  for (let i = 1; i < data.length; i++) {
    const key = data[i][0];
    const value = data[i][1];
    if (key) {
      settings[key] = value;
    }
  }

  // CC宛先を配列に変換
  if (settings.ccRecipients) {
    settings.ccRecipients = settings.ccRecipients.split(',').map(email => email.trim()).filter(email => email);
  } else {
    settings.ccRecipients = [];
  }

  return settings;
}

// 優先課題のラベルを取得
function getPriorityLabel(priority) {
  const labels = {
    newPatient: '新患を増やしたい',
    selfPay: '自費率を上げたい',
    cancel: 'キャンセルを減らしたい',
    staff: 'スタッフの定着・採用',
    efficiency: '業務を効率化したい'
  };
  return labels[priority] || priority || '未選択';
}

// ========================================
// 初期セットアップ用関数
// ========================================

// 設定シートを初期化（1回だけ実行）
function initializeSettingsSheet() {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  let sheet = ss.getSheetByName(CONFIG.SHEETS.SETTINGS);

  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEETS.SETTINGS);
  }

  // ヘッダーと初期データを設定
  sheet.clear();
  sheet.appendRow(['設定名', '設定値', '説明']);
  sheet.appendRow(['ccRecipients', '', 'CC送信先（カンマ区切りで複数指定可）']);
  sheet.appendRow(['schedulingUrl', '', 'Googleカレンダー日程調整URL']);
  sheet.appendRow(['adminEmail', '', '管理者メールアドレス']);

  // 列幅を調整
  sheet.setColumnWidth(1, 150);
  sheet.setColumnWidth(2, 400);
  sheet.setColumnWidth(3, 300);

  console.log('設定シートを初期化しました');
}
