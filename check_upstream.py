#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""연결 진단: 원본 API 가 정상인지 확인합니다.  python3 check_upstream.py"""
import json
import urllib.request

BASE = "https://public-sales-insight-coach.onrender.com"

for name, path in [
    ("상황실", "/api/public/room?bucket=all&size=25&page=1"),
    ("기관검색", "/api/public/institutions?q=&size=25&page=1"),
]:
    try:
        req = urllib.request.Request(BASE + path, headers={"User-Agent": "PsiMirror-check/1.0"})
        with urllib.request.urlopen(req, timeout=120) as r:
            d = json.load(r)
        if d.get("status") == "ok":
            extra = d.get("total", d.get("catalog_total", ""))
            print(f"[OK] {name} API 정상 (총 {extra}건)")
        else:
            print(f"[주의] {name} API 응답 상태: {d.get('status')} — {d.get('error', '')}")
    except Exception as e:
        print(f"[실패] {name} API 연결 오류: {e}")
print("\n실패가 나오면 인터넷 연결을 확인하고, 몇 분 뒤 다시 실행해 주세요.")
print("(원본이 무료 호스팅이라 잠들어 있으면 첫 응답까지 1분 이상 걸릴 수 있습니다.)")
