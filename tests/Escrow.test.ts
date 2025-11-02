// Escrow.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { uintCV, stringUtf8CV } from "@stacks/transactions";

const ERR_NOT_AUTHORIZED = 100;
const ERR_INVALID_AMOUNT = 101;
const ERR_INVALID_STATE = 102;
const ERR_ESCROW_NOT_FOUND = 103;
const ERR_ESCROW_EXPIRED = 104;
const ERR_ESCROW_NOT_EXPIRED = 105;
const ERR_INSUFFICIENT_BALANCE = 106;
const ERR_TOKEN_TRANSFER_FAILED = 107;
const ERR_STX_TRANSFER_FAILED = 108;
const ERR_INVALID_CURRENCY = 109;
const ERR_DISPUTE_NOT_ALLOWED = 110;
const ERR_ALREADY_RESOLVED = 111;
const ERR_INVALID_PARTY = 112;
const ERR_ESCROW_CANCELLED = 113;

interface Escrow {
  offerId: number;
  bidId: number;
  producer: string;
  buyer: string;
  amount: number;
  price: number;
  currency: string;
  status: string;
  createdAt: number;
  expiresAt: number;
  tokenLockId: number | null;
}

interface Result<T> {
  ok: boolean;
  value: T;
}

class EscrowMock {
  state: {
    nextEscrowId: number;
    disputeAuthority: string | null;
    escrows: Map<number, Escrow>;
    escrowBalances: Map<number, number>;
    stxTransfers: Array<{ amount: number; from: string; to: string }>;
    contractPrincipal: string;
  } = {
    nextEscrowId: 0,
    disputeAuthority: null,
    escrows: new Map(),
    escrowBalances: new Map(),
    stxTransfers: [],
    contractPrincipal: "ST_ESCROW_CONTRACT",
  };
  blockHeight: number = 100;
  caller: string = "ST1BUYER";

  constructor() {
    this.reset();
  }

  reset() {
    this.state = {
      nextEscrowId: 0,
      disputeAuthority: null,
      escrows: new Map(),
      escrowBalances: new Map(),
      stxTransfers: [],
      contractPrincipal: "ST_ESCROW_CONTRACT",
    };
    this.blockHeight = 100;
    this.caller = "ST1BUYER";
  }

  setDisputeAuthority(authority: string): Result<boolean> {
    if (this.state.disputeAuthority !== null)
      return { ok: false, value: false };
    if (authority === "SP000000000000000000002Q6VF78")
      return { ok: false, value: false };
    this.state.disputeAuthority = authority;
    return { ok: true, value: true };
  }

  initiateEscrow(
    offerId: number,
    bidId: number,
    amount: number,
    price: number,
    currency: string,
    expiresIn: number,
    tokenLockId: number | null
  ): Result<number> {
    if (amount <= 0 || price <= 0 || expiresIn <= 0)
      return { ok: false, value: false };
    if (!["STX", "USD", "BTC"].includes(currency))
      return { ok: false, value: false };
    const total = amount * price;
    const escrowId = this.state.nextEscrowId;
    const escrow: Escrow = {
      offerId,
      bidId,
      producer: "ST1PRODUCER",
      buyer: this.caller,
      amount,
      price,
      currency,
      status: "active",
      createdAt: this.blockHeight,
      expiresAt: this.blockHeight + expiresIn,
      tokenLockId,
    };
    this.state.escrows.set(escrowId, escrow);
    this.state.escrowBalances.set(escrowId, total);
    if (currency === "STX") {
      this.state.stxTransfers.push({
        amount: total,
        from: this.caller,
        to: this.state.contractPrincipal,
      });
    }
    this.state.nextEscrowId++;
    return { ok: true, value: escrowId };
  }

  releaseEscrow(escrowId: number): Result<boolean> {
    const escrow = this.state.escrows.get(escrowId);
    if (!escrow) return { ok: false, value: false };
    if (escrow.status !== "active") return { ok: false, value: false };
    if (this.blockHeight > escrow.expiresAt) return { ok: false, value: false };
    if (this.caller !== escrow.producer && this.caller !== escrow.buyer)
      return { ok: false, value: false };
    const total = this.state.escrowBalances.get(escrowId);
    if (total === undefined) return { ok: false, value: false };
    this.state.escrows.set(escrowId, { ...escrow, status: "released" });
    this.state.escrowBalances.delete(escrowId);
    if (escrow.currency === "STX") {
      this.state.stxTransfers.push({
        amount: total,
        from: this.state.contractPrincipal,
        to: escrow.producer,
      });
    }
    return { ok: true, value: true };
  }

  refundEscrow(escrowId: number): Result<boolean> {
    const escrow = this.state.escrows.get(escrowId);
    if (!escrow) return { ok: false, value: false };
    if (escrow.status !== "active") return { ok: false, value: false };
    if (this.blockHeight <= escrow.expiresAt)
      return { ok: false, value: false };
    if (this.caller !== escrow.buyer) return { ok: false, value: false };
    const total = this.state.escrowBalances.get(escrowId);
    if (total === undefined) return { ok: false, value: false };
    this.state.escrows.set(escrowId, { ...escrow, status: "refunded" });
    this.state.escrowBalances.delete(escrowId);
    this.state.stxTransfers.push({
      amount: total,
      from: this.state.contractPrincipal,
      to: escrow.buyer,
    });
    return { ok: true, value: true };
  }

  raiseDispute(escrowId: number): Result<boolean> {
    const escrow = this.state.escrows.get(escrowId);
    if (!escrow) return { ok: false, value: false };
    if (escrow.status !== "active") return { ok: false, value: false };
    if (!this.state.disputeAuthority) return { ok: false, value: false };
    if (this.caller !== escrow.producer && this.caller !== escrow.buyer)
      return { ok: false, value: false };
    this.state.escrows.set(escrowId, { ...escrow, status: "disputed" });
    return { ok: true, value: true };
  }

  resolveDispute(
    escrowId: number,
    releaseToProducer: boolean
  ): Result<boolean> {
    const escrow = this.state.escrows.get(escrowId);
    if (!escrow) return { ok: false, value: false };
    if (escrow.status !== "disputed") return { ok: false, value: false };
    if (this.caller !== this.state.disputeAuthority)
      return { ok: false, value: false };
    const total = this.state.escrowBalances.get(escrowId);
    if (total === undefined) return { ok: false, value: false };
    const recipient = releaseToProducer ? escrow.producer : escrow.buyer;
    this.state.escrows.set(escrowId, {
      ...escrow,
      status: releaseToProducer ? "released" : "refunded",
    });
    this.state.escrowBalances.delete(escrowId);
    if (escrow.currency === "STX") {
      this.state.stxTransfers.push({
        amount: total,
        from: this.state.contractPrincipal,
        to: recipient,
      });
    }
    return { ok: true, value: true };
  }

  cancelEscrow(escrowId: number): Result<boolean> {
    const escrow = this.state.escrows.get(escrowId);
    if (!escrow) return { ok: false, value: false };
    if (escrow.status !== "active") return { ok: false, value: false };
    if (this.blockHeight <= escrow.expiresAt)
      return { ok: false, value: false };
    if (this.caller !== escrow.buyer) return { ok: false, value: false };
    const total = this.state.escrowBalances.get(escrowId);
    if (total === undefined) return { ok: false, value: false };
    this.state.escrows.set(escrowId, { ...escrow, status: "cancelled" });
    this.state.escrowBalances.delete(escrowId);
    this.state.stxTransfers.push({
      amount: total,
      from: this.state.contractPrincipal,
      to: escrow.buyer,
    });
    return { ok: true, value: true };
  }

  getEscrow(escrowId: number): Escrow | null {
    return this.state.escrows.get(escrowId) || null;
  }

  getEscrowBalance(escrowId: number): number {
    return this.state.escrowBalances.get(escrowId) || 0;
  }
}

describe("Escrow", () => {
  let escrow: EscrowMock;

  beforeEach(() => {
    escrow = new EscrowMock();
    escrow.reset();
  });

  it("initiates escrow successfully", () => {
    const result = escrow.initiateEscrow(1, 1, 100, 50, "STX", 100, null);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(0);
    const e = escrow.getEscrow(0);
    expect(e?.amount).toBe(100);
    expect(e?.price).toBe(50);
    expect(e?.status).toBe("active");
    expect(escrow.getEscrowBalance(0)).toBe(5000);
  });

  it("releases escrow to producer", () => {
    escrow.initiateEscrow(1, 1, 100, 50, "STX", 100, null);
    escrow.caller = "ST1PRODUCER";
    const result = escrow.releaseEscrow(0);
    expect(result.ok).toBe(true);
    const e = escrow.getEscrow(0);
    expect(e?.status).toBe("released");
    expect(escrow.state.stxTransfers).toContainEqual({
      amount: 5000,
      from: "ST_ESCROW_CONTRACT",
      to: "ST1PRODUCER",
    });
  });

  it("refunds buyer after expiry", () => {
    escrow.initiateEscrow(1, 1, 100, 50, "STX", 10, null);
    escrow.blockHeight = 200;
    const result = escrow.refundEscrow(0);
    expect(result.ok).toBe(true);
    const e = escrow.getEscrow(0);
    expect(e?.status).toBe("refunded");
  });

  it("raises and resolves dispute", () => {
    escrow.setDisputeAuthority("ST_ARBITER");
    escrow.initiateEscrow(1, 1, 100, 50, "STX", 100, null);
    escrow.raiseDispute(0);
    escrow.caller = "ST_ARBITER";
    const result = escrow.resolveDispute(0, true);
    expect(result.ok).toBe(true);
    const e = escrow.getEscrow(0);
    expect(e?.status).toBe("released");
  });

  it("cancels escrow after expiry", () => {
    escrow.initiateEscrow(1, 1, 100, 50, "STX", 10, null);
    escrow.blockHeight = 200;
    const result = escrow.cancelEscrow(0);
    expect(result.ok).toBe(true);
    const e = escrow.getEscrow(0);
    expect(e?.status).toBe("cancelled");
  });
});
