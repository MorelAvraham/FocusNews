"""
Vercel Cron handler — called every hour by Vercel Cron Jobs.
Forces a fresh update for BOTH languages (he + en) so that data
in Redis is always fresh, even when no user visits the site.
"""

from http.server import BaseHTTPRequestHandler
import json
import requests
import os
import redis
import concurrent.futures
from datetime import datetime, timezone, timedelta
from bs4 import BeautifulSoup


def fetch_telegram_messages(channel):
    url = f"https://t.me/s/{channel}"
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        }
        response = requests.get(url, headers=headers, timeout=5)
        if response.status_code != 200:
            return []

        soup = BeautifulSoup(response.text, 'html.parser')
        messages = []

        now = datetime.now(timezone.utc)
        one_hour_ago = now - timedelta(hours=1)

        for block in soup.find_all('div', class_='tgme_widget_message'):
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


def call_gemini(prompt, api_key):
    """Call Gemini REST API directly."""
    url = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        f"gemini-2.5-flash:generateContent?key={api_key}"
    )
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "responseMimeType": "application/json",
            "temperature": 0.2
        }
    }
    resp = requests.post(url, json=payload, timeout=50)
    resp.raise_for_status()
    data = resp.json()
    return data["candidates"][0]["content"]["parts"][0]["text"]


def build_prompt(combined_text):
    return f"""You are an expert news editor for 'FocusNews' - a calm, neutral news aggregator covering the Israeli-Palestinian conflict and related regional events.
Review the raw intercept reports from the last hour, cross-reference them, remove duplicates and noise, and produce a bilingual JSON output (Hebrew + English) in ONE response.

## TIMELINE INSTRUCTIONS:
- Build a chronological timeline of 5-15 notable events. Use a BROAD definition of notable.
- INCLUDE: Targeted strikes or eliminations, IDF ground/air operations, significant rocket/missile barrages, large-scale red alerts in major cities (Beer Sheva, Tel Aviv, Haifa, Jerusalem), Home Front Command announcements, ceasefire/hostage deal updates, political or diplomatic statements, military movements, significant intelligence events.
- EXCLUDE ONLY: Completely isolated single rocket alerts in small peripheral localities that have no follow-up or escalation context.
- If the hour was eventful: include 10-15 events. If quieter: include 5-8 events. NEVER return fewer than 3 events unless there are truly zero military/political messages at all.
- You MUST use the EXACT [HH:MM] timestamps from the raw data. Do not guess or invent times.
- For each timeline event, assign a "level" field: "critical" (eliminations, major strikes, ceasefire/hostage deal changes, mass casualty events) | "notable" (IDF operations, political statements, large city alerts, Home Front Command updates) | "info" (routine confirmations, single alerts, minor updates).

## OUTPUT FORMAT — respond with ONLY this JSON structure, no extra text:
{{
  "he": {{
    "summary": "4-7 sentence paragraph in HEBREW summarizing the overall situation from the past hour with context.",
    "categories": [
      {{
        "name": "ביטחון",
        "items": [{{"text": "concise Hebrew item", "source": "channel_name"}}]
      }}
    ],
    "timeline": [
      {{"time": "HH:MM", "source": "channel_name", "event": "Short event description in HEBREW", "level": "critical|notable|info"}}
    ]
  }},
  "en": {{
    "summary": "4-7 sentence paragraph in ENGLISH summarizing the overall situation from the past hour with context.",
    "categories": [
      {{
        "name": "Security",
        "items": [{{"text": "concise English item", "source": "channel_name"}}]
      }}
    ],
    "timeline": [
      {{"time": "HH:MM", "source": "channel_name", "event": "Short event description in ENGLISH", "level": "critical|notable|info"}}
    ]
  }}
}}

Valid category names: Hebrew: "ביטחון" | "פוליטיקה" | "כלכלה" | "כללי" | English: "Security" | "Politics" | "Economy" | "General"

Raw intercept data:
{combined_text}
"""


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        """
        Cron endpoint — fetches Telegram, calls Gemini, saves BOTH
        languages to Redis. Returns a simple status JSON.
        """
        redis_url = os.environ.get("UPSTASH_REDIS_URL") or os.environ.get("REDIS_URL")
        api_key = os.environ.get("GEMINI_API_KEY")

        if not redis_url or not api_key:
            self.send_json({"error": "Missing UPSTASH_REDIS_URL or GEMINI_API_KEY"}, 500)
            return

        try:
            r = redis.from_url(redis_url)
        except Exception as e:
            self.send_json({"error": f"Redis connection failed: {e}"}, 500)
            return

        # 1. Fetch Telegram channels
        channels = [
            "abualiexpress", "amitsegal", "miraedj", "ziv710",
            "salehdesk1", "arabworld301news", "GLOBAL_Telegram_MOKED", "New_security8200"
        ]

        all_messages = []
        with concurrent.futures.ThreadPoolExecutor(max_workers=8) as executor:
            futures = {executor.submit(fetch_telegram_messages, c): c for c in channels}
            try:
                for future in concurrent.futures.as_completed(futures, timeout=10):
                    try:
                        msgs = future.result()
                        all_messages.extend(msgs)
                    except Exception as e:
                        print(f"Failed fetching channel: {e}")
            except concurrent.futures.TimeoutError:
                print("Telegram fetch timed out partially.")

        all_messages.sort(key=lambda x: x.get('time', ''))

        if not all_messages:
            # Save a "no reports" entry so the cache is still fresh
            now_ts = int(datetime.now(timezone.utc).timestamp())
            gen_tz = timezone(timedelta(hours=2))
            gen_time = datetime.now(gen_tz).strftime("%H:%M")
            for lng in ('he', 'en'):
                if lng == 'he':
                    entry = {
                        "summary": "לא נאספו דיווחים חדשים בשעה האחרונה.",
                        "categories": [{"name": "כללי", "items": [{"text": "לא נאספו דיווחים חדשים בשעה האחרונה מהמקורות המנוטרים.", "source": ""}]}],
                        "timeline": [],
                        "generated_at": gen_time
                    }
                else:
                    entry = {
                        "summary": "No new reports gathered in the last hour.",
                        "categories": [{"name": "General", "items": [{"text": "No new reports gathered in the last hour from monitored sources.", "source": ""}]}],
                        "timeline": [],
                        "generated_at": gen_time
                    }
                key = f"news_history_{lng}"
                try:
                    r.zadd(key, {json.dumps(entry, ensure_ascii=False): now_ts})
                    r.zremrangebyscore(key, "-inf", now_ts - 86400)
                except Exception as e:
                    print(f"Redis save error: {e}")

            self.send_json({"status": "ok", "result": "no_messages", "generated_at": gen_time})
            return

        # 2. Build combined text
        israel_tz = timezone(timedelta(hours=2))
        combined_text_parts = []
        for m in all_messages:
            time_str = m['time']
            if time_str:
                try:
                    dt = datetime.fromisoformat(time_str.replace('Z', '+00:00'))
                    time_hm = dt.astimezone(israel_tz).strftime("%H:%M")
                except Exception:
                    time_hm = ""
            else:
                time_hm = ""
            combined_text_parts.append(f"[{time_hm}] Source: {m['channel']}\n{m['text']}")

        combined_text = "\n\n---\n\n".join(combined_text_parts)
        if len(combined_text) > 12000:
            combined_text = combined_text[:12000]

        # 3. Call Gemini
        try:
            result_json = call_gemini(build_prompt(combined_text), api_key)
            both = json.loads(result_json)

            gen_tz = timezone(timedelta(hours=2))
            now_ts = int(datetime.now(timezone.utc).timestamp())
            gen_time = datetime.now(gen_tz).strftime("%H:%M")

            # Save BOTH languages to Redis
            saved_langs = []
            for lng in ('he', 'en'):
                if lng in both:
                    entry = dict(both[lng])
                    entry["generated_at"] = gen_time
                    key = f"news_history_{lng}"
                    try:
                        r.zadd(key, {json.dumps(entry, ensure_ascii=False): now_ts})
                        r.zremrangebyscore(key, "-inf", now_ts - 86400)
                        saved_langs.append(lng)
                    except Exception as e:
                        print(f"Redis save error for {lng}: {e}")

            self.send_json({
                "status": "ok",
                "result": "updated",
                "saved_languages": saved_langs,
                "message_count": len(all_messages),
                "generated_at": gen_time
            })

        except Exception as e:
            print(f"Cron Gemini error: {e}")
            self.send_json({"error": f"Gemini failed: {str(e)}"}, 500)

    def send_json(self, data, status=200):
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Cache-Control', 'no-store, no-cache')
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False).encode('utf-8'))
