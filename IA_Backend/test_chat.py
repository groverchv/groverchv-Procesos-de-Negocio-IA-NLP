import requests
try:
    res = requests.post("http://127.0.0.1:8000/api/v1/nlp/chat-asesor", json={"messages": [{"role": "user", "content": "hola"}]})
    print("STATUS:", res.status_code)
    print("RESPONSE:", res.text)
except Exception as e:
    print("ERROR:", e)
