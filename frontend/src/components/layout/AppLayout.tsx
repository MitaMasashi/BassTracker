import { Activity, AudioLines, Clock3, Disc3, FilePlus2, Library, Mic2 } from "lucide-react";
import { createContext, useContext, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import type { ViewState } from "../../api/types";

const ViewStateContext = createContext<ViewState>("normal");
export const useViewState = () => useContext(ViewStateContext);

const navItems = [
  { to: "/tracks", label: "ライブラリ", icon: Library, end: true },
  { to: "/tracks/new", label: "練習曲追加", icon: FilePlus2 },
  { to: "/tracks/12/ear-copy", label: "耳コピ", icon: AudioLines },
  { to: "/tracks/12/practice", label: "練習・録音", icon: Mic2 },
  { to: "/analysis", label: "解析", icon: Activity },
  { to: "/history", label: "履歴", icon: Clock3 },
];

export function AppLayout() {
  const [viewState, setViewState] = useState<ViewState>("normal");
  return <ViewStateContext.Provider value={viewState}>
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><Disc3 /><div><strong>Bass Practice Lab</strong><small>Personal studio</small></div></div>
        <nav>{navItems.map(({ to, label, icon: Icon, end }) => <NavLink key={to} to={to} end={end} className={({ isActive }) => isActive ? "active" : ""}><Icon /><span>{label}</span></NavLink>)}</nav>
        <div className="sidebar-footer"><label htmlFor="view-state">表示状態</label><select id="view-state" value={viewState} onChange={(event) => setViewState(event.target.value as ViewState)}><option value="normal">通常</option><option value="loading">読込中</option><option value="empty">空</option><option value="error">エラー</option></select></div>
      </aside>
      <main><Outlet /></main>
    </div>
  </ViewStateContext.Provider>;
}