import { HomelabClient } from "@/components/homelab/HomelabClient";

export const metadata = {
  title: "ALFRET — Raum IX · Werkstatt",
  description:
    "Geräte finden, Hardware prüfen, Nutzungsregeln festlegen und eine Platzierung planen — mit Begründung und ohne Ausführung.",
};

export default function HomelabPage() {
  return <HomelabClient />;
}
