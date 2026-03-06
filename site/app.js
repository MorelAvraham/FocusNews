document.addEventListener('DOMContentLoaded', () => {
    const newsContainer = document.getElementById('news-container');
    const refreshBtn = document.getElementById('refresh-btn');
    const lastUpdatedEl = document.getElementById('last-updated');

    const channelNamesMap = {
        'abualiexpress': 'אבו עלי אקספרס',
        'amitsegal': 'עמית סגל',
        'N12chat': 'N12 צ\'אט הכתבים',
        'kann_news': 'כאן חדשות',
        'idfofficial': 'צבא ההגנה לישראל'
    };

    const fetchUpdates = async () => {
        try {
            renderSkeletons();
            
            // On production, it should be /api/updates
            // On local dev, Vercel CLI handles this
            const res = await fetch('/api/updates');
            
            if (!res.ok) {
                throw new Error('שגיאת שרת או רשת: ' + res.status);
            }
            const data = await res.json();
            
            if (!data || data.length === 0) {
                renderEmptyState();
            } else {
                renderNews(data);
            }

            const now = new Date();
            lastUpdatedEl.innerText = `עודכן לאחרונה: ${now.toLocaleTimeString('he-IL', {hour: '2-digit', minute:'2-digit'})} (מתרענן עצמאית כל שעה)`;
            
        } catch (error) {
            console.error('Error fetching updates:', error);
            renderErrorState(error.message);
        }
    };

    const renderSkeletons = () => {
        newsContainer.innerHTML = '';
        for (let i = 0; i < 6; i++) {
            newsContainer.innerHTML += `
            <div class="skeleton-card glass-panel">
                <div class="skel-line title"></div>
                <div class="skel-line"></div>
                <div class="skel-line"></div>
                <div class="skel-line short"></div>
            </div>`;
        }
    };

    const renderEmptyState = () => {
        newsContainer.innerHTML = `
        <div class="glass-panel" style="text-align:center; padding: 3rem; grid-column: 1/-1;">
            <h3 style="color: var(--text-secondary); font-size: 1.5rem;">לא נמצאו עדכונים חדשים בשעה האחרונה.</h3>
            <p>המערכת מסננת לפי "שאגת הארי" ומילים קשורות. נסה מאוחר יותר.</p>
        </div>`;
    };

    const renderErrorState = (msg) => {
        newsContainer.innerHTML = `
        <div class="glass-panel" style="text-align:center; padding: 3rem; grid-column: 1/-1;">
            <h3 style="color: var(--accent-red); font-size: 1.5rem;">אופס! שגיאה בטעינת העדכונים.</h3>
            <p>${msg}</p>
        </div>`;
    };

    const renderNews = (data) => {
        newsContainer.innerHTML = '';
        data.forEach((item, index) => {
            const card = document.createElement('article');
            card.className = 'news-card glass-panel';
            
            // Stagger animations by index
            card.style.animation = `fade-in-up 0.5s ease backwards ${index * 0.05}s`;

            const channelName = channelNamesMap[item.channel] || item.channel;
            let timeDisplay = 'זמן לא ידוע';
            if (item.time) {
                const date = new Date(item.time);
                timeDisplay = date.toLocaleString('he-IL', {
                    day: '2-digit', month: '2-digit', hour: '2-digit', minute:'2-digit'
                });
            }

            card.innerHTML = `
                <div class="news-card-header">
                    <span class="channel-tag">${channelName}</span>
                    <span class="time-tag">${timeDisplay}</span>
                </div>
                <div class="content">${formatContent(item.text)}</div>
            `;
            newsContainer.appendChild(card);
        });
    };

    const formatContent = (text) => {
        // Simple formatter to bold keywords and parse links
        let formatted = text.replace(/(שאגת הארי|לבנון|חיזבאללה|צה"ל)/g, '<strong style="color: var(--accent-blue)">$1</strong>');
        // Basic URL replacer
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        formatted = formatted.replace(urlRegex, '<a href="$1" target="_blank" style="color: var(--accent-red); text-decoration: underline;">$1</a>');
        return formatted;
    };

    // Include an animation style dynamically
    const style = document.createElement('style');
    style.innerHTML = `
        @keyframes fade-in-up {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
        }
    `;
    document.head.appendChild(style);

    // Bind events
    refreshBtn.addEventListener('click', fetchUpdates);

    // Initial load
    fetchUpdates();
});
