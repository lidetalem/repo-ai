import urllib.request
import urllib.error

for path in ['/api/staff/', '/api/admins/management/', '/api/logs/history/']:
    url = f'http://127.0.0.1:8000{path}'
    try:
        with urllib.request.urlopen(url, timeout=5) as resp:
            body = resp.read(200).decode('utf-8', errors='ignore')
            print(path, resp.status)
            print(body)
    except urllib.error.HTTPError as e:
        body = e.read(200).decode('utf-8', errors='ignore')
        print(path, e.code)
        print(body)
    except Exception as e:
        print(path, 'EX', type(e).__name__, e)
