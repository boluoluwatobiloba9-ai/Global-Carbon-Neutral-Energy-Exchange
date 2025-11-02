import { describe, it, expect, beforeEach } from "vitest";
import { stringUtf8CV, uintCV } from "@stacks/transactions";

const ERR_NOT_AUTHORIZED = 100;
const ERR_INVALID_AMOUNT = 101;
const ERR_INVALID_PRICE = 102;
const ERR_INVALID_ENERGY_TYPE = 103;
const ERR_INVALID_LOCATION = 104;
const ERR_INVALID_EXPIRY = 105;
const ERR_OFFER_ALREADY_EXISTS = 106;
const ERR_OFFER_NOT_FOUND = 107;
const ERR_BID_ALREADY_EXISTS = 108;
const ERR_BID_NOT_FOUND = 109;
const ERR_INVALID_MATCH = 110;
const ERR_TRADE_FAILED = 111;
const ERR_CANCEL_NOT_ALLOWED = 112;
const ERR_INVALID_STATUS = 113;
const ERR_INSUFFICIENT_BALANCE = 114;
const ERR_ESCROW_FAIL = 115;
const ERR_AUDIT_FAIL = 116;
const ERR_INVALID_MIN_PRICE = 117;
const ERR_INVALID_MAX_PRICE = 118;
const ERR_INVALID_PREFERRED_TYPE = 119;
const ERR_INVALID_PREFERRED_LOCATION = 120;
const ERR_MAX_OFFERS_EXCEEDED = 121;
const ERR_MAX_BIDS_EXCEEDED = 122;
const ERR_INVALID_TIMESTAMP = 123;
const ERR_AUTHORITY_NOT_VERIFIED = 124;
const ERR_INVALID_CURRENCY = 125;

interface Offer {
  producer: string;
  amount: number;
  price: number;
  energyType: string;
  location: string;
  expiry: number;
  status: boolean;
  currency: string;
}

interface Bid {
  buyer: string;
  amount: number;
  maxPrice: number;
  preferredType: string;
  preferredLocation: string;
  expiry: number;
  status: boolean;
  currency: string;
}

interface Result<T> {
  ok: boolean;
  value: T;
}

class MarketplaceMock {
  state: {
    nextOfferId: number;
    nextBidId: number;
    maxOffers: number;
    maxBids: number;
    marketplaceFee: number;
    authorityContract: string | null;
    offers: Map<number, Offer>;
    bids: Map<number, Bid>;
    offerMatches: Map<number, number>;
    bidMatches: Map<number, number>;
  } = {
    nextOfferId: 0,
    nextBidId: 0,
    maxOffers: 10000,
    maxBids: 10000,
    marketplaceFee: 500,
    authorityContract: null,
    offers: new Map(),
    bids: new Map(),
    offerMatches: new Map(),
    bidMatches: new Map(),
  };
  blockHeight: number = 0;
  caller: string = "ST1TEST";
  authorities: Set<string> = new Set(["ST1TEST"]);
  stxTransfers: Array<{ amount: number; from: string; to: string | null }> = [];

  constructor() {
    this.reset();
  }

  reset() {
    this.state = {
      nextOfferId: 0,
      nextBidId: 0,
      maxOffers: 10000,
      maxBids: 10000,
      marketplaceFee: 500,
      authorityContract: null,
      offers: new Map(),
      bids: new Map(),
      offerMatches: new Map(),
      bidMatches: new Map(),
    };
    this.blockHeight = 0;
    this.caller = "ST1TEST";
    this.authorities = new Set(["ST1TEST"]);
    this.stxTransfers = [];
  }

  isVerifiedAuthority(principal: string): Result<boolean> {
    return { ok: true, value: this.authorities.has(principal) };
  }

  setAuthorityContract(contractPrincipal: string): Result<boolean> {
    if (contractPrincipal === "SP000000000000000000002Q6VF78") {
      return { ok: false, value: false };
    }
    if (this.state.authorityContract !== null) {
      return { ok: false, value: false };
    }
    this.state.authorityContract = contractPrincipal;
    return { ok: true, value: true };
  }

  setMaxOffers(newMax: number): Result<boolean> {
    if (!this.state.authorityContract) return { ok: false, value: false };
    if (newMax <= 0) return { ok: false, value: false };
    this.state.maxOffers = newMax;
    return { ok: true, value: true };
  }

  setMaxBids(newMax: number): Result<boolean> {
    if (!this.state.authorityContract) return { ok: false, value: false };
    if (newMax <= 0) return { ok: false, value: false };
    this.state.maxBids = newMax;
    return { ok: true, value: true };
  }

  setMarketplaceFee(newFee: number): Result<boolean> {
    if (!this.state.authorityContract) return { ok: false, value: false };
    if (newFee < 0) return { ok: false, value: false };
    this.state.marketplaceFee = newFee;
    return { ok: true, value: true };
  }

  listOffer(
    amount: number,
    price: number,
    energyType: string,
    location: string,
    expiry: number,
    currency: string
  ): Result<number> {
    if (this.state.nextOfferId >= this.state.maxOffers) return { ok: false, value: ERR_MAX_OFFERS_EXCEEDED };
    if (amount <= 0) return { ok: false, value: ERR_INVALID_AMOUNT };
    if (price <= 0) return { ok: false, value: ERR_INVALID_PRICE };
    if (!["solar", "wind", "hydro", "geothermal"].includes(energyType)) return { ok: false, value: ERR_INVALID_ENERGY_TYPE };
    if (!location || location.length > 100) return { ok: false, value: ERR_INVALID_LOCATION };
    if (expiry <= this.blockHeight) return { ok: false, value: ERR_INVALID_EXPIRY };
    if (!["STX", "USD", "BTC"].includes(currency)) return { ok: false, value: ERR_INVALID_CURRENCY };
    if (!this.state.authorityContract) return { ok: false, value: ERR_AUTHORITY_NOT_VERIFIED };
    const id = this.state.nextOfferId;
    const offer: Offer = {
      producer: this.caller,
      amount,
      price,
      energyType,
      location,
      expiry,
      status: true,
      currency,
    };
    this.state.offers.set(id, offer);
    this.state.nextOfferId++;
    return { ok: true, value: id };
  }

  createBid(
    amount: number,
    maxPrice: number,
    preferredType: string,
    preferredLocation: string,
    expiry: number,
    currency: string
  ): Result<number> {
    if (this.state.nextBidId >= this.state.maxBids) return { ok: false, value: ERR_MAX_BIDS_EXCEEDED };
    if (amount <= 0) return { ok: false, value: ERR_INVALID_AMOUNT };
    if (maxPrice <= 0) return { ok: false, value: ERR_INVALID_MAX_PRICE };
    if (!["solar", "wind", "hydro", "geothermal", "any"].includes(preferredType)) return { ok: false, value: ERR_INVALID_PREFERRED_TYPE };
    if (preferredLocation !== "any" && (!preferredLocation || preferredLocation.length > 100)) return { ok: false, value: ERR_INVALID_PREFERRED_LOCATION };
    if (expiry <= this.blockHeight) return { ok: false, value: ERR_INVALID_EXPIRY };
    if (!["STX", "USD", "BTC"].includes(currency)) return { ok: false, value: ERR_INVALID_CURRENCY };
    if (!this.state.authorityContract) return { ok: false, value: ERR_AUTHORITY_NOT_VERIFIED };
    const id = this.state.nextBidId;
    const bid: Bid = {
      buyer: this.caller,
      amount,
      maxPrice,
      preferredType,
      preferredLocation,
      expiry,
      status: true,
      currency,
    };
    this.state.bids.set(id, bid);
    this.state.nextBidId++;
    return { ok: true, value: id };
  }

  matchOrder(offerId: number, bidId: number): Result<boolean> {
    const offer = this.state.offers.get(offerId);
    const bid = this.state.bids.get(bidId);
    if (!offer) return { ok: false, value: false };
    if (!bid) return { ok: false, value: false };
    if (!offer.status || !bid.status) return { ok: false, value: false };
    if (offer.amount < bid.amount) return { ok: false, value: false };
    if (offer.price > bid.maxPrice) return { ok: false, value: false };
    if (bid.preferredType !== "any" && offer.energyType !== bid.preferredType) return { ok: false, value: false };
    if (bid.preferredLocation !== "any" && offer.location !== bid.preferredLocation) return { ok: false, value: false };
    if (offer.currency !== bid.currency) return { ok: false, value: false };
    if (offer.expiry <= this.blockHeight || bid.expiry <= this.blockHeight) return { ok: false, value: false };
    if (this.state.offerMatches.has(offerId) || this.state.bidMatches.has(bidId)) return { ok: false, value: false };
    this.state.offerMatches.set(offerId, bidId);
    this.state.bidMatches.set(bidId, offerId);
    return { ok: true, value: true };
  }

  executeTrade(offerId: number, bidId: number): Result<boolean> {
    const offer = this.state.offers.get(offerId);
    const bid = this.state.bids.get(bidId);
    if (!offer || !bid) return { ok: false, value: false };
    if (!this.state.offerMatches.has(offerId) || this.state.offerMatches.get(offerId) !== bidId) return { ok: false, value: false };
    if (!offer.status || !bid.status) return { ok: false, value: false };
    if (offer.amount < bid.amount) return { ok: false, value: false };
    if (offer.price > bid.maxPrice) return { ok: false, value: false };
    if (bid.preferredType !== "any" && offer.energyType !== bid.preferredType) return { ok: false, value: false };
    if (bid.preferredLocation !== "any" && offer.location !== bid.preferredLocation) return { ok: false, value: false };
    if (offer.currency !== bid.currency) return { ok: false, value: false };
    if (offer.expiry <= this.blockHeight || bid.expiry <= this.blockHeight) return { ok: false, value: false };
    this.state.offers.set(offerId, { ...offer, status: false });
    this.state.bids.set(bidId, { ...bid, status: false });
    this.state.offerMatches.delete(offerId);
    this.state.bidMatches.delete(bidId);
    return { ok: true, value: true };
  }

  cancelOffer(offerId: number): Result<boolean> {
    const offer = this.state.offers.get(offerId);
    if (!offer) return { ok: false, value: false };
    if (offer.producer !== this.caller) return { ok: false, value: false };
    if (!offer.status) return { ok: false, value: false };
    if (this.state.offerMatches.has(offerId)) return { ok: false, value: false };
    this.state.offers.set(offerId, { ...offer, status: false });
    return { ok: true, value: true };
  }

  cancelBid(bidId: number): Result<boolean> {
    const bid = this.state.bids.get(bidId);
    if (!bid) return { ok: false, value: false };
    if (bid.buyer !== this.caller) return { ok: false, value: false };
    if (!bid.status) return { ok: false, value: false };
    if (this.state.bidMatches.has(bidId)) return { ok: false, value: false };
    this.state.bids.set(bidId, { ...bid, status: false });
    return { ok: true, value: true };
  }

  getOffer(offerId: number): Offer | null {
    return this.state.offers.get(offerId) || null;
  }

  getBid(bidId: number): Bid | null {
    return this.state.bids.get(bidId) || null;
  }
}

describe("Marketplace", () => {
  let contract: MarketplaceMock;

  beforeEach(() => {
    contract = new MarketplaceMock();
    contract.reset();
  });

  it("lists an offer successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.listOffer(100, 50, "solar", "LocationA", 100, "STX");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(0);
    const offer = contract.getOffer(0);
    expect(offer?.amount).toBe(100);
    expect(offer?.price).toBe(50);
    expect(offer?.energyType).toBe("solar");
    expect(offer?.location).toBe("LocationA");
    expect(offer?.expiry).toBe(100);
    expect(offer?.currency).toBe("STX");
    expect(offer?.status).toBe(true);
  });

  it("rejects offer without authority", () => {
    const result = contract.listOffer(100, 50, "solar", "LocationA", 100, "STX");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_AUTHORITY_NOT_VERIFIED);
  });

  it("rejects invalid energy type", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.listOffer(100, 50, "invalid", "LocationA", 100, "STX");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_ENERGY_TYPE);
  });

  it("creates a bid successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.createBid(50, 60, "solar", "LocationA", 100, "STX");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(0);
    const bid = contract.getBid(0);
    expect(bid?.amount).toBe(50);
    expect(bid?.maxPrice).toBe(60);
    expect(bid?.preferredType).toBe("solar");
    expect(bid?.preferredLocation).toBe("LocationA");
    expect(bid?.expiry).toBe(100);
    expect(bid?.currency).toBe("STX");
    expect(bid?.status).toBe(true);
  });

  it("rejects bid with invalid preferred type", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.createBid(50, 60, "invalid", "any", 100, "STX");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_PREFERRED_TYPE);
  });

  it("matches order successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.listOffer(100, 50, "solar", "LocationA", 100, "STX");
    contract.createBid(50, 60, "solar", "LocationA", 100, "STX");
    const result = contract.matchOrder(0, 0);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
  });

  it("rejects match with price mismatch", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.listOffer(100, 70, "solar", "LocationA", 100, "STX");
    contract.createBid(50, 60, "solar", "LocationA", 100, "STX");
    const result = contract.matchOrder(0, 0);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("executes trade successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.listOffer(100, 50, "solar", "LocationA", 100, "STX");
    contract.createBid(50, 60, "solar", "LocationA", 100, "STX");
    contract.matchOrder(0, 0);
    const result = contract.executeTrade(0, 0);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const offer = contract.getOffer(0);
    const bid = contract.getBid(0);
    expect(offer?.status).toBe(false);
    expect(bid?.status).toBe(false);
  });

  it("rejects execute without match", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.listOffer(100, 50, "solar", "LocationA", 100, "STX");
    contract.createBid(50, 60, "solar", "LocationA", 100, "STX");
    const result = contract.executeTrade(0, 0);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("cancels offer successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.listOffer(100, 50, "solar", "LocationA", 100, "STX");
    const result = contract.cancelOffer(0);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const offer = contract.getOffer(0);
    expect(offer?.status).toBe(false);
  });

  it("rejects cancel by non-producer", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.listOffer(100, 50, "solar", "LocationA", 100, "STX");
    contract.caller = "ST3FAKE";
    const result = contract.cancelOffer(0);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("cancels bid successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.createBid(50, 60, "solar", "LocationA", 100, "STX");
    const result = contract.cancelBid(0);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const bid = contract.getBid(0);
    expect(bid?.status).toBe(false);
  });

  it("rejects cancel after match", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.listOffer(100, 50, "solar", "LocationA", 100, "STX");
    contract.createBid(50, 60, "solar", "LocationA", 100, "STX");
    contract.matchOrder(0, 0);
    const result = contract.cancelOffer(0);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("sets marketplace fee successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.setMarketplaceFee(1000);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.marketplaceFee).toBe(1000);
  });

  it("rejects fee change without authority", () => {
    const result = contract.setMarketplaceFee(1000);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("rejects offer with max exceeded", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.state.maxOffers = 1;
    contract.listOffer(100, 50, "solar", "LocationA", 100, "STX");
    const result = contract.listOffer(200, 60, "wind", "LocationB", 200, "USD");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_MAX_OFFERS_EXCEEDED);
  });
});