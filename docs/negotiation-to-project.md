# From Negotiation to Project — Operating Procedure

## Roles
- QS: Creates quotes; can edit lines while status is DRAFT.
- SENIOR_QS: Reviews and approves; finalizes after negotiation.
- SALES: Moves to NEGOTIATION; endorses the deal; provides commencement & payment schedule.
- PROJECT_MANAGEMENT: Plans commencement; raises requisitions; dispatches materials.
- PROCUREMENT: Requests funding; purchases; records vendor/tax invoice/price/date.
- ACCOUNTS: Approves and releases funds; records all client receipts and installments.
- SECURITY: Supervises dispatch, signatures.
- HEADS (Accounts, PM, Senior QS, GM, MD): Receive escalations.

## Status flow
DRAFT ? (QS) ? SUBMITTED_REVIEW ? (SENIOR_QS) ? SENT_TO_SALES ? (SALES) ? NEGOTIATION ? (SENIOR_QS) ? FINALIZED ? (ADMIN) ? ARCHIVED

## Negotiation
- Client proposals mark changed lines as PENDING, unchanged as OK.
- Senior QS accepts/rejects per-line. When all are OK/ACCEPTED, quote becomes REVIEWED automatically.

## Endorsement (Sales)
- Sales enters: commencement date, deposit, monthly installment amount, due day.
- System creates/updates a linked **Project** in PLANNED.

## Pre-Commencement
- 7 days before `commenceOn`, system reminds PM & Procurement to prepare materials and deployment.

## Procurement & Funding
- PM raises a **Procurement Requisition**.
- Procurement requests funding ? Accounts approves/releases.
- Hourly reminders for SUBMITTED/FUNDING_REQUESTED; after 3 reminders, system escalates to Heads.

## Purchasing & Invoicing
- Procurement records **Purchase** (vendor, tax invoice, price, date). Invoices go to Accounts for filing.

## Dispatch
- PM creates **Dispatch**; Security manages dispatch and signatures.

## Accounts
- Receives deposit and monthly installments according to schedule.
- Monthly reminders/invoices can be scheduled similarly.

## Reliability
- All background work is done by a Cron-triggered API (`/api/cron/reminders`), designed to be idempotent and short.
- DB transactions are short and use `TX_OPTS` to avoid timeouts.
