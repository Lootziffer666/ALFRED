import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReportClient as ReportPage } from "@/components/report/ReportClient";
import { extract } from "@/lib/atoms/extract";
import { EMPTY_SIGNALS, LEVELS, SHADED_SIGNALS, WARN } from "@/lib/atoms/data";
import { composeReport } from "@/lib/report/compose";
import { signalsFromEvidence } from "@/lib/report/signals";
import { ctaFor } from "@/lib/report/capabilities";
import type { ReportResponse } from "@/lib/client/api";
import type { RepoEvidence } from "@/lib/schema";
import { loaded, unavailable } from "@/lib/schema";

const now = () => new Date("2026-07-31T00:00:00.000Z");

/** The page reads share parameters; give the tests control over them. */
let searchParams = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useSearchParams: () => searchParams,
}));

function responseFor(signals = SHADED_SIGNALS, level: 1 | 2 | 3 | 4 = 1): ReportResponse {
  return {
    report: composeReport("pruefbericht", {
      atoms: extract(signals),
      level,
      repo: { owner: "Lootziffer666", name: "SHADED", ref: "main" },
      now,
    }),
    repo: {
      owner: "Lootziffer666",
      name: "SHADED",
      ref: "main",
      url: "https://github.com/Lootziffer666/SHADED",
      defaultBranch: "main",
      description: null,
      private: false,
    },
    sources: [
      { slot: "readme", label: "README", status: "loaded", paths: ["README.md"], chars: 120 },
      { slot: "const", label: "Verfassungs-Dokumente", status: "skipped", reason: "Keine Verfassungs-Datei.", paths: [], chars: 0 },
      { slot: "tree", label: "Dateibaum", status: "loaded", paths: ["git/trees"], chars: 90 },
      { slot: "commits", label: "Commits und Pull Requests", status: "unavailable_rate_limited", reason: "Rate limit erschöpft.", paths: [], chars: 0 },
      { slot: "conv", label: "Konventionen", status: "loaded", paths: ["CONTRIBUTING.md"], chars: 40 },
    ],
    warnings: ["Tree limited to first 4000 entries."],
    fetchedAt: "2026-07-31T00:00:00.000Z",
  };
}

function mockFetch(body: unknown, ok = true, status = 200) {
  return vi.fn().mockResolvedValue({ ok, status, json: async () => body } as Response);
}

beforeEach(() => {
  searchParams = new URLSearchParams();
  vi.stubGlobal("fetch", mockFetch(responseFor()));
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("/report — public demo", () => {
  it("asks for a public repository and offers only implemented modes", () => {
    render(<ReportPage />);
    expect(screen.getByLabelText(/Öffentliches GitHub-Repository/)).toBeInTheDocument();

    const modeSelect = screen.getByLabelText("Reportmodus") as HTMLSelectElement;
    expect([...modeSelect.options].map((o) => o.value)).toEqual(["pruefbericht", "biografie", "roast"]);
  });

  it("refuses to submit an empty repository instead of calling the API", async () => {
    const user = userEvent.setup();
    render(<ReportPage />);
    await user.click(screen.getByRole("button", { name: /Bericht erzeugen/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/öffentliches GitHub-Repository/i);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("sends no token to its own route", async () => {
    const user = userEvent.setup();
    render(<ReportPage />);
    await user.type(screen.getByLabelText(/Öffentliches GitHub-Repository/), "Lootziffer666/SHADED");
    await user.click(screen.getByRole("button", { name: /Bericht erzeugen/ }));

    await waitFor(() => expect(fetch).toHaveBeenCalled());
    const [url, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("/api/report");
    const sent = JSON.parse((init as RequestInit).body as string);
    expect(sent).not.toHaveProperty("token");
    expect(sent.repo).toBe("Lootziffer666/SHADED");
  });

  it("renders the report with its evidence reachable behind each backed claim", async () => {
    const user = userEvent.setup();
    render(<ReportPage />);
    await user.type(screen.getByLabelText(/Öffentliches GitHub-Repository/), "Lootziffer666/SHADED");
    await user.click(screen.getByRole("button", { name: /Bericht erzeugen/ }));

    expect(await screen.findByText(LEVELS[1].open)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(WARN[1].slice(0, 30).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))).toBeInTheDocument();

    const evidenceButtons = await screen.findAllByRole("button", { name: /Beleg/ });
    expect(evidenceButtons.length).toBeGreaterThan(0);

    await user.click(evidenceButtons[0]);
    const drawer = await screen.findByRole("dialog");
    expect(within(drawer).getByText(/Worauf dieser Satz beruht/)).toBeInTheDocument();

    await user.click(within(drawer).getByRole("button", { name: /Evidence schließen/ }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("shows what it could and could not read, including the reason", async () => {
    const user = userEvent.setup();
    render(<ReportPage />);
    await user.type(screen.getByLabelText(/Öffentliches GitHub-Repository/), "Lootziffer666/SHADED");
    await user.click(screen.getByRole("button", { name: /Bericht erzeugen/ }));

    expect(await screen.findByText("Quellenlage")).toBeInTheDocument();
    expect(screen.getByText("Keine Verfassungs-Datei.")).toBeInTheDocument();
    expect(screen.getByText("Rate limit erschöpft.")).toBeInTheDocument();
    expect(screen.getByText(/unavailable · rate limited/)).toBeInTheDocument();
    expect(screen.getByText(/Tree limited to first 4000 entries/)).toBeInTheDocument();
  });

  it("surfaces a route error instead of an empty report", async () => {
    vi.stubGlobal("fetch", mockFetch({ error: "Could not load repository nope/nope: 404." }, false, 422));
    const user = userEvent.setup();
    render(<ReportPage />);
    await user.type(screen.getByLabelText(/Öffentliches GitHub-Repository/), "nope/nope");
    await user.click(screen.getByRole("button", { name: /Bericht erzeugen/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/Could not load repository/);
    expect(screen.queryByText("Quellenlage")).not.toBeInTheDocument();
  });

  it("states the empty sections' reason rather than implying nothing was found", async () => {
    vi.stubGlobal("fetch", mockFetch(responseFor(EMPTY_SIGNALS)));
    const user = userEvent.setup();
    render(<ReportPage />);
    await user.type(screen.getByLabelText(/Öffentliches GitHub-Repository/), "octo/empty");
    await user.click(screen.getByRole("button", { name: /Bericht erzeugen/ }));

    expect(await screen.findByText(/Keine Regel hat einen Beleg gefunden/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Beleg/ })).not.toBeInTheDocument();
  });

  it("shows the iceberg and a CTA that does not claim an installer exists", async () => {
    const user = userEvent.setup();
    render(<ReportPage />);
    await user.type(screen.getByLabelText(/Öffentliches GitHub-Repository/), "Lootziffer666/SHADED");
    await user.click(screen.getByRole("button", { name: /Bericht erzeugen/ }));

    expect(await screen.findByText(/ALFRET-Eisberg/)).toBeInTheDocument();

    const cta = ctaFor();
    expect(cta.installs).toBe(false);
    expect(screen.getByRole("link", { name: /Lokale Version ansehen/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /ALFRET lokal installieren/ })).not.toBeInTheDocument();
    expect(screen.getByText(/noch keinen fertigen Installer/)).toBeInTheDocument();
  });

  it("shows no report surface before a run", () => {
    render(<ReportPage />);
    expect(screen.queryByText("Quellenlage")).not.toBeInTheDocument();
    expect(screen.queryByText(/ALFRET-Eisberg/)).not.toBeInTheDocument();
  });
});

describe("signal mapping", () => {
  function evidenceWith(overrides: Partial<RepoEvidence> = {}): RepoEvidence {
    return {
      identity: {
        owner: "octo",
        name: "widget",
        ref: "main",
        url: "https://github.com/octo/widget",
        defaultBranch: "main",
        description: null,
        private: false,
      },
      fetchedAt: "2026-07-31T00:00:00.000Z",
      tree: loaded([{ path: "README.md", type: "file" }]),
      docs: loaded([
        { path: "README.md", excerpt: "single-file runtime, kein build", truncated: false, fullLength: 30 },
        { path: "CLAUDE.md", excerpt: "invariante: darf nie wieder passieren", truncated: false, fullLength: 37 },
        { path: "docs/conventions.md", excerpt: "pink = fenster", truncated: false, fullLength: 14 },
      ]),
      packageManifest: loaded(null),
      commits: loaded([
        { sha: "abc123", message: "Drift beseitigt", author: null, date: null, url: "https://github.com/octo/widget/commit/abc123" },
      ]),
      pullRequests: loaded({ openCount: 1, recent: [{ number: 7, title: "oracle", state: "open", url: "https://github.com/octo/widget/pull/7" }] }),
      issues: loaded({ openCount: 0 }),
      warnings: [],
      ...overrides,
    };
  }

  it("routes each document to the slot its rules scan", () => {
    const { signals, sources } = signalsFromEvidence(evidenceWith());
    expect(signals.readme).toContain("single-file runtime");
    expect(signals.const).toContain("darf nie wieder passieren");
    expect(signals.conv).toContain("pink = fenster");
    expect(signals.commits).toContain("Drift beseitigt");
    expect(signals.commits).toContain("PR #7 oracle");
    expect(signals.tree).toContain("README.md");

    expect(sources.find((s) => s.slot === "const")?.paths).toEqual(["CLAUDE.md"]);
    expect(sources.every((s) => s.status === "loaded")).toBe(true);
  });

  it("propagates an upstream failure rather than reporting an empty repository", () => {
    const { signals, sources } = signalsFromEvidence(
      evidenceWith({ commits: unavailable("unavailable_rate_limited", "rate limited") }),
    );
    expect(signals.commits).toBe("");
    const commits = sources.find((s) => s.slot === "commits")!;
    expect(commits.status).toBe("unavailable_rate_limited");
    expect(commits.reason).toBe("rate limited");
  });

  it("says why a slot is empty when the fetch worked but nothing matched", () => {
    const { sources } = signalsFromEvidence(evidenceWith({ docs: loaded([]) }));
    for (const slot of ["readme", "const", "conv"] as const) {
      const source = sources.find((s) => s.slot === slot)!;
      expect(source.status).toBe("skipped");
      expect(source.reason).toBeTruthy();
    }
  });

  it("produces a report that asserts nothing when no signal carried anything", () => {
    const { signals } = signalsFromEvidence(
      evidenceWith({
        docs: loaded([]),
        commits: loaded([]),
        tree: loaded([]),
        pullRequests: loaded({ openCount: 0, recent: [] }),
      }),
    );
    const report = composeReport("pruefbericht", {
      atoms: extract(signals),
      level: 1,
      repo: { owner: "octo", name: "widget" },
      now,
    });
    expect(report.atomIds).toEqual([]);
  });
});

describe("/report — share links and fixtures", () => {
  it("rebuilds the run from a share link without being asked twice", async () => {
    searchParams = new URLSearchParams({ repo: "Lootziffer666/SHADED", mode: "roast", level: "3", ref: "main" });
    render(<ReportPage />);

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    const [, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      repo: "Lootziffer666/SHADED",
      ref: "main",
      mode: "roast",
      level: 3,
    });
    expect(await screen.findByText("Quellenlage")).toBeInTheDocument();
  });

  it("ignores a share link that names a mode it cannot compose", async () => {
    searchParams = new URLSearchParams({ repo: "o/r", mode: "nonsense" });
    render(<ReportPage />);

    await waitFor(() => expect(fetch).toHaveBeenCalled());
    const [, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(JSON.parse((init as RequestInit).body as string).mode).toBe("pruefbericht");
  });

  it("shows a fixture without any network call, and labels it as an example", async () => {
    const user = userEvent.setup();
    render(<ReportPage />);

    await user.click(screen.getByRole("button", { name: "octo/tinycache" }));

    expect(await screen.findByText(/Beispiel-Signale, kein Abruf/)).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
    expect(screen.queryByText("Quellenlage")).not.toBeInTheDocument();
  });

  it("offers Markdown, HTML, JSON and a share link once a report exists", async () => {
    const user = userEvent.setup();
    render(<ReportPage />);
    await user.click(screen.getByRole("button", { name: "SHADED" }));

    for (const label of [/Markdown/, /HTML/, /JSON/, /Link teilen/]) {
      expect(await screen.findByRole("button", { name: label })).toBeInTheDocument();
    }
    expect(screen.getByText(/Der Link enthält nur Repository, Ref und Modus/)).toBeInTheDocument();
  });

  it("shows the serious assessment alongside the tone", async () => {
    const user = userEvent.setup();
    render(<ReportPage />);
    await user.click(screen.getByRole("button", { name: "SHADED" }));

    expect(await screen.findByText("Kurzbewertung")).toBeInTheDocument();
    expect(screen.getByText("Donor-Eignung")).toBeInTheDocument();
    expect(screen.getByText(/Nicht beurteilt/)).toBeInTheDocument();
    // Stated both as a donor blocker and as an unjudged item — deliberately.
    expect(screen.getAllByText(/Die Lizenz wurde nicht gelesen/).length).toBeGreaterThan(1);
  });
});
