import { describe, it, expect } from "vitest";
import {
  checkDemoPolicy,
  withDemoTimeout,
  DemoPolicyError,
  DEMO_RESOURCE_LIMITS,
} from "@/lib/demo/policy";

describe("checkDemoPolicy", () => {
  it("erlaubt gültige öffentliche GitHub-URL in public-demo", () => {
    const violations = checkDemoPolicy(
      { repoUrl: "https://github.com/Lootziffer666/ALFRED" },
      "production",
    );
    expect(violations).toHaveLength(0);
  });

  it("erlaubt alles in local-installation (kein Limit)", () => {
    const violations = checkDemoPolicy(
      {
        repoUrl: "git@github.com:private/repo.git",
        nodeId: "local-workstation",
        executor: "native-runner",
      },
      "local-dev",
    );
    expect(violations).toHaveLength(0);
  });

  it("lehnt SSH-URL in public-demo ab", () => {
    const violations = checkDemoPolicy(
      { repoUrl: "git@github.com:someone/repo.git" },
      "production",
    );
    expect(violations.some((v) => v.kind === "private-repository")).toBe(true);
  });

  it("lehnt lokalen Node in public-demo ab", () => {
    const violations = checkDemoPolicy(
      {
        repoUrl: "https://github.com/someone/repo",
        nodeId: "local-workstation",
      },
      "production",
    );
    expect(violations.some((v) => v.kind === "local-runner-reference")).toBe(true);
  });

  it("lehnt unerlaubten Executor in public-demo ab", () => {
    const violations = checkDemoPolicy(
      {
        repoUrl: "https://github.com/someone/repo",
        executor: "native-runner",
      },
      "production",
    );
    expect(violations.some((v) => v.kind === "disallowed-executor")).toBe(true);
  });

  it("erlaubt deterministic-demo Executor in public-demo", () => {
    const violations = checkDemoPolicy(
      {
        repoUrl: "https://github.com/someone/repo",
        executor: "deterministic-demo",
      },
      "production",
    );
    expect(violations.filter((v) => v.kind === "disallowed-executor")).toHaveLength(0);
  });

  it("erkennt GitHub-Token im Body", () => {
    const violations = checkDemoPolicy(
      {
        repoUrl: "https://github.com/someone/repo",
        rawBody: JSON.stringify({ token: "ghp_" + "A".repeat(36) }),
      },
      "production",
    );
    expect(violations.some((v) => v.kind === "secret-detected")).toBe(true);
  });

  it("lehnt zu großen Body ab", () => {
    const violations = checkDemoPolicy(
      {
        repoUrl: "https://github.com/someone/repo",
        bodySizeBytes: DEMO_RESOURCE_LIMITS.maxOutputBytes + 1,
      },
      "production",
    );
    expect(violations.some((v) => v.kind === "payload-too-large")).toBe(true);
  });
});

describe("withDemoTimeout", () => {
  it("löst auf wenn die Funktion innerhalb des Limits fertig wird", async () => {
    const result = await withDemoTimeout(() => Promise.resolve(42), 1000);
    expect(result).toBe(42);
  });

  it("wirft DemoPolicyError bei Timeout-Überschreitung", async () => {
    await expect(
      withDemoTimeout(
        () => new Promise((resolve) => setTimeout(resolve, 200)),
        50,
      ),
    ).rejects.toThrow(DemoPolicyError);
  });
});
