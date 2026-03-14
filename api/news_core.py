import concurrent.futures
import json
import os
import re
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional

import requests
from bs4 import BeautifulSoup


ISRAEL_TZ = timezone(timedelta(hours=2))

SOURCE_CATALOG = [
    {
        "id": "abualiexpress",
        "telegram_handle": "abualiexpress",
        "display_name_he": "אבו עלי אקספרס",
        "display_name_en": "Abu Ali Express",
        "language": "he",
        "region": "israel",
        "topic_tags": ["security", "osint", "gaza"],
        "trust_score": 0.86,
        "priority": 0.92,
        "enabled": True,
    },
    {
        "id": "amitsegal",
        "telegram_handle": "amitsegal",
        "display_name_he": "עמית סגל",
        "display_name_en": "Amit Segal",
        "language": "he",
        "region": "israel",
        "topic_tags": ["politics", "government", "diplomacy"],
        "trust_score": 0.89,
        "priority": 0.84,
        "enabled": True,
    },
    {
        "id": "miraedj",
        "telegram_handle": "miraedj",
        "display_name_he": "מבזקי אפל",
        "display_name_en": "Mivzakei Epel",
        "language": "he",
        "region": "israel",
        "topic_tags": ["security", "alerts", "breaking"],
        "trust_score": 0.72,
        "priority": 0.78,
        "enabled": True,
    },
    {
        "id": "ziv710",
        "telegram_handle": "ziv710",
        "display_name_he": "זיו רובינשטיין",
        "display_name_en": "Ziv Rubinstein",
        "language": "he",
        "region": "israel",
        "topic_tags": ["security", "osint", "analysis"],
        "trust_score": 0.7,
        "priority": 0.7,
        "enabled": True,
    },
    {
        "id": "salehdesk1",
        "telegram_handle": "salehdesk1",
        "display_name_he": "אבו צאלח הדסק הערבי",
        "display_name_en": "Abu Saleh Desk",
        "language": "ar",
        "region": "regional",
        "topic_tags": ["security", "arab-media", "osint"],
        "trust_score": 0.74,
        "priority": 0.81,
        "enabled": True,
    },
    {
        "id": "arabworld301news",
        "telegram_handle": "arabworld301news",
        "display_name_he": "301 העולם הערבי",
        "display_name_en": "301 Arab World",
        "language": "ar",
        "region": "regional",
        "topic_tags": ["security", "regional", "osint"],
        "trust_score": 0.69,
        "priority": 0.72,
        "enabled": True,
    },
    {
        "id": "GLOBAL_Telegram_MOKED",
        "telegram_handle": "GLOBAL_Telegram_MOKED",
        "display_name_he": "מוקד גלובלי",
        "display_name_en": "Global Telegram Moked",
        "language": "en",
        "region": "global",
        "topic_tags": ["osint", "global", "security"],
        "trust_score": 0.63,
        "priority": 0.6,
        "enabled": True,
    },
    {
        "id": "New_security8200",
        "telegram_handle": "New_security8200",
        "display_name_he": "חדשות 8200",
        "display_name_en": "8200 News",
        "language": "he",
        "region": "israel",
        "topic_tags": ["security", "alerts", "osint"],
        "trust_score": 0.67,
        "priority": 0.66,
        "enabled": True,
    },
    {
        "id": "Kan11News",
        "telegram_handle": "Kan11News",
        "display_name_he": "כאן חדשות",
        "display_name_en": "Kan News",
        "language": "he",
        "region": "israel",
        "topic_tags": ["politics", "security", "general"],
        "trust_score": 0.9,
        "priority": 0.79,
        "enabled": True,
    },
    {
        "id": "ynetalerts",
        "telegram_handle": "ynetalerts",
        "display_name_he": "ynet עדכונים",
        "display_name_en": "ynet Alerts",
        "language": "he",
        "region": "israel",
        "topic_tags": ["breaking", "general", "security"],
        "trust_score": 0.77,
        "priority": 0.7,
        "enabled": True,
    },
    {
        "id": "glzradio",
        "telegram_handle": "glzradio",
        "display_name_he": "גלי צה״ל",
        "display_name_en": "Galei Tzahal",
        "language": "he",
        "region": "israel",
        "topic_tags": ["security", "politics", "general"],
        "trust_score": 0.85,
        "priority": 0.77,
        "enabled": True,
    },
    {
        "id": "N12Updates",
        "telegram_handle": "N12Updates",
        "display_name_he": "חדשות N12",
        "display_name_en": "N12 News",
        "language": "he",
        "region": "israel",
        "topic_tags": ["general", "security", "politics"],
        "trust_score": 0.8,
        "priority": 0.73,
        "enabled": True,
    },
    {
        "id": "FotrosResistance",
        "telegram_handle": "FotrosResistance",
        "display_name_he": "פוטרס התנגדות",
        "display_name_en": "Fotros Resistance Watch",
        "language": "en",
        "region": "regional",
        "topic_tags": ["osint", "regional", "security"],
        "trust_score": 0.52,
        "priority": 0.45,
        "enabled": True,
    },
    {
        "id": "IsraelRadar_com",
        "telegram_handle": "IsraelRadar_com",
        "display_name_he": "Israel Radar",
        "display_name_en": "Israel Radar",
        "language": "en",
        "region": "regional",
        "topic_tags": ["alerts", "security", "osint"],
        "trust_score": 0.61,
        "priority": 0.58,
        "enabled": True,
    },
]

SOURCE_INDEX = {source["id"]: source for source in SOURCE_CATALOG}

FILTER_PROFILES = {
    "high": {"threshold": 0.0, "max_candidates": 24, "label_he": "מלא", "label_en": "Full"},
    "balanced": {"threshold": 0.0, "max_candidates": 28, "label_he": "מורחב", "label_en": "Expanded"},
    "fast": {"threshold": 0.0, "max_candidates": 32, "label_he": "חי", "label_en": "Live"},
}

NOISE_PATTERNS = [
    "פרסומת",
    "advertisement",
    "sponsored",
    "join our",
    "subscribe",
    "לינק בתגובה",
    "קישור להצטרפות",
]

EVENT_KEYWORDS = {
    "security": [
        "יירוט", "כטב", "כטב\"מ", "rocket", "missile", "strike", "air force", "drone",
        "attack", "raid", "operation", "חוסל", "חיסול", "תקיפה", "יירי", "שיגור",
        "פיצוץ", "חדירה", "red alert", "sirens", "אזעק", "שב\"כ", "idf", "צה\"ל",
    ],
    "politics": [
        "cabinet", "prime minister", "minister", "knesset", "ceasefire", "hostage",
        "deal", "negotiation", "statement", "הצהרה", "ישיבת קבינט", "הסכם", "עסקה",
        "ממשלה", "שרים", "מדיני", "דיפלומט", "שגריר",
    ],
    "economy": [
        "gas", "economy", "market", "fuel", "תקציב", "בורסה", "מחיר", "סנקציות",
    ],
}

TOPIC_TO_CATEGORY = {
    "security": {"he": "ביטחון", "en": "Security"},
    "politics": {"he": "פוליטיקה", "en": "Politics"},
    "economy": {"he": "כלכלה", "en": "Economy"},
    "general": {"he": "כללי", "en": "General"},
}


def get_enabled_sources() -> List[Dict]:
    return [source for source in SOURCE_CATALOG if source.get("enabled")]


def get_filter_profile(filter_name: Optional[str]) -> Dict:
    return FILTER_PROFILES.get(filter_name or "high", FILTER_PROFILES["high"])


def source_display_name(source_id: str, lang: str = "he") -> str:
    source = SOURCE_INDEX.get(source_id)
    if not source:
        return source_id
    return source["display_name_he"] if lang == "he" else source["display_name_en"]


def normalize_text(value: str) -> str:
    value = (value or "").lower()
    value = re.sub(r"http\S+", " ", value)
    value = re.sub(r"[@#]\S+", " ", value)
    value = re.sub(r"[^\w\s\u0590-\u05ff\u0600-\u06ff]", " ", value)
    value = re.sub(r"\s+", " ", value).strip()
    return value


def tokenize(value: str) -> List[str]:
    tokens = re.findall(r"[\w\u0590-\u05ff\u0600-\u06ff]{3,}", normalize_text(value))
    return [token for token in tokens if not token.isdigit()]


def detect_topic(text: str, source: Dict) -> str:
    normalized = normalize_text(text)
    scores = {"security": 0, "politics": 0, "economy": 0}
    for topic, keywords in EVENT_KEYWORDS.items():
        scores[topic] = sum(1 for keyword in keywords if keyword.lower() in normalized)
    best_topic = max(scores, key=scores.get)
    if scores[best_topic] > 0:
        return best_topic
    source_topics = source.get("topic_tags", [])
    if "security" in source_topics:
        return "security"
    if "politics" in source_topics:
        return "politics"
    if "economy" in source_topics:
        return "economy"
    return "general"


def fetch_telegram_messages(source: Dict) -> List[Dict]:
    handle = source["telegram_handle"]
    url = f"https://t.me/s/{handle}"
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        }
        response = requests.get(url, headers=headers, timeout=3)
        if response.status_code != 200:
            return []

        soup = BeautifulSoup(response.text, "html.parser")
        messages = []
        now = datetime.now(timezone.utc)
        one_hour_ago = now - timedelta(hours=1)

        for block in soup.find_all("div", class_="tgme_widget_message"):
            for meta in block.find_all("span", class_="tgme_widget_message_meta"):
                meta.decompose()
            for views in block.find_all("span", class_="tgme_widget_message_views"):
                views.decompose()

            text_el = block.find("div", class_="tgme_widget_message_text")
            if not text_el:
                continue

            text = text_el.get_text(separator=" \n ", strip=True)
            if not text:
                continue

            time_wrap = block.find("a", class_="tgme_widget_message_date")
            time_el = time_wrap.find("time") if time_wrap else None
            time_str = time_el.get("datetime") if time_el else ""

            if time_str:
                try:
                    msg_time = datetime.fromisoformat(time_str.replace("Z", "+00:00"))
                    if msg_time < one_hour_ago:
                        continue
                except Exception:
                    pass

            messages.append(
                {
                    "channel": source["id"],
                    "text": text,
                    "time": time_str,
                    "source": source,
                }
            )

        return messages
    except Exception as exc:
        print(f"Error fetching {handle}: {exc}")
        return []


def is_noise(text: str) -> bool:
    normalized = normalize_text(text)
    if len(normalized) < 18:
        return True
    if len(tokenize(normalized)) < 3:
        return True
    return any(pattern in normalized for pattern in NOISE_PATTERNS)


def score_message(message: Dict) -> Optional[Dict]:
    text = message.get("text", "")
    if is_noise(text):
        return None

    source = message["source"]
    topic = detect_topic(text, source)
    normalized = normalize_text(text)
    tokens = tokenize(text)
    keyword_hits = sum(1 for words in EVENT_KEYWORDS.values() for word in words if word.lower() in normalized)
    length_bonus = min(len(tokens) / 28, 0.34)
    source_weight = 0.45 + (source["priority"] * 0.3)
    signal_bonus = min(keyword_hits * 0.09, 0.42)

    time_str = message.get("time") or ""
    freshness_bonus = 0.0
    if time_str:
        try:
            msg_dt = datetime.fromisoformat(time_str.replace("Z", "+00:00"))
            minutes_ago = max((datetime.now(timezone.utc) - msg_dt).total_seconds() / 60, 0)
            freshness_bonus = max(0, 0.2 - (minutes_ago / 1200))
        except Exception:
            freshness_bonus = 0.05

    score = round(source_weight + signal_bonus + length_bonus + freshness_bonus, 3)
    enriched = dict(message)
    enriched.update(
        {
            "topic": topic,
            "score": score,
            "normalized_text": normalized,
            "tokens": tokens,
            "source_trust": source["trust_score"],
        }
    )
    return enriched


def deduplicate_messages(messages: List[Dict]) -> List[Dict]:
    unique = {}
    for message in messages:
        key = message["normalized_text"]
        existing = unique.get(key)
        if not existing or message["score"] > existing["score"]:
            unique[key] = message
    return list(unique.values())


def jaccard_overlap(tokens_a: List[str], tokens_b: List[str]) -> float:
    set_a = set(tokens_a)
    set_b = set(tokens_b)
    if not set_a or not set_b:
        return 0.0
    return len(set_a & set_b) / len(set_a | set_b)


def cluster_messages(messages: List[Dict]) -> List[Dict]:
    clusters: List[Dict] = []
    for message in sorted(messages, key=lambda item: item["score"], reverse=True):
        placed = False
        for cluster in clusters:
            overlap = jaccard_overlap(message["tokens"], cluster["token_pool"])
            same_topic = message["topic"] == cluster["topic"]
            close_score = abs(message["score"] - cluster["score"]) < 0.5
            if same_topic and close_score and overlap >= 0.32:
                cluster["messages"].append(message)
                cluster["token_pool"] = list(set(cluster["token_pool"]) | set(message["tokens"]))
                cluster["matched_sources"].add(message["channel"])
                cluster["score"] = round(cluster["score"] + (message["score"] * 0.45), 3)
                placed = True
                break
        if not placed:
            clusters.append(
                {
                    "topic": message["topic"],
                    "messages": [message],
                    "token_pool": list(set(message["tokens"])),
                    "matched_sources": {message["channel"]},
                    "score": message["score"],
                }
            )

    for cluster in clusters:
        cluster["matched_sources"] = sorted(cluster["matched_sources"])
        cluster["primary"] = max(cluster["messages"], key=lambda item: item["score"])
        cluster["confidence"] = round(min(cluster["score"] / 1.8, 0.99), 2)
        cluster["verification_status"] = classify_verification(cluster)
        cluster["why_it_matters"] = build_why_it_matters(cluster)

    return sorted(clusters, key=lambda item: item["score"], reverse=True)


def classify_verification(cluster: Dict) -> str:
    matched_sources = cluster["matched_sources"]
    trusted_count = sum(1 for source_id in matched_sources if SOURCE_INDEX.get(source_id, {}).get("trust_score", 0) >= 0.78)
    if len(matched_sources) >= 2 and trusted_count >= 1:
        return "confirmed"
    if len(matched_sources) >= 2:
        return "developing"
    return "single_source"


def build_why_it_matters(cluster: Dict) -> str:
    topic = cluster["topic"]
    status = cluster["verification_status"]
    if topic == "security":
        if status == "confirmed":
            return "Multiple monitored sources point to an operational event with real-time impact."
        if status == "developing":
            return "Several channels are discussing the same security signal, but details are still forming."
        return "This is an early security signal worth watching, but it is not widely confirmed yet."
    if topic == "politics":
        return "Political messaging can change the operating picture, public guidance, or negotiation climate."
    if topic == "economy":
        return "Economic signals often matter when they affect resilience, markets, or national policy."
    return "This signal adds context to the broader picture tracked this hour."


def select_candidates(clusters: List[Dict], filter_name: str) -> List[Dict]:
    profile = get_filter_profile(filter_name)
    selected = [cluster for cluster in clusters if cluster["score"] >= profile["threshold"]]
    if not selected:
        selected = clusters[: max(6, profile["max_candidates"] // 2)]
    return selected[: profile["max_candidates"]]


def build_prompt(filter_name: str, selected_clusters: List[Dict]) -> str:
    cluster_blocks = []
    for index, cluster in enumerate(selected_clusters, start=1):
        primary = cluster["primary"]
        source_names = ", ".join(cluster["matched_sources"])
        raw_messages = []
        for message in cluster["messages"][:3]:
            time_hm = format_time_hm(message.get("time", ""))
            raw_messages.append(
                f"[{time_hm}] source={message['channel']} score={message['score']}\n{message['text']}"
            )
        cluster_blocks.append(
            "\n".join(
                [
                    f"CLUSTER {index}",
                    f"topic={cluster['topic']}",
                    f"score={cluster['score']}",
                    f"confidence={cluster['confidence']}",
                    f"verification_status={cluster['verification_status']}",
                    f"matched_sources={source_names}",
                    "raw_reports:",
                    "\n---\n".join(raw_messages),
                ]
            )
        )

    return f"""You are an expert news editor for FocusNews, a calm, neutral intelligence dashboard.
Review the scored candidate clusters from the last hour and produce bilingual JSON only.

Rules:
- Use only information that appears in the candidate clusters below.
- Prefer broad coverage of the hour, not just the most heavily repeated events.
- Merge duplicates, but keep distinct developments separate so the feed feels full and useful.
- Preserve exact HH:MM timestamps only when present in the raw reports.
- Create 4-6 top signals with a short 'why_it_matters' line.
- Build 10-18 timeline events when the hour is busy, and 6-10 when it is quieter.
- Every category item and timeline event must include:
  source, matched_sources, confidence, verification_status, level.

Return only this JSON shape:
{{
  "he": {{
    "summary": "4-7 sentence Hebrew summary.",
    "top_signals": [
      {{
        "title": "short Hebrew title",
        "why_it_matters": "short Hebrew explanation",
        "topic": "ביטחון|פוליטיקה|כלכלה|כללי",
        "confidence": 0.0,
        "verification_status": "confirmed|developing|single_source",
        "matched_sources": ["channel_id"]
      }}
    ],
    "categories": [
      {{
        "name": "ביטחון|פוליטיקה|כלכלה|כללי",
        "items": [
          {{
            "text": "concise Hebrew item",
            "source": "channel_id",
            "matched_sources": ["channel_id"],
            "confidence": 0.0,
            "verification_status": "confirmed|developing|single_source",
            "level": "critical|notable|info"
          }}
        ]
      }}
    ],
    "timeline": [
      {{
        "time": "HH:MM",
        "source": "channel_id",
        "matched_sources": ["channel_id"],
        "event": "short Hebrew event",
        "level": "critical|notable|info",
        "confidence": 0.0,
        "verification_status": "confirmed|developing|single_source",
        "why_it_matters": "short Hebrew explanation"
      }}
    ]
  }},
  "en": {{
    "summary": "4-7 sentence English summary.",
    "top_signals": [
      {{
        "title": "short English title",
        "why_it_matters": "short English explanation",
        "topic": "Security|Politics|Economy|General",
        "confidence": 0.0,
        "verification_status": "confirmed|developing|single_source",
        "matched_sources": ["channel_id"]
      }}
    ],
    "categories": [
      {{
        "name": "Security|Politics|Economy|General",
        "items": [
          {{
            "text": "concise English item",
            "source": "channel_id",
            "matched_sources": ["channel_id"],
            "confidence": 0.0,
            "verification_status": "confirmed|developing|single_source",
            "level": "critical|notable|info"
          }}
        ]
      }}
    ],
    "timeline": [
      {{
        "time": "HH:MM",
        "source": "channel_id",
        "matched_sources": ["channel_id"],
        "event": "short English event",
        "level": "critical|notable|info",
        "confidence": 0.0,
        "verification_status": "confirmed|developing|single_source",
        "why_it_matters": "short English explanation"
      }}
    ]
  }}
}}

Filter profile: {filter_name}

Candidate clusters:
{chr(10).join(cluster_blocks)}
"""


def call_gemini(prompt: str, api_key: str) -> str:
    url = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        f"gemini-2.5-flash:generateContent?key={api_key}"
    )
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "responseMimeType": "application/json",
            "temperature": 0.2,
            "thinkingConfig": {"thinkingBudget": 0},
        },
    }
    response = requests.post(url, json=payload, timeout=30)
    response.raise_for_status()
    data = response.json()
    return data["candidates"][0]["content"]["parts"][0]["text"]


def format_time_hm(time_str: str) -> str:
    if not time_str:
        return ""
    try:
        dt = datetime.fromisoformat(time_str.replace("Z", "+00:00"))
        return dt.astimezone(ISRAEL_TZ).strftime("%H:%M")
    except Exception:
        return ""


def build_sources_summary(raw_messages: List[Dict], selected_clusters: List[Dict], lang: str) -> Dict:
    active_source_ids = sorted({message["channel"] for message in raw_messages})
    contributing_ids = sorted(
        {
            source_id
            for cluster in selected_clusters
            for source_id in cluster.get("matched_sources", [])
        }
    )
    sources = []
    for source_id in active_source_ids:
        source = SOURCE_INDEX[source_id]
        raw_count = sum(1 for item in raw_messages if item["channel"] == source_id)
        contributed = source_id in contributing_ids
        sources.append(
            {
                "id": source_id,
                "name": source["display_name_he"] if lang == "he" else source["display_name_en"],
                "raw_count": raw_count,
                "contributed": contributed,
                "trust_score": source["trust_score"],
                "topic_tags": source["topic_tags"],
            }
        )

    return {
        "active_count": len(active_source_ids),
        "enabled_count": len(get_enabled_sources()),
        "contributing_count": len(contributing_ids),
        "sources": sources,
    }


def normalize_item_metadata(item: Dict, lang: str) -> Dict:
    level = item.get("level") or "info"
    verification_status = item.get("verification_status") or "single_source"
    matched_sources = item.get("matched_sources") or ([item["source"]] if item.get("source") else [])
    confidence = item.get("confidence")
    if confidence is None:
        confidence = 0.58 if verification_status == "single_source" else 0.76

    normalized = dict(item)
    normalized["level"] = level
    normalized["verification_status"] = verification_status
    normalized["matched_sources"] = matched_sources
    normalized["confidence"] = round(float(confidence), 2)
    if normalized.get("source"):
        normalized["source_label"] = source_display_name(normalized["source"], lang)
    normalized["matched_source_labels"] = [source_display_name(source_id, lang) for source_id in matched_sources]
    return normalized


def ensure_category_items(data: Dict, lang: str) -> None:
    categories = data.get("categories") or []
    normalized_categories = []
    for category in categories:
        items = category.get("items") or []
        normalized_items = []
        for item in items:
            if isinstance(item, str):
                item = {"text": item, "source": ""}
            normalized_items.append(normalize_item_metadata(item, lang))
        normalized_categories.append({"name": category.get("name", TOPIC_TO_CATEGORY["general"][lang]), "items": normalized_items})
    data["categories"] = normalized_categories


def ensure_timeline(data: Dict, lang: str) -> None:
    timeline = data.get("timeline") or []
    data["timeline"] = [normalize_item_metadata(item, lang) for item in timeline]


def ensure_top_signals(data: Dict, lang: str, selected_clusters: List[Dict]) -> None:
    top_signals = data.get("top_signals") or []
    if top_signals:
        normalized = []
        for signal in top_signals:
            matched_sources = signal.get("matched_sources") or []
            normalized.append(
                {
                    "title": signal.get("title", ""),
                    "why_it_matters": signal.get("why_it_matters", ""),
                    "topic": signal.get("topic", TOPIC_TO_CATEGORY["general"][lang]),
                    "confidence": round(float(signal.get("confidence", 0.6)), 2),
                    "verification_status": signal.get("verification_status", "single_source"),
                    "matched_sources": matched_sources,
                    "matched_source_labels": [source_display_name(source_id, lang) for source_id in matched_sources],
                }
            )
        data["top_signals"] = normalized[:5]
        return

    fallback = []
    for cluster in selected_clusters[:5]:
        primary = cluster["primary"]
        fallback.append(
            {
                "title": primary["text"][:90],
                "why_it_matters": cluster["why_it_matters"],
                "topic": TOPIC_TO_CATEGORY.get(cluster["topic"], TOPIC_TO_CATEGORY["general"])[lang],
                "confidence": cluster["confidence"],
                "verification_status": cluster["verification_status"],
                "matched_sources": cluster["matched_sources"],
                "matched_source_labels": [source_display_name(source_id, lang) for source_id in cluster["matched_sources"]],
            }
        )
    data["top_signals"] = fallback


def build_fallback_payload(lang: str, filter_name: str, raw_messages: Optional[List[Dict]] = None) -> Dict:
    raw_messages = raw_messages or []
    summary = "לא נאספו דיווחים חדשים בשעה האחרונה." if lang == "he" else "No new reports gathered in the last hour."
    item_text = (
        "לא נאספו דיווחים חדשים בשעה האחרונה מהמקורות המנוטרים."
        if lang == "he"
        else "No new reports gathered in the last hour from monitored sources."
    )
    general_name = TOPIC_TO_CATEGORY["general"][lang]
    payload = {
        "summary": summary,
        "top_signals": [],
        "categories": [{"name": general_name, "items": [{"text": item_text, "source": "", "matched_sources": [], "confidence": 0, "verification_status": "single_source", "level": "info"}]}],
        "timeline": [],
        "filter_profile": filter_name,
        "source_catalog": minimal_source_catalog(lang),
        "sources_summary": build_sources_summary(raw_messages, [], lang),
    }
    return payload


def minimal_source_catalog(lang: str) -> List[Dict]:
    catalog = []
    for source in get_enabled_sources():
        catalog.append(
            {
                "id": source["id"],
                "name": source["display_name_he"] if lang == "he" else source["display_name_en"],
                "language": source["language"],
                "region": source["region"],
                "topic_tags": source["topic_tags"],
                "trust_score": source["trust_score"],
            }
        )
    return catalog


def attach_metadata_to_payload(data: Dict, lang: str, filter_name: str, raw_messages: List[Dict], selected_clusters: List[Dict]) -> Dict:
    ensure_category_items(data, lang)
    ensure_timeline(data, lang)
    ensure_top_signals(data, lang, selected_clusters)
    data["filter_profile"] = filter_name
    data["sources_summary"] = build_sources_summary(raw_messages, selected_clusters, lang)
    data["source_catalog"] = minimal_source_catalog(lang)
    return data


def collect_and_rank_sources(filter_name: str) -> Dict:
    raw_messages: List[Dict] = []
    sources = get_enabled_sources()
    with concurrent.futures.ThreadPoolExecutor(max_workers=min(12, len(sources))) as executor:
        futures = {executor.submit(fetch_telegram_messages, source): source["id"] for source in sources}
        try:
            for future in concurrent.futures.as_completed(futures, timeout=7):
                try:
                    raw_messages.extend(future.result())
                except Exception as exc:
                    print(f"Failed fetching source: {exc}")
        except concurrent.futures.TimeoutError:
            print("Telegram fetch timed out partially.")

    scored = [result for result in (score_message(message) for message in raw_messages) if result]
    deduped = deduplicate_messages(scored)
    clusters = cluster_messages(deduped)
    selected = select_candidates(clusters, filter_name)
    return {
        "raw_messages": raw_messages,
        "scored_messages": deduped,
        "clusters": clusters,
        "selected_clusters": selected,
    }


def summarize_updates(filter_name: str, api_key: Optional[str]) -> Dict:
    collected = collect_and_rank_sources(filter_name)
    raw_messages = collected["raw_messages"]
    selected_clusters = collected["selected_clusters"]

    if not raw_messages or not selected_clusters:
        return {
            "both": {
                "he": build_fallback_payload("he", filter_name, raw_messages),
                "en": build_fallback_payload("en", filter_name, raw_messages),
            },
            "raw_messages": raw_messages,
            "selected_clusters": selected_clusters,
            "message_count": len(raw_messages),
        }

    if not api_key:
        raise RuntimeError("No GEMINI_API_KEY environment variable provided.")

    prompt = build_prompt(filter_name, selected_clusters)
    result_json = call_gemini(prompt, api_key)
    parsed = json.loads(result_json)

    both = {}
    for lang in ("he", "en"):
        language_data = parsed.get(lang) or build_fallback_payload(lang, filter_name, raw_messages)
        both[lang] = attach_metadata_to_payload(language_data, lang, filter_name, raw_messages, selected_clusters)

    return {
        "both": both,
        "raw_messages": raw_messages,
        "selected_clusters": selected_clusters,
        "message_count": len(raw_messages),
    }
