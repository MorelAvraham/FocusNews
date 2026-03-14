from http.server import BaseHTTPRequestHandler
import json
import os
from datetime import datetime, timedelta, timezone

import redis

from news_core import summarize_updates


GEN_TZ = timezone(timedelta(hours=2))


def cache_key(lang: str, filter_name: str) -> str:
    return f"news_history_{lang}_{filter_name}"


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        redis_url = os.environ.get("UPSTASH_REDIS_URL") or os.environ.get("REDIS_URL")
        api_key = os.environ.get("GEMINI_API_KEY")
        if not redis_url or not api_key:
            self.send_json({"error": "Missing UPSTASH_REDIS_URL or GEMINI_API_KEY"}, 500)
            return

        try:
            redis_client = redis.from_url(redis_url)
        except Exception as exc:
            self.send_json({"error": f"Redis connection failed: {exc}"}, 500)
            return

        try:
            result = summarize_updates("high", api_key)
            both = result["both"]
            now_ts = int(datetime.now(timezone.utc).timestamp())
            generated_at = datetime.now(GEN_TZ).strftime("%H:%M")

            saved_langs = []
            for lang in ("he", "en"):
                entry = dict(both[lang])
                entry["generated_at"] = generated_at
                redis_client.zadd(cache_key(lang, "high"), {json.dumps(entry, ensure_ascii=False): now_ts})
                redis_client.zremrangebyscore(cache_key(lang, "high"), "-inf", now_ts - 86400)
                saved_langs.append(lang)

            self.send_json(
                {
                    "status": "ok",
                    "result": "updated",
                    "filter_profile": "high",
                    "saved_languages": saved_langs,
                    "message_count": result["message_count"],
                    "candidate_count": len(result["selected_clusters"]),
                    "generated_at": generated_at,
                }
            )
        except Exception as exc:
            print(f"Cron pipeline error: {exc}")
            self.send_json({"error": f"Pipeline failed: {str(exc)}"}, 500)

    def send_json(self, data, status=200):
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store, no-cache")
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False).encode("utf-8"))
