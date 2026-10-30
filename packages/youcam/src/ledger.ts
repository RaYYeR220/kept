// Unit budget. Units are reserved before a task starts, committed only when the task
// succeeds (YouCam charges nothing for failed tasks) and released otherwise.
//
// Spend keys look like "<ip>|<session>": the session cap applies to the whole key and the
// IP cap to everything sharing the IP, so rotating a cookie doesn't buy a fresh budget.
// State is per server instance; the account's real credit floor is the final backstop.

export class BudgetError extends Error {
  constructor(readonly reason: "session_cap" | "ip_cap" | "global_cap" | "credit_low") {
    super(
      reason === "credit_low"
        ? "The demo has run out of YouCam units for now."
        : reason === "session_cap" || reason === "ip_cap"
          ? "This session has used its share of live measurements."
          : "This deployment has used its live-measurement budget.",
    );
    this.name = "BudgetError";
  }
}

export type Reservation = { id: number; key: string; ip: string | null; units: number };

export type LedgerOptions = {
  globalCap: number;
  sessionCap: number;
  /** Cap for all keys that share an IP. Defaults to three sessions' worth. */
  ipCap?: number;
  /** Reads the account's remaining units; called before every reservation when set. */
  readCredit?: () => Promise<number>;
};

const ipOf = (key: string) => (key.includes("|") ? key.slice(0, key.indexOf("|")) : null);

export class Ledger {
  private spent = 0;
  private held = 0;
  private byKey = new Map<string, number>();
  private byIp = new Map<string, number>();
  private open = new Map<number, Reservation>();
  private nextId = 1;

  constructor(private readonly opts: LedgerOptions) {}

  async reserve(units: number, key: string): Promise<Reservation> {
    // The only await happens before any check, so checks and increments below run as one
    // synchronous step and parallel reservations can't all pass on a stale count.
    const credit = this.opts.readCredit ? await this.opts.readCredit() : Infinity;
    const ip = ipOf(key);
    if ((this.byKey.get(key) ?? 0) + units > this.opts.sessionCap) throw new BudgetError("session_cap");
    if (ip && (this.byIp.get(ip) ?? 0) + units > (this.opts.ipCap ?? this.opts.sessionCap * 3)) throw new BudgetError("ip_cap");
    if (this.spent + this.held + units > this.opts.globalCap) throw new BudgetError("global_cap");
    if (credit - this.held < units) throw new BudgetError("credit_low");
    const r = { id: this.nextId++, key, ip, units };
    this.open.set(r.id, r);
    this.held += units;
    this.bump(r, units);
    return r;
  }

  commit(r: Reservation, actualUnits = r.units): void {
    if (!this.open.delete(r.id)) return;
    this.held -= r.units;
    this.spent += actualUnits;
    this.bump(r, actualUnits - r.units);
  }

  release(r: Reservation): void {
    if (!this.open.delete(r.id)) return;
    this.held -= r.units;
    this.bump(r, -r.units);
  }

  private bump(r: Reservation, delta: number) {
    this.byKey.set(r.key, Math.max(0, (this.byKey.get(r.key) ?? 0) + delta));
    if (r.ip) this.byIp.set(r.ip, Math.max(0, (this.byIp.get(r.ip) ?? 0) + delta));
  }

  snapshot() {
    return { spent: this.spent, held: this.held, globalCap: this.opts.globalCap, sessionCap: this.opts.sessionCap };
  }

  sessionSpent(key: string): number {
    return this.byKey.get(key) ?? 0;
  }
}
