// Unit budget. Units are reserved before a task starts, committed only when the task
// succeeds (YouCam charges nothing for failed tasks) and released otherwise.

export class BudgetError extends Error {
  constructor(readonly reason: "session_cap" | "global_cap" | "credit_low") {
    super(
      reason === "credit_low"
        ? "The demo has run out of YouCam units for now."
        : reason === "session_cap"
          ? "This session has used its share of live measurements."
          : "This deployment has used its live-measurement budget.",
    );
    this.name = "BudgetError";
  }
}

export type Reservation = { id: number; sessionId: string; units: number };

export type LedgerOptions = {
  globalCap: number;
  sessionCap: number;
  /** Reads the account's remaining units; called before every reservation when set. */
  readCredit?: () => Promise<number>;
};

export class Ledger {
  private spent = 0;
  private held = 0;
  private bySession = new Map<string, number>();
  private open = new Map<number, Reservation>();
  private nextId = 1;

  constructor(private readonly opts: LedgerOptions) {}

  async reserve(units: number, sessionId: string): Promise<Reservation> {
    const session = this.bySession.get(sessionId) ?? 0;
    if (session + units > this.opts.sessionCap) throw new BudgetError("session_cap");
    if (this.spent + this.held + units > this.opts.globalCap) throw new BudgetError("global_cap");
    if (this.opts.readCredit) {
      const credit = await this.opts.readCredit();
      if (credit - this.held < units) throw new BudgetError("credit_low");
    }
    const r = { id: this.nextId++, sessionId, units };
    this.open.set(r.id, r);
    this.held += units;
    this.bySession.set(sessionId, session + units);
    return r;
  }

  commit(r: Reservation, actualUnits = r.units): void {
    if (!this.open.delete(r.id)) return;
    this.held -= r.units;
    this.spent += actualUnits;
    this.bySession.set(r.sessionId, (this.bySession.get(r.sessionId) ?? 0) - r.units + actualUnits);
  }

  release(r: Reservation): void {
    if (!this.open.delete(r.id)) return;
    this.held -= r.units;
    this.bySession.set(r.sessionId, (this.bySession.get(r.sessionId) ?? 0) - r.units);
  }

  snapshot() {
    return { spent: this.spent, held: this.held, globalCap: this.opts.globalCap, sessionCap: this.opts.sessionCap };
  }

  sessionSpent(sessionId: string): number {
    return this.bySession.get(sessionId) ?? 0;
  }
}
