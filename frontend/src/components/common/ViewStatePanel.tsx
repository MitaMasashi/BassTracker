import type { PropsWithChildren } from "react";
import { AlertCircle, Inbox, LoaderCircle } from "lucide-react";
import type { ViewState } from "../../api/types";

export function ViewStatePanel({ state, children }: PropsWithChildren<{ state: ViewState }>) {
  if (state === "normal") return children;
  const content = {
    loading: { icon: <LoaderCircle className="spin" />, title: "読み込み中", text: "データを準備しています。" },
    empty: { icon: <Inbox />, title: "データがありません", text: "対象のデータが登録されると、ここに表示されます。" },
    error: { icon: <AlertCircle />, title: "読み込めませんでした", text: "接続を確認して、もう一度お試しください。" },
  }[state];
  return <div className={`state-panel ${state}`}>{content.icon}<strong>{content.title}</strong><span>{content.text}</span></div>;
}