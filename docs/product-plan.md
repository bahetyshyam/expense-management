# Expense Portal Product Plan

## Vision

Expense Portal is a personal finance ledger for understanding money movement across checking accounts and credit cards. The first goal is not advanced reconciliation. The first goal is trust: uploaded statements should recreate account ledgers and balances closely enough that they can be compared against real bank and card accounts.

## Phase 1: Ledger First

Phase 1 focuses on QFX/OFX imports, account discovery, deduplication, statement balances, and a dashboard that makes the raw ledger inspectable.

Success criteria:

- Uploading a QFX/OFX file auto-detects the account from statement metadata.
- If the account is known, transactions are attached to the existing account.
- If the account is new, the app creates it automatically with editable display metadata.
- Uploading the same file multiple times does not duplicate transactions.
- Each upload stores the statement ledger and available balances when present.
- The dashboard shows account-level balances, debits, credits, net movement, and raw transactions.
- Checking accounts and credit cards are visually separated.
- Splitwise-adjusted totals are hidden until the raw ledger is trustworthy.

## Data Sources

QFX/OFX is the only Phase 1 import format. It is preferred because it usually includes stable transaction IDs, account identity, signed transaction amounts, statement dates, and balance fields.

CSV is deferred because it is not standardized across banks and often lacks reliable deduplication fields or statement balances. Plaid or FDX-style APIs may be useful later, but they introduce cost, permissions, and operational complexity that conflict with the free-first goal.

## Account Identity

Accounts should not be matched by last four alone. The upload pipeline should create a non-reversible fingerprint from the imported QFX account identity, institution metadata, and account type. Last four remains useful for display and fallback, but it is not strong enough as the primary identity key.

User-editable account metadata should include display name, active/hidden status, and notes. Imported identity fields should remain immutable through the UI.

## Later Phases

Phase 2 adds categorization after ledger correctness is proven. It should start with deterministic rules and then use OpenAI for suggestions and review workflows.

Phase 3 reintroduces Splitwise. It should adjust fronted card charges into true personal spend only after raw account ledgers and categories are reliable.
