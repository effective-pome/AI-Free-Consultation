/**
 * GAS連携モジュール
 *
 * フロントエンドからGoogle Apps Scriptに診断データを送信し、
 * PDFアドバイスシートの生成とメール送信を行います。
 *
 * 【使用方法】
 * 1. このファイルをHTMLに追加: <script src="gas-integration.js"></script>
 * 2. GAS_CONFIG.WEBAPP_URL を設定
 * 3. submitForm() 内で sendDiagnosisToGAS() を呼び出す
 */

// ========================================
// 設定
// ========================================
const GAS_CONFIG = {
  // GAS WebアプリのURL（デプロイ後に設定）
  WEBAPP_URL: 'YOUR_GAS_WEBAPP_URL_HERE',

  // リトライ設定
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000, // ミリ秒

  // タイムアウト（ミリ秒）
  TIMEOUT: 30000
};

// ========================================
// メイン関数
// ========================================

/**
 * 診断データをGASに送信
 * @param {Object} formData - フォームデータ
 * @param {Object} recommendations - AI診断結果
 * @returns {Promise<Object>} 送信結果
 */
async function sendDiagnosisToGAS(formData, recommendations) {
  // URLが設定されていない場合はスキップ
  if (!GAS_CONFIG.WEBAPP_URL || GAS_CONFIG.WEBAPP_URL === 'YOUR_GAS_WEBAPP_URL_HERE') {
    console.warn('GAS連携: WebアプリURLが未設定です');
    return { success: false, error: 'WebアプリURLが未設定' };
  }

  // バリデーション
  if (!formData.userEmail) {
    console.warn('GAS連携: メールアドレスが未入力のためスキップ');
    return { success: false, error: 'メールアドレスが未入力' };
  }

  // ペイロードを構築
  const payload = buildPayload(formData, recommendations);

  // リトライ付きで送信
  return await sendWithRetry(payload);
}

/**
 * ペイロードを構築
 */
function buildPayload(formData, recommendations) {
  return {
    // 基本情報
    userName: formData.userName || '',
    userEmail: formData.userEmail || '',
    clinicName: formData.clinicName || '',
    region: formData.region || '',
    yearsOpen: formData.yearsOpen || '',
    units: formData.units || '',

    // 診断データ
    newPatient: formData.newPatient || null,
    dailyVisit: formData.dailyVisit || null,
    insurance: formData.insurance || null,
    selfPay: formData.selfPay || null,
    totalRevenue: formData.totalRevenue || null,
    selfPayRate: formData.selfPayRate || null,
    cancel: formData.cancel || null,
    recall: formData.recall || null,
    receipt: formData.receipt || null,

    // 課題
    priority: formData.priority || '',
    otherConcerns: formData.otherConcerns || '',

    // AI診断結果
    recommendations: recommendations || {},

    // 選択プラン（相談プラン）
    selectedPlan: formData.selectedPlan || '',

    // メタデータ
    timestamp: new Date().toISOString(),
    source: 'web-form',
    version: '1.0'
  };
}

/**
 * リトライ付きで送信
 */
async function sendWithRetry(payload, retryCount = 0) {
  try {
    const result = await sendRequest(payload);
    console.log('GAS連携: 送信成功', result);
    return { success: true, data: result };
  } catch (error) {
    console.error(`GAS連携: 送信失敗 (試行 ${retryCount + 1}/${GAS_CONFIG.MAX_RETRIES})`, error);

    if (retryCount < GAS_CONFIG.MAX_RETRIES - 1) {
      // リトライ
      await sleep(GAS_CONFIG.RETRY_DELAY * (retryCount + 1));
      return sendWithRetry(payload, retryCount + 1);
    }

    return { success: false, error: error.message };
  }
}

/**
 * HTTPリクエストを送信
 */
async function sendRequest(payload) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), GAS_CONFIG.TIMEOUT);

  try {
    // GAS WebAppはCORSに対応していないため、no-corsモードを使用
    // no-corsモードではレスポンスボディを読み取れないが、送信自体は成功する
    const response = await fetch(GAS_CONFIG.WEBAPP_URL, {
      method: 'POST',
      mode: 'no-cors', // CORS回避
      cache: 'no-cache',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    clearTimeout(timeoutId);

    // no-corsモードではresponse.okは常にfalseになるため、
    // リクエスト自体が成功したかどうかで判断
    return { sent: true };
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

/**
 * スリープ関数
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ========================================
// 追加ユーティリティ
// ========================================

/**
 * GAS連携が設定済みかチェック
 */
function isGASConfigured() {
  return GAS_CONFIG.WEBAPP_URL &&
         GAS_CONFIG.WEBAPP_URL !== 'YOUR_GAS_WEBAPP_URL_HERE';
}

/**
 * 設定をローカルストレージから読み込み（オプション）
 */
function loadGASConfig() {
  try {
    const saved = localStorage.getItem('gas_config');
    if (saved) {
      const config = JSON.parse(saved);
      if (config.webappUrl) {
        GAS_CONFIG.WEBAPP_URL = config.webappUrl;
      }
    }
  } catch (e) {
    console.warn('GAS設定の読み込みに失敗:', e);
  }
}

/**
 * 設定をローカルストレージに保存（オプション）
 */
function saveGASConfig(webappUrl) {
  try {
    localStorage.setItem('gas_config', JSON.stringify({
      webappUrl: webappUrl
    }));
    GAS_CONFIG.WEBAPP_URL = webappUrl;
  } catch (e) {
    console.warn('GAS設定の保存に失敗:', e);
  }
}

// ========================================
// app.js への統合例
// ========================================

/**
 * submitForm() 関数内に以下を追加:
 *
 * async function submitForm() {
 *   // ... 既存のコード ...
 *
 *   // 結果を生成
 *   let recommendations = await generateAIRecommendations();
 *
 *   // GASに送信（PDFメール送信）
 *   if (AppState.formData.userEmail) {
 *     try {
 *       const gasResult = await sendDiagnosisToGAS(AppState.formData, recommendations);
 *       if (gasResult.success) {
 *         console.log('PDFアドバイスシートをメール送信しました');
 *       }
 *     } catch (error) {
 *       console.error('GAS連携エラー:', error);
 *       // エラーでも診断結果は表示する
 *     }
 *   }
 *
 *   // 結果を表示
 *   displayResults(recommendations);
 * }
 */

// 初期化時に設定を読み込む
document.addEventListener('DOMContentLoaded', () => {
  loadGASConfig();
});

// エクスポート（モジュール使用時）
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    sendDiagnosisToGAS,
    isGASConfigured,
    loadGASConfig,
    saveGASConfig,
    GAS_CONFIG
  };
}
