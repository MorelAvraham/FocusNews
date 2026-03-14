document.addEventListener('DOMContentLoaded', () => {
    const lastUpdatedEl = document.getElementById('last-updated');
    const loadingState = document.getElementById('loading-state');
    const errorState = document.getElementById('error-state');
    const errorMessage = document.getElementById('error-message');
    const dashboardData = document.getElementById('dashboard-data');
    const categoriesContainer = document.getElementById('categories-container');
    const timeline = document.getElementById('timeline');
    const topSignalsContainer = document.getElementById('top-signals-container');
    const monitoredSourcesTags = document.getElementById('monitored-sources-tags');
    const shareWhatsappBtn = document.getElementById('share-whatsapp-btn');
    const themeToggle = document.getElementById('theme-toggle');
    const themeIcon = document.getElementById('theme-icon');
    const themeText = document.getElementById('theme-text');
    const langToggle = document.getElementById('lang-toggle');
    const langText = document.getElementById('lang-text');
    const copySummaryBtn = document.getElementById('copy-summary-btn');

    let currentLang = localStorage.getItem('lang') || 'he';
    let lastFetchTime = null;
    let loadingPhaseInterval = null;
    let currentData = null;

    const getDict = () => i18n[currentLang];
    const sanitizeShareText = (value) => (value || '').replace(/[^\S\r\n]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();

    const levelIconMap = {
        critical: '🚨',
        notable: '🟠',
        info: '🔹'
    };

    const sourceNameForItem = (item) => item.source_label || item.source || '';
    const sourceNamesForItem = (item) => item.matched_source_labels || item.matched_sources || [];

    const animateCountUp = (el, target, duration = 600) => {
        if (!el) return;
        const start = parseInt(el.textContent, 10) || 0;
        const range = target - start;
        if (range === 0 || Number.isNaN(target)) {
            el.textContent = target;
            return;
        }
        const startTime = performance.now();
        const step = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            el.textContent = Math.round(start + range * eased);
            if (progress < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
    };

    const setRefreshLoading = (isLoading) => {
        void isLoading;
    };

    const updateFreshnessDot = () => {
        const dot = document.getElementById('freshness-dot');
        if (!dot || !lastFetchTime) return;
        const age = Math.floor((Date.now() - lastFetchTime) / 60000);
        dot.style.display = 'inline-block';
        if (age < 20) {
            dot.style.background = 'var(--accent-green)';
            dot.title = currentLang === 'he' ? (age < 1 ? 'רענן' : `בן ${age} דקות`) : (age < 1 ? 'Fresh' : `${age}m old`);
        } else if (age < 50) {
            dot.style.background = 'var(--accent-orange)';
            dot.title = currentLang === 'he' ? `בן ${age} דקות` : `${age}m old`;
        } else {
            dot.style.background = 'var(--accent-red)';
            dot.title = currentLang === 'he' ? 'עתיד להתעדכן בקרוב' : 'Due for update soon';
        }
    };

    const updateUIText = () => {
        const dict = getDict();
        document.documentElement.dir = currentLang === 'he' ? 'rtl' : 'ltr';
        document.documentElement.lang = currentLang;

        document.querySelector('h2').innerText = dict.subtitle;
        document.querySelector('header p').innerText = dict.desc;
        document.querySelector('#loading-state h3').innerText = dict.loadingTitle;
        document.querySelector('#loading-state p').innerText = dict.loadingDesc;
        document.querySelector('#error-state h3').innerText = dict.errorTitle;
        document.getElementById('whatsapp-text').innerText = dict.shareBtn;
        document.querySelector('.timeline-section h3').innerHTML = `<i class="icon">⏱️</i> ${dict.timelineTitle.replace('⏱️ ', '')}`;
        document.getElementById('summary-title').innerText = dict.summaryTitle;
        document.getElementById('top-signals-title').innerText = dict.topSignalsTitle;
        document.getElementById('live-label').innerText = dict.liveLabel;
        document.getElementById('viewers-label').innerText = dict.viewsLabel;
        const copyLabel = document.getElementById('copy-label');
        if (copyLabel) copyLabel.innerText = dict.copyBtn;
        const retryLabel = document.getElementById('retry-label');
        if (retryLabel) retryLabel.innerText = dict.retryBtn;
        const loadingTitleEl = document.getElementById('loading-title');
        if (loadingTitleEl) loadingTitleEl.innerText = dict.loadingTitle;
        const loadingDescEl = document.getElementById('loading-desc');
        if (loadingDescEl) loadingDescEl.innerText = dict.loadingDesc;

        langText.innerText = dict.langName;
        updateHistoryDropdown();
        updateFreshnessDot();

        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        themeText.innerText = isDark ? dict.themeLight : dict.themeDark;

        if (currentData) {
            applyViewState();
        }
    };

    const updateHistoryDropdown = () => {
        const dict = getDict();
        const historySelector = document.getElementById('history-selector');
        if (!historySelector) return;
        const prevVal = historySelector.value || '0';
        historySelector.innerHTML = '';
        for (let i = 0; i <= 24; i++) {
            const option = document.createElement('option');
            option.value = i;
            if (i === 0) option.text = dict.historyNow;
            else if (i === 1) option.text = dict.historyHourAgo;
            else option.text = dict.historyHoursAgo.replace('{h}', i);
            historySelector.appendChild(option);
        }
        historySelector.value = prevVal;
    };

    const buildEndpoint = () => {
        const historySelector = document.getElementById('history-selector');
        const hoursAgo = historySelector ? historySelector.value : '0';
        const params = new URLSearchParams({ lang: currentLang });
        if (hoursAgo !== '0') {
            params.set('hours_ago', hoursAgo);
            return `/api/history?${params.toString()}`;
        }
        return `/api/updates?${params.toString()}`;
    };

    const parseApiResponse = async (res) => {
        const text = await res.text();
        try {
            const data = text ? JSON.parse(text) : {};
            return { data, rawText: text };
        } catch (error) {
            const cleaned = (text || '').replace(/\s+/g, ' ').trim();
            const excerpt = cleaned.slice(0, 180);
            const message = excerpt || `Server Error (${res.status})`;
            throw new Error(message);
        }
    };

    const fetchUpdates = async () => {
        try {
            showLoading();
            const res = await fetch(buildEndpoint());
            const { data } = await parseApiResponse(res);

            if (!res.ok && !data.stale) {
                throw new Error(data.error || `Server Error (${res.status})`);
            }

            currentData = data;
            applyViewState();

            const timeString = data.generated_at || new Date().toLocaleTimeString(currentLang === 'en' ? 'en-US' : 'he-IL', { hour: '2-digit', minute: '2-digit' });
            lastUpdatedEl.innerText = `${getDict().lastTestedTemplate}${timeString} | ${getDict().autoUpdateNote}`;

            if (document.hidden) {
                document.title = getDict().newUpdatesTab;
            }
        } catch (error) {
            console.error('Error fetching dashboard data:', error);
            showError(error.message);
            lastUpdatedEl.innerText = getDict().serverError;
        }
    };

    const startLoadingPhases = () => {
        const phaseEl = document.getElementById('loading-phase');
        if (!phaseEl) return;
        const phases = getDict().loadingPhases;
        let i = 0;
        phaseEl.textContent = phases[0];
        loadingPhaseInterval = setInterval(() => {
            i = (i + 1) % phases.length;
            phaseEl.textContent = phases[i];
        }, 2500);
    };

    const stopLoadingPhases = () => {
        if (loadingPhaseInterval) {
            clearInterval(loadingPhaseInterval);
            loadingPhaseInterval = null;
        }
        const phaseEl = document.getElementById('loading-phase');
        if (phaseEl) phaseEl.textContent = '';
    };

    const setStaleBanner = (isStale) => {
        const banner = document.getElementById('stale-banner');
        const msg = document.getElementById('stale-msg');
        if (!banner) return;
        if (isStale) {
            if (msg) msg.textContent = getDict().staleBanner;
            banner.classList.remove('hidden');
        } else {
            banner.classList.add('hidden');
        }
    };

    const showLoading = () => {
        setRefreshLoading(true);
        startLoadingPhases();
        loadingState.classList.remove('hidden');
        errorState.classList.add('hidden');
        dashboardData.classList.add('hidden');
    };

    const showError = (msg) => {
        setRefreshLoading(false);
        stopLoadingPhases();
        loadingState.classList.add('hidden');
        dashboardData.classList.add('hidden');
        errorState.classList.remove('hidden');
        errorMessage.innerText = msg;
    };

    const badgeHtml = (item) => {
        const sourcesCount = sourceNamesForItem(item).length;
        return `
            <div class="meta-badges">
                ${sourcesCount ? `<span class="meta-badge meta-badge-sources">${sourcesCount} ${currentLang === 'he' ? 'מקורות' : 'sources'}</span>` : ''}
            </div>
        `;
    };

    const renderTopSignals = (signals) => {
        topSignalsContainer.innerHTML = '';
        if (!signals.length) {
            topSignalsContainer.innerHTML = `<div class="signal-card empty-state">${getDict().noSignals}</div>`;
            return;
        }
        signals.slice(0, 5).forEach((signal, idx) => {
            const card = document.createElement('article');
            card.className = 'signal-card animate-in';
            card.style.animationDelay = `${idx * 70}ms`;
            const sourceList = (signal.matched_source_labels || []).join(' • ');
            card.innerHTML = `
                <div class="signal-card-top">
                    <span class="signal-topic-pill">${signal.topic}</span>
                    <span class="signal-confidence">${Math.round((signal.confidence || 0) * 100)}%</span>
                </div>
                <h4>${signal.title || ''}</h4>
                <p>${signal.why_it_matters || ''}</p>
                <div class="signal-sources">${sourceList}</div>
            `;
            topSignalsContainer.appendChild(card);
        });
    };

    const renderSourceCatalog = (summary = { active_count: 0, enabled_count: 0, sources: [] }, sourceCatalog = []) => {
        monitoredSourcesTags.innerHTML = '';
        const titleEl = document.getElementById('monitored-sources-title');
        titleEl.innerHTML = `${getDict().sourcesTitle.split('<span>')[0]} <span>(${summary.active_count || 0}/${summary.enabled_count || 0} ${currentLang === 'he' ? 'פעילים' : 'active'})</span>`;

        const activeSources = summary.sources || [];
        const contributionMap = Object.fromEntries(activeSources.map((source) => [source.id, source]));
        sourceCatalog.forEach((source) => {
            const sourceState = contributionMap[source.id];
            const tag = document.createElement('span');
            tag.className = `source-catalog-chip ${sourceState?.contributed ? 'contributed' : ''}`;
            tag.innerHTML = `${source.name} <small>${source.trust_score.toFixed(2)}</small>`;
            monitoredSourcesTags.appendChild(tag);
        });
    };

    const renderCategories = (categories) => {
        categoriesContainer.innerHTML = '';
        if (!categories.length) {
            categoriesContainer.innerHTML = `<div class="glass-panel text-center full-width"><p style="color:var(--text-secondary);">${getDict().noCategories}</p></div>`;
            return;
        }

        categories.forEach((cat, idx) => {
            const section = document.createElement('section');
            section.className = 'glass-panel category-section animate-in';
            section.style.animationDelay = `${idx * 60}ms`;

            const iconMap = {
                'ביטחון': '🛡️', 'Security': '🛡️',
                'פוליטיקה': '🏛️', 'Politics': '🏛️',
                'כלכלה': '📈', 'Economy': '📈',
                'כללי': '📰', 'General': '📰'
            };
            const itemCount = cat.items ? cat.items.length : 0;
            const listHtml = itemCount
                ? cat.items.map((item) => {
                    const sourceStr = sourceNameForItem(item);
                    const matchedSources = sourceNamesForItem(item).join(' • ');
                    return `<li>
                        <div class="item-content">${item.text || ''}</div>
                        ${badgeHtml(item)}
                        <div class="item-source-row">
                            ${sourceStr ? `<div class="item-source-tag">${sourceStr}</div>` : ''}
                            ${matchedSources ? `<div class="item-source-secondary">${matchedSources}</div>` : ''}
                        </div>
                    </li>`;
                }).join('')
                : `<li style="color:var(--text-secondary); border-color:transparent;">${getDict().noEvents}</li>`;

            section.innerHTML = `
                <h3 class="category-header" title="${getDict().expand}/${getDict().collapse}">
                    <i class="icon">${iconMap[cat.name] || '📰'}</i> ${cat.name}
                    ${itemCount ? `<span class="category-count-badge">${itemCount}</span>` : ''}
                    <span class="category-toggle-icon">▼</span>
                </h3>
                <ul class="category-list">${listHtml}</ul>
            `;
            categoriesContainer.appendChild(section);

            const header = section.querySelector('.category-header');
            const list = section.querySelector('.category-list');
            header.addEventListener('click', () => {
                header.classList.toggle('collapsed');
                list.classList.toggle('collapsed');
            });
        });
    };

    const renderTimeline = (timelineItems) => {
        timeline.innerHTML = '';
        if (!timelineItems.length) {
            timeline.innerHTML = `<div class="glass-panel-light" style="padding: 1.5rem; text-align: center; color: var(--text-secondary);">${getDict().noTimeline}</div>`;
            return;
        }

        const sortedTimeline = [...timelineItems].sort((a, b) => (a.time || '').localeCompare(b.time || ''));
        sortedTimeline.forEach((item, idx) => {
            const tlItem = document.createElement('div');
            const level = item.level || 'info';
            tlItem.className = `timeline-item timeline-level-${level} animate-in`;
            tlItem.style.animationDelay = `${idx * 50}ms`;
            tlItem.innerHTML = `
                <div class="timeline-time">${item.time || ''}</div>
                <div class="timeline-marker timeline-marker-${level}"></div>
                <div class="timeline-content glass-panel-light">
                    <div class="timeline-topline">
                        <span class="timeline-source">${sourceNameForItem(item) || ''}</span>
                        ${badgeHtml(item)}
                    </div>
                    <p>${levelIconMap[level] || '🔹'} ${item.event || ''}</p>
                    ${item.why_it_matters ? `<div class="why-it-matters"><strong>${getDict().whyItMatters}:</strong> ${item.why_it_matters}</div>` : ''}
                </div>
            `;
            timeline.appendChild(tlItem);
        });
    };

    const renderSummary = (data) => {
        const aiSummaryContainer = document.getElementById('ai-summary-container');
        const aiSummaryText = document.getElementById('ai-summary-text');
        if (data.summary) {
            aiSummaryText.innerText = data.summary;
            aiSummaryContainer.classList.remove('hidden');
        } else {
            aiSummaryContainer.classList.add('hidden');
        }
    };

    const renderDashboard = (data) => {
        setRefreshLoading(false);
        stopLoadingPhases();
        setStaleBanner(data.stale === true);
        loadingState.classList.add('hidden');
        errorState.classList.add('hidden');
        dashboardData.style.opacity = '0';
        dashboardData.classList.remove('hidden');
        requestAnimationFrame(() => {
            dashboardData.style.transition = 'opacity 0.3s ease';
            dashboardData.style.opacity = '1';
        });

        lastFetchTime = Date.now();
        updateFreshnessDot();

        renderSummary(data);
        renderTopSignals(data.top_signals || []);
        renderSourceCatalog(data.sources_summary || {}, data.source_catalog || []);
        renderCategories(data.categories || []);
        renderTimeline(data.timeline || []);
    };

    const applyViewState = () => {
        if (!currentData) return;
        renderDashboard(currentData);
    };

    const initCountdown = () => {
        const countdownEl = document.getElementById('countdown-timer');
        if (!countdownEl) return;
        let firedThisCycle = false;

        const tick = () => {
            const now = new Date();
            const next = new Date(now);
            next.setHours(next.getHours() + 1, 0, 0, 0);
            const diffSec = Math.floor((next - now) / 1000);
            if (diffSec > 5) firedThisCycle = false;

            const mm = String(Math.floor(diffSec / 60)).padStart(2, '0');
            const ss = String(diffSec % 60).padStart(2, '0');
            countdownEl.textContent = `${getDict().nextUpdateIn} ${mm}:${ss}`;

            if (diffSec <= 2 && !firedThisCycle) {
                firedThisCycle = true;
                fetchUpdates();
            }

            updateFreshnessDot();
        };

        tick();
        setInterval(tick, 1000);
    };

    const initHourlyRefresh = () => {
        setInterval(() => {
            fetchUpdates();
        }, 60 * 60 * 1000);
    };

    const copySummary = async () => {
        const text = document.getElementById('ai-summary-text')?.textContent?.trim();
        if (!text) return;
        const copyIcon = document.getElementById('copy-icon');
        const copyLabel = document.getElementById('copy-label');
        const copyToast = document.getElementById('copy-toast');
        try {
            await navigator.clipboard.writeText(text);
            if (copyIcon) copyIcon.textContent = '✓';
            if (copyLabel) copyLabel.textContent = getDict().copiedBtn;
            if (copyToast) {
                copyToast.textContent = currentLang === 'he' ? '✓ הועתק ללוח' : '✓ Copied to clipboard';
                copyToast.classList.remove('hidden');
                setTimeout(() => copyToast.classList.add('hidden'), 2500);
            }
            setTimeout(() => {
                if (copyIcon) copyIcon.textContent = '📋';
                if (copyLabel) copyLabel.textContent = getDict().copyBtn;
            }, 2500);
        } catch (e) {
            console.warn('Clipboard write failed', e);
        }
    };

    const initLiveViewers = async () => {
        const liveViewersEl = document.getElementById('live-viewers');
        const totalViewersEl = document.getElementById('total-viewers');
        const sessionId = Math.random().toString(36).substring(2, 15);

        const updateLiveCount = async () => {
            if (!liveViewersEl) return;
            try {
                const res = await fetch(`/api/viewers?id=${sessionId}`);
                const data = await res.json();
                animateCountUp(liveViewersEl, data.live);
            } catch (e) {
                console.error('Live viewers error', e);
            }
        };

        updateLiveCount();
        setInterval(updateLiveCount, 15000);

        if (totalViewersEl) {
            try {
                const res = await fetch('https://api.counterapi.dev/v1/FocusNews/views/up');
                const data = await res.json();
                if (data && data.count) animateCountUp(totalViewersEl, data.count);
            } catch (e) {
                console.error('Counter API failed', e);
            }
        }
    };

    const initThemeAndLang = () => {
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'dark') {
            document.documentElement.setAttribute('data-theme', 'dark');
            themeIcon.innerText = '☀️';
            themeText.innerText = getDict().themeLight;
        } else {
            themeIcon.innerText = '🌙';
            themeText.innerText = getDict().themeDark;
        }

        themeToggle.addEventListener('click', () => {
            const currentTheme = document.documentElement.getAttribute('data-theme');
            if (currentTheme === 'dark') {
                document.documentElement.removeAttribute('data-theme');
                localStorage.setItem('theme', 'light');
                themeIcon.innerText = '🌙';
                themeText.innerText = getDict().themeDark;
            } else {
                document.documentElement.setAttribute('data-theme', 'dark');
                localStorage.setItem('theme', 'dark');
                themeIcon.innerText = '☀️';
                themeText.innerText = getDict().themeLight;
            }
        });

        langToggle.addEventListener('click', () => {
            currentLang = currentLang === 'he' ? 'en' : 'he';
            localStorage.setItem('lang', currentLang);
            updateUIText();
            fetchUpdates();
        });
    };

    const shareToWhatsapp = () => {
        const url = window.location.href.split('?')[0];
        const dict = getDict();
        const lines = [dict.shareHeading, ''];
        const summaryText = document.getElementById('ai-summary-text');
        if (summaryText && summaryText.innerText.trim() !== '') {
            lines.push(`${dict.shareOverview}:`);
            lines.push(summaryText.innerText.trim());
            lines.push('');
        }

        const topSignalCards = document.querySelectorAll('.signal-card h4');
        const topSignals = [];
        topSignalCards.forEach((card, index) => {
            if (index < 3 && card.innerText.trim()) topSignals.push(`- ${card.innerText.trim()}`);
        });
        if (topSignals.length) {
            lines.push(`${dict.shareTopSignals}:`);
            lines.push(...topSignals);
            lines.push('');
        }

        const timelineEntries = [];
        document.querySelectorAll('.timeline-item').forEach((item, index) => {
            if (index >= 3) return;
            const time = item.querySelector('.timeline-time')?.innerText?.trim();
            const text = item.querySelector('.timeline-content p')?.innerText?.trim();
            if (text) timelineEntries.push(`- ${time ? `${time} | ` : ''}${text}`);
        });
        if (timelineEntries.length) {
            lines.push(`${dict.shareTimeline}:`);
            lines.push(...timelineEntries);
            lines.push('');
        }

        lines.push(`${dict.shareOpenApp}: ${url}`);
        const shareText = sanitizeShareText(lines.join('\n')) || dict.shareNoSummary;
        window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank');
    };

    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            document.title = getDict().originalTab || 'FocusNews';
        }
    });

    const backToTopBtn = document.createElement('button');
    backToTopBtn.id = 'back-to-top';
    backToTopBtn.className = 'icon-btn hidden';
    backToTopBtn.style.position = 'fixed';
    backToTopBtn.style.bottom = '80px';
    backToTopBtn.style.right = '20px';
    backToTopBtn.style.zIndex = '1000';
    backToTopBtn.style.background = 'var(--accent-blue)';
    backToTopBtn.style.color = '#fff';
    backToTopBtn.style.padding = '10px 15px';
    backToTopBtn.style.boxShadow = 'var(--shadow-soft)';
    backToTopBtn.innerHTML = `<span>${getDict().backToTop || '⏫ Back to Top'}</span>`;
    document.body.appendChild(backToTopBtn);

    const updateBackToTopAlignment = () => {
        backToTopBtn.style.left = '';
        backToTopBtn.style.right = '';
        backToTopBtn.style[document.documentElement.dir === 'rtl' ? 'left' : 'right'] = '20px';
    };

    updateBackToTopAlignment();

    window.addEventListener('scroll', () => {
        if (window.scrollY > 400) backToTopBtn.classList.remove('hidden');
        else backToTopBtn.classList.add('hidden');
    });

    backToTopBtn.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    let touchStartY = 0;
    let touchEndY = 0;
    let isPulling = false;

    document.addEventListener('touchstart', (e) => {
        if (window.scrollY === 0) {
            touchStartY = e.changedTouches[0].screenY;
            isPulling = true;
        }
    }, { passive: true });

    document.addEventListener('touchmove', (e) => {
        if (!isPulling) return;
        touchEndY = e.changedTouches[0].screenY;
    }, { passive: true });

    document.addEventListener('touchend', () => {
        if (!isPulling) return;
        if (touchEndY > touchStartY + 150) fetchUpdates();
        isPulling = false;
    });

    if (shareWhatsappBtn) shareWhatsappBtn.addEventListener('click', shareToWhatsapp);
    if (copySummaryBtn) copySummaryBtn.addEventListener('click', copySummary);

    const retryBtn = document.getElementById('retry-btn');
    if (retryBtn) retryBtn.addEventListener('click', fetchUpdates);

    const historySelector = document.getElementById('history-selector');
    if (historySelector) historySelector.addEventListener('change', fetchUpdates);

    updateUIText();
    initThemeAndLang();
    initLiveViewers();
    initCountdown();
    initHourlyRefresh();
    fetchUpdates();
});
