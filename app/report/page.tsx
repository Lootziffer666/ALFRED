import { Suspense } from "react";
import { ReportClient } from "@/components/report/ReportClient";

export const metadata = {
  title: "ALFRET — Öffentlicher Repository-Bericht",
  description:
    "ALFRET schreibt einen Bericht, weil es das Repository ohnehin verstehen muss. Jede Aussage ist an ihre Belege gebunden.",
};

export default function ReportPage() {
  return (
    <Suspense fallback={<main style={{ padding: 28 }} className="mono">Lädt…</main>}>
      <ReportClient />
    </Suspense>
  );
}
