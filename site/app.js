document.addEventListener('DOMContentLoaded', () => {
    const lastUpdatedEl = document.getElementById('last-updated');

    const loadingState = document.getElementById('loading-state');
    const errorState = document.getElementById('error-state');
    const errorMessage = document.getElementById('error-message');
    const dashboardData = document.getElementById('dashboard-data');

    const categoriesContainer = document.getElementById('categories-container');
    const timeline = document.getElementById('timeline');

    const shareWhatsappBtn = document.getElementById('share-whatsapp-btn');
    const themeToggle = document.getElementById('theme-toggle');
    const themeIcon = document.getElementById('theme-icon');
    const themeText = document.getElementById('theme-text');

    const langToggle = document.getElementById('lang-toggle');
    const langIcon = document.getElementById('lang-icon');
    const langText = document.getElementById('lang-text');

    const refreshBtn = document.getElementById('refresh-btn');
    const refreshIcon = document.getElementById('refresh-icon');
    const copySummaryBtn = document.getElementById('copy-summary-btn');

    // Module-scope state
    let lastFetchTime = null;
    let loadingPhaseInterval = null;

    // Dictionary for Translations
    const i18n = {
        he: {
            title: "FocusNews - חדשות ממוקדות מבצע : שאגת הארי ",
            subtitle: "להישאר מעודכנים, בלי להישאב לטלגרם. פעם בשעה!",
            desc: "איסוף, הצלבה וסינון של דיווחים מהשטח באמצעות בינה מלאכותית. העדכונים הקריטיים בלבד, מוגשים בכל שעה עגולה.",
            statusLabel: "עומס דיווחים:",
            loadingStatus: "מחשב נתונים...",
            refreshBtn: "סריקה מחדש",
            loadingTitle: "מעבד חדשות...",
            loadingDesc: "מפעיל מערכת בינה מלאכותית לאיסוף וסינון דיווחים מהשעה האחרונה.",
            errorTitle: "שגיאה בתקשורת נתונים",
            shareBtn: "שתף תקציר ל-WhatsApp",
            timelineTitle: "⏱️ ציר זמן מאומת (השעה האחרונה)",
            sourcesTitle: "מקורות מנוטרים <span>(8/8 פעילים)</span>",
            lastTestedTemplate: "עדכון אחרון: ",
            autoUpdateNote: "הנתונים מתעדכנים אוטומטית בכל שעה",
            noEvents: "אין עדכונים חריגים",
            noCategories: "לא נמצאו דיווחים חדשים לחלוקה לקטגוריות.",
            noTimeline: "לא זוהו אירועים הדורשים ציון בציר הזמן בשעה האחרונה.",
            routine: "שגרה",
            tension: "תנועה ערה",
            escalation: "עומס דיווחים",
            serverError: "שגיאת שרת",
            themeDark: "מצב לילה",
            themeLight: "מצב יום",
            langName: "English",
            liveLabel: "אונליין",
            viewsLabel: "כניסות",
            summaryTitle: "סיכום AI (מבט על)",
            historyNow: "עכשיו",
            historyHourAgo: "לפני שעה",
            historyHoursAgo: "לפני {h} שעות",
            copyBtn: "העתק",
            copiedBtn: "הועתק!",
            nextUpdateIn: "עדכון הבא בעוד",
            criticalLabel: "קריטי",
            retryBtn: "נסה שוב",
            staleBanner: "⚠️ מציג נתונים ממאגר — השרת לא הגיב, נסה שוב בעוד כמה דקות",
            loadingPhases: ["סורק ערוצי טלגרם...", "מנתח ומצליב דיווחים...", "מייצר סיכום AI..."]
        },
        en: {
            title: "FocusNews - Operation Lion's Roar",
            subtitle: "Stay updated without getting sucked into Telegram. Once an hour!",
            desc: "AI-powered collection, cross-referencing, and filtering of field reports. Only the critical updates, delivered every hour on the hour.",
            statusLabel: "News Volume:",
            loadingStatus: "Processing...",
            refreshBtn: "Rescan",
            loadingTitle: "Analyzing News...",
            loadingDesc: "Running AI engine to gather and filter reports from the last hour.",
            errorTitle: "Connection Error",
            shareBtn: "Share Summary to WhatsApp",
            timelineTitle: "⏱️ Verified Timeline (Last Hour)",
            sourcesTitle: "Monitored Sources <span>(8/8 Active)</span>",
            lastTestedTemplate: "Last updated: ",
            autoUpdateNote: "Data updates automatically every hour",
            noEvents: "No unusual updates",
            noCategories: "No new reports found to categorize.",
            noTimeline: "No actionable events detected in the timeline for the last hour.",
            routine: "Routine",
            tension: "Active",
            escalation: "Heavy Activity",
            serverError: "Server Error",
            themeDark: "Dark Mode",
            themeLight: "Light Mode",
            langName: "עברית",
            liveLabel: "Online",
            viewsLabel: "Views",
            summaryTitle: "AI Summary (Overview)",
            historyNow: "Current",
            historyHourAgo: "1 Hour Ago",
            historyHoursAgo: "{h} Hours Ago",
            copyBtn: "Copy",
            copiedBtn: "Copied!",
            nextUpdateIn: "Next update in",
            criticalLabel: "CRITICAL",
            retryBtn: "Try Again",
            staleBanner: "⚠️ Showing cached data — server didn't respond, try again in a few minutes",
            loadingPhases: ["Scanning Telegram channels...", "Cross-referencing reports...", "Generating AI summary..."]
        }
    };

    let currentLang = localStorage.getItem('lang') || 'he';

    // Display mappings for nice Hebrew names
    const channelMap = {
        'abualiexpress': 'אבו עלי אקספרס',
        'amitsegal': 'עמית סגל',
        'miraedj': 'מבזק אפל',
        'ziv710': 'זיו רובינשטיין',
        'salehdesk1': 'סאלח (הדסק הערבי)',
        'arabworld301news': 'עולם הערבים 301',
        'GLOBAL_Telegram_MOKED': 'מוקד טלגרם עולמי',
        'New_security8200': 'מודיעין 8200'
    };

    // ── Helper: animate number count-up ──
    const animateCountUp = (el, target, duration = 600) => {
        const start = parseInt(el.textContent) || 0;
        const range = target - start;
        if (range === 0 || isNaN(target)) { el.textContent = target; return; }
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

    // ── Helper: set refresh button loading state ──
    const setRefreshLoading = (isLoading) => {
        if (!refreshBtn) return;
        refreshBtn.disabled = isLoading;
        if (refreshIcon) {
            refreshIcon.style.animation = isLoading ? 'spin 0.8s linear infinite' : '';
        }
    };

    // ── Freshness dot ──
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
        const dict = i18n[currentLang];
        document.documentElement.dir = currentLang === 'he' ? 'rtl' : 'ltr';
        document.documentElement.lang = currentLang;

        document.querySelector('h2').innerText = dict.subtitle;
        document.querySelector('header p').innerText = dict.desc;
        document.querySelector('#loading-state h3').innerText = dict.loadingTitle;
        document.querySelector('#loading-state p').innerText = dict.loadingDesc;
        document.querySelector('#error-state h3').innerText = dict.errorTitle;
        const whatsappText = document.getElementById('whatsapp-text');
        if (whatsappText) whatsappText.innerText = dict.shareBtn;
        document.querySelector('.timeline-section h3').innerHTML = `<i class="icon">⏱️</i> ${dict.timelineTitle.replace('⏱️ ', '')}`;
        document.getElementById('monitored-sources-title').innerHTML = dict.sourcesTitle;

        langText.innerText = dict.langName;
        document.getElementById('live-label').innerText = dict.liveLabel;
        document.getElementById('viewers-label').innerText = dict.viewsLabel;
        document.getElementById('summary-title').innerText = dict.summaryTitle;

        const refreshLabel = document.getElementById('refresh-label');
        if (refreshLabel) refreshLabel.innerText = dict.refreshBtn;
        const copyLabel = document.getElementById('copy-label');
        if (copyLabel) copyLabel.innerText = dict.copyBtn;
        const retryLabel = document.getElementById('retry-label');
        if (retryLabel) retryLabel.innerText = dict.retryBtn;
        const loadingTitleEl = document.getElementById('loading-title');
        if (loadingTitleEl) loadingTitleEl.innerText = dict.loadingTitle;
        const loadingDescEl = document.getElementById('loading-desc');
        if (loadingDescEl) loadingDescEl.innerText = dict.loadingDesc;

        updateHistoryDropdown();
        updateFreshnessDot();

        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        themeText.innerText = isDark ? dict.themeLight : dict.themeDark;
    };

    const updateHistoryDropdown = () => {
        const dict = i18n[currentLang];
        const historySelector = document.getElementById('history-selector');
        if (!historySelector) return;

        const prevVal = historySelector.value || "0";
        historySelector.innerHTML = '';

        for (let i = 0; i <= 24; i++) {
            const option = document.createElement('option');
            option.value = i;
            if (i === 0) {
                option.text = dict.historyNow;
            } else if (i === 1) {
                option.text = dict.historyHourAgo;
            } else {
                option.text = dict.historyHoursAgo.replace('{h}', i);
            }
            historySelector.appendChild(option);
        }
        historySelector.value = prevVal;
    };

    const fetchUpdates = async () => {
        try {
            showLoading();

            const historySelector = document.getElementById('history-selector');
            const hoursAgo = historySelector ? historySelector.value : "0";

            let endpoint = `/api/updates?lang=${currentLang}`;
            if (hoursAgo !== "0") {
                endpoint = `/api/history?lang=${currentLang}&hours_ago=${hoursAgo}`;
            }

            const res = await fetch(endpoint);

            if (!res.ok) {
                let errText = await res.text();
                throw new Error(`Server Error (${res.status}): ${errText}`);
            }
            const data = await res.json();

            if (data.error) {
                throw new Error(data.error);
            }

            renderDashboard(data);

            let timeString = '';
            if (data.generated_at) {
                timeString = data.generated_at;
            } else {
                const now = new Date();
                timeString = now.toLocaleTimeString(currentLang === 'en' ? 'en-US' : 'he-IL', { hour: '2-digit', minute: '2-digit' });
            }

            lastUpdatedEl.innerText = `${i18n[currentLang].lastTestedTemplate}${timeString} | ${i18n[currentLang].autoUpdateNote}`;

        } catch (error) {
            console.error('Error fetching dashboard data:', error);
            showError(error.message);
            lastUpdatedEl.innerText = i18n[currentLang].serverError;
        }
    };

    // ── Loading phase cycling ──
    const startLoadingPhases = () => {
        const phaseEl = document.getElementById('loading-phase');
        if (!phaseEl) return;
        const phases = i18n[currentLang].loadingPhases;
        let i = 0;
        phaseEl.textContent = phases[0];
        loadingPhaseInterval = setInterval(() => {
            i = (i + 1) % phases.length;
            phaseEl.textContent = phases[i];
        }, 2500);
    };

    const stopLoadingPhases = () => {
        if (loadingPhaseInterval) { clearInterval(loadingPhaseInterval); loadingPhaseInterval = null; }
        const phaseEl = document.getElementById('loading-phase');
        if (phaseEl) phaseEl.textContent = '';
    };

    // ── Stale data banner ──
    const setStaleBanner = (isStale) => {
        const banner = document.getElementById('stale-banner');
        const msg = document.getElementById('stale-msg');
        if (!banner) return;
        if (isStale) {
            if (msg) msg.textContent = i18n[currentLang].staleBanner;
            banner.classList.remove('hidden');
        } else {
            banner.classList.add('hidden');
        }
    };

    const showLoading = () => {
        setRefreshLoading(true);
        dashboardData.classList.add('hidden');
        errorState.classList.add('hidden');
        loadingState.classList.remove('hidden');
        startLoadingPhases();
    };

    const showError = (msg) => {
        setRefreshLoading(false);
        stopLoadingPhases();
        loadingState.classList.add('hidden');
        dashboardData.classList.add('hidden');
        errorState.classList.remove('hidden');
        errorMessage.innerText = msg;
    };

    const renderDashboard = (data) => {
        setRefreshLoading(false);
        stopLoadingPhases();
        setStaleBanner(data.stale === true);
        loadingState.classList.add('hidden');
        errorState.classList.add('hidden');

        // Fade in the dashboard
        dashboardData.style.opacity = '0';
        dashboardData.classList.remove('hidden');
        requestAnimationFrame(() => {
            dashboardData.style.transition = 'opacity 0.3s ease';
            dashboardData.style.opacity = '1';
        });

        // Record fetch time for freshness dot
        lastFetchTime = Date.now();
        updateFreshnessDot();

        // AI Summary
        const aiSummaryContainer = document.getElementById('ai-summary-container');
        const aiSummaryText = document.getElementById('ai-summary-text');
        if (data.summary) {
            aiSummaryText.innerText = data.summary;
            aiSummaryContainer.classList.remove('hidden');
        } else {
            aiSummaryContainer.classList.add('hidden');
        }

        // 1. Categories
        categoriesContainer.innerHTML = '';
        if (data.categories && data.categories.length > 0) {
            data.categories.forEach((cat, idx) => {
                const section = document.createElement('section');
                section.className = 'glass-panel category-section animate-in';
                section.style.animationDelay = `${idx * 60}ms`;

                const iconMap = {
                    'ביטחון': '🛡️', 'Security': '🛡️',
                    'פוליטיקה': '🏛️', 'Politics': '🏛️',
                    'כלכלה': '📈', 'Economy': '📈',
                    'חינוך': '📚', 'Education': '📚',
                    'בריאות': '🏥', 'Health': '🏥',
                    'כללי': '📰', 'General': '📰'
                };
                const catIcon = iconMap[cat.name] || '📰';

                let listHtml = '';
                if (cat.items && cat.items.length > 0) {
                    cat.items.forEach(item => {
                        let textStr = "";
                        let sourceStr = "";

                        if (typeof item === 'string') {
                            textStr = item;
                        } else {
                            textStr = item.text || '';
                            let baseSource = item.source || '';
                            sourceStr = channelMap[baseSource] || baseSource;
                        }

                        let sourceHtml = '';
                        if (sourceStr) {
                            sourceHtml = `<div class="item-source-tag">${sourceStr}</div>`;
                        }

                        listHtml += `<li>
                            <div class="item-content">${textStr}</div>
                            ${sourceHtml}
                        </li>`;
                    });
                } else {
                    listHtml = `<li style="color:var(--text-secondary); border-color:transparent;">${i18n[currentLang].noEvents}</li>`;
                }

                // Count badge
                const itemCount = cat.items ? cat.items.length : 0;
                const countBadge = itemCount > 0
                    ? `<span class="category-count-badge">${itemCount}</span>`
                    : '';

                section.innerHTML = `
                    <h3><i class="icon">${catIcon}</i> ${cat.name} ${countBadge}</h3>
                    <ul class="category-list">${listHtml}</ul>
                `;
                categoriesContainer.appendChild(section);
            });
        } else {
            categoriesContainer.innerHTML = `
                <div class="glass-panel text-center full-width">
                    <p style="color:var(--text-secondary);">${i18n[currentLang].noCategories}</p>
                </div>
            `;
        }

        // 2. Verified Timeline
        timeline.innerHTML = '';
        if (data.timeline && data.timeline.length > 0) {
            const sortedTimeline = [...data.timeline].sort((a, b) => {
                const ta = a.time || "";
                const tb = b.time || "";
                return ta.localeCompare(tb);
            });

            sortedTimeline.forEach((item, idx) => {
                const tlItem = document.createElement('div');
                const level = item.level || 'info';
                tlItem.className = `timeline-item timeline-level-${level} animate-in`;
                tlItem.style.animationDelay = `${idx * 50}ms`;

                const timeStr = item.time || '';
                const baseSource = item.source || 'Unknown';
                const sourceStr = channelMap[baseSource] || baseSource;
                const eventStr = item.event || '';

                const criticalBadge = level === 'critical'
                    ? `<span class="timeline-critical-badge">${i18n[currentLang].criticalLabel}</span>`
                    : '';

                tlItem.innerHTML = `
                    <div class="timeline-time">${timeStr}</div>
                    <div class="timeline-marker timeline-marker-${level}"></div>
                    <div class="timeline-content glass-panel-light">
                        ${criticalBadge}
                        <span class="timeline-source">${sourceStr}</span>
                        <p>${eventStr}</p>
                    </div>
                `;
                timeline.appendChild(tlItem);
            });
        } else {
            timeline.innerHTML = `
                <div class="glass-panel-light" style="padding: 1.5rem; text-align: center; color: var(--text-secondary);">
                    ${i18n[currentLang].noTimeline}
                </div>
            `;
        }
    };

    // ── Countdown Timer + Auto-refresh ──
    const initCountdown = () => {
        const countdownEl = document.getElementById('countdown-timer');
        if (!countdownEl) return;
        let firedThisCycle = false;

        const tick = () => {
            const now = new Date();
            const next = new Date(now);
            next.setHours(next.getHours() + 1, 0, 0, 0);
            const diffSec = Math.floor((next - now) / 1000);

            // Reset guard after the trigger window
            if (diffSec > 5) firedThisCycle = false;

            const mm = String(Math.floor(diffSec / 60)).padStart(2, '0');
            const ss = String(diffSec % 60).padStart(2, '0');
            countdownEl.textContent = `${i18n[currentLang].nextUpdateIn} ${mm}:${ss}`;

            // Auto-refresh at the top of the hour
            if (diffSec <= 2 && !firedThisCycle) {
                firedThisCycle = true;
                fetchUpdates();
            }

            // Also update freshness dot every tick
            updateFreshnessDot();
        };

        tick();
        setInterval(tick, 1000);
    };

    // ── Copy Summary to Clipboard ──
    const copySummary = async () => {
        const text = document.getElementById('ai-summary-text')?.textContent?.trim();
        if (!text) return;
        const copyIcon = document.getElementById('copy-icon');
        const copyLabel = document.getElementById('copy-label');
        const copyToast = document.getElementById('copy-toast');

        try {
            await navigator.clipboard.writeText(text);

            if (copyIcon) copyIcon.textContent = '✓';
            if (copyLabel) copyLabel.textContent = i18n[currentLang].copiedBtn;

            if (copyToast) {
                copyToast.textContent = currentLang === 'he' ? '✓ הועתק ללוח' : '✓ Copied to clipboard';
                copyToast.classList.remove('hidden');
                setTimeout(() => copyToast.classList.add('hidden'), 2500);
            }

            setTimeout(() => {
                if (copyIcon) copyIcon.textContent = '📋';
                if (copyLabel) copyLabel.textContent = i18n[currentLang].copyBtn;
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
                console.error("Live viewers error", e);
            }
        };

        updateLiveCount();
        setInterval(updateLiveCount, 15000);

        if (totalViewersEl) {
            try {
                const res = await fetch('https://api.counterapi.dev/v1/FocusNews/views/up');
                const data = await res.json();
                if (data && data.count) {
                    animateCountUp(totalViewersEl, data.count);
                }
            } catch (e) {
                console.error("Counter API failed", e);
            }
        }
    };

    const initThemeAndLang = () => {
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'dark') {
            document.documentElement.setAttribute('data-theme', 'dark');
            themeIcon.innerText = '☀️';
            themeText.innerText = i18n[currentLang].themeLight;
        } else {
            themeIcon.innerText = '🌙';
            themeText.innerText = i18n[currentLang].themeDark;
        }

        themeToggle.addEventListener('click', () => {
            const currentTheme = document.documentElement.getAttribute('data-theme');
            if (currentTheme === 'dark') {
                document.documentElement.removeAttribute('data-theme');
                localStorage.setItem('theme', 'light');
                themeIcon.innerText = '🌙';
                themeText.innerText = i18n[currentLang].themeDark;
            } else {
                document.documentElement.setAttribute('data-theme', 'dark');
                localStorage.setItem('theme', 'dark');
                themeIcon.innerText = '☀️';
                themeText.innerText = i18n[currentLang].themeLight;
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
        let text = currentLang === 'en' ? "📰 *FocusNews - Live Updates:*\n\n" : "📰 *מבזק FocusNews - סיכום השעה:*\n\n";

        // Add summary if exists
        const summaryText = document.getElementById('ai-summary-text');
        if (summaryText && summaryText.innerText.trim() !== "") {
            const summaryTitle = currentLang === 'en' ? "Overview" : "מבט על";
            text += `*🌎 ${summaryTitle}:*\n${summaryText.innerText.trim()}\n\n`;
        }

        const timelineDivs = document.querySelectorAll('.timeline-item');
        let hasTimeline = false;

        if (timelineDivs.length > 0) {
            const firstItemText = timelineDivs[0].innerText.trim();
            if (!firstItemText.includes("No actionable events") && !firstItemText.includes("לא זוהו אירועים")) {
                text += currentLang === 'en' ? "*🔥 Key Events:*\n" : "*🔥 אירועים בולטים:*\n";
                let eventCount = 0;
                timelineDivs.forEach(tli => {
                    if (eventCount < 4 && tli.querySelector('.timeline-time') && tli.querySelector('p')) {
                        const time = tli.querySelector('.timeline-time').innerText;
                        const eventContent = tli.querySelector('p').innerText;
                        if (eventContent) {
                            text += `🕒 ${time} - ${eventContent}\n`;
                            eventCount++;
                        }
                    }
                });
                text += "\n";
                hasTimeline = true;
            }
        }

        if (!hasTimeline) {
            const categories = document.querySelectorAll('.category-section');
            let itemCount = 0;
            categories.forEach(cat => {
                const h3 = cat.querySelector('h3');
                if (!h3) return;
                const title = h3.innerText;
                const items = cat.querySelectorAll('li');
                if (items.length > 0 && !items[0].innerText.includes(i18n[currentLang].noEvents) && itemCount < 3) {
                    const itemContent = items[0].querySelector('.item-content') ? items[0].querySelector('.item-content').innerText : items[0].innerText;
                    text += `*${title.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '').trim()}*\n- ${itemContent}\n\n`;
                    itemCount++;
                }
            });
        }

        text += currentLang === 'en' ? `🔗 Read full updates live: ${url}` : `🔗 קראו את העדכונים המלאים: ${url}`;

        const encodedText = encodeURIComponent(text);
        window.open(`https://wa.me/?text=${encodedText}`, '_blank');
    };

    // ── Event Listeners ──
    if (shareWhatsappBtn) {
        shareWhatsappBtn.addEventListener('click', shareToWhatsapp);
    }

    if (refreshBtn) {
        refreshBtn.addEventListener('click', fetchUpdates);
    }

    if (copySummaryBtn) {
        copySummaryBtn.addEventListener('click', copySummary);
    }

    const retryBtn = document.getElementById('retry-btn');
    if (retryBtn) {
        retryBtn.addEventListener('click', fetchUpdates);
    }

    const historySelector = document.getElementById('history-selector');
    if (historySelector) {
        historySelector.addEventListener('change', fetchUpdates);
    }

    // ── Initial load ──
    updateUIText();
    initThemeAndLang();
    initLiveViewers();
    initCountdown();
    fetchUpdates();
});
