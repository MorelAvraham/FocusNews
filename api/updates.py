from http.server import BaseHTTPRequestHandler
import json
import requests
from bs4 import BeautifulSoup
import os
import google.generativeai as genai
from datetime import datetime, timezone, timedelta
from urllib.parse import urlparse, parse_qs

def fetch_telegram_messages(channel):
    url = f"https://t.me/s/{channel}"
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"
        }
        response = requests.get(url, headers=headers, timeout=10)
        if response.status_code != 200:
            return []
            
        soup = BeautifulSoup(response.text, 'html.parser')
        messages = []
        
        # We only want messages from the last hour
        now = datetime.now(timezone.utc)
        one_hour_ago = now - timedelta(hours=1)
        
        for block in soup.find_all('div', class_='tgme_widget_message'):
            # Data Cleanup: remove views/meta stats to avoid noise
            for meta in block.find_all('span', class_='tgme_widget_message_meta'):
                meta.decompose()
            for views in block.find_all('span', class_='tgme_widget_message_views'):
                views.decompose()
                
            text_el = block.find('div', class_='tgme_widget_message_text')
            if not text_el:
                continue
                
            text = text_el.get_text(separator=' \n ', strip=True)
            if not text:
                continue
                
            time_wrap = block.find('a', class_='tgme_widget_message_date')
            time_el = time_wrap.find('time') if time_wrap else None
            time_str = time_el.get('datetime') if time_el else ""
            
            # Check if within last hour
            if time_str:
                try:
                    msg_time = datetime.fromisoformat(time_str.replace('Z', '+00:00'))
                    if msg_time < one_hour_ago:
                        continue
                except Exception:
                    pass
            
            messages.append({"channel": channel, "text": text, "time": time_str})
            
        return messages
    except Exception as e:
        print(f"Error fetching {channel}: {e}")
        return []

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        query_components = parse_qs(urlparse(self.path).query)
        lang = query_components.get('lang', ['he'])[0]
        
        channels = [
            "abualiexpress", "amitsegal", "miraedj", "ziv710",
            "salehdesk1", "arabworld301news", "GLOBAL_Telegram_MOKED", "New_security8200"
        ]
        
        all_messages = []
        for c in channels:
            all_messages.extend(fetch_telegram_messages(c))
            
        if not all_messages:
            if lang == 'en':
                fallback = {
                    "status_level": "Routine",
                    "categories": [
                        {"name": "General", "items": ["No new reports gathered in the last hour from monitored sources."]}
                    ],
                    "timeline": []
                }
            else:
                fallback = {
                    "status_level": "שגרה",
                    "categories": [
                        {"name": "כללי", "items": ["לא נאספו דיווחים חדשים בשעה האחרונה מהמקורות המנוטרים."]}
                    ],
                    "timeline": []
                }
            self.send_json(fallback)
            return

        # Prepare text for Gemini
        combined_text_parts = []
        for m in all_messages:
            time_str = m['time']
            if time_str:
                try:
                    dt = datetime.fromisoformat(time_str.replace('Z', '+00:00'))
                    time_hm = dt.astimezone().strftime("%H:%M")
                except:
                    time_hm = ""
            else:
                time_hm = ""
            combined_text_parts.append(f"[{time_hm}] Source: {m['channel']}\n{m['text']}")
            
        combined_text = "\n\n---\n\n".join(combined_text_parts)
        
        # Token protection: Hard-truncate to 15,000 characters
        if len(combined_text) > 15000:
            combined_text = combined_text[:15000]

        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            self.send_json({"error": "No GEMINI_API_KEY environment variable provided."}, 500)
            return
            
        genai.configure(api_key=api_key)
        
        prompt_hebrew = f"""You are an expert news editor for 'FocusNews' - a calm, neutral, and clear news aggregator.
Your task is to review the raw string intercepts from news sources in the last hour, cross-reference them, remove duplicates and noise, and provide a clean, categorized news summary in HEBREW.
Output MUST be ONLY a valid JSON object matching this exact schema:
{{
  "status_level": "שגרה" | "תנועה ערה" | "עומס דיווחים",
  "categories": [
    {{
      "name": "ביטחון" | "פוליטיקה" | "כלכלה" | "כללי",
      "items": ["list of short strings summarizing key distinct news items in this category"]
    }}
  ],
  "timeline": [
    {{"time": "HH:MM", "source": "channel_name", "event": "Short description"}}
  ]
}}

Raw intercept data:
{combined_text}
"""

        prompt_english = f"""You are an expert news editor for 'FocusNews' - a calm, neutral, and clear news aggregator.
Your task is to review the raw string intercepts from news sources in the last hour, cross-reference them, remove duplicates and noise, translate it all to ENGLISH, and provide a clean, categorized news summary in ENGLISH.
Output MUST be ONLY a valid JSON object matching this exact schema:
{{
  "status_level": "Routine" | "Active" | "Heavy Activity",
  "categories": [
    {{
      "name": "Security" | "Politics" | "Economy" | "General",
      "items": ["list of short strings summarizing key distinct news items in this category"]
    }}
  ],
  "timeline": [
    {{"time": "HH:MM", "source": "channel_name", "event": "Short description"}}
  ]
}}

Raw intercept data:
{combined_text}
"""
        
        prompt = prompt_english if lang == 'en' else prompt_hebrew
        try:
            model = genai.GenerativeModel('gemini-2.5-flash')
            response = model.generate_content(
                prompt,
                generation_config=genai.GenerationConfig(
                    response_mime_type="application/json",
                )
            )
            
            result_json = response.text
            # Use json.loads to ensure it's valid JSON format and parseable
            data = json.loads(result_json)
            self.send_json(data)
            
        except Exception as e:
            self.send_json({"error": str(e)}, 500)
            
    def send_json(self, data, status=200):
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Access-Control-Allow-Origin', '*')
        # Vercel Caching to run exactly once per hour
        self.send_header('Cache-Control', 's-maxage=3600, stale-while-revalidate=600')
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False).encode('utf-8'))