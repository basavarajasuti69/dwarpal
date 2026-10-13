import os
import sys
import time
from dotenv import load_dotenv
from google import genai
from google.genai import types

load_dotenv()
model = sys.argv[1]

client = genai.Client(
    api_key=os.environ["GEMINI_API_KEY"],
    http_options=types.HttpOptions(timeout=30000),  # 30 seconds
)

start = time.time()
try:
    r = client.models.generate_content(model=model, contents="Say hi in one word")
    print("✅ Reply:", r.text)
except Exception as e:
    print("❌ Failed:", type(e).__name__, str(e)[:300])
print(f"⏱️  Took {time.time() - start:.1f}s")
