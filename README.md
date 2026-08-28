# Bass Practice Lab

ベースの耳コピ、練習、録音後の演奏分析を支援するWebアプリケーションのスケルトンです。

現時点ではUIとAPIの境界のみを実装しています。音源取込、Stem分離、音楽解析、録音、演奏評価は未実装です。

## 起動

```powershell
uv sync --extra dev
uv run uvicorn bass_tracker.main:app --reload
```
ブラウザで <http://127.0.0.1:8000> を開きます。API仕様は <http://127.0.0.1:8000/docs> です。

## 構成

```text
src/bass_tracker/
  main.py             Webアプリ起点
  api/routes.py       UI用のプレースホルダーAPI
  services/           将来の音声処理・解析のサービス境界
  static/             UIモックを元にした画面
```
