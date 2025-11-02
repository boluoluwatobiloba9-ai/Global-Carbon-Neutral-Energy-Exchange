// EnergyToken.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { uintCV, stringAsciiCV } from "@stacks/transactions";

const ERR_NOT_AUTHORIZED = 100;
const ERR_INSUFFICIENT_BALANCE = 101;
const ERR_INVALID_AMOUNT = 102;
const ERR_PRODUCER_NOT_VERIFIED = 103;
const ERR_TOKEN_LOCKED = 104;
const ERR_INVALID_RECIPIENT = 105;
const ERR_MINT_LIMIT_EXCEEDED = 106;
const ERR_BURN_NOT_ALLOWED = 107;
const ERR_TRANSFER_FAILED = 108;
const ERR_INVALID_EXPIRY = 109;

interface TokenLock {
  owner: string;
  amount: number;
  expiry: number;
}

interface Result<T> {
  ok: boolean;
  value: T;
}

class EnergyTokenMock {
  state: {
    balances: Map<string, number>;
    totalSupply: number;
    totalSupplyCap: number;
    mintAuthority: string | null;
    verifiedProducers: Set<string>;
    producerMintHistory: Map<string, number>;
    tokenLocks: Map<number, TokenLock>;
    nextLockId: number;
    contractPrincipal: string;
  } = {
    balances: new Map(),
    totalSupply: 0,
    totalSupplyCap: 100000000000000,
    mintAuthority: null,
    verifiedProducers: new Set(),
    producerMintHistory: new Map(),
    tokenLocks: new Map(),
    nextLockId: 0,
    contractPrincipal: "ST_TOKEN_CONTRACT",
  };
  blockHeight: number = 100;
  caller: string = "ST1PRODUCER";

  constructor() {
    this.reset();
  }

  reset() {
    this.state = {
      balances: new Map(),
      totalSupply: 0,
      totalSupplyCap: 100000000000000,
      mintAuthority: null,
      verifiedProducers: new Set(),
      producerMintHistory: new Map(),
      tokenLocks: new Map(),
      nextLockId: 0,
      contractPrincipal: "ST_TOKEN_CONTRACT",
    };
    this.blockHeight = 100;
    this.caller = "ST1PRODUCER";
  }

  getBalance(account: string): number {
    return this.state.balances.get(account) || 0;
  }

  getTotalSupply(): number {
    return this.state.totalSupply;
  }

  setMintAuthority(authority: string): Result<boolean> {
    if (this.state.mintAuthority !== null) return { ok: false, value: false };
    if (authority === "SP000000000000000000002Q6VF78")
      return { ok: false, value: false };
    this.state.mintAuthority = authority;
    return { ok: true, value: true };
  }

  verifyProducer(producer: string): Result<boolean> {
    if (this.caller !== this.state.mintAuthority)
      return { ok: false, value: false };
    this.state.verifiedProducers.add(producer);
    return { ok: true, value: true };
  }

  revokeProducer(producer: string): Result<boolean> {
    if (this.caller !== this.state.mintAuthority)
      return { ok: false, value: false };
    this.state.verifiedProducers.delete(producer);
    return { ok: true, value: true };
  }

  mint(amount: number, recipient: string): Result<boolean> {
    if (!this.state.mintAuthority) return { ok: false, value: false };
    if (!this.state.verifiedProducers.has(this.caller))
      return { ok: false, value: false };
    if (amount <= 0) return { ok: false, value: false };
    if (this.state.totalSupply + amount > this.state.totalSupplyCap)
      return { ok: false, value: false };
    const current = this.state.balances.get(recipient) || 0;
    this.state.balances.set(recipient, current + amount);
    this.state.totalSupply += amount;
    const minted =
      (this.state.producerMintHistory.get(this.caller) || 0) + amount;
    this.state.producerMintHistory.set(this.caller, minted);
    return { ok: true, value: true };
  }

  burn(amount: number): Result<boolean> {
    if (amount <= 0) return { ok: false, value: false };
    const balance = this.getBalance(this.caller);
    if (balance < amount) return { ok: false, value: false };
    this.state.balances.set(this.caller, balance - amount);
    this.state.totalSupply -= amount;
    return { ok: true, value: true };
  }

  transfer(amount: number, sender: string, recipient: string): Result<boolean> {
    if (this.caller !== sender) return { ok: false, value: false };
    if (amount <= 0) return { ok: false, value: false };
    if (sender === recipient) return { ok: false, value: false };
    const senderBal = this.getBalance(sender);
    const recipientBal = this.getBalance(recipient);
    if (senderBal < amount) return { ok: false, value: false };
    this.state.balances.set(sender, senderBal - amount);
    this.state.balances.set(recipient, recipientBal + amount);
    return { ok: true, value: true };
  }

  lockTokens(amount: number, expiry: number): Result<number> {
    if (amount <= 0) return { ok: false, value: false };
    if (expiry <= this.blockHeight) return { ok: false, value: false };
    const balance = this.getBalance(this.caller);
    if (balance < amount) return { ok: false, value: false };
    this.state.balances.set(this.caller, balance - amount);
    this.state.balances.set(
      this.state.contractPrincipal,
      (this.state.balances.get(this.state.contractPrincipal) || 0) + amount
    );
    const lockId = this.state.nextLockId;
    this.state.tokenLocks.set(lockId, { owner: this.caller, amount, expiry });
    this.state.nextLockId++;
    return { ok: true, value: lockId };
  }

  unlockTokens(lockId: number): Result<boolean> {
    const lock = this.state.tokenLocks.get(lockId);
    if (!lock) return { ok: false, value: false };
    if (lock.owner !== this.caller) return { ok: false, value: false };
    if (this.blockHeight < lock.expiry) return { ok: false, value: false };
    const contractBal =
      this.state.balances.get(this.state.contractPrincipal) || 0;
    this.state.balances.set(
      this.state.contractPrincipal,
      contractBal - lock.amount
    );
    const ownerBal = this.getBalance(lock.owner);
    this.state.balances.set(lock.owner, ownerBal + lock.amount);
    this.state.tokenLocks.delete(lockId);
    return { ok: true, value: true };
  }

  getLockedBalance(owner: string): number {
    let locked = 0;
    for (const [id, lock] of this.state.tokenLocks) {
      if (lock.owner === owner && this.blockHeight < lock.expiry) {
        locked += lock.amount;
      }
    }
    return locked;
  }
}

describe("EnergyToken", () => {
  let token: EnergyTokenMock;

  beforeEach(() => {
    token = new EnergyTokenMock();
    token.reset();
  });

  it("mints tokens successfully", () => {
    token.setMintAuthority("ST_AUTHORITY");
    token.caller = "ST_AUTHORITY";
    token.verifyProducer("ST1PRODUCER");
    token.caller = "ST1PRODUCER";
    const result = token.mint(1000, "ST_RECIPIENT");
    expect(result.ok).toBe(true);
    expect(token.getBalance("ST_RECIPIENT")).toBe(1000);
    expect(token.getTotalSupply()).toBe(1000);
  });

  it("rejects mint by unverified producer", () => {
    token.setMintAuthority("ST_AUTHORITY");
    token.caller = "ST1PRODUCER";
    const result = token.mint(1000, "ST_RECIPIENT");
    expect(result.ok).toBe(false);
  });

  it("enforces supply cap", () => {
    token.setMintAuthority("ST_AUTHORITY");
    token.caller = "ST_AUTHORITY";
    token.verifyProducer("ST1PRODUCER");
    token.state.totalSupplyCap = 1000;
    token.caller = "ST1PRODUCER";
    token.mint(1000, "ST_RECIPIENT");
    const result = token.mint(1, "ST_RECIPIENT");
    expect(result.ok).toBe(false);
  });

  it("burns tokens successfully", () => {
    token.setMintAuthority("ST_AUTHORITY");
    token.caller = "ST_AUTHORITY";
    token.verifyProducer("ST1PRODUCER");
    token.caller = "ST1PRODUCER";
    token.mint(1000, "ST1PRODUCER");
    const result = token.burn(500);
    expect(result.ok).toBe(true);
    expect(token.getBalance("ST1PRODUCER")).toBe(500);
    expect(token.getTotalSupply()).toBe(500);
  });

  it("transfers tokens successfully", () => {
    token.setMintAuthority("ST_AUTHORITY");
    token.caller = "ST_AUTHORITY";
    token.verifyProducer("ST1PRODUCER");
    token.caller = "ST1PRODUCER";
    token.mint(1000, "ST1PRODUCER");
    const result = token.transfer(300, "ST1PRODUCER", "ST2BUYER");
    expect(result.ok).toBe(true);
    expect(token.getBalance("ST2BUYER")).toBe(300);
    expect(token.getBalance("ST1PRODUCER")).toBe(700);
  });

  it("locks and unlocks tokens", () => {
    token.setMintAuthority("ST_AUTHORITY");
    token.caller = "ST_AUTHORITY";
    token.verifyProducer("ST1PRODUCER");
    token.caller = "ST1PRODUCER";
    token.mint(1000, "ST1PRODUCER");
    const lockResult = token.lockTokens(400, 150);
    expect(lockResult.ok).toBe(true);
    expect(lockResult.value).toBe(0);
    expect(token.getBalance("ST1PRODUCER")).toBe(600);
    token.blockHeight = 160;
    const unlockResult = token.unlockTokens(0);
    expect(unlockResult.ok).toBe(true);
    expect(token.getBalance("ST1PRODUCER")).toBe(1000);
  });

  it("prevents unlock before expiry", () => {
    token.setMintAuthority("ST_AUTHORITY");
    token.caller = "ST_AUTHORITY";
    token.verifyProducer("ST1PRODUCER");
    token.caller = "ST1PRODUCER";
    token.mint(1000, "ST1PRODUCER");
    token.lockTokens(400, 200);
    token.blockHeight = 150;
    const result = token.unlockTokens(0);
    expect(result.ok).toBe(false);
  });

  it("calculates locked balance correctly", () => {
    token.setMintAuthority("ST_AUTHORITY");
    token.caller = "ST_AUTHORITY";
    token.verifyProducer("ST1PRODUCER");
    token.caller = "ST1PRODUCER";
    token.mint(1000, "ST1PRODUCER");
    token.lockTokens(300, 200);
    token.lockTokens(200, 150);
    token.blockHeight = 160;
    expect(token.getLockedBalance("ST1PRODUCER")).toBe(300);
  });
});
