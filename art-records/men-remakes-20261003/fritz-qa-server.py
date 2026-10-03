"""Local read-only preview, explicit allowlist only; no archive traversal."""
from http.server import HTTPServer, BaseHTTPRequestHandler
from pathlib import Path
base=Path('C:/Users/Home/OneDrive/Desktop/Emberweave Archive/Game Art/Heroes/Fritz/sprite sheets/HAILUO 03OCT2026/unmixed-strong')
files={'/':(Path(__file__).with_name('fritz-qa-player.html'),'text/html'),'/idle.webp':(base/'fritz_idle.webp','image/webp'),'/walk.webp':(base/'fritz_walk.webp','image/webp')}
files.update({'/attack.webp':(base/'fritz_attack.webp','image/webp'),'/hit.webp':(base/'fritz_hit.webp','image/webp'),'/ult.webp':(base.parent/'ult 84 cells 12 fps/unmixed-strong/fritz_ult.webp','image/webp')})
class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        item=files.get(self.path)
        if not item: self.send_error(404); return
        data=item[0].read_bytes()
        self.send_response(200);self.send_header('Content-Type',item[1]);self.send_header('Content-Length',len(data));self.send_header('Cache-Control','no-store');self.end_headers();self.wfile.write(data)
HTTPServer(('127.0.0.1',4382),Handler).serve_forever()
