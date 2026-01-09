/**
 * 歯科医院AI診断 - Google Apps Script
 *
 * 機能:
 * 1. 診断データをスプレッドシートに一覧保存
 * 2. PDFアドバイスシートを自動生成
 * 3. 指定メールアドレスから結果を送信
 *
 * 【セットアップ手順】
 * 1. Google Apps Scriptで新しいプロジェクトを作成
 * 2. このコードをコピー&ペースト
 * 3. CONFIG内の設定値を更新
 * 4. 「デプロイ」→「新しいデプロイ」→「ウェブアプリ」として公開
 * 5. アクセス権限を「全員」に設定
 */

// ========================================
// 設定
// ========================================
const CONFIG = {
  // スプレッドシートID（URLから取得）
  // 例: https://docs.google.com/spreadsheets/d/XXXXX/edit の XXXXX 部分
  SPREADSHEET_ID: 'YOUR_SPREADSHEET_ID_HERE',

  // データを保存するシート名
  SHEET_NAME: '診断データ一覧',

  // 設定シート名（日程調整URLなどを管理）
  SETTINGS_SHEET_NAME: '設定',

  // 送信元メールアドレス（Gmailエイリアスまたはグループアドレス）
  // ※ GASはデフォルトで実行者のGmailから送信されます
  // ※ 別のアドレスから送信する場合はGmailエイリアスを設定してください
  SENDER_NAME: '歯科医院地域一番実践会',

  // 管理者通知用メールアドレス（新規診断時に通知）
  ADMIN_EMAIL: 'admin@example.com',

  // CC送信先メールアドレス（入力情報を共有する2名）
  CC_EMAILS: [
    'staff1@example.com',
    'staff2@example.com'
  ],

  // PDFファイル保存先フォルダID（Google Drive）
  PDF_FOLDER_ID: 'YOUR_FOLDER_ID_HERE',

  // デフォルトの日程調整URL（設定シートで上書き可能）
  DEFAULT_SCHEDULING_URL: 'https://calendar.google.com/calendar/appointments/schedules/YOUR_SCHEDULE_ID'
};

// ========================================
// Webアプリのエンドポイント
// ========================================

/**
 * POSTリクエストを処理
 * フロントエンドからの診断データを受け取る
 */
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const result = processDiagnosisData(data);

    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    console.error('Error in doPost:', error);
    return ContentService
      .createTextOutput(JSON.stringify({
        success: false,
        error: error.message
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * GETリクエストを処理（テスト用）
 */
function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({
      status: 'OK',
      message: '歯科医院AI診断APIが稼働中です'
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ========================================
// メイン処理
// ========================================

/**
 * 診断データを処理
 * @param {Object} data - 診断フォームデータ
 * @returns {Object} 処理結果
 */
function processDiagnosisData(data) {
  // 1. スプレッドシートに保存
  const rowNumber = saveToSpreadsheet(data);

  // 2. ユーザーにメール送信（診断結果をメール本文に記載）
  sendEmailToUser(data);

  // 3. 管理者に通知
  sendAdminNotification(data, rowNumber);

  // 4. CCメールアドレスにも送信
  sendCCNotification(data);

  return {
    success: true,
    message: '診断結果をメールで送信しました',
    rowNumber: rowNumber
  };
}

// ========================================
// スプレッドシート操作
// ========================================

/**
 * データをスプレッドシートに保存（一覧化）
 * @param {Object} data - 診断データ
 * @returns {number} 保存した行番号
 */
function saveToSpreadsheet(data) {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  let sheet = ss.getSheetByName(CONFIG.SHEET_NAME);

  // シートが存在しない場合は作成
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEET_NAME);
    createHeaderRow(sheet);
  }

  // データ行を追加
  const timestamp = new Date();
  const diagnosisId = generateDiagnosisId();

  const rowData = [
    diagnosisId,                          // 診断ID
    timestamp,                            // 受付日時
    data.userName || '',                  // お名前
    data.userEmail || '',                 // メールアドレス
    data.clinicName || '',                // 医院名
    getRegionName(data.region),           // 地域
    getYearsOpenName(data.yearsOpen),     // 開業年数
    data.units || '',                     // ユニット数
    data.newPatient || '',                // 新患数/月
    data.dailyVisit || '',                // 1日来院数
    data.insurance || '',                 // 保険収入/月
    data.selfPay || '',                   // 自費収入/月
    data.totalRevenue || '',              // 月商合計
    data.selfPayRate || '',               // 自費率
    data.cancel || '',                    // キャンセル率
    data.recall || '',                    // リコール率
    data.receipt || '',                   // レセプト枚数
    getPriorityName(data.priority),       // 最優先課題
    data.otherConcerns || '',             // その他のお悩み
    JSON.stringify(data.recommendations || {}), // AI診断結果（JSON）
    data.selectedPlan || '',              // 選択プラン
    'メール送信済',                        // ステータス
    ''                                    // 備考
  ];

  sheet.appendRow(rowData);

  // 行番号を返す
  return sheet.getLastRow();
}

/**
 * ヘッダー行を作成
 */
function createHeaderRow(sheet) {
  const headers = [
    '診断ID',
    '受付日時',
    'お名前',
    'メールアドレス',
    '医院名',
    '地域',
    '開業年数',
    'ユニット数',
    '新患数/月',
    '1日来院数',
    '保険収入/月(万円)',
    '自費収入/月(万円)',
    '月商合計(万円)',
    '自費率(%)',
    'キャンセル率(%)',
    'リコール率(%)',
    'レセプト枚数',
    '最優先課題',
    'その他のお悩み',
    'AI診断結果',
    '選択プラン',
    'ステータス',
    '備考'
  ];

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  // ヘッダー行のスタイリング
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setBackground('#0D3B66');
  headerRange.setFontColor('#FFFFFF');
  headerRange.setFontWeight('bold');
  sheet.setFrozenRows(1);

  // 列幅の調整
  sheet.setColumnWidth(1, 120);  // 診断ID
  sheet.setColumnWidth(2, 150);  // 受付日時
  sheet.setColumnWidth(3, 100);  // お名前
  sheet.setColumnWidth(4, 200);  // メールアドレス
  sheet.setColumnWidth(5, 150);  // 医院名
  sheet.setColumnWidth(19, 300); // その他のお悩み
  sheet.setColumnWidth(20, 100); // AI診断結果
}

// ========================================
// PDF生成
// ========================================

/**
 * PDFアドバイスシートを生成
 * @param {Object} data - 診断データ
 * @returns {Blob} PDFファイルのBlob
 */
function generatePDFAdviceSheet(data) {
  // Google Doc経由でスタイル付きPDFを生成
  const pdfBlob = createStyledPDF(data, data.clinicName || '診断結果');
  return pdfBlob;
}

/**
 * スタイル付きPDFを生成（Google Doc経由）
 * @param {Object} data - 診断データ
 * @param {string} fileName - ファイル名
 * @returns {Blob} PDFファイルのBlob
 */
function createStyledPDF(data, fileName) {
  // Google Documentを作成
  const doc = DocumentApp.create(fileName + '_アドバイスシート_' + new Date().getTime());
  const body = doc.getBody();

  try {
    // ドキュメントのスタイル設定
    body.setMarginTop(40);
    body.setMarginBottom(40);
    body.setMarginLeft(50);
    body.setMarginRight(50);

    // ========================================
    // ヘッダー
    // ========================================
    const title = body.appendParagraph('AI診断 アドバイスシート');
    title.setHeading(DocumentApp.ParagraphHeading.HEADING1);
    title.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
    title.setForegroundColor('#0D3B66');

    const subtitle = body.appendParagraph('歯科医院地域一番実践会 - 3,247件の成功事例に基づく診断');
    subtitle.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
    subtitle.setForegroundColor('#666666');
    subtitle.setFontSize(10);

    const diagnosisDate = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy年MM月dd日');
    const dateText = body.appendParagraph('診断日: ' + diagnosisDate);
    dateText.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
    dateText.setForegroundColor('#888888');
    dateText.setFontSize(9);

    body.appendParagraph('').setSpacingAfter(10);

    // ========================================
    // クリニック情報
    // ========================================
    const clinicHeader = body.appendParagraph('【 ' + (data.clinicName || '医院名未入力') + ' 様 】');
    clinicHeader.setHeading(DocumentApp.ParagraphHeading.HEADING2);
    clinicHeader.setForegroundColor('#0D3B66');
    clinicHeader.setBackgroundColor('#f0f7ff');

    const clinicInfo = body.appendParagraph(
      'ご担当者: ' + (data.userName || '-') + ' 様　|　' +
      '地域: ' + getRegionName(data.region) + '　|　' +
      '開業年数: ' + getYearsOpenName(data.yearsOpen) + '　|　' +
      'ユニット数: ' + (data.units || '-') + ' 台'
    );
    clinicInfo.setFontSize(9);
    clinicInfo.setForegroundColor('#555555');

    body.appendParagraph('').setSpacingAfter(15);

    // ========================================
    // 入力データサマリー
    // ========================================
    const summaryHeader = body.appendParagraph('■ 入力データサマリー');
    summaryHeader.setHeading(DocumentApp.ParagraphHeading.HEADING3);
    summaryHeader.setForegroundColor('#0D3B66');

    // サマリーテーブル
    const summaryTable = body.appendTable([
      ['新患数', '月間医業収入', '自費率', 'キャンセル率', 'リコール率'],
      [
        (data.newPatient || '--') + ' 人/月',
        (data.totalRevenue || '--') + ' 万円',
        (data.selfPayRate ? Math.floor(data.selfPayRate) : '--') + ' %',
        (data.cancel ? Math.floor(data.cancel) : '--') + ' %',
        (data.recall ? Math.floor(data.recall) : '--') + ' %'
      ]
    ]);

    // テーブルスタイル
    formatTable(summaryTable, '#0D3B66');

    // その他のお悩み
    if (data.otherConcerns) {
      body.appendParagraph('').setSpacingAfter(5);
      const concernsLabel = body.appendParagraph('その他のお悩み:');
      concernsLabel.setFontSize(9);
      concernsLabel.setForegroundColor('#666666');

      const concerns = body.appendParagraph(data.otherConcerns);
      concerns.setFontSize(10);
      concerns.setBackgroundColor('#fafafa');
    }

    body.appendParagraph('').setSpacingAfter(15);

    // ========================================
    // 類似医院との比較
    // ========================================
    const comparisonHeader = body.appendParagraph('■ 類似医院との比較');
    comparisonHeader.setHeading(DocumentApp.ParagraphHeading.HEADING3);
    comparisonHeader.setForegroundColor('#0D3B66');

    const comparison = generateComparisonData(data);

    const comparisonTable = body.appendTable([
      ['新患獲得力', '自費転換力', '患者定着率'],
      [
        '上位 ' + formatPercentile(comparison.newPatientPower.percentile) + '%\n' + getStatusLabel(comparison.newPatientPower.status),
        '上位 ' + formatPercentile(comparison.selfPayPower.percentile) + '%\n' + getStatusLabel(comparison.selfPayPower.status),
        '上位 ' + formatPercentile(comparison.patientRetention.percentile) + '%\n' + getStatusLabel(comparison.patientRetention.status)
      ]
    ]);

    formatTable(comparisonTable, '#667eea');

    body.appendParagraph('').setSpacingAfter(15);

    // ========================================
    // 最優先課題
    // ========================================
    const priorityHeader = body.appendParagraph('★ あなたの最優先課題: ' + getPriorityName(data.priority));
    priorityHeader.setHeading(DocumentApp.ParagraphHeading.HEADING3);
    priorityHeader.setForegroundColor('#764ba2');
    priorityHeader.setBackgroundColor('#f8f5ff');

    body.appendParagraph('').setSpacingAfter(15);

    // ========================================
    // AIからの提案
    // ========================================
    const recHeader = body.appendParagraph('■ AIからの提案');
    recHeader.setHeading(DocumentApp.ParagraphHeading.HEADING3);
    recHeader.setForegroundColor('#0D3B66');

    const recommendations = formatRecommendations(data);
    if (recommendations && recommendations.items) {
      for (let i = 0; i < Math.min(recommendations.items.length, 3); i++) {
        const item = recommendations.items[i];
        const itemTitle = typeof item === 'string' ? item : (item.title || item);

        const recItem = body.appendParagraph((i + 1) + '. ' + itemTitle);
        recItem.setFontSize(11);
        recItem.setForegroundColor('#0D3B66');
        recItem.setBold(true);

        if (typeof item !== 'string' && item.description) {
          const desc = body.appendParagraph('   ' + item.description);
          desc.setFontSize(9);
          desc.setForegroundColor('#555555');
        }

        if (typeof item !== 'string' && item.steps && item.steps.length > 0) {
          const stepsLabel = body.appendParagraph('   【実行ステップ】');
          stepsLabel.setFontSize(9);
          stepsLabel.setForegroundColor('#333333');

          for (let j = 0; j < Math.min(item.steps.length, 5); j++) {
            const step = body.appendParagraph('      ' + (j + 1) + ') ' + item.steps[j]);
            step.setFontSize(9);
            step.setForegroundColor('#666666');
          }
        }

        if (typeof item !== 'string' && item.effect) {
          const effect = body.appendParagraph('   → 期待効果: ' + item.effect);
          effect.setFontSize(9);
          effect.setForegroundColor('#2e7d32');
        }

        body.appendParagraph('').setSpacingAfter(5);
      }
    }

    body.appendParagraph('').setSpacingAfter(15);

    // ========================================
    // アクションプラン
    // ========================================
    const actionHeader = body.appendParagraph('■ 推奨アクションプラン');
    actionHeader.setHeading(DocumentApp.ParagraphHeading.HEADING3);
    actionHeader.setForegroundColor('#b45309');
    actionHeader.setBackgroundColor('#fffbeb');

    const actionTable = body.appendTable([
      ['今すぐ', '1週間以内', '1ヶ月以内', '3ヶ月後'],
      [
        '無料相談のご予約\n診断結果の詳細解説',
        '課題を院内で共有\n優先順位の確認',
        '最優先課題への\n取り組み開始',
        '効果測定\n次のステップへ'
      ]
    ]);

    formatTable(actionTable, '#fbbf24');

    body.appendParagraph('').setSpacingAfter(15);

    // ========================================
    // CTA
    // ========================================
    const ctaHeader = body.appendParagraph('【 次のステップ：無料相談のご案内 】');
    ctaHeader.setHeading(DocumentApp.ParagraphHeading.HEADING3);
    ctaHeader.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
    ctaHeader.setForegroundColor('#0D3B66');
    ctaHeader.setBackgroundColor('#e8f4ff');

    const ctaText = body.appendParagraph('診断結果について、より詳しくご説明させていただきます。\n具体的な改善プランをご一緒に作成しましょう。');
    ctaText.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
    ctaText.setFontSize(10);

    body.appendParagraph('').setSpacingAfter(15);

    // ========================================
    // フッター
    // ========================================
    const footer = body.appendParagraph('歯科医院地域一番実践会');
    footer.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
    footer.setForegroundColor('#0D3B66');
    footer.setBold(true);

    const footerNote = body.appendParagraph('このアドバイスシートは、AI診断システムにより自動生成されました。');
    footerNote.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
    footerNote.setFontSize(8);
    footerNote.setForegroundColor('#888888');

    // ドキュメントを保存
    doc.saveAndClose();

    // PDFとしてエクスポート
    const pdfBlob = DriveApp.getFileById(doc.getId()).getAs('application/pdf');
    pdfBlob.setName((data.clinicName || '診断結果') + '_アドバイスシート.pdf');

    // 一時ファイルを削除
    DriveApp.getFileById(doc.getId()).setTrashed(true);

    return pdfBlob;

  } catch (error) {
    // エラー時は一時ファイルを削除
    try {
      DriveApp.getFileById(doc.getId()).setTrashed(true);
    } catch (e) {}
    throw error;
  }
}

/**
 * テーブルのスタイルを設定
 */
function formatTable(table, headerColor) {
  // ヘッダー行のスタイル
  const headerRow = table.getRow(0);
  for (let i = 0; i < headerRow.getNumCells(); i++) {
    const cell = headerRow.getCell(i);
    cell.setBackgroundColor(headerColor);
    cell.getChild(0).asParagraph().setForegroundColor('#FFFFFF');
    cell.getChild(0).asParagraph().setAlignment(DocumentApp.HorizontalAlignment.CENTER);
    cell.getChild(0).asParagraph().setBold(true);
    cell.setPaddingTop(8);
    cell.setPaddingBottom(8);
  }

  // データ行のスタイル
  if (table.getNumRows() > 1) {
    const dataRow = table.getRow(1);
    for (let i = 0; i < dataRow.getNumCells(); i++) {
      const cell = dataRow.getCell(i);
      cell.setBackgroundColor('#f8f9fa');
      cell.getChild(0).asParagraph().setAlignment(DocumentApp.HorizontalAlignment.CENTER);
      cell.setPaddingTop(10);
      cell.setPaddingBottom(10);
    }
  }
}

/**
 * パーセンタイルをフォーマット
 */
function formatPercentile(percentile) {
  let topPercent = 100 - percentile;
  if (topPercent <= 0) topPercent = 0.1;
  if (topPercent < 10) return topPercent.toFixed(1);
  return Math.floor(topPercent);
}

/**
 * ステータスラベルを取得
 */
function getStatusLabel(status) {
  const labels = {
    'excellent': '非常に優秀',
    'good': '優秀',
    'average': '平均的',
    'needs-improvement': '改善の余地あり'
  };
  return labels[status] || '平均的';
}

/**
 * HTMLをPDFに変換（旧バージョン - 使用しない）
 */
function convertHtmlToPdf(htmlContent, fileName) {
  // 新しいcreateStyledPDF関数を使用するため、この関数は使用しない
  // 互換性のために残す
  return createStyledPDF({}, fileName);
}

/**
 * PDFをGoogle Driveに保存
 */
function savePDFToDrive(pdfBlob, data) {
  let folder;

  try {
    folder = DriveApp.getFolderById(CONFIG.PDF_FOLDER_ID);
  } catch (e) {
    // フォルダが見つからない場合はルートに保存
    folder = DriveApp.getRootFolder();
  }

  const file = folder.createFile(pdfBlob);
  file.setDescription('診断日: ' + new Date().toLocaleDateString('ja-JP') +
                      ' | 医院名: ' + (data.clinicName || '不明'));

  return file.getUrl();
}

// ========================================
// メール送信
// ========================================

/**
 * ユーザーに診断結果をメール送信（本文に記載）
 */
function sendEmailToUser(data) {
  if (!data.userEmail) {
    console.log('メールアドレスが未設定のためスキップ');
    return;
  }

  // 日程調整URLを取得（常に取得、無料サポート希望時は目立つ位置に配置）
  const schedulingUrl = getSchedulingUrl();

  // メール本文を作成
  const plainBody = createDiagnosisEmail(data, schedulingUrl);
  const htmlBody = createDiagnosisEmailHtml(data, schedulingUrl);

  // メール送信オプション
  const options = {
    name: CONFIG.SENDER_NAME,
    htmlBody: htmlBody
  };

  // 件名
  const subject = `【AI診断結果】${data.clinicName || 'お客様'}の診断レポート`;

  // メール送信
  GmailApp.sendEmail(data.userEmail, subject, plainBody, options);
  console.log('メール送信完了: ' + data.userEmail);
}

/**
 * CC送信先にデータを共有
 */
function sendCCNotification(data) {
  const ccEmails = getSettingValue('CC_EMAILS') || CONFIG.CC_EMAILS;

  if (!ccEmails || ccEmails.length === 0) {
    console.log('CC送信先が未設定のためスキップ');
    return;
  }

  const subject = `【診断データ共有】${data.clinicName || '新規'} - ${data.userName || '未入力'}`;

  const body = `
新しいAI診断データが送信されました。

━━━━━━━━━━━━━━━━━━━━━━━
■ 基本情報
━━━━━━━━━━━━━━━━━━━━━━━
お名前: ${data.userName || '未入力'}
メールアドレス: ${data.userEmail || '未入力'}
医院名: ${data.clinicName || '未入力'}
地域: ${getRegionName(data.region)}
開業年数: ${getYearsOpenName(data.yearsOpen)}
ユニット数: ${data.units || '-'}台

━━━━━━━━━━━━━━━━━━━━━━━
■ 診断データ
━━━━━━━━━━━━━━━━━━━━━━━
新患数/月: ${data.newPatient || '-'}人
月商: ${data.totalRevenue || '-'}万円
自費率: ${data.selfPayRate || '-'}%
キャンセル率: ${data.cancel || '-'}%
リコール率: ${data.recall || '-'}%

最優先課題: ${getPriorityName(data.priority)}
無料サポート希望: ${data.wantsFreeSupport ? 'あり' : 'なし'}

━━━━━━━━━━━━━━━━━━━━━━━
■ その他のお悩み
━━━━━━━━━━━━━━━━━━━━━━━
${data.otherConcerns || 'なし'}

━━━━━━━━━━━━━━━━━━━━━━━
※このメールはAI診断システムから自動送信されています。
`;

  const options = {
    name: CONFIG.SENDER_NAME
  };

  // 各CC宛先に送信
  const emailList = Array.isArray(ccEmails) ? ccEmails : ccEmails.split(',').map(e => e.trim());
  emailList.forEach(email => {
    if (email) {
      try {
        GmailApp.sendEmail(email, subject, body, options);
        console.log('CC送信完了: ' + email);
      } catch (e) {
        console.error('CC送信エラー (' + email + '): ' + e.message);
      }
    }
  });
}

/**
 * 設定シートから日程調整URLを取得
 */
function getSchedulingUrl() {
  return getSettingValue('SCHEDULING_URL') || CONFIG.DEFAULT_SCHEDULING_URL;
}

/**
 * 設定シートから値を取得
 */
function getSettingValue(key) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const settingsSheet = ss.getSheetByName(CONFIG.SETTINGS_SHEET_NAME);

    if (!settingsSheet) {
      console.log('設定シートが見つかりません');
      return null;
    }

    const data = settingsSheet.getDataRange().getValues();
    for (let i = 0; i < data.length; i++) {
      if (data[i][0] === key) {
        return data[i][1];
      }
    }
    return null;
  } catch (e) {
    console.error('設定取得エラー: ' + e.message);
    return null;
  }
}

/**
 * 設定シートを初期化（ヘルパー関数）
 */
function initializeSettingsSheet() {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  let sheet = ss.getSheetByName(CONFIG.SETTINGS_SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SETTINGS_SHEET_NAME);
  }

  // 設定項目を追加
  const settings = [
    ['設定項目', '値', '説明'],
    ['SCHEDULING_URL', CONFIG.DEFAULT_SCHEDULING_URL, '日程調整URL（Googleカレンダー予約ページなど）'],
    ['CC_EMAILS', CONFIG.CC_EMAILS.join(','), '診断データをCCで送信するメールアドレス（カンマ区切り）']
  ];

  sheet.getRange(1, 1, settings.length, 3).setValues(settings);

  // ヘッダースタイル
  const headerRange = sheet.getRange(1, 1, 1, 3);
  headerRange.setBackground('#0D3B66');
  headerRange.setFontColor('#FFFFFF');
  headerRange.setFontWeight('bold');

  sheet.setColumnWidth(1, 150);
  sheet.setColumnWidth(2, 400);
  sheet.setColumnWidth(3, 300);

  console.log('設定シートを初期化しました');
}

/**
 * 管理者に通知メール送信
 */
function sendAdminNotification(data, rowNumber) {
  const subject = `【新規診断】${data.clinicName || '新規'} - ${data.userName || '未入力'}`;

  const body = `
新しいAI診断が完了しました。

━━━━━━━━━━━━━━━━━━━━━━━
■ 基本情報
━━━━━━━━━━━━━━━━━━━━━━━
診断ID: ${generateDiagnosisId()}
受付日時: ${new Date().toLocaleString('ja-JP')}
スプレッドシート行番号: ${rowNumber}

お名前: ${data.userName || '未入力'}
メールアドレス: ${data.userEmail || '未入力'}
医院名: ${data.clinicName || '未入力'}
地域: ${getRegionName(data.region)}
開業年数: ${getYearsOpenName(data.yearsOpen)}

━━━━━━━━━━━━━━━━━━━━━━━
■ 診断データ
━━━━━━━━━━━━━━━━━━━━━━━
新患数/月: ${data.newPatient || '-'}人
月商: ${data.totalRevenue || '-'}万円
自費率: ${data.selfPayRate || '-'}%
キャンセル率: ${data.cancel || '-'}%

最優先課題: ${getPriorityName(data.priority)}
選択プラン: ${data.selectedPlan || '未選択'}

━━━━━━━━━━━━━━━━━━━━━━━
■ その他のお悩み
━━━━━━━━━━━━━━━━━━━━━━━
${data.otherConcerns || 'なし'}

━━━━━━━━━━━━━━━━━━━━━━━
スプレッドシートで確認:
https://docs.google.com/spreadsheets/d/${CONFIG.SPREADSHEET_ID}/edit
━━━━━━━━━━━━━━━━━━━━━━━
`;

  GmailApp.sendEmail(CONFIG.ADMIN_EMAIL, subject, body, {
    name: 'AI診断システム通知'
  });
}

/**
 * 診断結果メール本文を作成（プレーンテキスト）
 */
function createDiagnosisEmail(data, schedulingUrl) {
  const comparison = generateComparisonData(data);
  const recommendations = formatRecommendations(data);

  // 日程調整セクション（最初に配置）
  let schedulingSection = '';
  if (data.wantsFreeSupport && schedulingUrl) {
    schedulingSection = `
╔═══════════════════════════════════════╗
║  【無料サポート】日程予約のご案内      ║
╚═══════════════════════════════════════╝

無料サポートをご希望いただきありがとうございます！
経営コンサルタントが30分間、診断結果について
詳しくご説明させていただきます。

▼▼▼ 今すぐ日程を予約する ▼▼▼
${schedulingUrl}

━━━━━━━━━━━━━━━━━━━━━━━

`;
  }

  // 推奨事項のテキスト
  let recommendationsText = '';
  if (recommendations && recommendations.items) {
    recommendationsText = recommendations.items.slice(0, 3).map((item, i) => {
      const title = typeof item === 'string' ? item : (item.title || item);
      const desc = typeof item !== 'string' && item.description ? item.description : '';
      const effect = typeof item !== 'string' && item.effect ? item.effect : '';
      return `【${i + 1}】${title}
   ${desc}
   → ${effect}`;
    }).join('\n\n');
  }

  return `${schedulingSection}${data.userName || 'お客'}様

この度は「歯科医院AI診断」をご利用いただき、
誠にありがとうございます。

診断結果をお送りいたします。

━━━━━━━━━━━━━━━━━━━━━━━
■ 医院情報・現状データ
━━━━━━━━━━━━━━━━━━━━━━━
【基本情報】
医院名: ${data.clinicName || '未入力'}
診断日: ${new Date().toLocaleDateString('ja-JP')}
地域: ${getRegionName(data.region)}
開業年数: ${getYearsOpenName(data.yearsOpen)}
ユニット数: ${data.units || '-'}台

【現状の数値・指標】
新患数: ${data.newPatient || '--'}人/月
月間医業収入: ${data.totalRevenue || '--'}万円
自費率: ${data.selfPayRate ? Math.floor(data.selfPayRate) : '--'}%
キャンセル率: ${data.cancel ? Math.floor(data.cancel) : '--'}%
リコール率: ${data.recall ? Math.floor(data.recall) : '--'}%

━━━━━━━━━━━━━━━━━━━━━━━
■ 類似医院との比較
━━━━━━━━━━━━━━━━━━━━━━━
新患獲得力: 上位 ${formatPercentile(comparison.newPatientPower.percentile)}%（${getStatusLabel(comparison.newPatientPower.status)}）
自費転換力: 上位 ${formatPercentile(comparison.selfPayPower.percentile)}%（${getStatusLabel(comparison.selfPayPower.status)}）
患者定着率: 上位 ${formatPercentile(comparison.patientRetention.percentile)}%（${getStatusLabel(comparison.patientRetention.status)}）

━━━━━━━━━━━━━━━━━━━━━━━
★ あなたの最優先課題
━━━━━━━━━━━━━━━━━━━━━━━
${getPriorityName(data.priority)}

━━━━━━━━━━━━━━━━━━━━━━━
■ AIからの提案
━━━━━━━━━━━━━━━━━━━━━━━
${recommendationsText}

━━━━━━━━━━━━━━━━━━━━━━━
■ 推奨アクションプラン
━━━━━━━━━━━━━━━━━━━━━━━
【今すぐ】無料サポートのご予約
【1週間以内】課題を院内で共有
【1ヶ月以内】最優先課題への取り組み開始
【3ヶ月後】効果測定・次のステップへ

━━━━━━━━━━━━━━━━━━━━━━━
歯科医院地域一番実践会
━━━━━━━━━━━━━━━━━━━━━━━
このメールはAI診断システムから自動送信されています。
`;
}

/**
 * 診断結果メール本文を作成（HTML）
 */
function createDiagnosisEmailHtml(data, schedulingUrl) {
  const comparison = generateComparisonData(data);
  const recommendations = formatRecommendations(data);

  // 日程調整ボタン（最初に配置）
  let schedulingButton = '';
  if (data.wantsFreeSupport && schedulingUrl) {
    schedulingButton = `
    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; padding: 24px; margin-bottom: 24px; text-align: center;">
      <h2 style="color: white; margin: 0 0 12px 0; font-size: 18px;">🎉 無料サポートのご予約</h2>
      <p style="color: rgba(255,255,255,0.9); margin: 0 0 16px 0; font-size: 14px;">
        経営コンサルタントが30分間、診断結果について詳しくご説明いたします
      </p>
      <a href="${schedulingUrl}" style="display: inline-block; background: white; color: #667eea; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">
        📅 今すぐ日程を予約する
      </a>
    </div>
    `;
  }

  // 推奨事項のHTML
  let recommendationsHtml = '';
  if (recommendations && recommendations.items) {
    recommendationsHtml = recommendations.items.slice(0, 3).map((item, i) => {
      const title = typeof item === 'string' ? item : (item.title || item);
      const desc = typeof item !== 'string' && item.description ? item.description : '';
      const effect = typeof item !== 'string' && item.effect ? item.effect : '';
      return `
      <div style="background: #f8f9fa; border-radius: 8px; padding: 16px; margin-bottom: 12px; border-left: 4px solid #667eea;">
        <div style="display: flex; align-items: center; margin-bottom: 8px;">
          <span style="background: linear-gradient(135deg, #667eea, #764ba2); color: white; width: 24px; height: 24px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold; margin-right: 8px;">${i + 1}</span>
          <strong style="color: #1a1a2e; font-size: 14px;">${title}</strong>
        </div>
        ${desc ? `<p style="color: #555; font-size: 13px; margin: 0 0 8px 32px; line-height: 1.5;">${desc}</p>` : ''}
        ${effect ? `<p style="color: #10b981; font-size: 12px; margin: 0 0 0 32px; font-weight: 500;">→ ${effect}</p>` : ''}
      </div>`;
    }).join('');
  }

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background: #f5f5f5;">
  <div style="background: white; border-radius: 12px; padding: 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">

    ${schedulingButton}

    <h1 style="color: #0D3B66; font-size: 20px; margin: 0 0 8px 0; text-align: center;">AI診断結果レポート</h1>
    <p style="color: #666; font-size: 12px; text-align: center; margin: 0 0 24px 0;">歯科医院地域一番実践会</p>

    <p style="font-size: 15px; margin-bottom: 20px;">
      <strong>${data.userName || 'お客'}様</strong><br>
      この度は「歯科医院AI診断」をご利用いただき、誠にありがとうございます。
    </p>

    <!-- 医院情報・現状データ（統合セクション） -->
    <div style="background: #f0f7ff; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
      <h3 style="color: #0D3B66; font-size: 14px; margin: 0 0 16px 0; border-bottom: 2px solid #0D3B66; padding-bottom: 8px;">📋 医院情報・現状データ</h3>

      <!-- 基本情報 -->
      <p style="color: #0D3B66; font-size: 12px; font-weight: bold; margin: 0 0 8px 0;">【基本情報】</p>
      <table style="width: 100%; font-size: 13px; margin-bottom: 16px;">
        <tr><td style="color: #666; padding: 4px 0; width: 30%;">医院名:</td><td style="color: #333; font-weight: 500;">${data.clinicName || '未入力'}</td></tr>
        <tr><td style="color: #666; padding: 4px 0;">診断日:</td><td style="color: #333;">${new Date().toLocaleDateString('ja-JP')}</td></tr>
        <tr><td style="color: #666; padding: 4px 0;">地域:</td><td style="color: #333;">${getRegionName(data.region)}</td></tr>
        <tr><td style="color: #666; padding: 4px 0;">開業年数:</td><td style="color: #333;">${getYearsOpenName(data.yearsOpen)}</td></tr>
        <tr><td style="color: #666; padding: 4px 0;">ユニット数:</td><td style="color: #333;">${data.units || '-'}台</td></tr>
      </table>

      <!-- 現状の数値・指標 -->
      <p style="color: #0D3B66; font-size: 12px; font-weight: bold; margin: 0 0 8px 0;">【現状の数値・指標】</p>
      <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
        <tr style="background: rgba(255,255,255,0.7);">
          <td style="padding: 10px; border: 1px solid #d8f1ff; text-align: center;"><strong>新患数</strong><br>${data.newPatient || '--'}人/月</td>
          <td style="padding: 10px; border: 1px solid #d8f1ff; text-align: center;"><strong>月間収入</strong><br>${data.totalRevenue || '--'}万円</td>
          <td style="padding: 10px; border: 1px solid #d8f1ff; text-align: center;"><strong>自費率</strong><br>${data.selfPayRate ? Math.floor(data.selfPayRate) : '--'}%</td>
        </tr>
        <tr style="background: rgba(255,255,255,0.7);">
          <td style="padding: 10px; border: 1px solid #d8f1ff; text-align: center;"><strong>キャンセル率</strong><br>${data.cancel ? Math.floor(data.cancel) : '--'}%</td>
          <td style="padding: 10px; border: 1px solid #d8f1ff; text-align: center;" colspan="2"><strong>リコール率</strong><br>${data.recall ? Math.floor(data.recall) : '--'}%</td>
        </tr>
      </table>
    </div>

    <!-- 類似医院との比較 -->
    <div style="margin-bottom: 20px;">
      <h3 style="color: #0D3B66; font-size: 14px; margin: 0 0 12px 0;">📈 類似医院との比較</h3>
      <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
        <tr style="background: #667eea; color: white;">
          <th style="padding: 10px; text-align: center;">新患獲得力</th>
          <th style="padding: 10px; text-align: center;">自費転換力</th>
          <th style="padding: 10px; text-align: center;">患者定着率</th>
        </tr>
        <tr style="background: #f8f9fa;">
          <td style="padding: 12px; border: 1px solid #e0e0e0; text-align: center;">
            <strong style="font-size: 16px; color: #667eea;">上位 ${formatPercentile(comparison.newPatientPower.percentile)}%</strong><br>
            <span style="font-size: 11px; color: #666;">${getStatusLabel(comparison.newPatientPower.status)}</span>
          </td>
          <td style="padding: 12px; border: 1px solid #e0e0e0; text-align: center;">
            <strong style="font-size: 16px; color: #667eea;">上位 ${formatPercentile(comparison.selfPayPower.percentile)}%</strong><br>
            <span style="font-size: 11px; color: #666;">${getStatusLabel(comparison.selfPayPower.status)}</span>
          </td>
          <td style="padding: 12px; border: 1px solid #e0e0e0; text-align: center;">
            <strong style="font-size: 16px; color: #667eea;">上位 ${formatPercentile(comparison.patientRetention.percentile)}%</strong><br>
            <span style="font-size: 11px; color: #666;">${getStatusLabel(comparison.patientRetention.status)}</span>
          </td>
        </tr>
      </table>
    </div>

    <!-- 最優先課題 -->
    <div style="background: linear-gradient(135deg, #f8f5ff 0%, #fff 100%); border: 2px solid #764ba2; border-radius: 8px; padding: 16px; margin-bottom: 20px; text-align: center;">
      <p style="color: #764ba2; font-size: 12px; margin: 0 0 4px 0;">★ あなたの最優先課題</p>
      <p style="color: #1a1a2e; font-size: 18px; font-weight: bold; margin: 0;">${getPriorityName(data.priority)}</p>
    </div>

    <!-- AIからの提案 -->
    <div style="margin-bottom: 20px;">
      <h3 style="color: #0D3B66; font-size: 14px; margin: 0 0 12px 0;">💡 AIからの提案</h3>
      ${recommendationsHtml}
    </div>

    <!-- フッター -->
    <div style="border-top: 1px solid #e0e0e0; padding-top: 16px; margin-top: 24px; text-align: center;">
      <p style="color: #0D3B66; font-weight: bold; margin: 0 0 4px 0;">歯科医院地域一番実践会</p>
      <p style="color: #888; font-size: 11px; margin: 0;">このメールはAI診断システムから自動送信されています</p>
    </div>
  </div>
</body>
</html>
`;
}

// ========================================
// ヘルパー関数
// ========================================

/**
 * 診断IDを生成
 */
function generateDiagnosisId() {
  const now = new Date();
  const dateStr = Utilities.formatDate(now, 'Asia/Tokyo', 'yyyyMMdd');
  const timeStr = Utilities.formatDate(now, 'Asia/Tokyo', 'HHmmss');
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `DX-${dateStr}-${timeStr}-${random}`;
}

/**
 * 地域コードを名前に変換
 */
function getRegionName(code) {
  const regions = {
    'hokkaido': '北海道',
    'tohoku': '東北',
    'kanto': '関東',
    'chubu': '中部',
    'tokai': '東海',
    'kinki': '近畿',
    'chugoku': '中国',
    'shikoku': '四国',
    'kyushu': '九州・沖縄'
  };
  return regions[code] || code || '未選択';
}

/**
 * 開業年数コードを名前に変換
 */
function getYearsOpenName(code) {
  const years = {
    'under3': '3年未満',
    '3to5': '3〜5年',
    '5to10': '5〜10年',
    '10to20': '10〜20年',
    'over20': '20年以上'
  };
  return years[code] || code || '未選択';
}

/**
 * 課題コードを名前に変換
 */
function getPriorityName(code) {
  const priorities = {
    'newPatient': '新患獲得',
    'selfPay': '自費率向上',
    'cancel': 'キャンセル対策',
    'staffRetention': 'スタッフ定着',
    'staffRecruitment': 'スタッフ採用',
    'efficiency': '業務効率化'
  };
  return priorities[code] || code || '未選択';
}

/**
 * 推奨事項をフォーマット
 */
function formatRecommendations(data) {
  if (!data.recommendations) {
    return getDefaultRecommendations(data.priority);
  }
  return data.recommendations;
}

/**
 * メール用に推奨事項をフォーマット
 */
function formatRecommendationsForEmail(data) {
  const recs = formatRecommendations(data);
  if (typeof recs === 'string') {
    return recs;
  }
  return JSON.stringify(recs, null, 2);
}

/**
 * デフォルトの推奨事項を取得（詳細版）
 */
function getDefaultRecommendations(priority) {
  const defaults = {
    'newPatient': {
      title: '新患獲得戦略',
      items: [
        {
          title: 'Googleビジネスプロフィール（MEO）基本最適化',
          description: '現代の患者の多くは「地域名＋歯科」で検索し、Googleマップ上の評価を見て来院を決めます。',
          effect: '口コミ56件→116件、新患25人→56人/月に増加（実績事例）',
          difficulty: '低',
          period: '効果発現まで2-3ヶ月',
          steps: [
            'NAP情報をHP・SNSと完全一致させる',
            '院内写真を週1回以上アップロード',
            '口コミ全件に24時間以内に返信'
          ]
        },
        {
          title: '口コミ獲得の仕組み化',
          description: '評価4.8以上・口コミ100件以上を目標に計画的に収集。',
          effect: '口コミ数2倍、新患+35%',
          difficulty: '低',
          period: '即効性あり',
          steps: [
            'QRコード付きチラシを待合室・トイレに設置',
            '口コミ依頼トークスクリプトを作成',
            '満足度の高いタイミングで依頼'
          ]
        },
        {
          title: 'WEB予約システムの最適化',
          description: '新患は深夜や早朝に歯科医院を探す傾向があります。24時間予約可能な環境が必須です。',
          effect: 'WEB予約導入初月で30件獲得（実績）',
          difficulty: '低',
          period: '即効性あり',
          steps: [
            'HPの目立つ場所に予約ボタン設置',
            '初診枠をリアルタイム開放',
            'LINE予約連携を構築'
          ]
        }
      ]
    },
    'selfPay': {
      title: '自費率向上戦略',
      items: [
        {
          title: '三段階カウンセリングシステムの構築',
          description: '自費率を安定させるには、初診から補綴決定までの「流れ」を仕組み化することが最優先です。',
          effect: '自費率1.5〜1.8倍の実績',
          difficulty: '中',
          period: '効果発現まで1-2ヶ月',
          steps: [
            '初診カウンセリングで潜在的な不安・理想をヒアリング',
            'セカンドカウンセリングで「なぜ悪くなったか」を視覚的に説明',
            '補綴コンサルで「松・竹・梅」3パターン提示'
          ]
        },
        {
          title: '視覚情報（可視化ツール）の徹底活用',
          description: '人間は視覚情報から受ける影響が55%と最も大きいため、「見える化」が重要です。',
          effect: '説明ツールで成約率+20〜30%',
          difficulty: '低',
          period: '即効性あり',
          steps: [
            '40インチ以上の大型モニターで口腔内写真を見せる',
            '治療前後の比較写真で具体的ゴールをイメージさせる',
            '補綴模型を直接触ってもらい価値を体感'
          ]
        },
        {
          title: 'デンタルローンの導入',
          description: '高額治療のハードルを下げ、患者の「やりたいけど払えない」を解決します。',
          effect: '高額治療の成約率+40%',
          difficulty: '低',
          period: '即効性あり',
          steps: [
            '複数のローン会社と提携',
            'シミュレーションツールを導入',
            'スタッフへの説明トレーニング実施'
          ]
        }
      ]
    },
    'cancel': {
      title: 'キャンセル対策',
      items: [
        {
          title: '予約リマインド自動化',
          description: '前日リマインドで無断キャンセルを大幅に削減できます。',
          effect: 'キャンセル率-40%',
          difficulty: '低',
          period: '即効性あり',
          steps: [
            'LINE・SMS・メールでの自動リマインド設定',
            '予約2日前と前日の2回送信',
            'キャンセル方法も明記して連絡なしを防止'
          ]
        },
        {
          title: 'チェアサイド予約の徹底',
          description: '治療終了時にその場で次回予約を取ることで、予約忘れを防ぎます。',
          effect: '無断キャンセル-50%',
          difficulty: '低',
          period: '2週間で効果発現',
          steps: [
            '「次回はいつがよろしいですか？」を習慣化',
            '予約カードをその場で手渡し',
            '3日以内の予約で特典を検討'
          ]
        },
        {
          title: 'キャンセル待ちリストの運用',
          description: 'キャンセルが出たら即座に埋める仕組みで稼働率を維持します。',
          effect: '稼働率+15%向上',
          difficulty: '低',
          period: '1ヶ月で効果発現',
          steps: [
            '希望者をリスト化（早く来たい方）',
            'キャンセル発生時に即連絡',
            'LINEやSMSで迅速に空き情報を共有'
          ]
        }
      ]
    },
    'staffRetention': {
      title: 'スタッフ定着',
      items: [
        {
          title: '5分間トーク（定期1on1）の導入',
          description: '週1回5分の個別面談で、小さな不満を早期キャッチし離職を防ぎます。',
          effect: '離職率10-20%→1-2%に改善（実績）',
          difficulty: '低',
          period: '6ヶ月で効果発現',
          steps: [
            '週1回5分の定期面談を設定',
            '仕事以外の雑談も含めて関係構築',
            '小さな変化に気づいたらすぐフォロー'
          ]
        },
        {
          title: '評価制度・キャリアパスの整備',
          description: '頑張りが報われる仕組みで、モチベーションを維持します。',
          effect: 'スタッフの目標意識向上、生産性アップ',
          difficulty: '中',
          period: '3-6ヶ月で効果発現',
          steps: [
            '評価項目と基準を明確化',
            '昇給・賞与との連動ルールを整備',
            '四半期ごとの評価面談を実施'
          ]
        },
        {
          title: '定期研修・スキルアップ支援',
          description: '成長機会を提供することで、やりがいと帰属意識を高めます。',
          effect: '退職者大幅削減（実績）',
          difficulty: '中',
          period: '継続的に効果発現',
          steps: [
            '外部セミナーへの参加支援',
            '院内勉強会の定期開催',
            '資格取得費用の補助制度'
          ]
        }
      ]
    },
    'staffRecruitment': {
      title: 'スタッフ採用',
      items: [
        {
          title: '採用フェス・説明会への積極参加',
          description: 'プレゼンと職場の雰囲気で差別化し、優秀な人材を獲得します。',
          effect: 'プレゼン投票1位、ブース訪問71名、19名見学（実績）',
          difficulty: '中',
          period: 'イベント参加後即効',
          steps: [
            '医院の魅力を伝えるプレゼン準備',
            'スタッフを巻き込んだブース運営',
            '見学会への動線設計'
          ]
        },
        {
          title: '学校連携の強化',
          description: '実習生・研修生を大切にすることで、将来の採用に繋げます。',
          effect: '学生4名獲得、1名就職希望（実績）',
          difficulty: '低',
          period: '1年で効果発現',
          steps: [
            '近隣の歯科衛生士学校との関係構築',
            '実習生の「おもてなし」を徹底',
            '就職前提のインターン受け入れ'
          ]
        },
        {
          title: 'つながり採用の活用',
          description: '既存スタッフや取引先からの紹介で、ミスマッチを防ぎます。',
          effect: '新人Drから1名見学確保（実績）',
          difficulty: '低',
          period: '随時効果発現',
          steps: [
            'スタッフに紹介インセンティブを設定',
            'ディーラー・技工所にも声がけ',
            '紹介された方への特別対応'
          ]
        }
      ]
    },
    'efficiency': {
      title: '業務効率化',
      items: [
        {
          title: 'クリーンスタッフの採用',
          description: '片付け・清掃専門のパートを採用し、正社員の負担を軽減します。',
          effect: '片付け時間削減、残業時間ダウン（実績）',
          difficulty: '低',
          period: '即効性あり',
          steps: [
            '近隣からパート・シニア層を募集',
            '器具の片付け・滅菌準備を担当',
            '正社員は本来業務に集中可能に'
          ]
        },
        {
          title: 'DXツールの導入',
          description: 'デジタル化で事務作業を自動化し、生産性を向上させます。',
          effect: '事務作業50%削減',
          difficulty: '中',
          period: '1-2ヶ月で効果発現',
          steps: [
            'ペーパーレス化（問診票、同意書等）',
            '予約・会計システムの連携',
            'チャットツールでの情報共有'
          ]
        },
        {
          title: '診療時間の見直し',
          description: '時短診療や診療日の見直しで、スタッフの働きやすさを向上します。',
          effect: 'スタッフ満足度向上、採用力アップ',
          difficulty: '中',
          period: '3ヶ月で効果検証',
          steps: [
            '患者数と時間帯の分析',
            '非効率な時間帯の特定',
            '段階的な診療時間短縮'
          ]
        }
      ]
    }
  };

  return defaults[priority] || defaults['newPatient'];
}

/**
 * 比較データを生成
 */
function generateComparisonData(data) {
  // 業界ベンチマーク
  const benchmarks = {
    newPatient: { average: 35, excellent: 80, max: 150 },
    selfPayRate: { average: 15, excellent: 35, max: 60 },
    recall: { average: 50, excellent: 80, max: 100 },
    cancel: { average: 7, excellent: 3, min: 0 }
  };

  // パーセンタイルを計算するヘルパー関数
  function calculatePercentile(value, benchmark, isReverse = false) {
    if (value === undefined || value === null) return 50;

    if (isReverse) {
      // キャンセル率など、低い方が良い指標
      if (value <= benchmark.excellent) return 95;
      if (value <= benchmark.average) return 70;
      return Math.max(20, 50 - (value - benchmark.average) * 3);
    } else {
      // 新患数など、高い方が良い指標
      if (value >= benchmark.excellent) return 95;
      if (value >= benchmark.average) return 70;
      return Math.max(20, (value / benchmark.average) * 50);
    }
  }

  // ステータスを判定するヘルパー関数
  function getStatus(percentile) {
    if (percentile >= 90) return 'excellent';
    if (percentile >= 70) return 'good';
    if (percentile >= 40) return 'average';
    return 'needs-improvement';
  }

  // 新患獲得力（新患数ベース）
  const npPercentile = calculatePercentile(data.newPatient, benchmarks.newPatient);

  // 自費転換力（自費率ベース）
  const spPercentile = calculatePercentile(data.selfPayRate, benchmarks.selfPayRate);

  // 患者定着率（リコール率とキャンセル率を組み合わせ）
  const recallPercentile = calculatePercentile(data.recall, benchmarks.recall);
  const cancelPercentile = calculatePercentile(data.cancel, benchmarks.cancel, true);
  const prPercentile = Math.round((recallPercentile + cancelPercentile) / 2);

  return {
    newPatientPower: {
      percentile: npPercentile,
      status: getStatus(npPercentile)
    },
    selfPayPower: {
      percentile: spPercentile,
      status: getStatus(spPercentile)
    },
    patientRetention: {
      percentile: prPercentile,
      status: getStatus(prPercentile)
    }
  };
}

// ========================================
// テスト・デバッグ用関数
// ========================================

/**
 * テスト実行
 */
function testProcessDiagnosis() {
  const testData = {
    userName: 'テスト太郎',
    userEmail: 'test@example.com',
    clinicName: 'テスト歯科医院',
    region: 'kanto',
    yearsOpen: '5to10',
    units: '5',
    newPatient: 45,
    dailyVisit: 40,
    insurance: 600,
    selfPay: 200,
    totalRevenue: 800,
    selfPayRate: 25,
    cancel: 5,
    recall: 60,
    receipt: 1000,
    priority: 'newPatient',
    otherConcerns: 'スタッフの採用が難しい',
    recommendations: {
      title: '新患獲得戦略',
      items: ['MEO対策', 'HP改善']
    }
  };

  console.log('テスト開始...');
  // 実際のメール送信を避けるため、保存のみテスト
  // const result = processDiagnosisData(testData);
  // console.log('結果:', result);

  console.log('テストデータ:', JSON.stringify(testData, null, 2));
}

/**
 * スプレッドシートを初期化（ヘッダー作成）
 */
function initializeSpreadsheet() {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  let sheet = ss.getSheetByName(CONFIG.SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEET_NAME);
  }

  createHeaderRow(sheet);
  console.log('スプレッドシートを初期化しました');
}
