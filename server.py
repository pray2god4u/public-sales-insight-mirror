#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
공공영업 상황실 미러 서버 (로컬)
- 정적 페이지(공공영업 상황실 · 공공기관 검색)를 서빙하고,
- /api/public/* 요청을 원본 사이트(https://public-sales-insight-coach.onrender.com)로 그대로 중계합니다.

실행:  python3 server.py            (기본 포트 8765)
       python3 server.py --port 9000
브라우저:  http://localhost:8765
"""
import argparse
import json
import os
import sys
import threading
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

APP_DIR = Path(__file__).resolve().parent / "app"
OFFLINE_DIR = Path(__file__).resolve().parent / "data"
UPSTREAM = "https://public-sales-insight-coach.onrender.com"

STATIC_ROUTES = {
    "/": "situation-room.html",
    "/situation-room": "situation-room.html",
    "/institutions": "institutions.html",
    "/institution-directory.css": "institution-directory.css",
    "/public-room.css": "public-room.css",
    "/public-room.js": "public-room.js",
    "/institution-directory.js": "institution-directory.js",
}

CONTENT_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".json": "application/json; charset=utf-8",
}


class Handler(BaseHTTPRequestHandler):
    server_version = "PsiMirror/1.0"

    # ---------- 응답 헬퍼 ----------
    def _send(self, code, body, ctype="application/json; charset=utf-8"):
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def _send_file(self, path: Path):
        try:
            body = path.read_bytes()
        except OSError:
            self._send(404, b'{"status":"error","error":"not found"}')
            return
        self._send(200, body, CONTENT_TYPES.get(path.suffix.lower(), "application/octet-stream"))

    # ---------- API 프록시 ----------
    def _proxy(self, cache_to=None):
        url = UPSTREAM + self.path
        req = urllib.request.Request(url, headers={"User-Agent": "PsiMirror/1.0"})
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                body = r.read()
                if cache_to is not None:
                    try:
                        cache_to.parent.mkdir(parents=True, exist_ok=True)
                        cache_to.write_bytes(body)
                    except OSError:
                        pass
                self._send(r.status, body,
                           r.headers.get("Content-Type", "application/json; charset=utf-8"))
        except urllib.error.HTTPError as e:
            body = e.read()
            self._send(e.code, body,
                       e.headers.get("Content-Type", "application/json; charset=utf-8"))
        except (urllib.error.URLError, TimeoutError, OSError):
            if cache_to is not None and cache_to.exists():
                try:
                    body = cache_to.read_bytes()
                    self._send(200, body)
                    return
                except OSError:
                    pass
            msg = {
                "status": "error",
                "error": "원본 서버에 연결하지 못했습니다. 네트워크를 확인하고 다시 조회해 주세요. "
                         "(무료 호스팅 특성상 서버가 잠들어 있으면 첫 조회가 오래 걸릴 수 있습니다.)",
            }
            self._send(502, json.dumps(msg, ensure_ascii=False).encode("utf-8"))

    # ---------- 라우팅 ----------
    def do_GET(self):
        from urllib.parse import urlparse
        path = urlparse(self.path).path
        if path.startswith("/api/public/room"):
            self._proxy(cache_to=OFFLINE_DIR / "room.json")
            return
        if path.startswith("/api/public/institutions"):
            self._proxy(cache_to=OFFLINE_DIR / "institutions.json")
            return
        if path in STATIC_ROUTES:
            self._send_file(APP_DIR / STATIC_ROUTES[path])
            return
        if path.startswith("/assets/"):
            self._send_file(APP_DIR / "assets" / Path(path).name)
            return
        self._send(404, b'{"status":"error","error":"not found"}')

    do_HEAD = do_GET

    def log_message(self, fmt, *args):
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))


def warmup():
    """원본 서버(Render 무료 플랜)가 잠들어 있으면 첫 조회가 느리므로 미리 깨웁니다."""
    try:
        req = urllib.request.Request(
            UPSTREAM + "/api/public/room?bucket=current&size=25&page=1",
            headers={"User-Agent": "PsiMirror/1.0"})
        urllib.request.urlopen(req, timeout=180).read()
        print("[warmup] 원본 서버 응답 확인 완료 — 조회가 빨라집니다.", flush=True)
    except Exception:
        pass


def main():
    ap = argparse.ArgumentParser(description="공공영업 상황실 로컬 미러 서버")
    ap.add_argument("--port", type=int, default=int(os.environ.get("PORT", "8765")))
    ap.add_argument("--host", default=os.environ.get("HOST", "127.0.0.1"))
    args = ap.parse_args()

    if not (APP_DIR / "situation-room.html").exists():
        sys.exit("app/ 폴더의 정적 파일을 찾을 수 없습니다. 서버를 app 폴더와 함께 실행해 주세요.")

    threading.Thread(target=warmup, daemon=True).start()
    httpd = ThreadingHTTPServer((args.host, args.port), Handler)
    print("공공영업 상황실 미러 서버 시작 → http://localhost:%d" % args.port)
    print("  공개영업 상황실 : http://localhost:%d/situation-room" % args.port)
    print("  공공기관 검색  : http://localhost:%d/institutions" % args.port)
    print("  종료는 Ctrl+C", flush=True)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n서버를 종료합니다.")


if __name__ == "__main__":
    main()
