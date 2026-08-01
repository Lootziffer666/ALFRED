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
