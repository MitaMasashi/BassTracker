# ベース練習WebApp 暫定機能仕様 v0.4

## 1. 概要

### 1.1 目的

ベース演奏の練習を支援するWebアプリケーション。

主な用途を以下の3つとする。

1. 楽曲解析・耳コピ支援
2. 楽曲に合わせた演奏・録音
3. 録音した演奏の分析・評価

初期版は個人利用を目的とする。

---

# 2. 基本コンセプト

本アプリは、

**「楽譜を作るアプリ」ではなく、「練習対象の音源を解析し、耳コピ・演奏・評価を支援するアプリ」**

と位置付ける。

基本利用フロー：

```text
練習曲を登録
    ↓
音源取得・準備
    ↓
Stem分離
    ↓
BPM / Key / Chord / Pitch解析
    ↓
耳コピ
    ↓
必要に応じて外部で譜面作成
    ↓
Bass Muteで練習・録音
    ↓
録音セッション保存
    ↓
演奏解析
    ↓
苦手区間を再練習
```

---

# 3. トップレベルデータ単位

アプリ内の基本単位を `PracticeTrack` とする。

PracticeTrackは、

**「このアプリで練習対象として登録された1つの音源・楽曲・動画」**

を表す。

正式な楽曲である必要はない。

例：

- CD等から取得した楽曲
- WAV / MP3等の音声ファイル
- YouTube動画
- ライブ映像
- Backing Track
- Cover音源
- 自作練習音源

---

# 4. 全体データ構造

```text
PracticeTrack
│
├─ MediaSource
│
├─ AudioAsset
│
├─ ProcessingJob
│
├─ ChordEvent
├─ PitchEvent
│
└─ RecordingSession
       │
       ├─ LatencyCalibration（参照）
       │
       └─ AnalysisContext
              │
              └─ AnalysisResult
                     │
                     └─ NoteEvent
```

---

# 5. PracticeTrack

## 5.1 役割

アプリ内で扱う練習対象のマスターデータ。

取得元や音声ファイル形式には依存しない。

## 5.2 推奨項目

```text
PracticeTrack

id

display_title

song_title
artist_name

duration

bpm
time_signature
key

status

created_at
updated_at
```

### display_title

アプリ内で表示する名称。

### song_title

正式な曲名が分かる場合に保持する。

不明の場合はNULL可。

### artist_name

アーティストが明確な場合のみ保持する。

YouTubeのChannel名をArtistとして自動確定しない。

---

# 6. PracticeTrack Status

PracticeTrackでは細かな処理状態を管理せず、利用可能状態を大まかに表現する。

```text
registered
processing
ready
partial
error
```

例：

```text
YouTube URL登録
↓
registered

音源取得・解析中
↓
processing

必要処理がすべて完了
↓
ready

主要機能は利用可能だが一部解析失敗
↓
partial

音源自体が利用不能など重大エラー
↓
error
```

個々の解析処理の成功・失敗・再試行状態は `ProcessingJob` で管理する。

---

# 7. MediaSource

## 7.1 役割

PracticeTrackがどこから取得されたかを保持する。

解析用音声ファイルそのものは保持しない。

## 7.2 推奨項目

```text
MediaSource

id
practice_track_id

source_type

source_url
external_id

source_title

source_creator
source_creator_id

thumbnail_url

source_duration

source_metadata_json

created_at
```

---

# 8. MediaSource Type

初期対応：

```text
local_file
youtube
```

将来的な候補：

```text
manual
soundcloud
spotify
apple_music
other
```

---

# 9. Local File Source

ローカルファイル登録時：

```text
source_type = local_file
```

必要に応じて、

- 元ファイル名
- 元拡張子
- 元Sample Rate

等をMetadataに保持する。

---

# 10. YouTube Source

YouTubeの場合：

```text
source_type
= youtube

source_url
= 元URL

external_id
= YouTube Video ID

source_title
= 動画タイトル

source_creator
= Channel名

source_creator_id
= Channel ID

thumbnail_url
= サムネイルURL
```

Channel情報とArtist情報は別概念とする。

---

# 11. AudioAsset

## 11.1 役割

解析・再生で使用するサーバー上の実際の音声ファイルを管理する。

MediaSource：

```text
どこから取得したか
```

AudioAsset：

```text
何を解析・再生するか
```

---

## 11.2 推奨項目

```text
AudioAsset

id
practice_track_id

origin_media_source_id
parent_asset_id

asset_type

file_path

format
sample_rate
channels
duration

processing_method
processing_version

created_at
```

---

# 12. AudioAssetのトレーサビリティ

## 12.1 origin_media_source_id

どのMediaSourceを起点として生成されたAssetかを保持する。

例：

```text
MediaSource #3
YouTube

↓
AudioAsset #10
source_audio
```

```text
AudioAsset #10
origin_media_source_id = 3
```

---

## 12.2 parent_asset_id

直接の入力元となったAudioAssetが1つの場合、そのAssetを保持する。

例：

```text
source_audio #10
↓
stem_bass #11
```

```text
AudioAsset #11

origin_media_source_id = 3
parent_asset_id = 10
```

複数入力から生成されたAssetについては、必要に応じてProcessingJob側で入力Asset群を管理する。

---

# 13. AudioAsset Type

初期版では以下を想定する。

```text
source_audio

stem_bass

stem_drums
stem_vocals
stem_other

bass_mute

recording
```

録音ファイルをAudioAssetとして統一管理するか、RecordingSession内のパスとして保持するかは実装時に決定する。

---

# 14. 楽曲取込機能

取込処理のみSource別に分岐する。

```text
練習曲追加
│
├─ ローカル音声
│
└─ YouTube URL
```

どちらも最終的には、

```text
PracticeTrack
+
MediaSource
+
AudioAsset(source_audio)
```

を生成する。

---

# 15. Local File Import

```text
ファイル選択
↓
PracticeTrack作成
↓
MediaSource(local_file)作成
↓
解析用音声へ変換
↓
AudioAsset(source_audio)作成
↓
共通処理
```

---

# 16. YouTube Import

初期個人利用版ではYouTube Sourceから解析用音声を取得するImporterを用意する。

```text
YouTube URL
↓
Video ID取得
↓
Metadata取得
↓
PracticeTrack作成
↓
MediaSource(youtube)作成
↓
音声取得
↓
解析用形式へ変換
↓
AudioAsset(source_audio)
↓
共通処理
```

内部実装候補として `yt-dlp` 等を利用可能とする。

---

# 17. Import Service

```text
ImportService
│
├─ LocalFileImporter
│
└─ YouTubeImporter
```

Importerの責務は、

```text
Source入力
↓
MediaSource生成
↓
source_audio生成
```

までとする。

それ以降の解析処理は共通化する。

---

# 18. 公開版への拡張方針

初期版は個人利用を対象とする。

将来的に一般公開する場合、YouTube等については利用規約・権利・音声取得方法を再検討する。

YouTubeImporterのみ無効化しても、その他の処理に影響しない構造とする。

---

# 19. 共通音声前処理

```text
source_audio
↓
必要に応じて解析用形式へ変換
↓
Stem Separation
↓
Musical Analysis
```

---

# 20. 内部解析用音声形式

初期版ではPCM WAVを基本とする。

Sample Rate：

```text
44.1kHz
または
48kHz
```

最終値は解析モデルとの相性を確認して決定する。

---

# 21. ProcessingJob

## 21.1 役割

Import、Stem分離、BPM解析、Pitch解析等の個々のバックグラウンド処理を管理する。

PracticeTrackのStatusとは分離する。

---

## 21.2 推奨項目

```text
ProcessingJob

id
practice_track_id

job_type

status

processor_name
processor_version

parameters_json

started_at
finished_at

error_code
error_message

retry_count

created_at
```

必要に応じて以下も追加可能とする。

```text
input_asset_ids
output_asset_ids
```

---

# 22. ProcessingJob Type

初期例：

```text
import

normalize_audio

stem_separation

bpm_analysis

key_analysis

chord_analysis

pitch_analysis
```

将来的に処理追加可能とする。

---

# 23. ProcessingJob Status

```text
queued
running
succeeded
failed
cancelled
```

例：

```text
PracticeTrack #12

import              succeeded
normalize_audio     succeeded
stem_separation     succeeded
bpm_analysis        succeeded
key_analysis        succeeded
chord_analysis      succeeded
pitch_analysis      failed
```

この場合PracticeTrackは、

```text
partial
```

として利用可能にする。

Pitch解析だけを再試行可能とする。

---

# 24. Processing Parameters

アルゴリズム固有パラメータは固定カラムを大量に追加せず、

```text
parameters_json
```

に保持する。

例：

```json
{
  "profile": "bass_5string_standard",
  "fmin": 28.0,
  "fmax": 500.0,
  "frame_length": 4096,
  "hop_length": 256
}
```

これにより、解析方式やモデル変更に対応可能とする。

---

# 25. 音源分離

Demucs等を利用する。

```text
source_audio
↓
Stem Separation
↓
stem_bass
stem_drums
stem_vocals
stem_other
```

さらにBass Muteを生成する。

---

# 26. 楽曲解析

PracticeTrack単位で以下を解析する。

```text
BPM
Key
Chord
Bass Pitch
```

---

# 27. BPM推定

source_audioからBPMを推定する。

結果はPracticeTrackに保持し、ユーザー修正を可能とする。

---

# 28. Key推定

候補＋Confidenceを算出する。

例：

```text
E minor   72
G major   19
B minor    6
```

ユーザー修正可能。

---

# 29. ChordEvent

```text
ChordEvent

id
practice_track_id

start_time
end_time

chord
confidence

is_user_corrected
```

---

# 30. Bass Pitch推定

Bass Stemから音程候補を推定する。

目的は完全自動採譜ではなく、

**耳コピ支援用のPitch Hint**

とする。

---

# 31. PitchEvent

```text
PitchEvent

id
practice_track_id

onset_time
end_time

selected_pitch

candidates

is_user_corrected
```

例：

```text
84.382 sec

E2    0.78
E3    0.14
B1    0.05
```

---

# 32. 低音域解析方針

4弦Low-Eや5弦Low-B等の低音域を考慮する。

特にLow-B付近では基音周期が長いため、Pitch Detectionでは比較的長いWindowが必要になる。

ただし、

```text
Onset Detection
```

と

```text
Pitch Detection
```

は別処理として扱う。

---

## 32.1 Onset Detection

主に発音開始位置を高い時間分解能で取得する。

Pitch判定用の長いWindowにOnset精度を依存させない。

---

## 32.2 Pitch Detection

Onset後の安定部分からPitchを推定する。

解析条件例：

```text
fmin
fmax
frame_length
hop_length
model
profile
```

は `ProcessingJob.parameters_json` に保持する。

---

## 32.3 Bass解析Profile

将来的に以下のようなProfileを定義可能とする。

```text
bass_4string_standard
bass_5string_standard
bass_extended_low
```

初期版では必要以上にProfileを増やさず、実データによる比較後に決定する。

---

# 33. Pitch解析方式

候補：

```text
Basic Pitch
CREPE / torchcrepe
pYIN
```

実データで比較して採用方式を決定する。

モデル名・バージョン・パラメータはProcessingJobに保存する。

---

# 34. 耳コピ支援

表示対象：

```text
Waveform

Chord

Pitch Hint

Playback Position

A-B Loop
```

再生モード：

```text
source_audio
stem_bass
bass_mute
```

---

# 35. 譜面機能

初期版では以下を対象外とする。

```text
五線譜編集
TAB編集
音符編集
休符編集
運指編集
完全自動採譜
```

譜面作成は外部ツールまたは紙を使用する。

---

# 36. 練習・録音

リアルタイム解析は行わない。

```text
練習開始
↓
必要な伴奏をClientへロード
↓
ローカル再生
↓
演奏・録音
↓
録音終了
↓
Serverへ送信
```

---

# 37. 伴奏再生

練習開始前にBass Mute等を演奏用PCへ読み込む。

練習中の再生はネットワーク通信に依存しない。

---

# 38. Audio Monitoring

推奨構成：

```text
Bass
↓
Audio Interface
├─ Browser Recording
│
└─ Direct Monitor
      ↓
Headphones
```

ブラウザ経由のSoftware Monitoringは基本的に使用しない。

---

# 39. RecordingSession

## 39.1 役割

ユーザーが実施した1回の演奏・録音を表す。

```text
RecordingSession

id

practice_track_id

recording_file_path

section_start
section_end

playback_speed

count_in_bars

sample_rate

audio_input_device_id
audio_output_device_id

latency_calibration_id

recorded_at
```

---

# 40. RecordingSessionの役割

RecordingSessionには、

**演奏した時点での事実**

を保存する。

例：

```text
PracticeTrack #12

Section
01:20 ～ 01:32

Playback Speed
90%

Sample Rate
48000Hz

Audio Interface
xxx
```

後から書き換えないことを基本とする。

---

# 41. LatencyCalibration

## 41.1 役割

録音後のTiming解析に必要なシステム遅延を実測・保存する。

ユーザーが手動でms値を推測する運用を基本としない。

---

## 41.2 推奨項目

```text
LatencyCalibration

id

input_device_id
output_device_id

sample_rate

browser_info

roundtrip_latency_ms

calibration_method

measured_at
```

---

# 42. Latency Calibration Flow

推奨する自動測定方式：

```text
アプリからClick再生
↓
Audio Interface OUT
↓
Audio Interface IN
↓
Browser Recording
↓
Click位置検出
↓
Round Trip Latency算出
```

推奨方式：

```text
1. Audio Interface内部Loopback

2. Output → Inputをケーブル接続

3. Speaker → Microphone
```

精度の観点から1または2を推奨する。

---

# 43. Calibrationの利用

RecordingSessionでは、

```text
latency_calibration_id
```

を保持する。

AnalysisContext生成時には、

```text
latency_offset_ms
```

をスナップショットとして保存する。

これにより、後からCalibration値が変更されても過去の解析条件を再現できる。

---

# 44. AnalysisContext

## 44.1 役割

RecordingSessionを、

**どの条件で演奏評価したか**

を保存する。

PracticeTrack自体のPitch解析パラメータ等はここには保持しない。

---

## 44.2 推奨項目

```text
AnalysisContext

id

recording_session_id

reference_audio_asset_id

reference_start
reference_end

playback_speed

latency_offset_ms

onset_detector
onset_detector_version

analysis_version

created_at
```

---

# 45. 再解析

同じRecordingSessionを異なる条件で解析可能とする。

```text
RecordingSession
│
├─ AnalysisContext A
│    └─ AnalysisResult A
│
└─ AnalysisContext B
     └─ AnalysisResult B
```

---

# 46. 解析対象

初期版ではApp内で生成されたRecordingSessionのみを解析対象とする。

外部DAW録音等の直接Importは将来機能とする。

---

# 47. 解析画面

ユーザーは録音セッションを1件選択する。

```text
演奏解析

録音
[ 2026/08/28 09:42
  Sample Song A
  01:20 - 01:32 ]

[ 解析開始 ]
```

---

# 48. Context自動取得

RecordingSession選択後、以下を自動取得する。

```text
PracticeTrack

Reference Bass

Section

Playback Speed

Latency Offset

Sample Rate
```

ユーザーによる個別入力を原則不要とする。

---

# 49. Reference

楽曲練習の場合：

```text
PracticeTrack
↓
AudioAsset(stem_bass)
↓
Onset Detection
↓
Reference Note Events
```

を利用する。

---

# 50. タイミング解析

```text
Timing Error
=
Corrected User Onset
-
Reference Onset
```

正値：

```text
遅れ
```

負値：

```text
走り
```

---

# 51. 音量解析

各発音についてLevelを取得する。

候補：

```text
RMS
Peak
```

初期版では発音強度の相対的なばらつきを主な評価対象とする。

---

# 52. AnalysisResult

```text
AnalysisResult

id
analysis_context_id

reference_note_count
matched_note_count
missing_note_count
extra_note_count

timing_mean_ms
timing_mae_ms
timing_std_ms

level_mean_db
level_std_db
level_min_db
level_max_db

analysis_status

analyzed_at
```

---

# 53. NoteEvent

```text
NoteEvent

id
analysis_result_id

event_index

reference_time
user_time

timing_error_ms

level_db

status
```

将来的に：

```text
reference_pitch
detected_pitch
pitch_confidence

reference_duration
detected_duration
```

等を追加可能とする。

---

# 54. NoteEvent Status

初期：

```text
matched
missing
extra
```

将来的な評価属性：

```text
early
late
low_volume
wrong_pitch
```

---

# 55. 解析結果

Summary例：

```text
Timing

平均ズレ       +12 ms
平均絶対ズレ    24 ms
ばらつき        17 ms

Volume

平均           -14.2 dB
ばらつき         2.1 dB

Notes

Reference       128
Matched         121
Missing           7
Extra             4
```

---

# 56. 練習履歴

RecordingSession / AnalysisResult単位で保存する。

```text
日時

PracticeTrack

Section

Playback Speed

Timing Mean
Timing MAE
Timing SD

Volume SD

Missing
Extra
```

---

# 57. 推奨DB構成

```text
practice_tracks

media_sources
audio_assets

processing_jobs

chord_events
pitch_events

latency_calibrations

recording_sessions

analysis_contexts
analysis_results
note_events
```

---

# 58. 主なリレーション

```text
PracticeTrack
  1
  │
  ├── N MediaSource
  │
  ├── N AudioAsset
  │
  ├── N ProcessingJob
  │
  ├── N ChordEvent
  │
  ├── N PitchEvent
  │
  └── N RecordingSession
           │
           ├── 0..1 LatencyCalibration
           │
           └── N AnalysisContext
                    │
                    └── 1 AnalysisResult
                             │
                             └── N NoteEvent
```

LatencyCalibrationは独立した測定データであり、RecordingSessionから参照する。

---

# 59. AudioAsset生成関係

例：

```text
MediaSource
YouTube #3
   ↓
AudioAsset #10
source_audio
   ↓
ProcessingJob
stem_separation
   ↓
├─ AudioAsset #11 stem_bass
├─ AudioAsset #12 stem_drums
├─ AudioAsset #13 stem_vocals
└─ AudioAsset #14 stem_other
```

各Assetは、

```text
origin_media_source_id
```

で大元のSourceを追跡する。

直接の生成関係は、

```text
parent_asset_id
```

または

```text
ProcessingJobのInput / Output情報
```

で追跡する。

---

# 60. 初期実装Phase

## Phase 1：PracticeTrack / Import

```text
PracticeTrack管理

Local File Import

YouTube Import

MediaSource管理

source_audio生成

ProcessingJob基盤
```

---

## Phase 2：音源処理

```text
内部音声形式統一

Demucs

Stem生成

AudioAsset管理

ProcessingJob状態管理
```

---

## Phase 3：耳コピ支援

```text
Waveform

BPM

Key

Chord

A-B Loop

速度変更
```

---

## Phase 4：Bass Pitch Hint

```text
Onset Detection

Pitch Detection

低音域向けParameter調整

複数候補表示

Confidence表示
```

---

## Phase 5：練習・録音

```text
Audio Interface選択

ローカル伴奏再生

Direct Monitor前提

Latency Calibration

カウント

録音

RecordingSession保存
```

---

## Phase 6：演奏解析

```text
RecordingSession選択

AnalysisContext生成

Reference取得

Latency補正

Timing分析

Volume分析

Missing / Extra判定
```

---

## Phase 7：履歴・比較

```text
AnalysisResult保存

過去セッション比較

改善グラフ
```

---

# 61. 初期版完成フロー

```text
練習曲追加

├─ Local File
│
└─ YouTube URL

        ↓

PracticeTrack
MediaSource

        ↓

source_audio

        ↓

Stem分離

        ↓

BPM / Key / Chord / Pitch解析

        ↓

耳コピ

        ↓

Latency Calibration

        ↓

Bass Muteで練習

        ↓

録音

        ↓

RecordingSession

        ↓

解析タブで録音選択

        ↓

Context自動取得

        ↓

Latency補正

        ↓

演奏解析

        ↓

結果確認

        ↓

再練習
```

---

# 62. 初期版で対象外

```text
リアルタイム演奏採点

リアルタイムPitch解析

完全自動採譜

五線譜編集

TAB編集

外部録音ファイル解析

録音音声のリアルタイムStreaming解析

ユーザー間共有

SNS

課金
```

---

# 63. ストレージ管理について

初期個人利用版では、ストレージ容量最適化やAudioAssetの自動削除・キャッシュライフサイクル管理は優先実装対象外とする。

現段階では、

```text
機能検証
解析精度
練習体験
```

を優先する。

以下については、一般公開・複数ユーザー対応・長期運用等が具体化した段階で再検討する。

```text
AudioAsset容量制限

一時ファイル自動削除

Stemの保存対象削減

圧縮形式での保存

ユーザーごとのQuota

キャッシュ管理

Storage Monitoring
```

データ構造上は将来のライフサイクル管理を妨げないよう設計するが、初期版では具体的な削除ポリシーを定義しない。

---

# 64. 設計上の重要原則

## 64.1 Importと解析を分離する

```text
LocalFileImporter
YouTubeImporter
       ↓
source_audio
       ↓
共通処理
```

---

## 64.2 MediaSourceとAudioAssetを分離する

```text
MediaSource
= 出自

AudioAsset
= 処理・再生対象
```

---

## 64.3 AudioAssetの生成経路を追跡する

```text
origin_media_source_id
parent_asset_id
ProcessingJob
```

によって、Sourceから生成物までの経路を追跡可能とする。

---

## 64.4 ProcessingJobとPracticeTrack Statusを分離する

PracticeTrack：

```text
ユーザーから見た利用可能状態
```

ProcessingJob：

```text
個々の処理の成功・失敗・進捗
```

を表す。

---

## 64.5 解析アルゴリズム固有設定はProcessingJobへ保持する

モデル名、バージョン、Window Size、Pitch Range等は、

```text
ProcessingJob.parameters_json
```

で管理する。

---

## 64.6 OnsetとPitchを分離する

特にベース低音域では、

```text
Onset Detection
```

と

```text
Pitch Detection
```

を独立した処理として設計する。

---

## 64.7 RecordingSessionは演奏時の事実

後から変更しない。

---

## 64.8 AnalysisContextは演奏評価条件

RecordingSessionと解析条件を分離し、再解析可能とする。

---

## 64.9 Latencyは実測する

手動推測ではなく、

```text
LatencyCalibration
```

によってAudio環境ごとの遅延を実測することを基本とする。

---

## 64.10 取込後はSource非依存

`source_audio`生成後は、

```text
Local File
YouTube
```

の違いを解析・練習・録音・演奏評価側で意識しない。