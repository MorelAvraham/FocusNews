from http.server import BaseHTTPRequestHandler
import json
import os
import time
from urllib.parse import urlparse, parse_qs
import redis

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        query = parse_qs(urlparse(self.path).query)
        user_id = query.get('id', ['anonymous'])[0]        
        redis_url = os.environ.get("REDIS_URL")
        
        live_count = 1
        
        if redis_url:
            try:
                r = redis.from_url(redis_url)
                current_time = int(time.time())
                
                r.zadd("live_users", {user_id: current_time})
                r.zremrangebyscore("live_users", "-inf", current_time - 30)
                live_count = r.zcard("live_users")
            except Exception as e:
                print(f"Redis error: {e}")

        self.send_response(200)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        self.end_headers()
        self.wfile.write(json.dumps({"live": live_count}).encode('utf-8'))