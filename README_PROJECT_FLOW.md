# Project & Operations Flow

## Lifecycle
1. **QS** creates quote ? **Senior QS** reviews ? sends to **Sales**.
2. **Sales** negotiates with client; when deal is accepted, **Sales Endorses**:
   - Set commence date, deposit, monthly installment, and due-day.
   - System creates a **Project** and marks Quote **FINALIZED**.
3. **PM** creates Procurement **Requisition** (auto-creates Funding Request).
4. **Accounts** approves **Funding**; **Procurement** records **Purchase** (with invoice).
5. **PM** creates **Dispatch**, **Security** approves and marks **Delivered**.
6. **Accounts** records **Deposit** and **Installments**; reminders fire by due-day.

## Reminders
- **Funding SLA**: hourly while `PENDING`. After 3 reminders, 4th escalates to heads (GM/MD/PM/Senior QS/Accounts).
- **Commencement T-7**: 7 days before start, notify PM to prepare manpower/procurement.
- **Installments**: remind Accounts 3 days before due-day and on the day.

## Redirect
- When **Sales** moves a quote to **NEGOTIATION**, UI redirects to `/client/quotes/[quoteId]`.

## Files Touched
- Prisma models for `Project`, `ProcurementRequisition`, `ProcurementRequisitionItem`, `FundingRequest`, `Purchase`, `Dispatch`, `DispatchItem`, `Payment`
- Server actions in `app/(protected)/quotes/[quoteId]/actions.ts` and `app/(protected)/projects/actions.ts`
- Cron route `app/api/cron/reminders/route.ts`
- Minimal UIs in `app/(protected)/projects/page.tsx` (+ `app/(protected)/security/page.tsx`)

## Next
- Wire real notifications (email/SMS/Slack).
- Add uploads to store invoices/dispatch docs.
- Harden role-based UI checks.
