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

  // BCC宛先をカンマ区切りで配列に変換
  if (settings.bccRecipients) {
    settings.bccRecipients = settings.bccRecipients.split(',').map(email => email.trim()).filter(email => email);
  } else {
    settings.bccRecipients = [];
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

// 診断結果メール送信（HTML形式）
function sendDiagnosisEmail(data) {
  const settings = getSettingsObject();
  const schedulingUrl = settings.schedulingUrl || '';

  const subject = '【AI診断結果】歯科医院経営診断レポート';

  // AI提案の内容を整形
  const recommendationsHtml = formatRecommendationsHtml(data.recommendations);

  // CTAボタンセクション
  var ctaSection = '';
  if (schedulingUrl) {
    ctaSection = '<tr><td style="padding: 10px 40px 40px;"><table width="100%" cellpadding="0" cellspacing="0" style="background: #fef3c7; border-radius: 12px; border: 1px solid #fcd34d;"><tr><td style="padding: 24px; text-align: center;"><p style="color: #92400e; font-size: 14px; margin: 0 0 16px 0;">経営コンサルタントによる30分の無料フォローをご提供</p><a href="' + schedulingUrl + '" style="display: inline-block; padding: 16px 40px; background: linear-gradient(135deg, #1485f7 0%, #d946ef 100%); color: #ffffff; font-size: 16px; font-weight: 600; text-decoration: none; border-radius: 50px; box-shadow: 0 4px 15px rgba(20, 133, 247, 0.4);">日程調整をする</a></td></tr></table></td></tr>';
  }

  var htmlBody = '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>';
  htmlBody += '<body style="margin: 0; padding: 0; font-family: Helvetica Neue, Arial, Hiragino Kaku Gothic ProN, Hiragino Sans, Meiryo, sans-serif; background-color: #f5f7fa;">';
  htmlBody += '<table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f7fa; padding: 40px 20px;"><tr><td align="center">';
  htmlBody += '<table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); overflow: hidden;">';

  // Header
  htmlBody += '<tr><td style="background: linear-gradient(135deg, #1485f7 0%, #d946ef 100%); padding: 40px 40px 30px; text-align: center;">';
  htmlBody += '<h1 style="color: #ffffff; font-size: 24px; margin: 0 0 8px 0; font-weight: 700;">AI診断結果レポート</h1>';
  htmlBody += '<p style="color: rgba(255,255,255,0.9); font-size: 14px; margin: 0;">歯科医院地域一番実践会</p>';
  htmlBody += '</td></tr>';

  // Greeting
  htmlBody += '<tr><td style="padding: 40px 40px 20px;">';
  htmlBody += '<p style="color: #333; font-size: 16px; line-height: 1.8; margin: 0;">';
  htmlBody += (data.userName || 'お客') + '様<br><br>';
  htmlBody += 'この度はAI診断をご利用いただき、誠にありがとうございます。<br>';
  htmlBody += '以下に診断結果をお送りいたします。</p></td></tr>';

  // Summary Card
  htmlBody += '<tr><td style="padding: 0 40px 30px;">';
  htmlBody += '<table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #f8fafc 0%, #eef9ff 100%); border-radius: 12px; border: 1px solid #e2e8f0;">';
  htmlBody += '<tr><td style="padding: 24px;">';
  htmlBody += '<h2 style="color: #1485f7; font-size: 16px; margin: 0 0 16px 0; font-weight: 600;">📊 診断結果サマリー</h2>';
  htmlBody += '<table width="100%" cellpadding="0" cellspacing="0">';
  htmlBody += '<tr><td style="padding: 8px 0; color: #64748b; font-size: 14px; border-bottom: 1px solid #e2e8f0;">医院名</td>';
  htmlBody += '<td style="padding: 8px 0; color: #334155; font-size: 14px; font-weight: 600; text-align: right; border-bottom: 1px solid #e2e8f0;">' + (data.clinicName || '未入力') + '</td></tr>';
  htmlBody += '<tr><td style="padding: 8px 0; color: #64748b; font-size: 14px; border-bottom: 1px solid #e2e8f0;">月間新患数</td>';
  htmlBody += '<td style="padding: 8px 0; color: #334155; font-size: 14px; font-weight: 600; text-align: right; border-bottom: 1px solid #e2e8f0;">' + (data.newPatient || '未入力') + '人</td></tr>';
  htmlBody += '<tr><td style="padding: 8px 0; color: #64748b; font-size: 14px; border-bottom: 1px solid #e2e8f0;">月間医業収入</td>';
  htmlBody += '<td style="padding: 8px 0; color: #334155; font-size: 14px; font-weight: 600; text-align: right; border-bottom: 1px solid #e2e8f0;">' + (data.totalRevenue || '未入力') + '万円</td></tr>';
  htmlBody += '<tr><td style="padding: 8px 0; color: #64748b; font-size: 14px; border-bottom: 1px solid #e2e8f0;">自費率</td>';
  htmlBody += '<td style="padding: 8px 0; color: #334155; font-size: 14px; font-weight: 600; text-align: right; border-bottom: 1px solid #e2e8f0;">' + (data.selfPayRate || '未入力') + '%</td></tr>';
  htmlBody += '<tr><td style="padding: 8px 0; color: #64748b; font-size: 14px; border-bottom: 1px solid #e2e8f0;">キャンセル率</td>';
  htmlBody += '<td style="padding: 8px 0; color: #334155; font-size: 14px; font-weight: 600; text-align: right; border-bottom: 1px solid #e2e8f0;">' + (data.cancel || '未入力') + '%</td></tr>';
  htmlBody += '<tr><td style="padding: 8px 0; color: #64748b; font-size: 14px;">リコール率</td>';
  htmlBody += '<td style="padding: 8px 0; color: #334155; font-size: 14px; font-weight: 600; text-align: right;">' + (data.recall || '未入力') + '%</td></tr>';
  htmlBody += '</table>';
  htmlBody += '<div style="margin-top: 16px; padding: 12px 16px; background: linear-gradient(135deg, #1485f7 0%, #d946ef 100%); border-radius: 8px;">';
  htmlBody += '<span style="color: rgba(255,255,255,0.8); font-size: 12px;">優先課題</span>';
  htmlBody += '<p style="color: #ffffff; font-size: 16px; font-weight: 600; margin: 4px 0 0 0;">' + getPriorityLabel(data.priority) + '</p>';
  htmlBody += '</div></td></tr></table></td></tr>';

  // AI Recommendations
  htmlBody += recommendationsHtml;

  // CTA Button
  htmlBody += ctaSection;

  // Footer
  htmlBody += '<tr><td style="background: #f8fafc; padding: 30px 40px; border-top: 1px solid #e2e8f0;">';
  htmlBody += '<p style="color: #64748b; font-size: 13px; line-height: 1.8; margin: 0; text-align: center;">';
  htmlBody += 'ご不明点がございましたら、お気軽にお問い合わせください。<br><br>';
  htmlBody += '<strong style="color: #334155;">歯科医院地域一番実践会</strong><br>TEL: 045-440-0322</p>';
  htmlBody += '</td></tr></table></td></tr></table></body></html>';

  // プレーンテキスト版（HTMLが表示できない環境用）
  var plainBody = (data.userName || 'お客') + '様\n\n';
  plainBody += '歯科医院地域一番実践会のAI診断をご利用いただき、ありがとうございます。\n\n';
  plainBody += '■ 診断結果サマリー\n';
  plainBody += '医院名: ' + (data.clinicName || '未入力') + '\n';
  plainBody += '月間新患数: ' + (data.newPatient || '未入力') + '人\n';
  plainBody += '月間医業収入: ' + (data.totalRevenue || '未入力') + '万円\n';
  plainBody += '自費率: ' + (data.selfPayRate || '未入力') + '%\n';
  plainBody += 'キャンセル率: ' + (data.cancel || '未入力') + '%\n';
  plainBody += 'リコール率: ' + (data.recall || '未入力') + '%\n';
  plainBody += '優先課題: ' + getPriorityLabel(data.priority) + '\n\n';
  if (schedulingUrl) {
    plainBody += '■ 無料サポート\n日程調整はこちら: ' + schedulingUrl + '\n\n';
  }
  plainBody += '歯科医院地域一番実践会\nTEL: 045-440-0322';

  // 送信先リスト
  const recipients = [data.userEmail];

  // BCC送信
  const bccList = settings.bccRecipients || [];

  try {
    MailApp.sendEmail({
      to: recipients.join(','),
      bcc: bccList.join(','),
      subject: subject,
      body: plainBody,
      htmlBody: htmlBody,
      name: CONFIG.EMAIL.FROM_NAME
    });
  } catch (error) {
    console.error('メール送信エラー:', error);
  }
}

// 日程調整メール送信（HTML形式）
function sendSchedulingEmail(data) {
  const settings = getSettingsObject();
  const schedulingUrl = settings.schedulingUrl || '';

  const subject = '【無料サポート】日程調整のご案内';

  // AI提案の内容を整形
  const recommendationsHtml = formatRecommendationsHtml(data.recommendations);

  // CTAボタンセクション
  var ctaButtonHtml = '';
  if (schedulingUrl) {
    ctaButtonHtml = '<a href="' + schedulingUrl + '" style="display: inline-block; padding: 18px 48px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; font-size: 18px; font-weight: 700; text-decoration: none; border-radius: 50px; box-shadow: 0 4px 15px rgba(16, 185, 129, 0.4);">日程調整をする</a>';
  } else {
    ctaButtonHtml = '<p style="color: #047857; font-size: 14px; margin: 0;">担当者より改めてご連絡いたします。</p>';
  }

  var htmlBody = '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>';
  htmlBody += '<body style="margin: 0; padding: 0; font-family: Helvetica Neue, Arial, Hiragino Kaku Gothic ProN, Hiragino Sans, Meiryo, sans-serif; background-color: #f5f7fa;">';
  htmlBody += '<table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f7fa; padding: 40px 20px;"><tr><td align="center">';
  htmlBody += '<table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); overflow: hidden;">';

  // Header
  htmlBody += '<tr><td style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 40px 40px 30px; text-align: center;">';
  htmlBody += '<h1 style="color: #ffffff; font-size: 24px; margin: 0 0 8px 0; font-weight: 700;">無料サポートのご案内</h1>';
  htmlBody += '<p style="color: rgba(255,255,255,0.9); font-size: 14px; margin: 0;">歯科医院地域一番実践会</p>';
  htmlBody += '</td></tr>';

  // Greeting
  htmlBody += '<tr><td style="padding: 40px 40px 20px;">';
  htmlBody += '<p style="color: #333; font-size: 16px; line-height: 1.8; margin: 0;">';
  htmlBody += (data.userName || 'お客') + '様<br><br>';
  htmlBody += '無料サポートにお申し込みいただき、誠にありがとうございます。<br>';
  htmlBody += '経営コンサルタントによる<strong>30分の無料フォロー</strong>をご提供いたします。</p></td></tr>';

  // CTA Button
  htmlBody += '<tr><td style="padding: 0 40px 30px;">';
  htmlBody += '<table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%); border-radius: 12px; border: 1px solid #10b981;">';
  htmlBody += '<tr><td style="padding: 30px; text-align: center;">';
  htmlBody += '<p style="color: #065f46; font-size: 16px; font-weight: 600; margin: 0 0 8px 0;">📅 日程調整</p>';
  htmlBody += '<p style="color: #047857; font-size: 14px; margin: 0 0 20px 0;">下記ボタンより、ご都合の良い日時をお選びください</p>';
  htmlBody += ctaButtonHtml;
  htmlBody += '</td></tr></table></td></tr>';

  // Support Content
  htmlBody += '<tr><td style="padding: 0 40px 30px;">';
  htmlBody += '<table width="100%" cellpadding="0" cellspacing="0" style="background: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0;">';
  htmlBody += '<tr><td style="padding: 24px;">';
  htmlBody += '<h2 style="color: #334155; font-size: 16px; margin: 0 0 16px 0; font-weight: 600;">🎯 無料サポートの内容</h2>';
  htmlBody += '<ul style="color: #475569; font-size: 14px; line-height: 2; margin: 0; padding-left: 20px;">';
  htmlBody += '<li>AI診断結果の詳細解説</li>';
  htmlBody += '<li>貴院の課題に対する具体的なアドバイス</li>';
  htmlBody += '<li>質疑応答</li>';
  htmlBody += '</ul></td></tr></table></td></tr>';

  // AI Recommendations
  htmlBody += recommendationsHtml;

  // Footer
  htmlBody += '<tr><td style="background: #f8fafc; padding: 30px 40px; border-top: 1px solid #e2e8f0;">';
  htmlBody += '<p style="color: #64748b; font-size: 13px; line-height: 1.8; margin: 0; text-align: center;">';
  htmlBody += 'ご不明点がございましたら、お気軽にお問い合わせください。<br><br>';
  htmlBody += '<strong style="color: #334155;">歯科医院地域一番実践会</strong><br>TEL: 045-440-0322</p>';
  htmlBody += '</td></tr></table></td></tr></table></body></html>';

  // プレーンテキスト版
  var plainBody = (data.userName || 'お客') + '様\n\n';
  plainBody += '無料サポートにお申し込みいただき、誠にありがとうございます。\n';
  plainBody += '経営コンサルタントによる30分の無料フォローをご提供いたします。\n\n';
  plainBody += '■ 日程調整\n';
  if (schedulingUrl) {
    plainBody += '下記URLより、ご都合の良い日時をお選びください。\n' + schedulingUrl + '\n\n';
  } else {
    plainBody += '担当者より改めてご連絡いたします。\n\n';
  }
  plainBody += '■ 無料サポートの内容\n';
  plainBody += '・AI診断結果の詳細解説\n';
  plainBody += '・貴院の課題に対する具体的なアドバイス\n';
  plainBody += '・質疑応答\n\n';
  plainBody += '歯科医院地域一番実践会\nTEL: 045-440-0322';

  // BCC送信
  const bccList = settings.bccRecipients || [];

  try {
    MailApp.sendEmail({
      to: data.userEmail,
      bcc: bccList.join(','),
      subject: subject,
      body: plainBody,
      htmlBody: htmlBody,
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
  const bccList = settings.bccRecipients || [];

  try {
    MailApp.sendEmail({
      to: adminRecipients.concat(bccList).join(','),
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
    return { bccRecipients: [], schedulingUrl: '' };
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

  // BCC宛先を配列に変換
  if (settings.bccRecipients) {
    settings.bccRecipients = settings.bccRecipients.split(',').map(email => email.trim()).filter(email => email);
  } else {
    settings.bccRecipients = [];
  }

  return settings;
}

// AI提案をHTML形式に整形
function formatRecommendationsHtml(recommendations) {
  if (!recommendations || !recommendations.recommendations) {
    return '';
  }

  var recs = recommendations.recommendations;
  var itemsHtml = '';

  // アクション項目を文字列に変換するヘルパー関数
  function actionToString(action) {
    if (typeof action === 'string') {
      return action;
    } else if (action && typeof action === 'object') {
      // オブジェクトの場合、text, title, name, description の順で探す
      return action.text || action.title || action.name || action.description || action.action || JSON.stringify(action);
    }
    return String(action);
  }

  if (Array.isArray(recs)) {
    // API生成の場合
    for (var i = 0; i < recs.length; i++) {
      var rec = recs[i];
      itemsHtml += '<div style="margin-bottom: 20px; padding: 20px; background: #ffffff; border-radius: 8px; border-left: 4px solid #1485f7;">';
      itemsHtml += '<h4 style="color: #1485f7; font-size: 15px; margin: 0 0 12px 0; font-weight: 600;">' + (i + 1) + '. ' + (rec.title || rec.name || '提案') + '</h4>';
      itemsHtml += '<p style="color: #475569; font-size: 14px; line-height: 1.7; margin: 0 0 12px 0;">' + (rec.description || rec.summary || '') + '</p>';
      if (rec.actions && rec.actions.length > 0) {
        itemsHtml += '<div style="background: #f1f5f9; border-radius: 6px; padding: 12px 16px;">';
        itemsHtml += '<p style="color: #64748b; font-size: 12px; margin: 0 0 8px 0; font-weight: 600;">📋 今週からできること:</p>';
        itemsHtml += '<ul style="color: #475569; font-size: 13px; line-height: 1.8; margin: 0; padding-left: 16px;">';
        for (var j = 0; j < rec.actions.length; j++) {
          itemsHtml += '<li>' + actionToString(rec.actions[j]) + '</li>';
        }
        itemsHtml += '</ul></div>';
      }
      itemsHtml += '</div>';
    }
  } else if (recs.items && Array.isArray(recs.items)) {
    // ローカル生成の場合（オブジェクト形式）
    for (var i = 0; i < recs.items.length; i++) {
      var item = recs.items[i];
      itemsHtml += '<div style="margin-bottom: 20px; padding: 20px; background: #ffffff; border-radius: 8px; border-left: 4px solid #1485f7;">';
      itemsHtml += '<h4 style="color: #1485f7; font-size: 15px; margin: 0 0 12px 0; font-weight: 600;">' + (i + 1) + '. ' + (item.title || '提案') + '</h4>';
      itemsHtml += '<p style="color: #475569; font-size: 14px; line-height: 1.7; margin: 0 0 12px 0;">' + (item.description || '') + '</p>';
      if (item.detailedActions && item.detailedActions.length > 0) {
        itemsHtml += '<div style="background: #f1f5f9; border-radius: 6px; padding: 12px 16px;">';
        itemsHtml += '<p style="color: #64748b; font-size: 12px; margin: 0 0 8px 0; font-weight: 600;">📋 今週からできること:</p>';
        itemsHtml += '<ul style="color: #475569; font-size: 13px; line-height: 1.8; margin: 0; padding-left: 16px;">';
        // detailedActionsはカテゴリオブジェクトの配列: [{category: string, actions: string[]}, ...]
        // 「今週からすぐできること」カテゴリを探すか、最初のカテゴリのactionsを使用
        var weeklyActions = [];
        for (var k = 0; k < item.detailedActions.length; k++) {
          var category = item.detailedActions[k];
          if (category && category.category && category.category.indexOf('今週') !== -1) {
            weeklyActions = category.actions || [];
            break;
          }
        }
        // 見つからなければ最後のカテゴリ（通常「今週からすぐできること」）を使用
        if (weeklyActions.length === 0 && item.detailedActions.length > 0) {
          var lastCategory = item.detailedActions[item.detailedActions.length - 1];
          weeklyActions = (lastCategory && lastCategory.actions) ? lastCategory.actions : [];
        }
        var actionsToShow = weeklyActions.slice(0, 3);
        for (var j = 0; j < actionsToShow.length; j++) {
          itemsHtml += '<li>' + actionToString(actionsToShow[j]) + '</li>';
        }
        itemsHtml += '</ul></div>';
      }
      itemsHtml += '</div>';
    }
  }

  if (!itemsHtml) {
    return '';
  }

  var result = '<tr><td style="padding: 0 40px 30px;">';
  result += '<table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #f8fafc 0%, #eef9ff 100%); border-radius: 12px; border: 1px solid #e2e8f0;">';
  result += '<tr><td style="padding: 24px;">';
  result += '<h2 style="color: #1485f7; font-size: 16px; margin: 0 0 20px 0; font-weight: 600;">💡 AIによる改善提案</h2>';
  result += itemsHtml;
  result += '</td></tr></table></td></tr>';
  return result;
}

// 優先課題のラベルを取得
function getPriorityLabel(priority) {
  const labels = {
    newPatient: '新患を増やしたい',
    selfPay: '自費率を上げたい',
    cancel: 'キャンセルを減らしたい',
    staffRetention: 'スタッフの定着',
    staffRecruitment: 'スタッフの採用',
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
  sheet.appendRow(['bccRecipients', '', 'BCC送信先（カンマ区切りで複数指定可）']);
  sheet.appendRow(['schedulingUrl', '', 'Googleカレンダー日程調整URL']);
  sheet.appendRow(['adminEmail', '', '管理者メールアドレス']);

  // 列幅を調整
  sheet.setColumnWidth(1, 150);
  sheet.setColumnWidth(2, 400);
  sheet.setColumnWidth(3, 300);

  console.log('設定シートを初期化しました');
}
