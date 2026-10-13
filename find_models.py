import os
import time
from dotenv import load_dotenv
from google import genai
from google.genai import types

load_dotenv()
client = genai.Client(
    api_key=os.environ["GEMINI_API_KEY"],
    http_options=types.HttpOptions(timeout=20000),  # 20 seconds
)

SKIP = ("live", "tts", "image", "audio", "translate", "embed",
        "robotics", "computer-use", "native", "veo", "imagen", "lyria")

for m in client.models.list():
    name = m.name.replace("models/", "")
    actions = getattr(m, "supported_actions", None) or []
    if "flash" not in name:
        continue
    if actions and "generateContent" not in actions:
        continue
    if any(s in name for s in SKIP):
        continue
    start = time.time()
    try:
        r = client.models.generate_content(model=name, contents="Say hi in one word")
        print(f"✅ {name}: {r.text.strip()[:20]} ({time.time() - start:.1f}s)")
    except Exception as e:
        print(f"❌ {name}: {type(e).__name__} ({time.time() - start:.1f}s)")
