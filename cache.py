import time

_CACHE = {}
TTL_SECONDS = 300  # 5 minutes

def get_cached_query(question: str):
    key = question.strip().lower()
    if key in _CACHE:
        result, timestamp = _CACHE[key]
        if time.time() - timestamp < TTL_SECONDS:
            print("⚡ Cache hit! Serving results from memory.")
            return result
        else:
            del _CACHE[key]
    return None

def set_cached_query(question: str, data):
    key = question.strip().lower()
    _CACHE[key] = (data, time.time())
