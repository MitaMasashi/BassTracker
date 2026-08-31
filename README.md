# Bass Practice Lab

ベースの耳コピ、練習、録音後の演奏分析を支援するWebアプリケーションです。

現在は実装仕様書のPhase 1（React UI Skeleton）まで実装しています。画面は型付きMock Dataで動作し、音源取込、DB、音声処理、録音、演奏評価は後続Phaseで接続します。

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

API仕様は <http://127.0.0.1:8000/docs> です。現時点のBackendはPhase 2以前のプレースホルダーです。

Backendの検証:

```powershell
uv run pytest
```

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
src/bass_tracker/       FastAPIプレースホルダー
tests/                  Backend tests
```
