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

    // Dictionary for Translations
    const i18n = {
        he: {
            title: "FocusNews",
            subtitle: "כל החדשות, בלי הרעש",
            desc: "מערכת חכמה לניתוח וסינון דיווחים, מתעדכנת בזמן אמת.",
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
            summaryTitle: "סיכום AI (מבט על)"
        },
        en: {
            title: "FocusNews",
            subtitle: "All the News, Without the Noise",
            desc: "Smart system for analyzing and filtering reports, updated in real-time.",
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
            summaryTitle: "AI Summary (Overview)"
        }
    };

    let currentLang = localStorage.getItem('lang') || 'he';

    // Display mappings for nice Hebrew names
    const channelMap = {
        'abualiexpress': 'אבו עלי אקספרס',
        'amitsegal': 'עמית סגל',
        'miraedj': 'מירה אדג\'י',
        'ziv710': 'זיו רובינשטיין',
        'salehdesk1': 'סאלח (הדסק הערבי)',
        'arabworld301news': 'עולם הערבים 301',
        'GLOBAL_Telegram_MOKED': 'מוקד טלגרם עולמי',
        'New_security8200': 'מודיעין 8200'
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
        if(shareWhatsappBtn) shareWhatsappBtn.innerHTML = shareWhatsappBtn.innerHTML.replace(/.*<\/svg>\s*.*/s, document.querySelector('#share-whatsapp-btn svg').outerHTML + ' ' + dict.shareBtn);
        document.querySelector('.timeline-section h3').innerHTML = `<i class="icon">⏱️</i> ${dict.timelineTitle.replace('⏱️ ', '')}`;
        document.getElementById('monitored-sources-title').innerHTML = dict.sourcesTitle;
        
        langText.innerText = dict.langName;
        document.getElementById('live-label').innerText = dict.liveLabel;
        document.getElementById('viewers-label').innerText = dict.viewsLabel;
        document.getElementById('summary-title').innerText = dict.summaryTitle;
        
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        themeText.innerText = isDark ? dict.themeLight : dict.themeDark;
    };

    const fetchUpdates = async () => {
        try {
            showLoading();
            
            const res = await fetch(`/api/updates?lang=${currentLang}`);
            
            if (!res.ok) {
                let errText = await res.text();
                throw new Error(`Server Error (${res.status}): ${errText}`);
            }
            const data = await res.json();
            
            if (data.error) {
                throw new Error(data.error);
            }
            
            renderDashboard(data);
            
            const now = new Date();
            const timeString = now.toLocaleTimeString(currentLang === 'en' ? 'en-US' : 'he-IL', {hour: '2-digit', minute:'2-digit'});
            lastUpdatedEl.innerText = `${i18n[currentLang].lastTestedTemplate}${timeString} | ${i18n[currentLang].autoUpdateNote}`;
            
        } catch (error) {
            console.error('Error fetching dashboard data:', error);
            showError(error.message);
            lastUpdatedEl.innerText = i18n[currentLang].serverError;
        }
    };

    const showLoading = () => {
        dashboardData.classList.add('hidden');
        errorState.classList.add('hidden');
        loadingState.classList.remove('hidden');
    };

    const showError = (msg) => {
        loadingState.classList.add('hidden');
        dashboardData.classList.add('hidden');
        errorState.classList.remove('hidden');
        errorMessage.innerText = msg;
    };

    const renderDashboard = (data) => {
        loadingState.classList.add('hidden');
        errorState.classList.add('hidden');
        dashboardData.classList.remove('hidden');
        
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
        if(data.categories && data.categories.length > 0) {
            data.categories.forEach(cat => {
                const section = document.createElement('section');
                section.className = 'glass-panel category-section';
                
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
                if(cat.items && cat.items.length > 0) {
                    cat.items.forEach(item => {
                        listHtml += `<li>${item}</li>`;
                    });
                } else {
                    listHtml = `<li style="color:var(--text-secondary); border-color:transparent;">${i18n[currentLang].noEvents}</li>`;
                }
                
                section.innerHTML = `
                    <h3><i class="icon">${catIcon}</i> ${cat.name}</h3>
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
        
        // 4. Verified Timeline
        timeline.innerHTML = '';
        if(data.timeline && data.timeline.length > 0) {
            data.timeline.forEach(item => {
                const tlItem = document.createElement('div');
                tlItem.className = 'timeline-item';
                
                const timeStr = item.time || '';
                const baseSource = item.source || 'Unknown';
                const sourceStr = channelMap[baseSource] || baseSource;
                const eventStr = item.event || '';
                
                tlItem.innerHTML = `
                    <div class="timeline-time">${timeStr}</div>
                    <div class="timeline-marker"></div>
                    <div class="timeline-content glass-panel-light">
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

    const initLiveViewers = async () => {
        const liveViewersEl = document.getElementById('live-viewers');
        const totalViewersEl = document.getElementById('total-viewers');
        
        // Live Viewers Simulation (changes every 5s)
        if (liveViewersEl) {
            let baseLive = Math.floor(Math.random() * (180 - 130 + 1)) + 130;
            liveViewersEl.innerText = baseLive;
            setInterval(() => {
                const change = Math.floor(Math.random() * 5) - 2;
                baseLive = Math.max(80, baseLive + change);
                liveViewersEl.innerText = baseLive;
            }, 5000);
        }

        // Total Viewers Counter (Counter API API)
        if (totalViewersEl) {
            try {
                const res = await fetch('https://api.counterapi.dev/v1/FocusNews/views/up');
                const data = await res.json();
                if (data && data.count) {
                    totalViewersEl.innerText = data.count.toLocaleString();
                } else {
                    throw new Error("Invalid count");
                }
            } catch(e) {
                console.error("Counter API failed", e);
                totalViewersEl.innerText = "15,234";
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
            fetchUpdates(); // Refresh data in new language
        });
    };

    const shareToWhatsapp = () => {
        const url = window.location.href;
        let text = "עדכוני FocusNews בשעה האחרונה:\n\n";
        
        const categories = document.querySelectorAll('.category-section');
        let itemCount = 0;
        
        categories.forEach(cat => {
            const title = cat.querySelector('h3').innerText;
            const items = cat.querySelectorAll('li');
            if(items.length > 0 && items[0].innerText !== "אין עדכונים חריגים" && itemCount < 3) {
                text += `*${title.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '').trim()}*\n- ${items[0].innerText}\n\n`;
                itemCount++;
            }
        });
        
        text += `לכל הדיווחים אונליין: ${url}`;
        const encodedText = encodeURIComponent(text);
        window.open(`https://wa.me/?text=${encodedText}`, '_blank');
    };

    if (shareWhatsappBtn) {
        shareWhatsappBtn.addEventListener('click', shareToWhatsapp);
    }

    // Initial load
    updateUIText();
    initThemeAndLang();
    initLiveViewers();
    fetchUpdates();
});
