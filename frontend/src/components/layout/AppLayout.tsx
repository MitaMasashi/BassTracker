import { Activity, AudioLines, Clock3, Disc3, FilePlus2, Library, Mic2 } from "lucide-react";
import { createContext, useCallback, useContext, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import type { ViewState } from "../../api/types";
import { readSelectedTrack, writeSelectedTrack } from "../../services/selectedTrack";

const ViewStateContext = createContext<ViewState>("normal");
export const useViewState = () => useContext(ViewStateContext);

const SelectedTrackContext = createContext<{ trackId: number | null; selectTrack: (trackId: number) => void }>({ trackId: null, selectTrack: () => undefined });
export const useSelectedTrack = () => useContext(SelectedTrackContext);

function buildNavItems(trackId: number | null) {
  return [
    { to: "/tracks", label: "ライブラリ", icon: Library, end: true },
    { to: "/tracks/new", label: "練習曲追加", icon: FilePlus2 },
    { to: trackId ? `/tracks/${trackId}/ear-copy` : "/tracks", label: "耳コピ", icon: AudioLines },
    { to: trackId ? `/tracks/${trackId}/practice` : "/tracks", label: "練習・録音", icon: Mic2 },
    { to: "/analysis", label: "解析", icon: Activity },
    { to: "/history", label: "履歴", icon: Clock3 },
  ];
}

export function AppLayout() {
  const [viewState, setViewState] = useState<ViewState>("normal");
  const [trackId, setTrackId] = useState<number | null>(readSelectedTrack);
  const selectTrack = useCallback((next: number) => { writeSelectedTrack(next); setTrackId(next); }, []);
  const navItems = buildNavItems(trackId);
  return <SelectedTrackContext.Provider value={{ trackId, selectTrack }}><ViewStateContext.Provider value={viewState}>
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><Disc3 /><div><strong>Bass Practice Lab</strong><small>Personal studio</small></div></div>
        <nav>{navItems.map(({ to, label, icon: Icon, end }) => <NavLink key={label} to={to} end={end} className={({ isActive }) => isActive ? "active" : ""}><Icon /><span>{label}</span></NavLink>)}</nav>
        <div className="sidebar-footer"><label htmlFor="view-state">表示状態</label><select id="view-state" value={viewState} onChange={(event) => setViewState(event.target.value as ViewState)}><option value="normal">通常</option><option value="loading">読込中</option><option value="empty">空</option><option value="error">エラー</option></select></div>
      </aside>
      <main><Outlet /></main>
    </div>
  </ViewStateContext.Provider></SelectedTrackContext.Provider>;
}