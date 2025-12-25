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
  // HTMLテンプレートを取得
  const template = HtmlService.createTemplateFromFile('PDFTemplate');

  // テンプレートにデータを渡す
  template.data = data;
  template.diagnosisDate = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy年MM月dd日');
  template.recommendations = formatRecommendations(data);
  template.comparison = generateComparisonData(data);

  // HTMLを生成
  const htmlContent = template.evaluate().getContent();

  // HTMLをPDFに変換
  const pdfBlob = convertHtmlToPdf(htmlContent, data.clinicName || '診断結果');

  return pdfBlob;
}

/**
 * HTMLをPDFに変換
 */
function convertHtmlToPdf(htmlContent, fileName) {
  // 一時的なGoogle Docを作成してPDF化
  const doc = DocumentApp.create('temp_' + new Date().getTime());
  const docId = doc.getId();

  try {
    // HTMLの内容をDocに挿入（簡易版）
    const body = doc.getBody();

    // HTMLからテキストを抽出して整形
    const plainText = htmlContent
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, '\n')
      .replace(/\n\s*\n/g, '\n\n')
      .trim();

    body.setText(plainText);
    doc.saveAndClose();

    // PDFとしてエクスポート
    const pdfBlob = DriveApp.getFileById(docId).getAs('application/pdf');
    pdfBlob.setName(fileName + '_アドバイスシート.pdf');

    // 一時ファイルを削除
    DriveApp.getFileById(docId).setTrashed(true);

    return pdfBlob;
  } catch (error) {
    // エラー時は一時ファイルを削除
    DriveApp.getFileById(docId).setTrashed(true);
    throw error;
  }
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
  // 業界ベンチマークとの比較
  const benchmarks = {
    newPatient: { average: 35, excellent: 80 },
    totalRevenue: { average: 650, excellent: 1800 },
    selfPayRate: { average: 15, excellent: 35 },
    cancel: { average: 7, excellent: 3 }
  };

  const comparison = {};

  if (data.newPatient) {
    comparison.newPatient = {
      value: data.newPatient,
      vsAverage: Math.round((data.newPatient / benchmarks.newPatient.average - 1) * 100),
      level: data.newPatient >= benchmarks.newPatient.excellent ? '優秀' :
             data.newPatient >= benchmarks.newPatient.average ? '平均以上' : '改善余地あり'
    };
  }

  if (data.totalRevenue) {
    comparison.totalRevenue = {
      value: data.totalRevenue,
      vsAverage: Math.round((data.totalRevenue / benchmarks.totalRevenue.average - 1) * 100),
      level: data.totalRevenue >= benchmarks.totalRevenue.excellent ? '優秀' :
             data.totalRevenue >= benchmarks.totalRevenue.average ? '平均以上' : '改善余地あり'
    };
  }

  if (data.selfPayRate) {
    comparison.selfPayRate = {
      value: data.selfPayRate,
      vsAverage: Math.round((data.selfPayRate / benchmarks.selfPayRate.average - 1) * 100),
      level: data.selfPayRate >= benchmarks.selfPayRate.excellent ? '優秀' :
             data.selfPayRate >= benchmarks.selfPayRate.average ? '平均以上' : '改善余地あり'
    };
  }

  if (data.cancel) {
    comparison.cancel = {
      value: data.cancel,
      vsAverage: Math.round((1 - data.cancel / benchmarks.cancel.average) * 100),
      level: data.cancel <= benchmarks.cancel.excellent ? '優秀' :
             data.cancel <= benchmarks.cancel.average ? '平均以上' : '改善余地あり'
    };
  }

  return comparison;
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
