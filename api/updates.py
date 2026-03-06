from http.server import BaseHTTPRequestHandler
import json
import requests
from bs4 import BeautifulSoup

def fetch_telegram_messages(channel):
    url = f"https://t.me/s/{channel}"
    try:
        # User-Agent to mimic a browser, Telegram block some requests without it
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"
        }
        response = requests.get(url, headers=headers, timeout=10)
        if response.status_code != 200:
            return []
            
        soup = BeautifulSoup(response.text, 'html.parser')
        messages = []
        
        # Telegram public channels web preview has message blocks with class "tgme_widget_message"
        for block in soup.find_all('div', class_='tgme_widget_message'):
            text_el = block.find('div', class_='tgme_widget_message_text')
            if not text_el:
                continue
                
            text = text_el.get_text(separator=' \n ', strip=True)
            
            # Find time
            time_wrap = block.find('a', class_='tgme_widget_message_date')
            time_el = time_wrap.find('time') if time_wrap else None
            time_str = time_el.get('datetime') if time_el else ""
            
            messages.append({"channel": channel, "text": text, "time": time_str})
            
        return messages
    except Exception as e:
        print(f"Error fetching {channel}: {e}")
        return []

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        # We will scrape a few popular Israeli news Telegram channels
        channels = ["abualiexpress", "amitsegal", "N12chat", "kann_news", "idfofficial"]
        all_messages = []
        for c in channels:
            all_messages.extend(fetch_telegram_messages(c))
        
        # Filter messages specifically for "שאגת הארי" or related context (Lebanon war / operation)
        # We also include some broad keywords so it doesn't return empty during normal times.
        keywords = ["שאגת", "ארי", "חיזבאללה", "לבנון", "מלחמה", "צה\"ל", "תקיפה"]
        filtered = []
        
        for m in all_messages:
            if any(k in m["text"] for k in keywords):
                filtered.append(m)
                
        # Sort by time, descending
        filtered.sort(key=lambda x: x.get("time", ""), reverse=True)
        
        # Return JSON
        self.send_response(200)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        # Access-Control-Allow-Origin to allow frontend to fetch
        self.send_header('Access-Control-Allow-Origin', '*')
        # Cache for 1 hour at edge (s-maxage=3600), so Vercel only runs this once an hour!
        # This perfectly implements "every hour" without needing a literal cron job.
        self.send_header('Cache-Control', 's-maxage=3600, stale-while-revalidate=600')
        self.end_headers()
        
        self.wfile.write(json.dumps(filtered[:50], ensure_ascii=False).encode('utf-8'))
        return
