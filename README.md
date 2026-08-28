# Bass Practice Lab

ベースの耳コピ、練習、録音後の演奏分析を支援するWebアプリケーションのスケルトンです。

SQLite永続化、Repository／Service、基本API、ファイル保存構成、Job管理までを実装しています。
音源取込、Stem分離、音楽解析、ブラウザ録音、演奏評価の各処理は未実装です。

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
  models.py           SQLAlchemyテーブル定義
  repositories.py     永続化アクセス
  api/routes.py       FastAPIエンドポイント
  services/           エンティティ操作・Job実行管理
  storage.py          ファイル保存先管理
  static/             UIモックを元にした画面
```

## 共通基盤

起動時に `data/` 以下へSQLite DBとファイル保存ディレクトリを作成します。

```text
data/
  db/bass_tracker.sqlite3
  uploads/
  tmp/
  audio/
    source/
    stems/{bass,drums,vocals,other}/
    bass_mute/
    recordings/
```

データ保存先は `BASS_TRACKER_DATA_DIR`、DB接続先は
`BASS_TRACKER_DATABASE_URL` 環境変数で変更できます。API仕様と試行は
<http://127.0.0.1:8000/docs> から確認できます。

`ProcessingJob` は `queued → running → succeeded / failed` の状態遷移を管理します。
未登録の処理を実行すると `failed` になり、例外クラスとメッセージが
`error_code`、`error_message` に保存されます。失敗Jobは再試行できます。
