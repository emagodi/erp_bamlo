# Ops Flow Overview

This document summarizes the core operational flows added across Sales, Project Management, Procurement, Accounts, and Dispatch/Security, including lightweight cron endpoints for reminders and SLA escalations.

## Sales Endorsement

- Inputs captured by Sales/Admin when endorsing a quote to a project:
  - Commencement date (`commenceOn`)
  - Deposit amount (`deposit`)
  - Expected monthly installment (`installment`)
  - Installment due day (`dueDay`, 1–28)
- Effects:
  - Creates or updates the `Project` linked to the `Quote`.
  - Normalizes amounts to minor units.
  - Sets `Project` status to `PLANNED` (if newly created).
  - Keeps `Quote` consistent (e.g., ensure status in sales pipeline).

## Project Manager (PM)

- Create Procurement Requisition
  - Action: `createProcurementRequisition(projectId, note?)`
  - Role: `PROJECT_MANAGER` or `ADMIN`
  - Creates a new requisition in `PENDING` status.
- Record Payments
  - Action: `recordPayment(projectId, { type, amount, date, ref? })`
  - Roles: Accounts roles (`ACCOUNTS`, `ACCOUNTING_CLERK`, `ACCOUNTING_OFFICER`, `ACCOUNTING_AUDITOR`) or `ADMIN`
  - Records a `DEPOSIT` or an `INSTALLMENT` payment on the project.

## Procurement

- Request Funding
  - Action: `requestFunding(requisitionId, amount)`
  - Roles: `PROCUREMENT`, `PROJECT_MANAGER`, or `ADMIN`
  - Creates a funding request associated with a requisition.
- Record Purchase
  - Action: `recordPurchase(requisitionId, { vendor, taxInvoiceNo, price, date })`
  - Roles: `PROCUREMENT` or `ADMIN`
  - Records a vendor purchase with tax invoice details and price.

## Accounts

- Approve/Reject Funding Requests
  - Action: `approveFunding(fundingId, approve)`
  - Roles: Accounts roles (`ACCOUNTS`, `ACCOUNTING_CLERK`, `ACCOUNTING_OFFICER`, `ACCOUNTING_AUDITOR`) or `ADMIN`
  - Updates status to `APPROVED` or `REJECTED`, and stamps reviewer and time.

## Dispatch & Security

- Create Dispatch (PM)
  - Action: `createDispatch(projectId, items[])`
  - Roles: `PROJECT_MANAGER` or `ADMIN`
  - Creates a dispatch with nested items, each including description, quantity, and optional unit.
- Security Approval
  - Action: `securityApprove(dispatchId, driverName)`
  - Roles: `SECURITY` or `ADMIN`
  - Moves dispatch to `OUT_FOR_DELIVERY`, stamps security officer and driver name.
- Mark Delivered
  - Action: `markDelivered(dispatchId, signedBy)`
  - Roles: `DRIVER`, `SECURITY`, or `ADMIN`
  - Updates status to `DELIVERED`, recording signature name and time.

## Cron Endpoints

- Daily (`/api/cron/daily`)
  - Scans projects that commence in ~7 days and logs reminders.
  - Response: `{ ok: true, count }` where `count` is the number of matched projects.
- Hourly (`/api/cron/hourly`)
  - Scans `PENDING` funding requests and increments project `alertsCount`.
  - On the 3rd alert (and beyond), logs an escalation notice.
  - Response: `{ ok: true, reminded }` where `reminded` is the count of pending requests processed.

## QS Customer Address (Tiny)

- `upsertCustomer` now accepts `address?: string | null`.
- When creating a new customer, the address is stored.
- Callers in QS flows include `address: ... || null` without changing other fields.

## Navigation Note

- When a quote transitions to `NEGOTIATION` by a `SALES` or `ADMIN` role, the UI redirects to the client-facing quote page.

---

This skeleton flow enables the minimum viable operations threading from Sales endorsement through PM, Procurement, Accounts, and Dispatch/Security, with simple cron hooks for reminders and SLA nudges.

