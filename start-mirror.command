#!/bin/bash
# 공공영업 상황실 미러 서버 실행 스크립트 (더블클릭용)
cd "$(dirname "$0")"
echo "공공영업 상황실 미러 서버를 시작합니다..."
echo "브라우저에서 http://localhost:8765 를 여세요. (종료는 이 창 닫기 또는 Ctrl+C)"
echo
python3 server.py --port 8765
