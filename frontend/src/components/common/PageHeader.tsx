import type { ReactNode } from "react";

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow: string; title: string; description: string; actions?: ReactNode }) {
  return <header className="page-header"><div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2><p>{description}</p></div>{actions && <div className="header-actions">{actions}</div>}</header>;
}