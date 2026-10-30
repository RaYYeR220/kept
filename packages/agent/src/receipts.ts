export type GateId = "scope" | "lint" | "product" | "spend" | "budget" | "photo";

export type Receipt = {
  at: string;
  kind: "tool" | "gate";
  name: string;
  status: "ok" | "blocked" | "error";
  detail: string;
  units?: number;
};

export class ReceiptLog {
  readonly items: Receipt[] = [];
  constructor(private readonly now: () => string = () => new Date().toISOString()) {}

  tool(name: string, status: Receipt["status"], detail: string, units?: number) {
    this.items.push({ at: this.now(), kind: "tool", name, status, detail, ...(units === undefined ? {} : { units }) });
  }

  gate(gate: GateId, detail: string) {
    this.items.push({ at: this.now(), kind: "gate", name: gate, status: "blocked", detail });
  }
}
