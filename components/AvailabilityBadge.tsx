import type { Availability } from "@/lib/schema";

const LABELS: Record<string, { label: string; color: string }> = {
  loaded: { label: "loaded", color: "var(--ok)" },
  loading: { label: "loading…", color: "var(--brass-l)" },
  unavailable_permissions: { label: "unavailable · permissions", color: "var(--zinnober)" },
  unavailable_rate_limited: { label: "unavailable · rate limited", color: "var(--zinnober)" },
  failed: { label: "failed", color: "var(--zinnober)" },
  skipped: { label: "skipped · safety limit", color: "var(--hyp)" },
};

export function AvailabilityBadge({ status }: { status: Availability<unknown>["status"] }) {
  const info = LABELS[status] ?? { label: status, color: "var(--mut)" };
  return (
    <span className="pill">
      <span className="dot" style={{ background: info.color }} />
      {info.label}
    </span>
  );
}

export function reasonOf(a: Availability<unknown>): string | null {
  if (a.status === "loaded" || a.status === "loading") return null;
  return (a as { reason: string }).reason;
}
