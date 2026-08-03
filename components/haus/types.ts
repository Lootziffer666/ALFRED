export type DockCorner = "br" | "bl" | "tr" | "tl";

export interface DockItem {
  id: string;
  label: string;
  icon: string;
  primary?: boolean;
  onSelect?: () => void;
}

export interface IconAction {
  id: string;
  label: string;
  icon: string;
}

export interface HausRoom {
  id: string;
  navLabel: string;
  title: string;
  subtitle: string;
  /** Nur gesetzt, wenn der Raum eine kontextsensitive Werkzeugzeile zeigt. */
  contextToolbar?: string[];
  hasRightbar: boolean;
  body: React.ReactNode;
}
