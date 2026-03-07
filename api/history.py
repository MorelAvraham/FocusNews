from http.server import BaseHTTPRequestHandler
import json
import os
import redis
from urllib.parse import urlparse, parse_qs
from datetime import datetime, timezone

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        query_components = parse_qs(urlparse(self.path).query)
        lang = query_components.get('lang', ['he'])[0]
        try:
            hours_ago = int(query_components.get('hours_ago', ['1'])[0])
        except ValueError:
            hours_ago = 1

        if hours_ago < 1 or hours_ago > 24:
            hours_ago = 1

        redis_url = os.environ.get("UPSTASH_REDIS_URL") or os.environ.get("REDIS_URL")
        
        if not redis_url:
            self.send_json({"error": "Redis not configured for history. Please set UPSTASH_REDIS_URL."}, 500)
            return

        try:
            r = redis.from_url(redis_url)
            
            current_ts = int(datetime.now(timezone.utc).timestamp())
            target_ts = current_ts - (hours_ago * 3600)
            
            key = f"news_history_{lang}"
            
            # Search within a 1-hour window (+/- 3600s) to find the closest record
            records = r.zrangebyscore(key, target_ts - 3600, target_ts + 3600, withscores=True)
            
            if not records:
                if lang == 'en':
                    fallback = {
                        "summary": f"No historical records found for {hours_ago} hours ago.",
                        "categories": [],
                        "timeline": []
                    }
                else:
                    hour_word = "שעה" if hours_ago == 1 else f"{hours_ago} שעות"
                    fallback = {
                        "summary": f"לא נמצא תיעוד היסטורי מלפני {hour_word}.",
                        "categories": [],
                        "timeline": []
                    }
                self.send_json(fallback)
                return
                
            closest_record = None
            min_diff = float('inf')
            for record_json, score in records:
                diff = abs(score - target_ts)
                if diff < min_diff:
                    min_diff = diff
                    closest_record = record_json
                    
            if closest_record is not None:
                record_str = closest_record.decode('utf-8') if isinstance(closest_record, bytes) else str(closest_record)
                data = json.loads(record_str)
                self.send_json(data)
            else:
                self.send_json({"error": "No records found near this time"}, 404)
                
        except Exception as e:
            self.send_json({"error": f"History fetch error: {str(e)}"}, 500)

    def send_json(self, data, status=200):
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Access-Control-Allow-Origin', '*')
        # Short cache for history endpoint
        self.send_header('Cache-Control', 's-maxage=60, stale-while-revalidate=30')
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False).encode('utf-8'))
