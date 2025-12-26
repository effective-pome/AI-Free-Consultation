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

  // 送信元メールアドレス（Gmailエイリアスまたはグループアドレス）
  // ※ GASはデフォルトで実行者のGmailから送信されます
  // ※ 別のアドレスから送信する場合はGmailエイリアスを設定してください
  SENDER_NAME: '歯科医院地域一番実践会',

  // 管理者通知用メールアドレス（新規診断時に通知）
  ADMIN_EMAIL: 'admin@example.com',

  // PDFファイル保存先フォルダID（Google Drive）
  PDF_FOLDER_ID: 'YOUR_FOLDER_ID_HERE'
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

  // 2. PDFアドバイスシートを生成
  const pdfBlob = generatePDFAdviceSheet(data);

  // 3. PDFをGoogle Driveに保存
  const pdfUrl = savePDFToDrive(pdfBlob, data);

  // 4. ユーザーにメール送信
  sendEmailToUser(data, pdfBlob);

  // 5. 管理者に通知
  sendAdminNotification(data, rowNumber);

  return {
    success: true,
    message: 'アドバイスシートをメールで送信しました',
    rowNumber: rowNumber,
    pdfUrl: pdfUrl
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
      for (let i = 0; i < Math.min(recommendations.items.length, 4); i++) {
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
 * ユーザーにアドバイスシートをメール送信
 */
function sendEmailToUser(data, pdfBlob) {
  if (!data.userEmail) {
    console.log('メールアドレスが未設定のためスキップ');
    return;
  }

  // メールテンプレートを取得
  const template = HtmlService.createTemplateFromFile('EmailTemplate');
  template.data = data;
  template.recommendations = formatRecommendationsForEmail(data);

  const htmlBody = template.evaluate().getContent();
  const plainBody = createPlainTextEmail(data);

  // メール送信オプション
  const options = {
    name: CONFIG.SENDER_NAME,
    htmlBody: htmlBody,
    attachments: [pdfBlob]
  };

  // 件名
  const subject = `【AI診断結果】${data.clinicName || 'お客様'}のアドバイスシート`;

  // メール送信
  GmailApp.sendEmail(data.userEmail, subject, plainBody, options);

  console.log('メール送信完了: ' + data.userEmail);
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
 * プレーンテキストメール本文を作成
 */
function createPlainTextEmail(data) {
  return `
${data.userName || 'お客'}様

この度は「歯科医院AI診断」をご利用いただき、誠にありがとうございます。

診断結果とアドバイスシートをPDFにてお送りいたします。
添付ファイルをご確認ください。

━━━━━━━━━━━━━━━━━━━━━━━
■ 診断結果サマリー
━━━━━━━━━━━━━━━━━━━━━━━
医院名: ${data.clinicName || '未入力'}
診断日: ${new Date().toLocaleDateString('ja-JP')}
最優先課題: ${getPriorityName(data.priority)}

詳細なアドバイスは添付のPDFをご覧ください。

━━━━━━━━━━━━━━━━━━━━━━━
■ 次のステップ
━━━━━━━━━━━━━━━━━━━━━━━
無料相談のご予約を承っております。
診断結果について詳しくご説明させていただきます。

━━━━━━━━━━━━━━━━━━━━━━━
歯科医院地域一番実践会
━━━━━━━━━━━━━━━━━━━━━━━
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
    'staff': 'スタッフ採用・定着',
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
 * デフォルトの推奨事項を取得
 */
function getDefaultRecommendations(priority) {
  const defaults = {
    'newPatient': {
      title: '新患獲得戦略',
      items: [
        'Googleマップ（MEO）対策の強化',
        'ホームページのSEO改善',
        'Web予約システムの最適化',
        'SNS・Instagram活用'
      ]
    },
    'selfPay': {
      title: '自費率向上戦略',
      items: [
        'カウンセリング強化研修',
        '自費メニュー表の作成',
        'デンタルローンの導入',
        '症例写真の活用'
      ]
    },
    'cancel': {
      title: 'キャンセル対策',
      items: [
        '予約リマインド自動化',
        'キャンセルポリシーの明確化',
        '予約枠の最適化',
        'キャンセル患者フォロー'
      ]
    },
    'staff': {
      title: 'スタッフ採用・定着',
      items: [
        '採用ブランディング強化',
        '教育システムの整備',
        '評価制度の導入',
        '働きやすい環境づくり'
      ]
    },
    'efficiency': {
      title: '業務効率化',
      items: [
        'デジタル化の推進',
        'マニュアル整備',
        'タスク管理システム導入',
        '無駄な業務の見直し'
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
