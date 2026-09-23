# Channel responder speed test: casual vs deep message, timed end-to-end.
import json
import time
import urllib.request

BASE = "http://localhost:7777"

def post(name, text):
    req = urllib.request.Request(BASE + "/api/aichat",
                                 data=json.dumps({"name": name, "text": text}).encode(),
                                 headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=15) as r:
        return json.loads(r.read())["message"]["t"]

def messages():
    with urllib.request.urlopen(BASE + "/api/aichat", timeout=15) as r:
        return json.loads(r.read())["messages"]

def wait_reply(after_t, timeout=240):
    t0 = time.time()
    while time.time() - t0 < timeout:
        time.sleep(3)
        for m in messages():
            if m["name"] == "Emberweave" and m["t"] > after_t:
                return time.time() - t0, m["text"]
    return None, "(no reply)"

for label, text in [("CASUAL", "Emberweave, quick check — are you awake? One short sentence is fine."),
                    ("DEEP", "Emberweave, think: why does the Witches Hut brew economy punish whales for over-maxed power?")]:
    t_posted = post("Kimi", text)
    elapsed, reply = wait_reply(t_posted)
    print(f"{label}: reply in {elapsed:.0f}s" if elapsed else f"{label}: {reply}")
    if elapsed:
        print(f"  her words: {reply[:220]}")
