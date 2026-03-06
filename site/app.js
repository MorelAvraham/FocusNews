document.addEventListener('DOMContentLoaded', () => {
    const refreshBtn = document.getElementById('refresh-btn');
    const lastUpdatedEl = document.getElementById('last-updated');
    
    const loadingState = document.getElementById('loading-state');
    const errorState = document.getElementById('error-state');
    const errorMessage = document.getElementById('error-message');
    const dashboardData = document.getElementById('dashboard-data');
    
    const statusPulse = document.getElementById('status-pulse');
    const statusBadge = document.getElementById('status-badge');
    const mainSummary = document.getElementById('main-summary');
    const criticalEvents = document.getElementById('critical-events');
    const timeline = document.getElementById('timeline');

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
        statusBadge.innerText = 'מבודד ומעבד...';
        statusBadge.className = 'badge badge-loading';
        statusPulse.className = 'pulse-dot pulse-loading';
    };

    const showError = (msg) => {
        loadingState.classList.add('hidden');
        dashboardData.classList.add('hidden');
        errorState.classList.remove('hidden');
        errorMessage.innerText = msg;
        statusBadge.innerText = 'שגיאת שרת';
        statusBadge.className = 'badge badge-error';
        statusPulse.className = 'pulse-dot pulse-error';
    };

    const renderDashboard = (data) => {
        loadingState.classList.add('hidden');
        errorState.classList.add('hidden');
        dashboardData.classList.remove('hidden');
        
        // 1. Render Status Mode
        let status = data.status_level || 'שגרה';
        statusBadge.innerText = status;
        
        let badgeClass = 'badge-normal';
        let pulseClass = 'pulse-normal';
        
        if(status === 'שגרה') {
            badgeClass = 'badge-routine'; pulseClass = 'pulse-routine';
        } else if(status === 'מתיחות') {
            badgeClass = 'badge-tension'; pulseClass = 'pulse-tension';
        } else if(status === 'הסלמה') {
            badgeClass = 'badge-escalation'; pulseClass = 'pulse-escalation';
        } else if(status === 'לחימה עצימה') {
            badgeClass = 'badge-combat'; pulseClass = 'pulse-combat';
        }
        
        statusBadge.className = `badge ${badgeClass}`;
        statusPulse.className = `pulse-dot ${pulseClass}`;
        
        // 2. Executive Summary
        mainSummary.innerText = data.main_summary || "לא התקבל סיכום מידע תקין מהמודל.";
        
        // 3. Critical Events
        criticalEvents.innerHTML = '';
        if(data.critical_events && data.critical_events.length > 0) {
            data.critical_events.forEach(event => {
                const li = document.createElement('li');
                li.innerText = event;
                criticalEvents.appendChild(li);
            });
        } else {
            const li = document.createElement('li');
            li.innerText = "לא נרשמו אירועים חריגים.";
            li.style.color = "var(--text-secondary)";
            li.style.borderRightColor = "var(--text-secondary)";
            criticalEvents.appendChild(li);
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

    refreshBtn.addEventListener('click', fetchUpdates);

    // Initial load
    fetchUpdates();
});
