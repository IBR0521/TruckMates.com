# Data Subject Request Process (GDPR / CCPA)

This document defines the in-product process for handling data subject requests.

## Legal Timelines

- GDPR: respond within 30 days of request intake.
- CCPA: respond within 45 days of verified request intake.

## Workflow in TruckMates

1. User submits request from `Settings -> Account -> GDPR / CCPA data subject requests`.
2. Request is recorded in `data_subject_requests` with:
   - jurisdiction (`gdpr` or `ccpa`)
   - request type (`access_export`, `deletion`, `rectification`, `restriction`)
   - due date auto-calculated based on legal timeline
3. Manager/legal user processes request from `Settings -> Privacy Requests`:
   - `pending` -> `in_review` -> `completed` or `rejected`/`cancelled`
4. For access/export requests, manager can complete and attach generated export payload.
5. All state changes are logged to `audit_logs` for accountability.

## Data Scope Notes

- Export payload includes user profile and linked driver/operational records currently available in-app.
- External processor data (e.g., Stripe-level records) may require processor-side workflows and legal retention exceptions.

## Recommended Operating Procedure

- Verify identity before processing (for non-authenticated channels like email support tickets).
- Record response notes in each request entry.
- Document legal basis if rejecting/limiting a request.
- Keep evidence of completion timestamp and responder identity.
