/**
 * 歯科医院AI診断フォーム - メインアプリケーション
 */

// ========================================
// グローバル状態
// ========================================
const AppState = {
    currentStep: 1,
    totalSteps: 4,
    formData: {},
    apiKey: null,
    useApi: false
};

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
    const timePerStep = [15, 30, 30, 15];
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
                // 計算を更新
                updateCalculations();
                // 可視化パネルを更新
                updateVisualizationPanel();
            });
        });
    });
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
    // 基本情報
    document.getElementById('clinicName')?.addEventListener('input', (e) => {
        AppState.formData.clinicName = e.target.value;
        updateVisualizationPanel();
    });

    document.getElementById('region')?.addEventListener('change', (e) => {
        AppState.formData.region = e.target.value;
        updateVisualizationPanel();
        updateSimilarClinics();
    });

    document.getElementById('yearsOpen')?.addEventListener('change', (e) => {
        AppState.formData.yearsOpen = e.target.value;
        updateVisualizationPanel();
        updateSimilarClinics();
    });

    document.getElementById('units')?.addEventListener('change', (e) => {
        AppState.formData.units = e.target.value;
        updateVisualizationPanel();
        updateSimilarClinics();
    });

    // 具体的入力フィールド
    const specificFields = [
        { id: 'newPatientSpecific', field: 'newPatient' },
        { id: 'dailyVisitSpecific', field: 'dailyVisit' },
        { id: 'insuranceSpecific', field: 'insurance' },
        { id: 'selfPaySpecific', field: 'selfPay' },
        { id: 'cancelSpecific', field: 'cancel' },
        { id: 'recallSpecific', field: 'recall' },
        { id: 'receiptSpecific', field: 'receipt' }
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
                updateCalculations();
                updateVisualizationPanel();
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
    document.getElementById('submitButton').disabled = false;
}

// ========================================
// 計算処理
// ========================================
function updateCalculations() {
    const insurance = AppState.formData.insurance || 0;
    const selfPay = AppState.formData.selfPay || 0;

    // 月間医業収入
    const totalRevenue = insurance + selfPay;
    document.getElementById('totalRevenue').textContent = totalRevenue > 0 ? `${totalRevenue} 万円` : '-- 万円';

    // 自費率（小数点以下切り捨て）
    let selfPayRate = 0;
    if (totalRevenue > 0) {
        selfPayRate = Math.floor((selfPay / totalRevenue) * 100);
        document.getElementById('selfPayRate').textContent = `${selfPayRate} %`;
    } else {
        document.getElementById('selfPayRate').textContent = '-- %';
    }

    // データ保存
    AppState.formData.totalRevenue = totalRevenue;
    AppState.formData.selfPayRate = selfPayRate;
}

// ========================================
// 可視化パネル
// ========================================
function updateVisualizationPanel() {
    // 基本情報
    document.getElementById('summaryClinicName').textContent = AppState.formData.clinicName || '--';
    document.getElementById('summaryRegion').textContent = getRegionLabel(AppState.formData.region) || '--';
    document.getElementById('summaryYears').textContent = getYearsLabel(AppState.formData.yearsOpen) || '--';
    document.getElementById('summaryUnits').textContent = AppState.formData.units ? `${AppState.formData.units}台` : '--';

    // メトリクスバー（すべての数値データを反映）
    updateMetricBar('NewPatient', AppState.formData.newPatient, 150, '人');
    updateMetricBar('DailyVisit', AppState.formData.dailyVisit, 150, '人');
    updateMetricBar('Insurance', AppState.formData.insurance, 2000, '万円');
    updateMetricBar('SelfPay', AppState.formData.selfPay, 2000, '万円');
    updateMetricBar('TotalRevenue', AppState.formData.totalRevenue, 4000, '万円');
    updateMetricBar('SelfPayRate', AppState.formData.selfPayRate, 100, '%');
    updateMetricBar('Cancel', AppState.formData.cancel, 15, '%');
    updateMetricBar('Recall', AppState.formData.recall, 100, '%');
    updateMetricBar('Receipt', AppState.formData.receipt, 4000, '枚');
}

function updateMetricBar(name, value, max, unit) {
    const bar = document.getElementById(`bar${name}`);
    const metric = document.getElementById(`metric${name}`);

    // 要素が存在しない場合はスキップ
    if (!bar || !metric) return;

    if (value && value > 0) {
        const percentage = Math.min((value / max) * 100, 100);
        bar.style.width = `${percentage}%`;
        // 率の表示は小数点以下切り捨て
        if (unit === '%') {
            metric.textContent = `${Math.floor(value)}${unit}`;
        } else {
            metric.textContent = `${value}${unit}`;
        }
    } else {
        bar.style.width = '0%';
        metric.textContent = '--';
    }
}

function updateSimilarClinics() {
    const count = KnowledgeBase.estimateSimilarClinics(AppState.formData);
    document.getElementById('similarCount').textContent = count.toLocaleString();
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
        { label: '来院数/日', value: summary.dailyVisit ? `${summary.dailyVisit}人` : '--' },
        { label: '保険収入', value: summary.insurance ? `${summary.insurance}万円` : '--' },
        { label: '自費収入', value: summary.selfPay ? `${summary.selfPay}万円` : '--' },
        { label: '月間医業収入', value: summary.totalRevenue ? `${summary.totalRevenue}万円` : '--', highlight: true },
        { label: '自費率', value: summary.selfPayRate ? `${Math.floor(summary.selfPayRate)}%` : '--', highlight: true },
        { label: 'キャンセル率', value: summary.cancel ? `${Math.floor(summary.cancel)}%` : '--' },
        { label: 'リコール率', value: summary.recall ? `${Math.floor(summary.recall)}%` : '--' },
        { label: 'レセプト枚数', value: summary.receipt ? `${summary.receipt}枚/月` : '--' }
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

    // 可視化パネルをリセット
    updateVisualizationPanel();

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
