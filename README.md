# Work English Note

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/dpark-nv/work-english-note)

업무 중 마주친 영어 문장을 붙여넣고, 번역/주요 단어/숙어/문장 구조/발음/복습 상태를 한곳에 쌓는 영어 공부 노트입니다.

## 무료 클라우드 구조

현재 배포 구조는 당분간 무료로 운영하기 좋게 맞춰져 있습니다.

- Render Free Web Service: 앱 서버 실행
- Supabase Free Postgres: 문장 데이터 영구 저장 및 기기 간 동기화
- `APP_PASSWORD`: 공개 URL 비밀번호 잠금
- 같은 URL에 접속하는 모든 기기가 같은 데이터를 봅니다.

Render 무료 서버는 사용하지 않으면 잠시 잠들 수 있어서 첫 접속이 느릴 수 있습니다. 데이터는 Render가 아니라 Supabase Postgres에 저장되므로 서버가 재시작되어도 유지됩니다.

## Render 무료 배포

1. Supabase에서 새 프로젝트를 만듭니다.
2. Project Settings > Database에서 Postgres connection string을 복사합니다.
3. Render에서 이 저장소를 Blueprint로 배포합니다.
4. Render 환경 변수에 아래 값을 설정합니다.

```text
DATABASE_URL=Supabase에서 복사한 Postgres connection string
APP_PASSWORD=원하는_앱_비밀번호
APP_SECRET=긴_랜덤_문자열
OPENAI_API_KEY=선택사항
OPENAI_MODEL=gpt-5.4-mini
```

`OPENAI_API_KEY`가 없어도 저장, 검색, 복습, 브라우저 발음 재생, 기본 분석은 동작합니다. 키를 넣으면 문장 추가 시 더 자연스러운 AI 분석이 생성됩니다.

## iPad/Mac 앱처럼 쓰기

iPad에서는 배포된 Render URL을 Safari로 연 뒤 공유 버튼 > 홈 화면에 추가를 선택하면 됩니다.

MacBook에서는 Safari, Chrome, Edge에서 같은 URL을 열고 브라우저의 설치 또는 Dock 추가 기능을 사용하면 앱처럼 실행할 수 있습니다.

## 로컬 실행

```powershell
cd C:\Users\dpark\work-english-note
node server.js
```

브라우저에서 `http://localhost:4177`을 엽니다. `DATABASE_URL`이 없으면 로컬 데이터는 `data/sentences.json`에 저장됩니다.

## Docker 로컬 실행

```powershell
docker build -t work-english-note .
docker run -p 4177:4177 `
  -e APP_PASSWORD=local-password `
  -e DATABASE_URL="your_supabase_connection_string" `
  work-english-note
```

`DATABASE_URL`을 빼면 컨테이너 내부 파일 저장으로 동작합니다. 컨테이너를 삭제해도 데이터를 유지하려면 volume을 연결하거나 Supabase를 사용하세요.

## 기존 로컬 데이터 클라우드로 옮기기

클라우드 배포 URL이 생긴 뒤 기존 `data/sentences.json`의 문장을 업로드할 수 있습니다.

```powershell
.\scripts\upload-data-to-cloud.ps1 `
  -CloudUrl "https://your-app.onrender.com" `
  -Password "APP_PASSWORD에_넣은_비밀번호" `
  -Mode merge
```

클라우드 데이터를 백업으로 내려받을 때:

```powershell
.\scripts\download-data-from-cloud.ps1 `
  -CloudUrl "https://your-app.onrender.com" `
  -Password "APP_PASSWORD에_넣은_비밀번호"
```

## 저장 방식

서버는 시작할 때 자동으로 저장소를 선택합니다.

- `DATABASE_URL` 있음: Supabase/Postgres의 `work_english_note_store` 테이블에 저장
- `DATABASE_URL` 없음: 로컬 `data/sentences.json` 파일에 저장

공개 URL로 배포할 때는 `APP_PASSWORD`를 반드시 설정하세요.
