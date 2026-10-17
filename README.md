# 공공영업 상황실 미러 (로컬 클론)

https://public-sales-insight-coach.onrender.com 사이트의 공개 페이지를 똑같이 로컬에서
실행하는 미러입니다. 원본과 동일한 HTML · CSS · JS(더존비즈온 로고·lucide 아이콘 포함)를
그대로 사용하고, 데이터는 원본의 공개 API 를 실시간으로 중계해 보여줍니다.

## 실행 방법

가장 쉬운 방법 — Finder 에서 더블클릭:

    start-mirror.command

또는 터미널에서:

    cd /Users/kwangminhwang/Documents/Amaranth10/OneAI/public-sales-insight-mirror
    python3 server.py

서버가 뜨면 브라우저에서:

- 공공영업 상황실 : http://localhost:8765/situation-room  (http://localhost:8765 도 같음)
- 공공기관 검색  : http://localhost:8765/institutions

다른 포트를 쓰려면 `python3 server.py --port 9000`

## 구조

    server.py                     로컬 웹서버 + API 프록시 (표준 라이브러리만 사용)
    check_upstream.py             원본 API 연결 진단 스크립트
    app/situation-room.html       공공영업 상황실 페이지 (원본과 동일)
    app/institutions.html         공공기관 검색 페이지 (원본과 동일)
    app/public-room.css/.js       상황실 스타일·동작
    app/institution-directory.*   기관 검색 스타일·동작
    app/assets/douzone-logo.png   DOUZONE 로고
    app/assets/directory-lucide.min.js  lucide 아이콘 라이브러리 (원본과 동일 파일)
    data/                         최근 조회 결과 캐시 (실행 시 자동 생성 · git 제외)

## 동작 방식

- 페이지·CSS·JS 는 이 폴더(app/)에서 직접 서빙됩니다.
- 데이터는 브라우저가 `/api/public/room`, `/api/public/institutions` 를 호출하면
  server.py 가 원본 사이트의 동일 API 로 그대로 전달합니다(원본이 CORS 를 허용하지 않아
  브라우저 직접 호출 대신 로컬 프록시를 사용).
- 마지막으로 성공한 조회 결과를 data/ 에 캐시해 두고, 원본에 연결하지 못하면
  마지막 캐시를 보여줍니다.
- 원본이 무료 호스팅(Render)이라 잠들어 있을 수 있습니다. 서버 시작 시 자동으로
  한 번 깨우며(warm-up), 첫 조회가 느리면 몇십 초 후 다시 조회하면 됩니다.
  연결 자체가 의심되면 `python3 check_upstream.py` 로 진단해 보세요.

## 참고

- 로그인이 필요한 기능(임직원 로그인·가입 요청·명단 내보내기 등)은 원본에서도 로그인
  회원 전용이라 이 미러에 포함하지 않았습니다. 공개 페이지 2개는 완전히 동일하게 동작합니다.
- 서버 종료는 실행 중인 터미널에서 Ctrl+C (start-mirror.command 로 열었다면 그 창 닫기).
