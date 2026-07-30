import { describe, expect, it } from "vitest";
import { GitHubInputError, normalizeRepoInput, parseGitHubResourceUrl, parseUnifiedDiff } from "@/lib/github";

describe("normalizeRepoInput", () => {
  it("parses an owner/repo pair", () => {
    expect(normalizeRepoInput("octo/widget-kit")).toEqual({ owner: "octo", name: "widget-kit" });
  });

  it("parses a full github.com URL", () => {
    expect(normalizeRepoInput("https://github.com/octo/widget-kit")).toEqual({ owner: "octo", name: "widget-kit" });
  });

  it("parses a github.com URL with a trailing .git and extra path segments", () => {
    expect(normalizeRepoInput("https://github.com/octo/widget-kit.git")).toEqual({ owner: "octo", name: "widget-kit" });
    expect(normalizeRepoInput("https://github.com/octo/widget-kit/tree/main")).toEqual({ owner: "octo", name: "widget-kit" });
  });

  it("rejects empty input", () => {
    expect(() => normalizeRepoInput("")).toThrow(GitHubInputError);
  });

  it("rejects a non-GitHub URL", () => {
    expect(() => normalizeRepoInput("https://gitlab.com/octo/widget-kit")).toThrow(GitHubInputError);
  });

  it("rejects nonsense input", () => {
    expect(() => normalizeRepoInput("just some words")).toThrow(GitHubInputError);
  });
});

describe("parseGitHubResourceUrl", () => {
  it("parses a pull request URL", () => {
    const result = parseGitHubResourceUrl("https://github.com/octo/widget-kit/pull/42");
    expect(result).toEqual({ kind: "pull_request", owner: "octo", name: "widget-kit", number: 42 });
  });

  it("parses a compare URL", () => {
    const result = parseGitHubResourceUrl("https://github.com/octo/widget-kit/compare/main...feature");
    expect(result).toEqual({ kind: "compare", owner: "octo", name: "widget-kit", base: "main", head: "feature" });
  });

  it("rejects a non-github URL", () => {
    const result = parseGitHubResourceUrl("https://example.com/octo/widget-kit/pull/1");
    expect(result.kind).toBe("invalid");
  });

  it("rejects an unrecognized github.com path", () => {
    const result = parseGitHubResourceUrl("https://github.com/octo/widget-kit/issues/1");
    expect(result.kind).toBe("invalid");
  });
});

describe("parseUnifiedDiff", () => {
  it("extracts changed files, additions and deletions", () => {
    const diff = `diff --git a/foo.ts b/foo.ts
index 111..222 100644
--- a/foo.ts
+++ b/foo.ts
@@ -1,2 +1,3 @@
 const a = 1;
+const b = 2;
-const c = 3;
`;
    const files = parseUnifiedDiff(diff);
    expect(files).toHaveLength(1);
    expect(files[0].path).toBe("foo.ts");
    expect(files[0].additions).toBe(1);
    expect(files[0].deletions).toBe(1);
    expect(files[0].status).toBe("modified");
  });

  it("detects added and deleted files", () => {
    const diff = `diff --git a/new.ts b/new.ts
new file mode 100644
index 000..111
--- /dev/null
+++ b/new.ts
@@ -0,0 +1,1 @@
+export const x = 1;
diff --git a/old.ts b/old.ts
deleted file mode 100644
index 111..000
--- a/old.ts
+++ /dev/null
@@ -1,1 +0,0 @@
-export const y = 1;
`;
    const files = parseUnifiedDiff(diff);
    expect(files).toHaveLength(2);
    expect(files[0]).toMatchObject({ path: "new.ts", status: "added" });
    expect(files[1]).toMatchObject({ path: "old.ts", status: "removed" });
  });

  it("returns an empty array for non-diff text", () => {
    expect(parseUnifiedDiff("hello world")).toEqual([]);
  });
});
