// plan §34 — React Button für Safe Repair.

interface RepairButtonProps {
  findingId: string;
  onRepair?: (findingId: string) => void;
}

export function RepairButton({ findingId, onRepair }: RepairButtonProps) {
  return (
    <button
      onClick={() => onRepair?.(findingId)}
      className="repair-button"
      disabled
    >
      Repair
    </button>
  );
}
