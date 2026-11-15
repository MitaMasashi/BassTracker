import { Check, X } from "lucide-react";
import { useState } from "react";
import { api, type ApiTrack, type TrackPatch } from "../../api/client";

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
export const KEY_OPTIONS = NOTE_NAMES.flatMap((note) => [`${note} major`, `${note} minor`]);
const DENOMINATORS = [2, 4, 8, 16];

interface Draft {
  display_title: string;
  song_title: string;
  artist_name: string;
  bpm: string;
  musical_key: string;
  time_signature_numerator: string;
  time_signature_denominator: string;
}

function toDraft(track: ApiTrack): Draft {
  return {
    display_title: track.display_title,
    song_title: track.song_title ?? "",
    artist_name: track.artist_name ?? "",
    bpm: track.bpm !== null ? String(Number(track.bpm.toFixed(2))) : "",
    musical_key: track.musical_key ?? "",
    time_signature_numerator: track.time_signature_numerator ? String(track.time_signature_numerator) : "",
    time_signature_denominator: track.time_signature_denominator ? String(track.time_signature_denominator) : "",
  };
}

const optionalText = (value: string): string | null => value.trim() || null;

/** 入力値を検証してPATCH Bodyを作る。不正な場合はエラーメッセージを返す。 */
export function buildTrackPatch(draft: Draft): { patch: TrackPatch } | { error: string } {
  const title = draft.display_title.trim();
  if (!title) return { error: "表示名は必須です" };
  const bpm = draft.bpm.trim() ? Number(draft.bpm) : null;
  if (bpm !== null && (!Number.isFinite(bpm) || bpm <= 0 || bpm > 400)) return { error: "BPMは0より大きく400以下の数値で入力してください" };
  const numerator = draft.time_signature_numerator.trim() ? Number(draft.time_signature_numerator) : null;
  if (numerator !== null && (!Number.isInteger(numerator) || numerator < 1 || numerator > 32)) return { error: "拍子の分子は1〜32の整数で入力してください" };
  const denominator = draft.time_signature_denominator ? Number(draft.time_signature_denominator) : null;
  if ((numerator === null) !== (denominator === null)) return { error: "拍子は分子と分母の両方を指定してください" };
  return {
    patch: {
      display_title: title,
      song_title: optionalText(draft.song_title),
      artist_name: optionalText(draft.artist_name),
      bpm,
      musical_key: optionalText(draft.musical_key),
      time_signature_numerator: numerator,
      time_signature_denominator: denominator,
    },
  };
}

export function TrackInfoEditor({ track, onSaved, onCancel }: { track: ApiTrack; onSaved: (track: ApiTrack) => void; onCancel: () => void }) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(track));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const field = (key: keyof Draft) => ({ value: draft[key], onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setDraft({ ...draft, [key]: event.target.value }) });

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const built = buildTrackPatch(draft);
    if ("error" in built) { setError(built.error); return; }
    setSaving(true);
    setError("");
    try {
      onSaved(await api.patchTrack(track.id, built.patch));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "保存に失敗しました");
      setSaving(false);
    }
  }

  return <form className="form track-editor" onSubmit={submit} aria-label="曲情報の編集">
    <label>表示名<input {...field("display_title")} required maxLength={200} /></label>
    <div className="field-grid two">
      <label>曲名 <small>任意</small><input {...field("song_title")} /></label>
      <label>アーティスト <small>任意</small><input {...field("artist_name")} /></label>
    </div>
    <div className="field-grid">
      <label>BPM<input {...field("bpm")} type="number" inputMode="decimal" min={1} max={400} step="0.01" placeholder="120" /></label>
      <label>Key<input {...field("musical_key")} list="track-key-options" placeholder="E minor" /></label>
      <label className="time-signature-field">拍子<span className="time-signature"><input {...field("time_signature_numerator")} aria-label="拍子の分子" type="number" min={1} max={32} step={1} placeholder="4" /><span>/</span><select {...field("time_signature_denominator")} aria-label="拍子の分母"><option value="">-</option>{DENOMINATORS.map((value) => <option key={value} value={value}>{value}</option>)}</select></span></label>
    </div>
    <datalist id="track-key-options">{KEY_OPTIONS.map((key) => <option key={key} value={key} />)}</datalist>
    <small className="hint">BPMと拍子はカウントインと演奏解析の基準になります。</small>
    {error && <p className="form-error">{error}</p>}
    <div className="button-row">
      <button className="button primary" type="submit" disabled={saving}><Check />{saving ? "保存中..." : "保存"}</button>
      <button className="button" type="button" onClick={onCancel} disabled={saving}><X />キャンセル</button>
    </div>
  </form>;
}
