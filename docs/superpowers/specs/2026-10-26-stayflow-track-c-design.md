# StayFlow: Track C design

**Date:** 2026-10-26. **Deadline:** Sat 2026-10-31, 10:00 PM Asia/Manila.
**Sources:** `StayFlow_Track_C_Buildathon_Blueprint.md` (team plan), the organizer instructions PDF, and the live organizer payload saved in `fixtures/guest-request-payload.json`.

This document turns the blueprint into a buildable design. Where it departs from the blueprint, it's because the real organizer payload differs from what the blueprint assumed. Those changes are listed in §2.

---

## 1. Intent

Hotel front desks lose time reading guest requests, checking availability and policy by hand, writing replies, and remembering follow-ups. StayFlow is a **rule-based** n8n pipeline that takes the organizer's batch of guest requests and, for each one, decides an outcome from hotel policy and room inventory. It then logs the outcome, schedules the staff task, and emails the guest a polished HTML reply. It never promises something the inventory or policy can't back.

**Success:** one execution on the organizer's cloud instance processes all 20 organizer requests through all five required node categories. Re-running the same execution creates **no** new rows, events, or emails. The decisions match the expected outcome table in §8.

### Goals
- Deterministic, explainable decisions. Policy and the request catalog are editable data in Google Sheets, not hard-coded branches.
- Every request gets an auditable log row with business status and delivery status kept separate.
- Idempotent re-runs, plus detection of duplicate requests from the same booking.
- Honest guest emails: "confirmed" only when policy and inventory allow it; otherwise an alternative or "under staff review".
- Answers to all three Track C pitch questions are visible on the canvas.

### Non-goals
- No AI or LLM nodes. Track C is rules and templates.
- No frontend, guest website, chatbot, payments, or real PMS integration.
- No multi-property support or concurrency guarantees across simultaneous executions (explained as a limitation instead).

### Anti-goals (failure even if it "works")
- Changing or replacing the organizer's HTTP Request node, or feeding judged runs from any other input.
- An email that promises an unavailable room, an upgrade, or a time slot.
- A second run that re-sends emails or duplicates calendar events.
- Sending to the `@example.com` guest addresses in the payload.

---

## 2. What the real payload changed vs. the blueprint

| Blueprint assumption | Reality | Design response |
|---|---|---|
| One request per call | `GET /webhook/GuestRequest` returns `{ submissions: [20 items] }` | Split Out, then process as a batch |
| 4 request types | 17 distinct `request_type` labels | Data-driven `RequestCatalog` tab maps labels to 8 categories |
| Structured times | Times only in free-text `request_details` | Regex extraction; missing time leads to manual review |
| `booking_id` + `Bookings` tab | Payload carries the booking itself (`confirmation_number`, dates, room type) | **Drop the `Bookings` tab** (my call). Validate payload fields instead. |
| Random or new data per call | Identical payload every call | Re-running is the natural duplicate/idempotency demo |
| Usable guest emails | All `@example.com` | `demo_recipient_override` policy redirects all mail to a team inbox |

Payload shape (each submission):
```json
{ "request_id": "REQ-2026-101", "timestamp": "2026-10-26T08:00:00Z",
  "booking": { "confirmation_number": "HTL-88219", "guest_name": "Eleanor Vance",
    "email": "eleanor.vance@example.com", "check_in_date": "2026-11-02",
    "check_out_date": "2026-11-06", "room_type": "Deluxe King Suite",
    "request_type": "Early Check-In", "request_details": "…free text…" } }
```

---

## 3. Vocabulary

- **Request:** one organizer submission, identified by `request_id`.
- **Category:** our canonical bucket for a request type (§5.1).
- **Already processed:** a `request_id` that already has a row in the request log. It's skipped entirely: no new row, no side effects. This is what makes re-runs idempotent.
- **Duplicate request:** a *different* `request_id` with the same `confirmation_number` and the same category as one already logged or earlier in the batch. It's logged with status `DUPLICATE` and gets no calendar event or email.
- **Status (business outcome):** `CONFIRMED`, `ALTERNATIVE_OFFERED`, `MANUAL_REVIEW`, `INVALID`, `DUPLICATE`.
- **Delivery status:** `calendar_status` ∈ {`CREATED`, `FAILED`, `NOT_NEEDED`}, `email_status` ∈ {`SENT`, `FAILED`, `SKIPPED`}. While in flight, both are `PENDING`.
- **Hold:** provisional inventory reservation (`active_holds + 1`). It isn't a confirmed reservation.

---

## 4. Google Sheet: "StayFlow — Harborlight Front Desk"

One spreadsheet with four tabs. The hotel ("Harborlight Hotel", Manila) and all its policy values are **fictional demo data**. Seed CSVs live in `sheets/`.

### 4.1 `RequestCatalog`
| request_type_label | category | base_priority | schedule_from_text |
|---|---|---|---|
| Early Check-In | early_checkin | NORMAL | false |
| Late Check-Out | late_checkout | NORMAL | false |
| Room Upgrade | room_upgrade | NORMAL | false |
| Quiet Room / Location | room_preference | NORMAL | false |
| High-Floor Request | room_preference | NORMAL | false |
| Connecting Rooms | room_preference | NORMAL | false |
| Amenity Request | service_request | NORMAL | false |
| Bedding Preference | service_request | NORMAL | false |
| Workstation Setup | service_request | NORMAL | false |
| Special Occasion | service_request | NORMAL | false |
| Laundry & Dry Cleaning | service_request | NORMAL | false |
| Luggage Storage & Hold | service_request | NORMAL | false |
| Airport Transfer | service_request | NORMAL | true |
| In-Room Dining Booking | service_request | NORMAL | true |
| Pet Accommodation | pet_stay | NORMAL | false |
| Dietary Preference | special_care | NORMAL | false |
| Accessibility Request | special_care | HIGH | false |

Label matching is case-insensitive and whitespace/`&`/`and`-insensitive. Unknown labels go to category `other` (manual review, never approved).

### 4.2 `HotelPolicies` (key/value)
| policy_key | value |
|---|---|
| hotel_name | Harborlight Hotel |
| hotel_timezone_offset | +08:00 |
| standard_checkin_time | 14:00 |
| earliest_early_checkin | 10:00 |
| standard_checkout_time | 11:00 |
| latest_late_checkout | 16:00 |
| early_checkin_enabled | true |
| late_checkout_enabled | true |
| upgrades_enabled | true |
| upgrade_hold_hours | 24 |
| pets_allowed | true |
| pet_max_weight_lbs | 25 |
| pet_fee_per_night | PHP 1,500 |
| services_enabled | true |
| service_prep_time | 09:00 |
| review_sla_hours_high | 2 |
| review_sla_hours_normal | 24 |
| high_priority_keywords | allerg,anaphyla,wheelchair,mobility,medical,urgent |
| front_desk_contact | frontdesk@harborlight.example |
| demo_recipient_override | *(team inbox; blank = send to guest)* |

A required policy that's missing or empty sends the affected request to `MANUAL_REVIEW` (reason: "policy not configured").

### 4.3 `RoomInventory`
Columns: `inventory_key` (`YYYY-MM-DD|Room Type`, the update key), `date`, `room_type`, `total_rooms`, `reserved_rooms`, `blocked_rooms`, `active_holds`, `early_ready_rooms`.
`available = max(0, total − reserved − blocked − active_holds)`. The live sheet also shows this as an `available_rooms` formula column for staff. The workflow recomputes it rather than trusting the column.

**Live sheet:** [StayFlow — Harborlight Front Desk](https://docs.google.com/spreadsheets/d/18wno6DELat3xTkZs62UcYKlw_iRo9W2DtaCTZP2iyvk/edit) (ID in `config/local.json`).

Seed rows chosen so the organizer data exercises both happy and adverse paths:

| inventory_key | total | reserved | blocked | holds | early_ready | Exercises |
|---|---|---|---|---|---|---|
| 2026-11-02\|Deluxe King Suite | 10 | 7 | 1 | 0 | 1 | REQ-101 early check-in confirmed |
| 2026-11-04\|Standard Queen | 20 | 18 | 2 | 0 | 0 | REQ-115 early check-in alternative |
| 2026-11-03\|Ocean View Suite | 4 | 4 | 0 | 0 | 0 | REQ-102 upgrade, fully booked |
| 2026-11-04\|Ocean View Suite | 4 | 3 | 1 | 0 | 0 | REQ-102 upgrade, fully booked |
| 2026-11-08\|Penthouse Suite | 2 | 1 | 0 | 0 | 0 | REQ-105 late check-out confirmed |
| 2026-11-15\|Penthouse Suite | 2 | 2 | 0 | 0 | 0 | REQ-120 late check-out alternative |

A missing inventory row for a needed date and room type leads to `MANUAL_REVIEW` ("inventory not available for verification").

### 4.4 `GuestRequests` (audit log)
`request_id, received_at, confirmation_number, guest_name, guest_email, request_type, category, priority, check_in_date, check_out_date, room_type, request_details, requested_time, status, decision_code, decision_reason, staff_action, calendar_status, calendar_event_id, email_status, email_recipient, email_sent_at, processed_at, last_updated_at`

Written with **append-or-update keyed on `request_id`**: first with `PENDING` delivery fields, then updated with the final delivery state.

---

## 5. Rules

All rule logic is pure JavaScript in `src/` (no n8n globals), unit-tested with `node:test`, and inlined into Code nodes by the build script (§7).

### 5.1 Classify, validate, de-duplicate (whole batch, one Code node)
For each normalized request, in payload order:
1. **Already processed:** `request_id` exists in the log, so `route = "already_processed"`.
2. **Validate:**
   - `request_id`, `confirmation_number` and `guest_name` are present.
   - The email matches a basic address pattern.
   - Both dates are valid ISO `YYYY-MM-DD`, and `check_out > check_in`.
   
   Any failure gives `route = "invalid"` with human-readable `validation_errors`.
3. **Classify** through `RequestCatalog`, which yields `category` and `base_priority`. A label that isn't in the catalog gives `other`.
4. **Priority:** `HIGH` if `base_priority` is HIGH or the details match any `high_priority_keywords`; otherwise `NORMAL`.
5. **Duplicate:** the same `confirmation_number` and `category` as a logged row with a different `request_id`, or as an earlier request in this batch, gives `route = "duplicate"` with `duplicate_of`.
6. Otherwise `route = category`.

### 5.2 Text extraction helpers
- **Times:** `/\b(\d{1,2})(?::(\d{2}))?\s*(AM|PM)\b/gi`. The **last** time mentioned is the requested time. This is correct for all 4 time-based organizer requests, e.g. "Landing at 9:00 AM … check-in around 10:30 AM" gives 10:30.
- **Dates in text** (only when `schedule_from_text`): month name/abbrev + day (`Nov 1`, `Nov 8th`), with the year taken from `check_in_date`.
- **Pet weight:** `/(\d+(?:\.\d+)?)\s*-?\s*(lbs?|pounds?|kg)/i`, with kg converted to lb.
- **Target room type:** the longest inventory `room_type` name found in the details that differs from the current room.
- **Linked booking:** any `HTL-\d+` in the details other than the request's own number.

### 5.3 Category rules (one Code node per Switch branch)
| Category | Rule (in order) | Outcome |
|---|---|---|
| early_checkin | disabled → ALT · no time parsed → REVIEW · time ≥ standard check-in → CONFIRMED (`STANDARD_CHECKIN_APPLIES`) · time < earliest → ALT (`TOO_EARLY`) · no inventory row → REVIEW · `early_ready_rooms` (minus rooms already allocated earlier in this batch) > 0 → CONFIRMED (`EARLY_CHECKIN_CONFIRMED`, allocate 1 ready room) · else ALT (`NO_READY_ROOM`: luggage storage + standard check-in) | |
| late_checkout | disabled → ALT · no time → REVIEW · time ≤ standard checkout → CONFIRMED (`STANDARD_CHECKOUT_APPLIES`) · time > latest → ALT (offer latest) · no inventory row for `check_out_date` + room type → REVIEW · available > 0 → CONFIRMED (`LATE_CHECKOUT_CONFIRMED`) · else ALT (`LATE_CHECKOUT_UNAVAILABLE`: luggage storage) | |
| room_upgrade | disabled → ALT · no target type → REVIEW · any night (`check_in` … `check_out − 1`) missing a row → REVIEW · any night available ≤ 0 (after batch holds) → ALT (`UPGRADE_UNAVAILABLE`: keep current room, re-check at arrival) · else place hold on every night → ALT (`UPGRADE_HELD_AWAITING_APPROVAL`: rate + guest approval needed, hold expires in `upgrade_hold_hours`) | Never CONFIRMED automatically: upgrades need guest approval of the rate |
| room_preference | linked booking found → REVIEW (`LINKED_BOOKING_CHECK`) · else CONFIRMED (`PREFERENCE_NOTED`: noted for room assignment, not guaranteed) | |
| service_request | services disabled → REVIEW · else CONFIRMED (`SERVICE_ACCEPTED`: accepted into the staff queue, not a stock guarantee) | |
| pet_stay | pets not allowed → ALT · no weight parsed → REVIEW · weight > max → ALT · else CONFIRMED (`PET_STAY_CONFIRMED`, fee from policy) | |
| special_care | always REVIEW (`SPECIAL_CARE_REVIEW`), HIGH priority if keywords match | Safety-related: a human must confirm |
| other | REVIEW (`UNRECOGNIZED_REQUEST_TYPE`) | |
| invalid | INVALID. Guest email only if the address itself is valid ("we need more details") | |
| duplicate | DUPLICATE. No calendar, no email | |

**In-batch allocation ledger:** the early check-in and upgrade branch nodes each process all their items in one run and keep a running ledger, so two requests in one batch can't both take the last ready room or upgrade room. Resulting inventory changes are written back to `RoomInventory` (`early_ready_rooms − n`, `active_holds + n`).

### 5.4 Staff task (Calendar) plan
All times are in hotel local time (+08:00), 30-minute events unless noted. Titles carry `[HIGH]` when priority is HIGH, plus `request_id` and confirmation number.

| Decision | Event |
|---|---|
| EARLY_CHECKIN_CONFIRMED | "Prepare early check-in", check-in date, 60 min before the requested time |
| NO_READY_ROOM / TOO_EARLY | "Early arrival: hold luggage", check-in date at requested time |
| LATE_CHECKOUT_CONFIRMED | "Late check-out approved until HH:MM: notify housekeeping", check-out date at standard checkout |
| LATE_CHECKOUT_UNAVAILABLE | "Offer luggage storage at check-out", check-out date at standard checkout |
| UPGRADE_UNAVAILABLE | "Re-check upgrade availability", check-in date at `service_prep_time` |
| UPGRADE_HELD_AWAITING_APPROVAL | "Upgrade hold expires: confirm or release", now + `upgrade_hold_hours` |
| PREFERENCE_NOTED / PET_STAY_CONFIRMED / SERVICE_ACCEPTED | "Prepare: <request type>", check-in date at `service_prep_time`; for `schedule_from_text` types, at the parsed date and time (60 min) |
| Any MANUAL_REVIEW | "Review: <request type>", now + `review_sla_hours_high`/`_normal` |
| STANDARD_*_APPLIES, INVALID, DUPLICATE | no event |

### 5.5 Guest email plan
Templates: `confirmed` (green), `alternative` (amber), `review` (blue), `needs_info` (grey, INVALID only). Each is a single inline-styled, table-based HTML email:
- navy header with the hotel name
- a status pill
- greeting
- a summary table (request ID, confirmation number, stay dates, room, request type)
- "What we decided" (decision-specific sentence)
- "What happens next"
- the guest's original request, quoted
- footer with the front-desk contact

**All guest-supplied text is HTML-escaped.**

Subjects: `Harborlight Hotel | Request confirmed — REQ-…`, `… | An option for your request — REQ-…`, `… | We're reviewing your request — REQ-…`, `… | We need a few more details — REQ-…`.

Recipient: `demo_recipient_override` if set, otherwise the guest email. When overridden, a small footer line shows the original recipient and `email_recipient` logs the actual address used.

---

## 6. Workflow (n8n canvas)

Names are exactly as they'll appear. The two organizer nodes are kept **unchanged** (same name, URL, and options).

```
When clicking 'Execute workflow' → Guest Request Submissions (HTTP, organizer)
 → Split Out Submissions → Normalize Fields (Set)
 → Read Request Catalog → Read Hotel Policies → Read Room Inventory → Read Request Log   (Sheets, execute once; log read always outputs data)
 → Classify, Validate & Dedupe (Code)
 → New Request? (IF) ──false──→ Already Processed: No Action (NoOp)
 → Route by Category (Switch: invalid, duplicate, early_checkin, late_checkout, room_upgrade,
                             room_preference, service_request, pet_stay, special_care, fallback=other)
     → Decision: Invalid (Set) │ Decision: Duplicate (Set) │ Rules: Early Check-In (Code) │ Rules: Late Check-Out (Code)
       Rules: Room Upgrade (Code) │ Rules: Room Preference (Code) │ Rules: Service Request (Code)
       Rules: Pet Stay (Code) │ Rules: Special Care (Code) │ Decision: Manual Review (Set)
 → Plan Staff Task & Email (Code)
 → Log Request (Sheets append-or-update, PENDING)
 → Needs Staff Task? (IF) → Create Staff Task (Calendar; on error → error output)
       → Calendar Created (Set) / Calendar Failed (Set)
 → Send Guest Email? (IF) → Send Guest Email (Gmail HTML; on error → error output)
       → Email Sent (Set) / Email Failed (Set)
 → Update Request Log (Sheets append-or-update: delivery status)

Rules: Early Check-In + Rules: Room Upgrade
 → Collect Inventory Changes (Code) → Update Room Inventory (Sheets update by inventory_key)
```

Canvas layout: sticky notes group *Intake*, *Reference data*, *Rules*, *Actions*, *Audit*; every Switch output is labelled. Workflow settings: `executionOrder: v1`, timezone `Asia/Manila`.

Converging branches run downstream nodes once per branch. That's accepted; every downstream node is per-item, so behaviour is unchanged.

---

## 7. Build, test, deploy

```
src/            pure rule modules (normalize, classify, validate, extract, rules, plan, email)
test/           node:test unit tests + golden test over the organizer payload
fixtures/       organizer starter template, organizer payload, expected decisions, edge cases
sheets/         seed CSVs for the four tabs
scripts/build-workflow.mjs   inlines src/ into Code nodes → dist/stayflow-workflow.json
config/local.json, config/cloud.json   spreadsheet ID, calendar ID, credential names per environment
```

- **Code-node packaging:** each `src` module ends with `if (typeof module !== 'undefined') module.exports = {…}`, so the same text runs under Node tests and inside an n8n Code node. The build concatenates the needed modules plus a short glue block that reads `$input` and `$('Node').all()` and calls the pure functions with `now = new Date()`.
- **Tests:**
  - **Unit tests** for each helper and rule.
  - **Golden test:** the organizer payload plus seed sheets must produce exactly the §8 table.
  - **Edge-case fixtures:**
    - invalid email
    - check-out on or before check-in
    - missing fields
    - unknown request type
    - in-batch duplicate
    - logged duplicate
    - already-processed re-run
    - missing inventory row
    - missing time
    - two early check-ins competing for one ready room
    - pet over the weight limit
    - HTML injection in details
- **Local deploy:** import `dist/stayflow-workflow.json` into the Docker n8n, run it, then check the sheet rows, calendar events and inbox. Re-run and confirm nothing new is created.
- **Cloud deploy:** paste the JSON from `config/cloud.json` into the organizer instance, re-select the Google credentials, and run there for all recorded or judged runs.

### Prerequisite (user action)
The local n8n has **no credentials**. Google Sheets, Calendar and Gmail on localhost need a Google Cloud OAuth client:
1. Enable the Sheets, Calendar and Gmail APIs.
2. Set the redirect URI to `http://localhost:5678/rest/oauth2-credential/callback`.
3. Add the team's Google account as a test user.

Use a team-owned Google account, not anyone's personal one, because the cloud instance is shared. On the organizer cloud, n8n's managed "Sign in with Google" may be available instead.

---

## 8. Expected outcomes for the organizer payload (golden test)

| Request | Type | Category | Status | Decision code | Calendar | Email |
|---|---|---|---|---|---|---|
| 101 | Early Check-In 10:30 | early_checkin | CONFIRMED | EARLY_CHECKIN_CONFIRMED | 11-02 09:30 prep | confirmed |
| 102 | Room Upgrade → Ocean View Suite | room_upgrade | ALTERNATIVE_OFFERED | UPGRADE_UNAVAILABLE | 11-03 09:00 re-check | alternative |
| 103 | Dietary (severe allergies) | special_care | MANUAL_REVIEW (HIGH) | SPECIAL_CARE_REVIEW | now+2h | review |
| 104 | Amenity (crib) | service_request | CONFIRMED | SERVICE_ACCEPTED | 11-07 09:00 | confirmed |
| 105 | Late Check-Out 16:00 | late_checkout | CONFIRMED | LATE_CHECKOUT_CONFIRMED | 11-08 11:00 | confirmed |
| 106 | Accessibility | special_care | MANUAL_REVIEW (HIGH) | SPECIAL_CARE_REVIEW | now+2h | review |
| 107 | Special Occasion | service_request | CONFIRMED | SERVICE_ACCEPTED | 11-05 09:00 | confirmed |
| 108 | Quiet Room | room_preference | CONFIRMED | PREFERENCE_NOTED | 11-03 09:00 | confirmed |
| 109 | Pet (15 lb) | pet_stay | CONFIRMED | PET_STAY_CONFIRMED | 11-06 09:00 | confirmed |
| 110 | Airport Transfer, Nov 1 2:30 PM | service_request | CONFIRMED | SERVICE_ACCEPTED | 11-01 14:30 (60 min) | confirmed |
| 111 | Connecting Rooms (HTL-11924) | room_preference | MANUAL_REVIEW | LINKED_BOOKING_CHECK | now+24h | review |
| 112 | High-Floor | room_preference | CONFIRMED | PREFERENCE_NOTED | 11-02 09:00 | confirmed |
| 113 | Bedding | service_request | CONFIRMED | SERVICE_ACCEPTED | 11-05 09:00 | confirmed |
| 114 | Workstation | service_request | CONFIRMED | SERVICE_ACCEPTED | 11-03 09:00 | confirmed |
| 115 | Early Check-In 11:30 | early_checkin | ALTERNATIVE_OFFERED | NO_READY_ROOM | 11-04 11:30 luggage | alternative |
| 116 | Laundry | service_request | CONFIRMED | SERVICE_ACCEPTED | 11-09 09:00 | confirmed |
| 117 | Dietary (vegan) | special_care | MANUAL_REVIEW | SPECIAL_CARE_REVIEW | now+24h | review |
| 118 | In-Room Dining, Nov 8 8 PM | service_request | CONFIRMED | SERVICE_ACCEPTED | 11-08 20:00 (60 min) | confirmed |
| 119 | Luggage Storage | service_request | CONFIRMED | SERVICE_ACCEPTED | 11-01 09:00 | confirmed |
| 120 | Late Check-Out 16:00 | late_checkout | ALTERNATIVE_OFFERED | LATE_CHECKOUT_UNAVAILABLE | 11-15 11:00 | alternative |

Totals: **13 confirmed, 3 alternative, 4 manual review**. Second run: **20 already processed, 0 side effects.**

---

## 9. Pitch-question mapping

1. **Routing and policy compliance:** Classify → Switch by category → per-category rule nodes reading `HotelPolicies` and `RoomInventory` → the decision code selects the template. The email text comes from the decision, so it can't promise what the rules didn't grant.
2. **Edge cases:**
   - fully booked upgrade (102) and late check-out (120)
   - no ready room (115)
   - linked booking (111)
   - already-processed re-run and same-booking duplicates
   - in-batch ledger
   - missing inventory or policy → review
   - Calendar and Gmail error outputs recorded in the log
3. **Impact and scale:**
   - 20 requests handled in one run, with measured execution time
   - an audit trail
   - staff tasks on the calendar
   - the Sheets adapters can be swapped for PMS APIs
   - a property column and per-hotel policy tabs would support a hotel chain
   - the concurrency limitation of Sheets is stated honestly

## 10. Risks and limitations
- Google Sheets has no transactions. Two *simultaneous executions* could both take the last room. The in-batch ledger covers one execution; production needs PMS or database atomic allocation.
- Payload stay dates are in early November. At the Nov 7 finals some will be in the past. No past-date rule is applied, by design (my call), so the demo stays stable.
- The cloud instance's Google credential flow is unknown until we try it. Test on Day 1 of the cloud move.
- The Gmail daily send limit is far above 20 per run, so it's not a concern.

## 11. Calls I made (check these)
1. Dropped the blueprint's `Bookings` tab: the payload is the booking record.
2. Eight categories via a `RequestCatalog` sheet instead of four hard-coded types.
3. Upgrades are never auto-confirmed: available leads to a hold plus a guest-approval alternative.
4. Every special-care request (dietary, accessibility) goes to staff review. Keyword hits mark it HIGH.
5. Pet stays are auto-confirmed under a weight limit (25 lb) with a fictional fee.
6. Policy values (14:00 check-in, 10:00 earliest early check-in, 11:00 checkout, 16:00 latest late checkout) and inventory seeds are fictional. They're chosen so the organizer data shows confirmed, alternative and fully booked paths.
7. "Already processed" re-runs are skipped silently: no new log row. Semantic duplicates *are* logged as `DUPLICATE`.
8. No automatic retry of failed Calendar/Gmail actions. Failures are visible in the log for staff.
