from http.server import BaseHTTPRequestHandler
import json
import os
from datetime import datetime, timezone, timedelta
from urllib.parse import parse_qs, urlparse

import redis

from news_core import build_fallback_payload, summarize_updates


GEN_TZ = timezone(timedelta(hours=2))


def cache_key(lang: str, filter_name: str) -> str:
    return f"news_history_{lang}_{filter_name}"


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        query_components = parse_qs(urlparse(self.path).query)
        lang = query_components.get("lang", ["he"])[0]
        if lang not in ("he", "en"):
            lang = "he"

        filter_name = query_components.get("filter", ["high"])[0]
        if filter_name not in ("high", "balanced", "fast"):
            filter_name = "high"

        redis_url = os.environ.get("UPSTASH_REDIS_URL") or os.environ.get("REDIS_URL")
        redis_client = None

        if redis_url:
            try:
                redis_client = redis.from_url(redis_url)
                now_ts = int(datetime.now(timezone.utc).timestamp())
                recent = redis_client.zrangebyscore(cache_key(lang, filter_name), now_ts - 3300, "+inf", withscores=True)
                if recent:
                    best = max(recent, key=lambda item: item[1])
                    record_str = best[0].decode("utf-8") if isinstance(best[0], bytes) else str(best[0])
                    self.send_json(json.loads(record_str))
                    return
            except Exception as exc:
                print(f"Redis cache read error: {exc}")

        api_key = os.environ.get("GEMINI_API_KEY")
        try:
            result = summarize_updates(filter_name, api_key)
            both = result["both"]
            now_ts = int(datetime.now(timezone.utc).timestamp())
            generated_at = datetime.now(GEN_TZ).strftime("%H:%M")

            if redis_client is not None:
                try:
                    for payload_lang in ("he", "en"):
                        entry = dict(both[payload_lang])
                        entry["generated_at"] = generated_at
                        redis_client.zadd(cache_key(payload_lang, filter_name), {json.dumps(entry, ensure_ascii=False): now_ts})
                        redis_client.zremrangebyscore(cache_key(payload_lang, filter_name), "-inf", now_ts - 86400)
                except Exception as exc:
                    print(f"Redis save error: {exc}")

            data = dict(both.get(lang) or build_fallback_payload(lang, filter_name))
            data["generated_at"] = generated_at
            data["filter_profile"] = filter_name
            self.send_json(data)
        except Exception as exc:
            print(f"Gemini error: {exc}")
            if redis_client is not None:
                try:
                    stale = redis_client.zrangebyscore(cache_key(lang, filter_name), "-inf", "+inf", withscores=True)
                    if stale:
                        best = max(stale, key=lambda item: item[1])
                        record_str = best[0].decode("utf-8") if isinstance(best[0], bytes) else str(best[0])
                        data = json.loads(record_str)
                        data["stale"] = True
                        self.send_json(data)
                        return
                except Exception:
                    pass
            fallback = build_fallback_payload(lang, filter_name)
            fallback["error"] = str(exc)
            self.send_json(fallback, 500)

    def send_json(self, data, status=200):
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Cache-Control", "s-maxage=300, stale-while-revalidate=60")
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False).encode("utf-8"))
