// plan §33 — Global Search Query. Rein, keine I/O.

export interface SearchQuery {
  text: string;
  filters?: {
    kind?: string;
    severity?: string;
    repository?: string;
  };
}

export interface SearchResult {
  id: string;
  kind: string;
  path: string;
  repository: string;
  detail: string;
  severity?: string;
}

export function parseSearchQuery(input: string): SearchQuery {
  return {
    text: input.trim(),
    filters: {},
  };
}

export function matchesQuery(result: SearchResult, query: SearchQuery): boolean {
  if (query.text && !result.detail.toLowerCase().includes(query.text.toLowerCase())) {
    return false;
  }
  if (query.filters?.kind && result.kind !== query.filters.kind) {
    return false;
  }
  if (query.filters?.severity && result.severity !== query.filters.severity) {
    return false;
  }
  if (query.filters?.repository && result.repository !== query.filters.repository) {
    return false;
  }
  return true;
}

export function applyFilters<T extends { repository?: string; title?: string; severity?: string; path?: string }>(
  results: T[],
  filters: Record<string, string>,
): T[] {
  return results.filter((r) => {
    for (const [key, value] of Object.entries(filters)) {
      switch (key) {
        case "repo":
        case "repository":
          if (!r.repository?.toLowerCase().includes(value.toLowerCase())) return false;
          break;
        case "kind":
          if (r.title?.toLowerCase() !== value.toLowerCase()) return false;
          break;
        case "severity":
          if (r.severity?.toLowerCase() !== value.toLowerCase()) return false;
          break;
        case "path":
          if (!r.path?.toLowerCase().includes(value.toLowerCase())) return false;
          break;
        default:
          break;
      }
    }
    return true;
  });
}
