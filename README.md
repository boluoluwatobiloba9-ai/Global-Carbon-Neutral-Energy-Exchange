# 🌍 Global Carbon-Neutral Energy Exchange

Welcome to a revolutionary platform for trading renewable energy credits on the blockchain! This Web3 project addresses the real-world problem of opaque energy markets and unverifiable carbon neutrality claims by creating a transparent, immutable exchange on the Stacks blockchain. Buyers (e.g., companies seeking carbon offsets) are matched with verified renewable energy producers, with all transactions and audits recorded immutably for trust and compliance.

## ✨ Features

🔋 Tokenize and trade renewable energy credits  
🌱 Verify producers' renewable sources via on-chain audits  
🤝 Automated matching of buyers and sellers based on preferences (e.g., location, energy type)  
📊 Immutable audit trails for regulatory compliance and transparency  
💰 Secure escrow for transactions to ensure delivery  
🏆 Incentive rewards for verified producers  
📈 Real-time dashboard data via on-chain queries  
🚫 Dispute resolution mechanism to handle conflicts  

## 🛠 How It Works

**For Renewable Energy Producers**  
- Register your profile and submit proof of renewable sources (e.g., via oracle-integrated audits).  
- Mint energy credits based on verified production data.  
- List your credits on the marketplace with details like energy type (solar, wind), location, and price.  
- Once matched, credits are transferred via escrow, and you receive payment in STX or stable tokens.  

**For Buyers**  
- Register and specify your needs (e.g., amount of credits, preferred sources).  
- Browse or get auto-matched with available offers.  
- Purchase credits securely; the system escrows funds until delivery is confirmed.  
- Access immutable audits to verify the carbon-neutral impact for reporting.  

**For Auditors/Verifiers**  
- Use oracle contracts to feed real-world data (e.g., energy production metrics).  
- Trigger on-chain audits to certify producers and transactions.  
- Query historical data for compliance checks.  

That's it! The blockchain ensures every step is tamper-proof, promoting a truly sustainable energy economy.

## 📜 Smart Contracts Overview

This project is built with Clarity on the Stacks blockchain and modularized into 8 smart contracts for scalability and security:  

1. **UserRegistry.clar**: Handles registration and profiles for buyers, sellers, and auditors. Includes functions for KYC-like verification.  
2. **ProducerVerification.clar**: Manages certification of renewable sources, storing proofs and revocation logic.  
3. **EnergyToken.clar**: Implements an SIP-10 fungible token for representing energy credits (e.g., 1 token = 1 MWh of renewable energy).  
4. **Marketplace.clar**: Core exchange logic for listing offers, matching buyers/sellers, and handling bids.  
5. **Escrow.clar**: Securely holds funds and tokens during transactions, releasing upon confirmation.  
6. **AuditTrail.clar**: Stores immutable logs of all audits, transactions, and verifications for querying.  
7. **OracleIntegration.clar**: Interfaces with external data feeds for real-world energy production validation (e.g., via trusted oracles).  
8. **Governance.clar**: Manages system parameters, dispute resolutions, and incentive distributions via DAO-like voting.  

These contracts interact seamlessly: for example, the Marketplace calls Escrow for trades and AuditTrail for logging, ensuring end-to-end transparency.