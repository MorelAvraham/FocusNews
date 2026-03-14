import sys
import os
sys.path.append(os.path.join(os.getcwd(), 'api'))
from news_core import SOURCE_INDEX, fetch_telegram_messages
messages = fetch_telegram_messages(SOURCE_INDEX['amitsegal'])
print(f"Fetched {len(messages)} messages.")
if messages:
    print(messages[0])
