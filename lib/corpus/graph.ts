import type { CorpusKind, GraphEdge, GraphEdgeKind, GraphNode, GraphNodeKind } from "../schema/corpus";
import { isProven } from "../schema/truth";

/**
 * The project graph (plan §10.5). Nodes carry both where they came from
 * (`corpus`) and how well they are supported (`truth`), so a donor idea and a
 * verified module can sit in the same graph without being mistaken for each
 * other.
 */
export class ProjectGraph {
  private readonly nodesById = new Map<string, GraphNode>();
  private readonly edgeList: GraphEdge[] = [];

  constructor(nodes: GraphNode[] = [], edges: GraphEdge[] = []) {
    for (const node of nodes) this.nodesById.set(node.id, node);
    for (const edge of edges) this.edgeList.push(edge);
  }

  addNode(node: GraphNode): GraphNode {
    this.nodesById.set(node.id, node);
    return node;
  }

  /** Refuses to connect nodes that do not exist, rather than creating them implicitly. */
  addEdge(edge: GraphEdge): GraphEdge {
    if (!this.nodesById.has(edge.from)) throw new Error(`Unknown graph node: ${edge.from}`);
    if (!this.nodesById.has(edge.to)) throw new Error(`Unknown graph node: ${edge.to}`);
    this.edgeList.push(edge);
    return edge;
  }

  node(id: string): GraphNode | undefined {
    return this.nodesById.get(id);
  }

  nodes(filter?: { kind?: GraphNodeKind; corpus?: CorpusKind }): GraphNode[] {
    return [...this.nodesById.values()].filter(
      (n) => (!filter?.kind || n.kind === filter.kind) && (!filter?.corpus || n.corpus === filter.corpus),
    );
  }

  edges(filter?: { kind?: GraphEdgeKind; from?: string; to?: string }): GraphEdge[] {
    return this.edgeList.filter(
      (e) =>
        (!filter?.kind || e.kind === filter.kind) &&
        (!filter?.from || e.from === filter.from) &&
        (!filter?.to || e.to === filter.to),
    );
  }

  neighbours(id: string, kind?: GraphEdgeKind): GraphNode[] {
    return this.edgeList
      .filter((e) => e.from === id && (!kind || e.kind === kind))
      .map((e) => this.nodesById.get(e.to))
      .filter((n): n is GraphNode => n !== undefined);
  }

  /** Only the project corpus counts as settled, and only when actually proven. */
  provenProjectNodes(): GraphNode[] {
    return this.nodes({ corpus: "project" }).filter((n) => isProven(n.truth));
  }

  toJSON(): { nodes: GraphNode[]; edges: GraphEdge[] } {
    return { nodes: [...this.nodesById.values()], edges: [...this.edgeList] };
  }
}
