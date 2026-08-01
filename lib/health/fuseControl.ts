// plan §34b — Fuse Control: Kill-Switch pro Subsystem.

export interface FuseState {
  subsystem: string;
  blown: boolean;
  reason?: string;
  autoResetAt?: string;
}

export class FuseBox {
  private fuses: Map<string, FuseState> = new Map();

  blow(subsystem: string, reason: string): void {
    this.fuses.set(subsystem, {
      subsystem,
      blown: true,
      reason,
      autoResetAt: new Date(Date.now() + 60000).toISOString(),
    });
  }

  isBlown(subsystem: string): boolean {
    const fuse = this.fuses.get(subsystem);
    return fuse?.blown ?? false;
  }

  reset(subsystem: string): void {
    this.fuses.delete(subsystem);
  }

  getStatus(): FuseState[] {
    return Array.from(this.fuses.values());
  }
}
