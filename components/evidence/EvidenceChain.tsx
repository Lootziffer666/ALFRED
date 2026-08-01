// plan §33 — React-Komponente: Evidence-Kette visualisieren.

import type { EvidenceChain } from "../../lib/evidence/ref.js";

interface EvidenceChainProps {
  chain: EvidenceChain;
}

export function EvidenceChain({ chain }: EvidenceChainProps) {
  return (
    <div className="evidence-chain">
      <div className="evidence-root">
        <span className="kind">{chain.root.kind}</span>
        <span className="detail">{chain.root.detail}</span>
      </div>
      {chain.related.length > 0 && (
        <div className="related-evidence">
          {chain.related.map((ref) => (
            <div key={ref.id} className="evidence-item">
              <span className="kind">{ref.kind}</span>
              <span className="detail">{ref.detail}</span>
            </div>
          ))}
        </div>
      )}
      {chain.explanation && (
        <div className="explanation">
          <p>{chain.explanation}</p>
        </div>
      )}
    </div>
  );
}
