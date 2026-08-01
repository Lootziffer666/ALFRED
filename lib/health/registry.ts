// plan §34b — Health Registry: Status aller Subsysteme.

export type HealthStatus = "ok" | "degraded" | "failed";

export interface HealthCheck {
  name: string;
  status: HealthStatus;
  lastCheck: string;
  message?: string;
}

export interface HealthRegistry {
  checks: Map<string, HealthCheck>;
}

export function createHealthRegistry(): HealthRegistry {
  return {
    checks: new Map(),
  };
}

export function recordCheck(
  registry: HealthRegistry,
  name: string,
  status: HealthStatus,
  message?: string,
): void {
  registry.checks.set(name, {
    name,
    status,
    lastCheck: new Date().toISOString(),
    message,
  });
}

export function getOverallHealth(registry: HealthRegistry): HealthStatus {
  let hasFailure = false;
  let hasDegraded = false;

  for (const check of registry.checks.values()) {
    if (check.status === "failed") hasFailure = true;
    if (check.status === "degraded") hasDegraded = true;
  }

  if (hasFailure) return "failed";
  if (hasDegraded) return "degraded";
  return "ok";
}
