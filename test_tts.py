import urllib.request
import json

data = json.dumps({
    "text": "hello world test",
    "voice": "zh-CN-XiaoxiaoNeural",
    "rate": "+0%"
}).encode("utf-8")

req = urllib.request.Request(
    "http://127.0.0.1:8000/api/tts/synthesize",
    data=data,
    headers={"Content-Type": "application/json"}
)

try:
    resp = urllib.request.urlopen(req, timeout=15)
    audio = resp.read()
    print(f"STATUS: {resp.status}, AUDIO_SIZE: {len(audio)} bytes")
except Exception as e:
    print(f"ERROR: {e}")
