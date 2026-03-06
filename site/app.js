document.addEventListener('DOMContentLoaded', () => {
    const refreshBtn = document.getElementById('refresh-btn');
    const lastUpdatedEl = document.getElementById('last-updated');
    
    const loadingState = document.getElementById('loading-state');
    const errorState = document.getElementById('error-state');
    const errorMessage = document.getElementById('error-message');
    const dashboardData = document.getElementById('dashboard-data');
    
    const statusBadge = document.getElementById('status-badge');
    const categoriesContainer = document.getElementById('categories-container');
    const timeline = document.getElementById('timeline');
    
    const shareWhatsappBtn = document.getElementById('share-whatsapp-btn');
    const themeToggle = document.getElementById('theme-toggle');
    const themeIcon = document.getElementById('theme-icon');

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

    const fetchUpdates = async () => {
        try {
            showLoading();
            
            const res = await fetch('/api/updates');
            
            if (!res.ok) {
                let errText = await res.text();
                throw new Error(`שגיאת תקשורת מול שרת (${res.status}): ${errText}`);
            }
            const data = await res.json();
            
            if (data.error) {
                throw new Error(data.error);
            }
            
            renderDashboard(data);
            
            const now = new Date();
            lastUpdatedEl.innerText = `נבדק לאחרונה: ${now.toLocaleTimeString('he-IL', {hour: '2-digit', minute:'2-digit'})}`;
            
        } catch (error) {
            console.error('Error fetching dashboard data:', error);
            showError(error.message);
            lastUpdatedEl.innerText = 'שגיאת עדכון מערכת';
        }
    };

    const showLoading = () => {
        dashboardData.classList.add('hidden');
        errorState.classList.add('hidden');
        loadingState.classList.remove('hidden');
        statusBadge.innerText = 'מחשב נתונים...';
        statusBadge.className = 'badge badge-loading';
    };

    const showError = (msg) => {
        loadingState.classList.add('hidden');
        dashboardData.classList.add('hidden');
        errorState.classList.remove('hidden');
        errorMessage.innerText = msg;
        statusBadge.innerText = 'שגיאת שרת';
        statusBadge.className = 'badge badge-error';
    };

    const renderDashboard = (data) => {
        loadingState.classList.add('hidden');
        errorState.classList.add('hidden');
        dashboardData.classList.remove('hidden');
        
        // 1. Render Status Mode
        let status = data.status_level || 'שגרה';
        statusBadge.innerText = status;
        
        let badgeClass = 'badge-routine';
        if(status === 'תנועה ערה' || status === 'מתיחות') {
            badgeClass = 'badge-tension';
        } else if(status === 'עומס דיווחים' || status === 'הסלמה') {
            badgeClass = 'badge-escalation';
        }
        
        statusBadge.className = `badge ${badgeClass}`;
        
        // 2. Categories
        categoriesContainer.innerHTML = '';
        if(data.categories && data.categories.length > 0) {
            data.categories.forEach(cat => {
                const section = document.createElement('section');
                section.className = 'glass-panel category-section';
                
                const iconMap = {
                    'ביטחון': '🛡️',
                    'פוליטיקה': '🏛️',
                    'כלכלה': '📈',
                    'חינוך': '📚',
                    'בריאות': '🏥',
                    'כללי': '📰'
                };
                const catIcon = iconMap[cat.name] || '📰';
                
                let listHtml = '';
                if(cat.items && cat.items.length > 0) {
                    cat.items.forEach(item => {
                        listHtml += `<li>${item}</li>`;
                    });
                } else {
                    listHtml = `<li style="color:var(--text-secondary); border-color:transparent;">אין עדכונים חריגים</li>`;
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
                    <p style="color:var(--text-secondary);">לא נמצאו דיווחים חדשים לחלוקה לקטגוריות.</p>
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
                const baseSource = item.source || 'מקור לא ידוע';
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
                    לא זוהו אירועים הדורשים ציון בציר הזמן בשעה האחרונה.
                </div>
            `;
        }
    };

    const initLiveViewers = () => {
        const viewersEl = document.getElementById('live-viewers');
        if (!viewersEl) return;
        
        // Random base number between 130 and 180
        let baseViewers = Math.floor(Math.random() * (180 - 130 + 1)) + 130;
        viewersEl.innerText = baseViewers;
        
        // Update number slightly every 5 seconds
        setInterval(() => {
            const change = Math.floor(Math.random() * 5) - 2; // -2 to +2
            baseViewers = Math.max(130, baseViewers + change); // keep it looking realistic (min 130)
            viewersEl.innerText = baseViewers;
        }, 5000);
    };

    refreshBtn.addEventListener('click', fetchUpdates);

    const initTheme = () => {
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'dark') {
            document.documentElement.setAttribute('data-theme', 'dark');
            themeIcon.innerText = '☀️';
        } else {
            themeIcon.innerText = '🌙';
        }

        themeToggle.addEventListener('click', () => {
            const currentTheme = document.documentElement.getAttribute('data-theme');
            if (currentTheme === 'dark') {
                document.documentElement.removeAttribute('data-theme');
                localStorage.setItem('theme', 'light');
                themeIcon.innerText = '🌙';
            } else {
                document.documentElement.setAttribute('data-theme', 'dark');
                localStorage.setItem('theme', 'dark');
                themeIcon.innerText = '☀️';
            }
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
    initTheme();
    initLiveViewers();
    fetchUpdates();
});
