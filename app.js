/**
 * 歯科医院AI診断フォーム - メインアプリケーション
 */

// ========================================
// グローバル状態
// ========================================
const AppState = {
    currentStep: 1,
    totalSteps: 3,
    formData: {},
    apiKey: null,
    useApi: false
};

// ========================================
// GAS連携設定
// ========================================
// Google Apps ScriptのウェブアプリURL（デプロイ後に設定してください）
const GAS_WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbwZZVAm0UjDw_bZD4-OpjOG89ScUzCi2yh-q2XxTHH7vRqYT9gJm_1Qi_-zHsXBSmnH6A/exec';

// ========================================
// 初期化
// ========================================
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

function initializeApp() {
    // ランディングページのアニメーション
    animateStatNumbers();
    animateGrowthChart();
    createParticles();

    // ボタングループのイベントリスナー
    setupButtonGroups();

    // 入力フィールドのイベントリスナー
    setupInputListeners();

    // API設定の読み込み
    loadApiSettings();

    // フォームデータの復元（保存されている場合）
    restoreFormData();
}

// ========================================
// ランディングページ
// ========================================
function animateStatNumbers() {
    const numbers = document.querySelectorAll('.stat-number');
    if (!numbers.length) return;

    numbers.forEach((el, index) => {
        const target = parseInt(el.dataset.target) || 0;
        const duration = 2000;
        const delay = 800 + index * 150;

        setTimeout(() => {
            const startTime = performance.now();

            function update(currentTime) {
                const elapsed = currentTime - startTime;
                const progress = Math.min(elapsed / duration, 1);

                // イージング関数
                const easeOutQuart = 1 - Math.pow(1 - progress, 4);
                const current = Math.floor(easeOutQuart * target);

                el.textContent = current.toLocaleString();

                if (progress < 1) {
                    requestAnimationFrame(update);
                }
            }

            requestAnimationFrame(update);
        }, delay);
    });
}

function animateGrowthChart() {
    const bars = document.querySelectorAll('.growth-bar');
    if (!bars.length) return;

    // 棒グラフのアニメーション（右肩上がり）
    setTimeout(() => {
        bars.forEach((bar, index) => {
            const value = parseInt(bar.dataset.value) || 0;
            const fill = bar.querySelector('.growth-bar-fill');
            const valueLabel = bar.querySelector('.growth-bar-value');

            setTimeout(() => {
                if (fill) {
                    // 最大値を基準にした高さ計算（右肩上がりに見せる）
                    const maxHeight = 120; // px
                    const height = (value / 100) * maxHeight;
                    fill.style.height = `${height}px`;
                }
                // 値のラベルを表示
                bar.classList.add('animated');
            }, index * 200);
        });
    }, 500);
}

function createParticles() {
    const container = document.getElementById('particles');
    if (!container) return;

    const particleCount = 15;

    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        particle.style.left = `${Math.random() * 100}%`;
        particle.style.animationDelay = `${Math.random() * 15}s`;
        particle.style.animationDuration = `${15 + Math.random() * 10}s`;
        container.appendChild(particle);
    }
}

function startDiagnosis() {
    document.getElementById('landing').classList.add('hidden');
    document.getElementById('formSection').classList.remove('hidden');
    updateProgress();
}

// ========================================
// フォームナビゲーション
// ========================================
function nextStep() {
    if (AppState.currentStep < AppState.totalSteps) {
        // 現在のステップを非表示
        document.getElementById(`step${AppState.currentStep}`).classList.add('hidden');

        // 次のステップを表示
        AppState.currentStep++;
        document.getElementById(`step${AppState.currentStep}`).classList.remove('hidden');

        // プログレス更新
        updateProgress();

        // データ保存
        saveFormData();

        // スクロールトップ
        document.querySelector('.form-container').scrollTo(0, 0);
    }
}

function goBack() {
    if (AppState.currentStep > 1) {
        document.getElementById(`step${AppState.currentStep}`).classList.add('hidden');
        AppState.currentStep--;
        document.getElementById(`step${AppState.currentStep}`).classList.remove('hidden');
        updateProgress();
    } else {
        // ランディングページに戻る
        document.getElementById('formSection').classList.add('hidden');
        document.getElementById('landing').classList.remove('hidden');
    }
}

function updateProgress() {
    const progress = (AppState.currentStep / AppState.totalSteps) * 100;
    document.getElementById('progressFill').style.width = `${progress}%`;
    document.getElementById('progressText').textContent = `STEP ${AppState.currentStep}/${AppState.totalSteps}`;

    // 残り時間の更新
    const timePerStep = [15, 45, 15];
    let remainingTime = 0;
    for (let i = AppState.currentStep - 1; i < AppState.totalSteps; i++) {
        remainingTime += timePerStep[i];
    }
    document.getElementById('timeEstimate').querySelector('span').textContent = `残り約${remainingTime}秒`;
}

// ========================================
// ボタングループ
// ========================================
function setupButtonGroups() {
    document.querySelectorAll('.button-group').forEach(group => {
        const field = group.dataset.field;
        group.querySelectorAll('.option-button').forEach(button => {
            button.addEventListener('click', () => {
                // 他のボタンの選択を解除
                group.querySelectorAll('.option-button').forEach(b => b.classList.remove('selected'));
                // このボタンを選択
                button.classList.add('selected');
                // 値を保存
                AppState.formData[field] = parseFloat(button.dataset.value);

                // 次の入力項目に自動スクロール
                scrollToNextFormGroup(group);
            });
        });
    });
}

// 次のフォームグループにスクロール
function scrollToNextFormGroup(currentGroup) {
    const formGroups = Array.from(document.querySelectorAll('.step:not(.hidden) .form-group'));
    const currentIndex = formGroups.findIndex(g => g.contains(currentGroup));

    if (currentIndex !== -1 && currentIndex < formGroups.length - 1) {
        // 次のグループにスクロール
        const nextGroup = formGroups[currentIndex + 1];
        setTimeout(() => {
            nextGroup.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 200);
    } else {
        // 最後のグループの場合はCTAボタンにスクロール
        scrollToCTAButton();
    }
}

// CTAボタンにスクロールしてアピール
function scrollToCTAButton() {
    const currentStep = document.querySelector('.step:not(.hidden)');
    const ctaButton = currentStep?.querySelector('.step-actions .cta-button');

    if (ctaButton) {
        setTimeout(() => {
            ctaButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
            // アピールアニメーション
            ctaButton.classList.add('cta-highlight');
            setTimeout(() => {
                ctaButton.classList.remove('cta-highlight');
            }, 2000);
        }, 300);
    }
}

function toggleSpecificInput(button) {
    const wrapper = button.closest('.specific-input-wrapper');
    const inputDiv = wrapper.querySelector('.specific-input');
    inputDiv.classList.toggle('hidden');

    if (!inputDiv.classList.contains('hidden')) {
        inputDiv.querySelector('input').focus();
    }
}

// ========================================
// 入力フィールドのリスナー
// ========================================
function setupInputListeners() {
    // 基本情報（名前・メールアドレス）
    document.getElementById('userName')?.addEventListener('input', (e) => {
        AppState.formData.userName = e.target.value;
    });

    document.getElementById('userEmail')?.addEventListener('input', (e) => {
        AppState.formData.userEmail = e.target.value;
    });

    document.getElementById('clinicName')?.addEventListener('input', (e) => {
        AppState.formData.clinicName = e.target.value;
    });

    document.getElementById('region')?.addEventListener('change', (e) => {
        AppState.formData.region = e.target.value;
    });

    document.getElementById('yearsOpen')?.addEventListener('change', (e) => {
        AppState.formData.yearsOpen = e.target.value;
    });

    document.getElementById('units')?.addEventListener('change', (e) => {
        AppState.formData.units = e.target.value;
    });

    // 具体的入力フィールド
    const specificFields = [
        { id: 'newPatientSpecific', field: 'newPatient' },
        { id: 'totalRevenueSpecific', field: 'totalRevenue' },
        { id: 'selfPayRateSpecific', field: 'selfPayRate' },
        { id: 'cancelSpecific', field: 'cancel' },
        { id: 'recallSpecific', field: 'recall' }
    ];

    specificFields.forEach(({ id, field }) => {
        document.getElementById(id)?.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            if (!isNaN(value)) {
                AppState.formData[field] = value;
                // ボタンの選択を解除
                const buttonGroup = document.querySelector(`[data-field="${field}"]`);
                if (buttonGroup) {
                    buttonGroup.querySelectorAll('.option-button').forEach(b => b.classList.remove('selected'));
                }
            }
        });
    });

    // その他のお悩み
    document.getElementById('otherConcerns')?.addEventListener('input', (e) => {
        AppState.formData.otherConcerns = e.target.value;
    });
}

// ========================================
// 課題選択
// ========================================
function selectPriority(button) {
    // 他の選択を解除
    document.querySelectorAll('.priority-button').forEach(b => b.classList.remove('selected'));
    // このボタンを選択
    button.classList.add('selected');
    // 値を保存
    AppState.formData.priority = button.dataset.value;
    // 送信ボタンを有効化
    const submitButton = document.getElementById('submitButton');
    submitButton.disabled = false;

    // CTAボタンにスクロールしてアピール
    setTimeout(() => {
        submitButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
        submitButton.classList.add('cta-highlight');
        setTimeout(() => {
            submitButton.classList.remove('cta-highlight');
        }, 2000);
    }, 300);
}




// ========================================
// フォーム送信
// ========================================
async function submitForm() {
    // データ保存
    saveFormData();

    // ローディング画面を表示
    document.getElementById('formSection').classList.add('hidden');
    document.getElementById('loadingScreen').classList.remove('hidden');

    // ローディングアニメーション
    await runLoadingAnimation();

    // 結果を生成
    let recommendations;
    if (AppState.useApi && AppState.apiKey) {
        try {
            recommendations = await generateAIRecommendations();
        } catch (error) {
            console.error('API error:', error);
            recommendations = generateLocalRecommendations();
        }
    } else {
        recommendations = generateLocalRecommendations();
    }

    // 結果画面を表示
    document.getElementById('loadingScreen').classList.add('hidden');
    document.getElementById('resultsScreen').classList.remove('hidden');

    // 結果を表示
    displayResults(recommendations);

    // GASにデータを送信（PDFアドバイスシートをメール送信）
    if (AppState.formData.userEmail) {
        sendToGAS(AppState.formData, recommendations);
    }
}

// ========================================
// GAS連携（メール・PDF送信）
// ========================================
async function sendToGAS(formData, recommendations) {
    // URLが設定されていない場合はスキップ
    if (!GAS_WEBAPP_URL || GAS_WEBAPP_URL === 'YOUR_GAS_WEBAPP_URL_HERE') {
        console.log('GAS未設定: PDFメール送信をスキップ');
        return;
    }

    // 送信データを作成
    const payload = {
        userName: formData.userName,
        userEmail: formData.userEmail,
        clinicName: formData.clinicName,
        region: formData.region,
        yearsOpen: formData.yearsOpen,
        units: formData.units,
        newPatient: formData.newPatient,
        totalRevenue: formData.totalRevenue,
        selfPayRate: formData.selfPayRate,
        cancel: formData.cancel,
        recall: formData.recall,
        priority: formData.priority,
        otherConcerns: formData.otherConcerns,
        recommendations: recommendations,
        timestamp: new Date().toISOString()
    };

    try {
        await fetch(GAS_WEBAPP_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        console.log('GAS送信完了: PDFアドバイスシートをメール送信しました');
    } catch (error) {
        console.error('GAS送信エラー:', error);
    }
}

async function runLoadingAnimation() {
    const progressBar = document.getElementById('loadingProgressBar');
    const steps = [
        document.getElementById('loadingStep1'),
        document.getElementById('loadingStep2'),
        document.getElementById('loadingStep3')
    ];

    // ステップ1: データ分析
    steps[0].classList.add('active');
    await animateProgress(progressBar, 0, 33, 1000);
    steps[0].classList.remove('active');
    steps[0].classList.add('completed');

    // ステップ2: 類似医院検索
    steps[1].classList.add('active');
    await animateProgress(progressBar, 33, 66, 1000);
    steps[1].classList.remove('active');
    steps[1].classList.add('completed');

    // ステップ3: 改善提案生成
    steps[2].classList.add('active');
    await animateProgress(progressBar, 66, 100, 1000);
    steps[2].classList.remove('active');
    steps[2].classList.add('completed');
}

function animateProgress(element, from, to, duration) {
    return new Promise(resolve => {
        const startTime = performance.now();

        function update(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const current = from + (to - from) * progress;
            element.style.width = `${current}%`;

            if (progress < 1) {
                requestAnimationFrame(update);
            } else {
                resolve();
            }
        }

        requestAnimationFrame(update);
    });
}

// ========================================
// ローカル推薦生成
// ========================================
function generateLocalRecommendations() {
    const priority = AppState.formData.priority;
    const recommendations = KnowledgeBase.getRecommendations(priority, AppState.formData);
    const comparison = KnowledgeBase.generateComparison(AppState.formData);

    return {
        summary: AppState.formData,
        comparison: comparison,
        recommendations: recommendations,
        isApiGenerated: false
    };
}

// ========================================
// Gemini API連携
// ========================================
async function generateAIRecommendations() {
    const prompt = KnowledgeBase.generateGeminiPrompt(AppState.formData, AppState.formData.priority);

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${KnowledgeBase.GEMINI_CONFIG.model}:generateContent?key=${AppState.apiKey}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            contents: [{
                parts: [{ text: prompt }]
            }],
            generationConfig: {
                maxOutputTokens: KnowledgeBase.GEMINI_CONFIG.maxOutputTokens,
                temperature: KnowledgeBase.GEMINI_CONFIG.temperature
            }
        })
    });

    if (!response.ok) {
        throw new Error('API request failed');
    }

    const data = await response.json();
    const aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!aiResponse) {
        throw new Error('No response from API');
    }

    // AIレスポンスをパースして構造化
    const parsedRecommendations = parseAIResponse(aiResponse);
    const comparison = KnowledgeBase.generateComparison(AppState.formData);

    return {
        summary: AppState.formData,
        comparison: comparison,
        recommendations: parsedRecommendations,
        isApiGenerated: true,
        rawResponse: aiResponse
    };
}

function parseAIResponse(response) {
    // AIレスポンスから推薦を抽出（簡易パーサー）
    const priority = AppState.formData.priority;
    const baseRecommendations = KnowledgeBase.getRecommendations(priority, AppState.formData);

    // AIレスポンスを追加情報として含める
    return {
        ...baseRecommendations,
        aiAnalysis: response,
        isEnhanced: true
    };
}

// ========================================
// 結果表示
// ========================================
function displayResults(results) {
    displaySummary(results.summary);
    displayComparison(results.comparison);
    displayRecommendations(results.recommendations, results.isApiGenerated);
}

function displaySummary(summary) {
    const container = document.getElementById('resultsSummary');
    const items = [
        { label: '新患数', value: summary.newPatient ? `${summary.newPatient}人/月` : '--' },
        { label: '月間医業収入', value: summary.totalRevenue ? `${summary.totalRevenue}万円` : '--', highlight: true },
        { label: '自費率', value: summary.selfPayRate ? `${Math.floor(summary.selfPayRate)}%` : '--', highlight: true },
        { label: 'キャンセル率', value: summary.cancel ? `${Math.floor(summary.cancel)}%` : '--' },
        { label: 'リコール率', value: summary.recall ? `${Math.floor(summary.recall)}%` : '--' }
    ];

    container.innerHTML = items.map(item => `
        <div class="summary-card${item.highlight ? ' highlight' : ''}">
            <div class="summary-card-label">${item.label}</div>
            <div class="summary-card-value">${item.value}</div>
        </div>
    `).join('');

    // その他のお悩みがある場合
    if (summary.otherConcerns) {
        container.innerHTML += `
            <div class="summary-card" style="grid-column: 1 / -1;">
                <div class="summary-card-label">その他のお悩み</div>
                <div class="summary-card-value" style="font-size: 0.875rem; font-weight: 400;">${summary.otherConcerns}</div>
            </div>
        `;
    }
}

function displayComparison(comparison) {
    const container = document.getElementById('comparisonGrid');

    const items = [
        {
            label: '新患獲得力',
            percentile: comparison.newPatientPower.percentile,
            status: comparison.newPatientPower.status
        },
        {
            label: '自費転換力',
            percentile: comparison.selfPayPower.percentile,
            status: comparison.selfPayPower.status
        },
        {
            label: '患者定着率',
            percentile: comparison.patientRetention.percentile,
            status: comparison.patientRetention.status
        }
    ];

    container.innerHTML = items.map(item => {
        // 上位パーセントを計算（0%にならないように最低0.1%を保証）
        let topPercent = 100 - item.percentile;
        if (topPercent <= 0) {
            topPercent = 0.1;
        } else if (topPercent < 0.1) {
            topPercent = 0.1;
        }

        // 小数点第一位まで表示（10未満は小数点表示、10以上は整数）
        let displayPercent;
        if (topPercent < 10) {
            displayPercent = topPercent.toFixed(1);
        } else {
            displayPercent = Math.floor(topPercent);
        }

        return `
            <div class="comparison-card">
                <div class="comparison-label">${item.label}</div>
                <div class="comparison-value">上位 ${displayPercent}%</div>
                <span class="comparison-badge ${item.status === 'excellent' || item.status === 'good' ? 'good' : 'warning'}">
                    ${getStatusLabel(item.status)}
                </span>
            </div>
        `;
    }).join('');
}

function displayRecommendations(recommendations, isApiGenerated) {
    const container = document.getElementById('recommendationsList');

    if (!recommendations || !recommendations.items) {
        container.innerHTML = '<p>提案を生成できませんでした。</p>';
        return;
    }

    // AIによる分析がある場合は先に表示
    let html = '';

    if (recommendations.aiAnalysis) {
        html += `
            <div class="recommendation-card" style="border-left: 4px solid var(--success-500);">
                <div class="recommendation-header">
                    <div class="recommendation-number" style="background: var(--success-500);">AI</div>
                    <div class="recommendation-title">AIによる詳細分析</div>
                </div>
                <div class="recommendation-body">
                    <div class="recommendation-description" style="white-space: pre-wrap;">${formatAIResponse(recommendations.aiAnalysis)}</div>
                </div>
            </div>
        `;
    }

    // 標準の推薦を表示
    html += recommendations.items.map((item, index) => `
        <div class="recommendation-card">
            <div class="recommendation-header">
                <div class="recommendation-number">${index + 1}</div>
                <div class="recommendation-title">${item.title}</div>
            </div>
            <div class="recommendation-body">
                <p class="recommendation-description">${item.description}</p>
                ${item.additionalNote ? `<p class="recommendation-description" style="color: var(--accent-500);"><strong>※ ${item.additionalNote}</strong></p>` : ''}
                <div class="recommendation-steps">
                    ${item.steps.map(step => `
                        <div class="recommendation-step">
                            <svg class="recommendation-step-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="20 6 9 17 4 12"/>
                            </svg>
                            <span>${step}</span>
                        </div>
                    `).join('')}
                </div>
                <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
                    <span class="recommendation-effect">${item.effect}</span>
                    <span style="font-size: 0.75rem; color: var(--gray-400);">難易度: ${item.difficulty} | ${item.period}</span>
                </div>
            </div>
        </div>
    `).join('');

    container.innerHTML = html;
}

function formatAIResponse(text) {
    // Markdownスタイルのフォーマットを簡易的にHTMLに変換
    return text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n\n/g, '</p><p>')
        .replace(/\n/g, '<br>');
}

// ========================================
// 再スタート
// ========================================
function restartDiagnosis() {
    // 状態をリセット
    AppState.currentStep = 1;
    AppState.formData = {};

    // 画面を切り替え
    document.getElementById('resultsScreen').classList.add('hidden');
    document.getElementById('landing').classList.remove('hidden');

    // フォームをリセット
    document.querySelectorAll('.option-button').forEach(b => b.classList.remove('selected'));
    document.querySelectorAll('.priority-button').forEach(b => b.classList.remove('selected'));
    document.querySelectorAll('input, select, textarea').forEach(el => {
        if (el.type === 'checkbox') {
            el.checked = false;
        } else {
            el.value = '';
        }
    });

    // ステップをリセット
    document.querySelectorAll('.step').forEach((step, index) => {
        if (index === 0) {
            step.classList.remove('hidden');
        } else {
            step.classList.add('hidden');
        }
    });

    // ローディングステップをリセット
    document.querySelectorAll('.loading-step').forEach(step => {
        step.classList.remove('active', 'completed');
    });
    document.getElementById('loadingProgressBar').style.width = '0%';

    // 送信ボタンを無効化
    document.getElementById('submitButton').disabled = true;

    // ローカルストレージをクリア
    localStorage.removeItem('dentalAIFormData');
}

// ========================================
// API設定
// ========================================
function openApiSettings() {
    document.getElementById('apiSettingsModal').classList.remove('hidden');
    document.getElementById('apiKeyInput').value = AppState.apiKey || '';
    document.getElementById('useApiCheckbox').checked = AppState.useApi;
}

function closeApiSettings() {
    document.getElementById('apiSettingsModal').classList.add('hidden');
}

function saveApiSettings() {
    AppState.apiKey = document.getElementById('apiKeyInput').value;
    AppState.useApi = document.getElementById('useApiCheckbox').checked;

    // ローカルストレージに保存
    localStorage.setItem('dentalAI_apiKey', AppState.apiKey);
    localStorage.setItem('dentalAI_useApi', AppState.useApi);

    closeApiSettings();
}

function loadApiSettings() {
    AppState.apiKey = localStorage.getItem('dentalAI_apiKey') || null;
    AppState.useApi = localStorage.getItem('dentalAI_useApi') === 'true';
}

// ========================================
// フォームデータの保存・復元
// ========================================
function saveFormData() {
    localStorage.setItem('dentalAIFormData', JSON.stringify(AppState.formData));
}

function restoreFormData() {
    const saved = localStorage.getItem('dentalAIFormData');
    if (saved) {
        try {
            AppState.formData = JSON.parse(saved);
            // UIに反映（必要に応じて実装）
        } catch (e) {
            console.error('Failed to restore form data:', e);
        }
    }
}

// ========================================
// ヘルパー関数
// ========================================
function getRegionLabel(value) {
    const labels = {
        hokkaido: '北海道',
        tohoku: '東北',
        kanto: '関東',
        chubu: '中部',
        tokai: '東海',
        kinki: '近畿',
        chugoku: '中国',
        shikoku: '四国',
        kyushu: '九州・沖縄'
    };
    return labels[value] || value;
}

function getYearsLabel(value) {
    const labels = {
        'under3': '3年未満',
        '3to5': '3〜5年',
        '5to10': '5〜10年',
        '10to20': '10〜20年',
        'over20': '20年以上'
    };
    return labels[value] || value;
}

function getStatusLabel(status) {
    const labels = {
        excellent: '優秀',
        good: '良好',
        average: '平均的',
        needsImprovement: '改善余地あり'
    };
    return labels[status] || status;
}

// ========================================
// 相談プラン選択
// ========================================
const CONSULTATION_PLANS = {
    light: {
        name: 'お手軽相談',
        duration: '30分',
        badge: 'LIGHT'
    },
    standard: {
        name: 'しっかり相談',
        duration: '1時間',
        badge: 'STANDARD'
    },
    premium: {
        name: 'がっつり相談',
        duration: '2時間',
        badge: 'PREMIUM'
    }
};

let selectedPlan = null;

function openConsultationPlans() {
    document.getElementById('consultationPlansModal').classList.remove('hidden');
    document.body.style.overflow = 'hidden';

    // モバイル用スクロールインジケーターをセットアップ
    setupPlansScrollIndicator();
}

// プランカードのスクロールインジケーターをセットアップ
function setupPlansScrollIndicator() {
    const plansGrid = document.querySelector('.plans-grid');
    const dots = document.querySelectorAll('.plans-scroll-hint .dot');

    if (!plansGrid || !dots.length) return;

    // スクロールイベントでインジケーターを更新
    plansGrid.addEventListener('scroll', () => {
        const scrollLeft = plansGrid.scrollLeft;
        const cardWidth = plansGrid.querySelector('.plan-card')?.offsetWidth || 280;
        const gap = 16;
        const activeIndex = Math.round(scrollLeft / (cardWidth + gap));

        dots.forEach((dot, index) => {
            dot.classList.toggle('active', index === activeIndex);
        });
    });

    // ドットクリックでスクロール
    dots.forEach((dot, index) => {
        dot.addEventListener('click', () => {
            const cardWidth = plansGrid.querySelector('.plan-card')?.offsetWidth || 280;
            const gap = 16;
            plansGrid.scrollTo({
                left: index * (cardWidth + gap),
                behavior: 'smooth'
            });
        });
    });

    // 初期状態で「おすすめ」のがっつり相談（3番目）を中央に表示
    setTimeout(() => {
        if (window.innerWidth <= 800) {
            const cardWidth = plansGrid.querySelector('.plan-card')?.offsetWidth || 280;
            const gap = 16;
            plansGrid.scrollTo({
                left: 2 * (cardWidth + gap),
                behavior: 'smooth'
            });
        }
    }, 100);
}

function closeConsultationPlans() {
    document.getElementById('consultationPlansModal').classList.add('hidden');
    document.body.style.overflow = '';
}

function selectPlan(planType) {
    selectedPlan = planType;
    const plan = CONSULTATION_PLANS[planType];

    // プラン情報をバナーに表示
    document.getElementById('selectedPlanBanner').innerHTML = `
        <div class="plan-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 6v6l4 2"/>
            </svg>
        </div>
        <div class="plan-info">
            <h4>${plan.name}（${plan.duration}）</h4>
            <p>選択中のプラン: ${plan.badge}</p>
        </div>
    `;

    // フォームに診断データを自動入力
    if (AppState.formData.clinicName) {
        document.getElementById('appClinicName').value = AppState.formData.clinicName;
    }
    if (AppState.formData.userName) {
        document.getElementById('appName').value = AppState.formData.userName;
    }
    if (AppState.formData.userEmail) {
        document.getElementById('appEmail').value = AppState.formData.userEmail;
    }

    // プラン選択モーダルを閉じて申し込みフォームを開く
    closeConsultationPlans();
    document.getElementById('applicationFormModal').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function closeApplicationForm() {
    document.getElementById('applicationFormModal').classList.add('hidden');
    document.body.style.overflow = '';
    // フォームをリセット
    document.getElementById('applicationForm').reset();
}

function backToPlans() {
    closeApplicationForm();
    openConsultationPlans();
}

function closeApplicationComplete() {
    document.getElementById('applicationCompleteModal').classList.add('hidden');
    document.body.style.overflow = '';
}

async function submitApplication(event) {
    event.preventDefault();

    const formData = {
        plan: CONSULTATION_PLANS[selectedPlan],
        planType: selectedPlan,
        clinicName: document.getElementById('appClinicName').value,
        name: document.getElementById('appName').value,
        position: document.getElementById('appPosition').value,
        email: document.getElementById('appEmail').value,
        phone: document.getElementById('appPhone').value,
        submittedAt: new Date().toISOString()
    };

    // 完了画面のサマリーを生成
    document.getElementById('completeSummary').innerHTML = `
        <div class="summary-row">
            <span class="summary-label">プラン</span>
            <span class="summary-value">${formData.plan.name}（${formData.plan.duration}）</span>
        </div>
        <div class="summary-row">
            <span class="summary-label">医院名</span>
            <span class="summary-value">${formData.clinicName}</span>
        </div>
        <div class="summary-row">
            <span class="summary-label">お名前</span>
            <span class="summary-value">${formData.name}</span>
        </div>
        <div class="summary-row">
            <span class="summary-label">役職</span>
            <span class="summary-value">${formData.position}</span>
        </div>
        <div class="summary-row">
            <span class="summary-label">メールアドレス</span>
            <span class="summary-value">${formData.email}</span>
        </div>
        <div class="summary-row">
            <span class="summary-label">電話番号</span>
            <span class="summary-value">${formData.phone}</span>
        </div>
    `;

    // メール送信（実際の実装ではバックエンドAPIを呼び出す）
    try {
        await sendApplicationEmail(formData);
    } catch (error) {
        console.error('メール送信エラー:', error);
    }

    // 申し込みフォームを閉じて完了画面を表示
    closeApplicationForm();
    document.getElementById('applicationCompleteModal').classList.remove('hidden');
    document.body.style.overflow = 'hidden';

    // ローカルストレージに保存（分析用）
    const applications = JSON.parse(localStorage.getItem('consultationApplications') || '[]');
    applications.push(formData);
    localStorage.setItem('consultationApplications', JSON.stringify(applications));
}

async function sendApplicationEmail(formData) {
    // メール送信のシミュレーション
    // 実際のプロダクションでは、バックエンドAPIを呼び出してメールを送信する
    console.log('申し込み情報:', formData);

    // mailto リンクを生成して確認メールの代わりとする
    const subject = encodeURIComponent(`【無料相談申込】${formData.plan.name} - ${formData.clinicName}`);
    const body = encodeURIComponent(`
以下の内容で無料相談のお申し込みを受け付けました。

■ プラン: ${formData.plan.name}（${formData.plan.duration}）
■ 医院名: ${formData.clinicName}
■ お名前: ${formData.name}
■ 役職: ${formData.position}
■ メールアドレス: ${formData.email}
■ 電話番号: ${formData.phone}
■ 申込日時: ${new Date(formData.submittedAt).toLocaleString('ja-JP')}

担当者より2営業日以内にご連絡いたします。
ご不明点がございましたら、045-440-0322までお電話ください。

─────────────────────
歯科医院地域一番実践会
─────────────────────
    `.trim());

    // メールクライアントを開く（デモ用）
    // window.location.href = `mailto:${formData.email}?subject=${subject}&body=${body}`;

    return Promise.resolve();
}

// ========================================
// 診断結果メール送信
// ========================================
async function sendDiagnosisResultEmail(recommendations) {
    const formData = AppState.formData;
    const comparison = recommendations.comparison;

    // 優先課題のラベル取得
    const priorityLabels = {
        newPatient: '新患を増やしたい',
        selfPay: '自費率を上げたい',
        cancel: 'キャンセルを減らしたい',
        staff: 'スタッフの定着・採用',
        efficiency: '業務を効率化したい'
    };

    // メール本文を生成
    const emailContent = {
        to: formData.userEmail,
        name: formData.userName,
        clinicName: formData.clinicName || '未入力',
        subject: '【AI無料診断】診断結果のお知らせ',
        body: `
${formData.userName} 様

この度はAI無料診断をご利用いただき、誠にありがとうございます。
診断結果をお送りいたします。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
■ 入力データサマリー
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
医院名: ${formData.clinicName || '未入力'}
新患数: ${formData.newPatient ? formData.newPatient + '人/月' : '未入力'}
月間医業収入: ${formData.totalRevenue ? formData.totalRevenue + '万円' : '未入力'}
自費率: ${formData.selfPayRate ? Math.floor(formData.selfPayRate) + '%' : '未入力'}
キャンセル率: ${formData.cancel ? Math.floor(formData.cancel) + '%' : '未入力'}
リコール率: ${formData.recall ? Math.floor(formData.recall) + '%' : '未入力'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
■ 類似医院との比較
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
新患獲得力: 上位 ${Math.max(0.1, 100 - comparison.newPatientPower.percentile).toFixed(1)}%
自費転換力: 上位 ${Math.max(0.1, 100 - comparison.selfPayPower.percentile).toFixed(1)}%
患者定着率: 上位 ${Math.max(0.1, 100 - comparison.patientRetention.percentile).toFixed(1)}%

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
■ 最も解決したい課題
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${priorityLabels[formData.priority] || formData.priority}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
■ AIからの提案
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${recommendations.recommendations.items.map((item, i) => `
【${i + 1}】${item.title}
${item.description}
期待効果: ${item.effect}
`).join('\n')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

詳しい改善プランについては、無料相談をご予約ください。
あなたの医院に最適な改善策をご提案いたします。

▼ 無料相談のご予約はこちら
電話: 045-440-0322（平日 9:00-18:00）

─────────────────────
歯科医院地域一番実践会
─────────────────────
        `.trim()
    };

    // コンソールにログ出力（実際の実装ではバックエンドAPIを呼び出す）
    console.log('診断結果メール送信:', emailContent);

    // ローカルストレージに保存（分析用）
    const diagnosisResults = JSON.parse(localStorage.getItem('diagnosisResults') || '[]');
    diagnosisResults.push({
        ...emailContent,
        sentAt: new Date().toISOString(),
        formData: formData
    });
    localStorage.setItem('diagnosisResults', JSON.stringify(diagnosisResults));

    return Promise.resolve();
}
