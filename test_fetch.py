import sys
import os
sys.path.append(os.path.join(os.getcwd(), 'api'))
from updates import fetch_telegram_messages
messages = fetch_telegram_messages('amitsegal')
print(f"Fetched {len(messages)} messages.")
if messages:
    print(messages[0])
