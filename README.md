# Bass Practice Lab

ベースの耳コピ、練習、録音後の演奏分析を支援するWebアプリケーションです。

実装仕様書のPhase 1〜7のアプリケーション境界を実装しています。外部音声処理にはFFmpeg、yt-dlp、Demucsが必要です。

## Frontend起動

```powershell
cd frontend
npm install
npm run dev
```

ブラウザで <http://localhost:5173> を開きます。

Frontendの検証:

```powershell
cd frontend
npm run build
```

## Backend起動

```powershell
uv sync --extra dev
uv run uvicorn bass_tracker.main:app --reload
```

API仕様は <http://127.0.0.1:8000/docs> です。

別TerminalでWorkerを起動します。

```powershell
uv run bass-tracker-worker
```

初回DB作成とMigration:

```powershell
uv run alembic upgrade head
```

## 外部ツール

PATH上に以下を用意するか、`.env`で実行ファイルを指定します。

```text
ffmpeg / ffprobe
yt-dlp
demucs
```

`.env.example`を設定の基準にしてください。LANの別PCから録音する場合はHTTPSでFrontendを配信します。

Backendの検証:

```powershell
uv run pytest
```

## NVIDIA GPU Docker起動

前提:

- NVIDIA GPUとCUDA 13互換ドライバー
- Docker EngineまたはDocker Desktop
- NVIDIA Container Toolkit
- Docker Compose v2

GPUがコンテナから見えることを確認します。

```powershell
docker run --rm --gpus all nvidia/cuda:13.0.2-base-ubuntu24.04 nvidia-smi
```

アプリケーションをビルドして起動します。

```powershell
docker compose up --build -d
docker compose logs -f worker
```

ブラウザで <http://localhost:8080> を開きます。公開Portを変更する場合は`APP_PORT`を指定します。

```powershell
$env:APP_PORT=8088
docker compose up --build -d
```

Workerは起動時にCUDAを検査し、GPUが利用できなければ終了します。Demucsは`DEMUCS_DEVICE=cuda`で実行され、モデルとアプリケーションデータはDocker Volumeへ保存されます。

```powershell
docker compose down
docker compose down -v  # 音源、DB、モデルキャッシュも削除
```

LAN上の別PCからマイク録音を利用する場合は、信頼済み証明書を使うHTTPSリバースプロキシをFrontendの前段に配置してください。

## Routes

```text
/                      -> /tracks
/tracks                -> ライブラリ
/tracks/new            -> 練習曲追加
/tracks/:id/ear-copy   -> 耳コピ
/tracks/:id/practice   -> 練習・録音
/analysis              -> 解析
/history               -> 履歴
```

## 構成

```text
frontend/               React + TypeScript + Vite UI
  src/app/              Router
  src/pages/            主要6画面
  src/components/       共通Layout / UI
  src/api/types.ts      Frontend型定義
  src/mocks/            Phase 1 Mock Data
src/bass_tracker/       FastAPI / Worker / Audio processors
tests/                  Backend tests
```
