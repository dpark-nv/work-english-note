# Work English Note

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/dpark-nv/work-english-note)

업무 중 마주친 영어 문장을 붙여넣고, 번역/주요 단어/숙어/문장 구조/발음/복습 상태를 한곳에 쌓는 영어 공부 노트입니다.

## 이 PC에서 실행

```powershell
cd C:\Users\dpark\work-english-note
node server.js
```

브라우저에서 `http://localhost:4177`을 엽니다.

## 같은 Wi-Fi의 다른 기기에서 실행

```powershell
cd C:\Users\dpark\work-english-note
.\run-lan.ps1
```

터미널에 `LAN: http://내_PC_IP:4177` 주소가 표시됩니다. 휴대폰이나 다른 노트북이 같은 Wi-Fi에 연결되어 있으면 그 주소로 접속하면 됩니다.

다른 기기에서 접속이 안 되면 Windows Defender Firewall에서 Node.js를 개인 네트워크에 허용하세요.

## MacBook/iPad에서 앱처럼 설치

이 앱은 PWA로 설정되어 있어서 브라우저에서 설치형 앱처럼 사용할 수 있습니다.

### MacBook

1. 서버 주소를 엽니다. 예: `http://192.168.0.12:4177` 또는 클라우드 배포 URL
2. Chrome/Edge에서는 주소창 오른쪽의 설치 아이콘을 누릅니다.
3. Safari에서는 공유 버튼 또는 파일 메뉴의 Dock 추가 기능을 사용합니다.

### iPad

1. Safari에서 서버 주소를 엽니다.
2. 공유 버튼을 누릅니다.
3. `홈 화면에 추가`를 선택합니다.

같은 Wi-Fi의 `http://192.168.0.12:4177` 주소도 열 수 있지만, 진짜 설치형 PWA 동작과 캐시는 HTTPS 클라우드 배포 URL에서 가장 안정적입니다.

## AI 자동 분석 켜기

OpenAI API 키를 환경 변수로 설정하면 문장 추가 시 자동으로 더 자연스러운 분석이 생성됩니다.

```powershell
$env:OPENAI_API_KEY="your_api_key"
$env:OPENAI_MODEL="gpt-5.4-mini"
node server.js
```

키가 없어도 문장 저장, 검색, 복습, 브라우저 발음 재생, 기본 단어/구조 힌트는 계속 동작합니다.

## 클라우드 배포

이 앱은 Docker 배포가 가능하도록 준비되어 있습니다.

```powershell
docker build -t work-english-note .
docker run -p 4177:4177 -v ${PWD}\data:/app/data work-english-note
```

Docker Compose로 계속 켜둘 수도 있습니다.

```powershell
docker compose up -d
```

여러 디바이스 동기화는 모든 기기가 같은 서버 URL에 접속하는 방식입니다. 예를 들어 클라우드 URL이 `https://work-english-note.example.com`이면 MacBook, iPad, Windows PC 모두 그 주소를 열고 같은 저장소를 보게 됩니다.

Render 같은 Docker 지원 플랫폼에서는 `render.yaml`을 사용할 수 있습니다. `OPENAI_API_KEY`는 플랫폼의 환경 변수/Secret으로 넣고, `/app/data`는 persistent disk로 유지해야 문장 데이터가 사라지지 않습니다. 이 앱은 `DATA_DIR=/app/data`에 `sentences.json`을 저장하고, 저장할 때마다 `backups/`에 자동 백업을 남깁니다.

중요: ephemeral filesystem만 제공하는 무료/임시 런타임에 올리면 재시작 때 데이터가 사라질 수 있습니다. 반드시 persistent disk, mounted volume, 또는 별도 데이터베이스가 있는 배포 환경을 사용하세요.

공개 URL로 배포할 때는 `APP_PASSWORD`를 반드시 설정하세요. 설정하면 앱 접속 시 비밀번호 화면이 먼저 뜹니다.

```text
APP_PASSWORD=원하는_비밀번호
APP_SECRET=긴_랜덤_문자열
```

## 기존 로컬 데이터 클라우드로 옮기기

클라우드 배포 후 공개 URL이 생기면 기존 `data/sentences.json`의 문장을 클라우드 저장소로 옮길 수 있습니다.

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

## 저장 위치

기본 저장 파일:

```text
C:\Users\dpark\work-english-note\data\sentences.json
```

클라우드나 Docker에서는 `DATA_DIR` 환경 변수로 저장 위치를 바꿀 수 있습니다.
