# STAYFLOW — Track C n8n Buildathon Blueprint

**Project:** StayFlow — Rule-Based Hotel Guest Concierge & Front-Desk Automation  
**Competition:** Hack with the Flow: n8n Buildathon — Qualifying Round  
**Track:** C — Intelligent Customer Concierge  
**Official challenge:** *Rule-Based Guest Request Automation & Front-Desk Log Sync*  
**Working date:** October 26, 2026 (Philippines)  
**Deadline:** **Saturday, October 31, 2026, 10:00 PM (Asia/Manila)**  
**If qualified:** Top 3 teams per track compete **November 7, 2026, 1:00–6:00 PM** (NCR, venue TBA).

> **Read this first:** The organizer assigns a specific problem to Track C: **hotel guest request processing**, not AI social media content generation. The project below is intentionally rules-driven. Build and run it **only** in the organizer's designated n8n instance: `https://khylepanganiban.app.n8n.cloud`. A local/Docker n8n workflow is **not an accepted submission**. Import the official **Track C JSON starter template** from the linked Google Doc. Keep and execute its provided HTTP Request node(s). Do not replace their mandatory data source with manually entered production input.

**Official instructions:** https://docs.google.com/document/d/1gjbyJSU14gMA-zMz5_aWI2LOFDNTRivPonhLEb5iLKY/edit  
**Submission form:** https://khylepanganiban.app.n8n.cloud/form/QualifyingRoundSubmission

**Important template limitation:** The written rules were reviewed, but the linked starter JSON's actual fields and node configuration could not be inspected here. **Treat the input schema below as our proposed internal schema, not a claim about the starter payload.** On Day 1, execute the starter and map its real output fields into this schema. If its available cases/fields differ, preserve the starter and adapt our logic.

---

## 1. What exactly are we building?

**One-liner:** *A rule-based hotel concierge that automatically reviews guest requests against hotel policies and room availability, records every outcome, schedules front-desk action, and sends a polished guest email.*

### Problem

Front-desk staff manually read request forms, check room availability, compare hotel policies, email guests, and schedule reminders. This creates duplicate requests, inconsistent promises, and forgotten follow-ups.

### Our solution

Guest request → classify → validate → check availability + policy → decide → update front-desk log → create staff calendar task/hold → send personalized HTML guest email.

### Successful demo means

- A **valid early check-in** is categorized, checked against policy and available ready rooms, logged, put on Calendar, and confirmed by Gmail.
- A **fully booked upgrade** is **not falsely promised**: an alternative or staff-review message is sent and logged.
- A **duplicate request** causes **no second hold, task, or confirmation**.
- The full workflow executes live on the **official instance**, showing all five mandatory categories.

### MVP: do these, not everything

**Must ship:** Four request categories, sheet lookups, deterministic routing, log updates, calendar scheduling, rich HTML responses, duplicate prevention, at least 6 tests, 2–5 minute demo.  
**Nice to have after MVP:** A small dashboard, SLA escalation, follow-up digest, visual hotel branding.  
**Do not waste qualifying-round time on:** AI agent, chatbot, Facebook integration, guest-facing website, payments, realistic PMS integration, multi-property database, auto-publishing content.

---

## 2. Organizer compliance matrix

| Requirement | Our implementation | Proof in submission |
|---|---|---|
| **HTTP Request** from official starter | Receive or generate incoming guest request from organizer's provided node | Show it executing with real output |
| **Logic & Data**: Switch / Filter / Code / Set | Normalize payload, validate, route by request type, evaluate policy and availability, compose email | Show decision branches and Code/Set outputs |
| **Google Sheets** | Read availability/policy/booking rows; log and update requests | Show before/after sheet rows |
| **Google Calendar** | Create operational reminder, room hold, or staff follow-up | Open the created event |
| **Gmail** | Send styled HTML guest outcome email | Open received example email |
| All five actually execute | Demonstrate a happy-path request through all five | n8n execution details + recorded evidence |
| Original work | Our own business rules, normalization, routing, templates, test fixtures | Source workflow clearly created by team |
| Official n8n workspace | All development + execution in organizer's cloud | Workflow URL on correct domain |
| Team limit | Up to three team members, same exact team name | Submission form |
| Screenshot | **One** full-canvas screenshot, visible node layout | Uploaded image |
| Demo video | **2–5 minutes**, live execution + three track questions | Uploaded recording |
| Documentation | A clear **one-page overview** (presentation criterion) | Prepare one page; include if submission permits or explain in demo |

**Important wording from organizer:** For Google Sheets/Gmail/Calendar, they allow your own data setup, but say mandatory data input/output must originate from the provided HTTP Request nodes. Preserve the starter's flow as the authoritative incoming dataset and do not create an independent replacement trigger for the judged path. If this rule is interpreted differently by event staff, follow their clarification.

---

## 3. Core system and architecture

```text
 [ORGANIZER'S TRACK C HTTP REQUEST NODE(S)]
                 |
       [01 Normalize Input / Set]
                 |
       [02 Validate / Code + IF]
           | invalid -------------------> [Log as Invalid / Staff review]
           v
       [03 Lookup Request ID / Sheets]
           | duplicate -----------------> [Stop: no duplicate side effects]
           v
       [04 Lookup Booking / Sheets]       (optional if starter contains confirmed booking)
                 |
       [05 Lookup Policy / Sheets]
                 |
       [06 Lookup Inventory / Sheets]
                 |
       [07 Decide / Code + Switch]
           | approved / alternative / review / rejected
                 |
       [08 Log request / Sheets]
                 |
       [09 Create follow-up / Calendar]
                 |
       [10 Build HTML / Set or Code]
                 |
       [11 Send email / Gmail]
                 |
       [12 Update status / Sheets]
                 |
          [End + audit data]
```

**Why the order matters:** Validate first. Check duplicates *before* creating calendar events. Log the intended decision and later update its delivery state so failed operations are visible. Create a Calendar follow-up before claiming a completed staff handoff. Do not mark a guest request `CONFIRMED` if critical capacity checks or downstream operations failed.

**n8n canvas convention:** Name every node with ordered readable labels (`01 — Normalize Input`, `02 — Validate`, etc.). Group nodes by intake, lookups, rules, actions, and recovery. Label every Switch output. One clean screenshot will help the presentation score.

---

## 4. Data design: create ONE Google Sheet with these tabs

Use a *synthetic demo hotel* called **Harborlight Hotel**. Use fictional bookings, room counts, and guest emails controlled by your team. Do not upload real hotel/customer personal data.

### Tab 1 — `Bookings` (recommended for stronger validation)

| Column | Type / example | Why |
|---|---|---|
| `booking_id` | `BKG-1001` | Match requests to an existing booking |
| `guest_name` | `Alex Santos` | Response personalization |
| `guest_email` | `team-demo@example.com` | Guest identity check / delivery; replace with a team-controlled mailbox |
| `arrival_date` | `2026-11-03` | Match availability date |
| `room_type` | `Standard` | Current booking |
| `booking_status` | `confirmed` | Ignore cancelled bookings |

### Tab 2 — `RoomInventory` (mandatory function: availability)

| Column | Type / example | Why |
|---|---|---|
| `date` | `2026-11-03` | Inventory applies to one stay date |
| `room_type` | `Deluxe` | Standard / Deluxe / Suite |
| `total_rooms` | `10` | Total inventory |
| `reserved_rooms` | `8` | Existing reservations |
| `blocked_rooms` | `1` | Out of service |
| `active_holds` | `0` | Provisional assignments |
| `early_ready_rooms` | `1` | Rooms already ready for early check-in |

**Calculated availability:** `available = total_rooms - reserved_rooms - blocked_rooms - active_holds` (clamp at zero). Do not treat `early_ready_rooms` as proof that an upgrade is bookable. Read and check the row for **exact stay date + requested room type**.

**Example seed data (hypothetical):**

```csv
date,room_type,total_rooms,reserved_rooms,blocked_rooms,active_holds,early_ready_rooms
2026-11-03,Standard,20,17,1,0,2
2026-11-03,Deluxe,10,8,1,0,1
2026-11-03,Suite,4,4,0,0,0
2026-11-04,Standard,20,18,2,0,0
2026-11-04,Deluxe,10,10,0,0,0
```

### Tab 3 — `HotelPolicies` (makes our logic configurable)

| `policy_key` | `value` | Meaning |
|---|---|---|
| `normal_checkin_time` | `15:00` | Local check-in time (demo assumption) |
| `earliest_early_checkin` | `12:00` | Earlier requests require staff review |
| `early_checkin_enabled` | `true` | Allow this request type |
| `upgrades_enabled` | `true` | Allow upgrade review |
| `paid_upgrades_require_guest_approval` | `true` | Never auto-charge/confirm a priced change |
| `amenity_requests_enabled` | `true` | Allow amenity scheduling |
| `hotel_timezone` | `Asia/Manila` | Event + email timestamps |

> These are **our fictional demo policies**, not official hotel policies or organizer-provided values. Show them as editable data instead of hard-coding them throughout the workflow.

### Tab 4 — `GuestRequests` (main audit log)

Required columns:

```text
request_id,booking_id,guest_name,guest_email,request_type,stay_date,
requested_checkin_time,current_room_type,target_room_type,amenity,
status,decision_code,decision_reason,staff_action,calendar_event_id,
email_status,email_sent_at,created_at,last_updated_at
```

Recommended statuses: `RECEIVED`, `CONFIRMED`, `ALTERNATIVE_OFFERED`, `MANUAL_REVIEW`, `INVALID`, `REJECTED`, `ACTION_FAILED`, `EMAIL_SENT` (or keep business status and delivery status separate).

**Avoid mixing business status with delivery status:** prefer `status=CONFIRMED` and `email_status=SENT` over changing the business outcome to `EMAIL_SENT`.

---

## 5. Internal request contract (map starter output here)

The starter JSON's fields must be checked before implementing. In `01 — Normalize Input`, map the incoming body onto this **internal normalized structure** so all subsequent nodes have stable keys:

```json
{
  "request_id": "REQ-1001",
  "booking_id": "BKG-1001",
  "guest_name": "Alex Santos",
  "guest_email": "team-demo@example.com",
  "request_type": "early_checkin",
  "stay_date": "2026-11-03",
  "requested_checkin_time": "12:30",
  "current_room_type": "Standard",
  "target_room_type": "",
  "amenity": "",
  "notes": "We are arriving before the normal check-in time."
}
```

Accepted canonical `request_type` values: `early_checkin`, `room_upgrade`, `amenity_request`, `special_accommodation`. Map labels such as `Early Check In`, `ROOM UPGRADE`, `room type change`, or `dietary preference` to canonical values using a rule table; unsupported labels route to `MANUAL_REVIEW` (never silently approve).

**Starter rule:** If its payload omits a field (for example, `request_id` or `booking_id`), do **not** assume it exists. Build a consistent fallback key from fields that actually exist, or document what you cannot validate. If the template contains repeated requests with IDs, prioritize those IDs.

### Starter inspection checklist

1. Open the instructions Doc → Track C tab → click **Workflow Template**.
2. Copy or download its `.json` and import/paste it into a **new workflow** in the required cloud instance.
3. Run the template **without modifying its HTTP Request node(s)**.
4. Copy one output payload into your team notes; list the exact property names/types.
5. Configure `01 — Normalize Input` using those observed properties, not assumptions.
6. Determine whether the sample payload includes different request types and edge cases. Reuse those for judged demonstrations whenever possible.
7. Save a baseline version of the organizer's template for safe rollback.

---

## 6. Decision table (the heart of the project)

Apply these rules **in order**. A missing or contradictory input must **never** produce an unconditional approval.

| Scenario | Rule / lookup | Decision | Guest email | Calendar action |
|---|---|---|---|---|
| Missing booking ID or unusable email | Required field invalid | `INVALID` | If a safe address exists, ask for details; otherwise no external guest email | Optional staff review |
| Same request ID processed and completed | Existing `GuestRequests` row | `DUPLICATE` | No second confirmation | No duplicate event |
| Booking not found / cancelled / mismatch | `Bookings` lookup | `MANUAL_REVIEW` | Acknowledge pending verification | Staff verification task |
| Early check-in at/after standard check-in | Requested time ≥ `normal_checkin_time` | `CONFIRMED` for standard check-in only | Explain normal check-in applies | Optional staff note |
| Early check-in inside allowed window | Policy enabled; matching room ready and booking valid | `CONFIRMED` in simulation | Confirm eligible early check-in | Create front-desk prep task |
| Too early or no room ready | Time before minimum or `early_ready_rooms <= 0` | `ALTERNATIVE_OFFERED` | Offer normal check-in / luggage storage, subject to policy | Optional follow-up |
| Upgrade to free available category | Upgrade enabled, matching room capacity > 0, no fee/consent required | `CONFIRMED` *only if capacity/hold is safely established* | Upgrade details | Room hold / room-block task |
| Paid upgrade or no room available | Payment approval needed OR capacity = 0 | `ALTERNATIVE_OFFERED` | Quote/request approval or offer current room | Follow-up for staff |
| Amenity request feasible | Amenity on available list, valid booking | `CONFIRMED` as a staff request (not stock guarantee) | Acknowledge request and fulfillment window | Staff preparation task |
| Special accommodation needs human confirmation | Accessibility / diet / special care | `MANUAL_REVIEW` | Acknowledge and promise staff review, not availability | Priority follow-up |
| Missing inventory or policy row | Cannot verify source of truth | `MANUAL_REVIEW` | Acknowledge pending verification | Staff verification task |

**Important distinction:** `CONFIRMED` on an amenity means **the request was accepted into the work queue**, not that a scarce item or a particular room is guaranteed. The email wording must reflect that distinction.

### Rule engine pseudocode

```js
// Decision logic after the request, booking, policy, and inventory have been read.
if (!validRequest) return 'INVALID';
if (alreadyCompleted) return 'DUPLICATE';
if (!bookingVerified) return 'MANUAL_REVIEW';

switch (request.request_type) {
  case 'early_checkin':
    if (!earlyCheckinEnabled) return 'ALTERNATIVE_OFFERED';
    if (requestedTime >= normalCheckinTime) return 'CONFIRMED_STANDARD_TIME';
    if (requestedTime < earliestEarlyCheckin) return 'MANUAL_REVIEW';
    return roomReadyForEarlyArrival ? 'CONFIRMED' : 'ALTERNATIVE_OFFERED';

  case 'room_upgrade':
    if (!upgradesEnabled || availableTargetRooms <= 0) return 'ALTERNATIVE_OFFERED';
    if (upgradeNeedsPaymentOrConsent) return 'ALTERNATIVE_OFFERED';
    return inventoryHoldSafelyRecorded ? 'CONFIRMED' : 'MANUAL_REVIEW';

  case 'amenity_request':
    return amenityRecognized ? 'CONFIRMED_STAFF_REQUEST' : 'MANUAL_REVIEW';

  case 'special_accommodation':
    return 'MANUAL_REVIEW';

  default:
    return 'MANUAL_REVIEW';
}
```

**Production caveat:** Google Sheets does not provide a transactional inventory lock. Two executions might read the same last available room. For the demo, **serialize the handling of capacity-affecting requests where supported**, re-read inventory immediately before the update, and/or route contested holds to manual confirmation. Never claim this proves double-booking impossible. Explain that production hotel PMS APIs/database transactions would enforce atomic allocations.

---

## 7. Exact n8n build order (follow this sequence)

### Phase A — Setup and input (first milestone)

- [ ] Obtain organizer n8n access and import **official Track C starter**.
- [ ] Rename workflow: `StayFlow | Track C | Guest Request Automation`.
- [ ] Run HTTP Request starter and **inspect real fields**.
- [ ] Build `01 — Normalize Input` (Edit Fields/Set node) to return internal schema.
- [ ] Build `02 — Validate Request` (Code node). Check IDs, names, address format, date, type, and type-specific fields. Return `{valid, validation_errors[]}`.
- [ ] Add `03 — Valid?` (IF) and stop unsafe cases with a logged outcome.

**Check:** Given one starter payload, normalized output is consistent and validation errors are human-readable.

### Phase B — Google Sheets and lookups

- [ ] Create a new Google Sheets workbook with four tabs above.
- [ ] Seed with **fictional** bookings and inventory. Ensure at least one available and one fully booked scenario.
- [ ] Configure Google Sheets credentials in official n8n workspace.
- [ ] `04 — Find Existing Request`: lookup `request_id` in `GuestRequests`.
- [ ] `05 — Duplicate?`: route *completed* duplicates to a no-side-effect exit. Existing incomplete requests should resume cautiously instead of being retried blindly.
- [ ] `06 — Lookup Booking`: match booking ID and check guest email/date where fields exist.
- [ ] `07 — Read Hotel Policies`: obtain policy values; route absent values to review.
- [ ] `08 — Read Room Inventory`: match exact arrival date plus room type.

**Check:** A lookup finds the exact row in both available and fully booked cases. Empty lookups do not crash downstream nodes (configure empty-item behavior / conditional branches as appropriate).

### Phase C — Deterministic rules

- [ ] `09 — Route Request Type` (Switch): `early_checkin`, `room_upgrade`, `amenity_request`, `special_accommodation`, `other`.
- [ ] `10 — Evaluate Hotel Rules` (Code/IF per branch): output `decision_code`, `status`, `decision_reason`, `staff_action`, `calendar_start`, `calendar_end`, `email_template_key`.
- [ ] Apply the **decision table**; no AI is needed.
- [ ] Explicitly handle: missing room row, zero availability, unrecognized category, booking mismatch, unsupported special request.

**Check:** Execute four different scenarios and compare actual decisions with the table.

### Phase D — Actions and logging

- [ ] `11 — Write Request Record`: append a new row to `GuestRequests` *before* external side effects, with `email_status=PENDING`.
- [ ] If a room hold changes capacity, re-check state; update `active_holds` only when safe. Otherwise leave hold pending review.
- [ ] `12 — Create Staff Calendar Event`: appropriate follow-up, room-prep task, or hold, with booking/request ID in title/description.
- [ ] `13 — Build HTML Email`: choose confirmed, alternative, or review template from rule outcome.
- [ ] `14 — Gmail Send`: Message → Send; choose **HTML**; To = normalized guest email; subject = outcome + request ID.
- [ ] `15 — Update Request Audit`: write `calendar_event_id`, `email_status`, `email_sent_at`, `last_updated_at`.

**Check:** A single run yields **one log row, one intended Calendar action, and one email**. Inspect output of each node, not just the final green checkmark.

### Phase E — Failure handling + polish

- [ ] On Sheets lookup/write failure: stop and alert staff; never promise room availability.
- [ ] On Calendar failure: leave `calendar_event_id` empty, mark `ACTION_FAILED`, and send only a pending-review response where appropriate.
- [ ] On Gmail failure: mark `email_status=FAILED`; do not mark as sent.
- [ ] On retry: read existing log record and event/email flags; skip already-completed side effects.
- [ ] Escape user-supplied text before injecting into HTML to prevent markup injection.
- [ ] Clear temporary test data / create a clean demo dataset and run final full execution.

**Check:** At least one intentional failure is detected, recorded, and visible to staff without a false confirmation.

### Design note for n8n field mappings

Use the n8n input/output viewer to map fields; for example, after `01 — Normalize Input`, values are normally accessed as `{{$json.booking_id}}` **in nodes directly receiving that normalized item**. Cross-branch mappings require explicit node references or Merge/Set processing. Confirm the expression preview before saving because Sheets/Calendar/Gmail nodes may replace the current `$json` with their own outputs. Use stable names and inspect item linking.

---

## 8. Email templates to demonstrate

**Design:** White HTML email, deep-navy header, green/orange status pill, guest name, hotel name, booking ID, request summary, decision, next steps, and small contact note. Aim for a polished transactional email rather than an AI-generated paragraph.

### Template A — Confirmed

**Subject:** `Harborlight Hotel | Request confirmed — {{request_id}}`

> Hi {{guest_name}},  
> We've reviewed your {{request_type}} request for booking {{booking_id}} on {{stay_date}}.  
> **Status: Confirmed.** {{specific_confirmed_details}}  
> Our front-desk team has been notified. Please keep this email for your reference.

### Template B — Alternative

**Subject:** `Harborlight Hotel | An option for your request — {{request_id}}`

> Hi {{guest_name}},  
> We received your request for {{request_type}}. We can't confirm your preferred option right now because {{safe_reason}}.  
> **Alternative:** {{policy_approved_alternative}}.  
> Reply to this message or contact the front desk to discuss options.

### Template C — Under staff review

**Subject:** `Harborlight Hotel | We're reviewing your request — {{request_id}}`

> Hi {{guest_name}},  
> Your request has been received. Our front-desk staff need to verify {{review_reason}} before confirming.  
> **Status: Under review.** We'll follow up through our normal guest support process.

**Never send:** “Your upgraded room is guaranteed” unless the room allocation/consent is actually secured. Also do not fabricate an exact response time if it is not in policy.

---

## 9. Calendar event conventions

Use timezone `Asia/Manila` and a shared **demo front-desk calendar** (or team-owned calendar with permission). Include the stable `request_id` in every event so duplicate checks and recovery are easy.

| Decision | Example event |
|---|---|
| Early check-in approved | `Prepare early check-in — REQ-1001`, 30–60 minutes before confirmed arrival |
| Upgrade awaiting consent | `Call guest about upgrade — REQ-1002`, staff follow-up |
| Special accommodation | `Review guest accommodation — REQ-1003`, priority follow-up |
| Amenity request | `Prepare requested amenity — REQ-1004`, prep window before arrival |
| Duplicate | No new event |

**Do not invent a staff member's actual availability:** Use a configured demo staff calendar, check for conflicts if possible, and use non-blocking follow-up events or manual assignment. Demo time windows are assumptions that can be changed per hotel policy.

---

## 10. Test matrix: evidence we should capture

| ID | Input condition | Expected status | No-risk proof |
|---|---|---|---|
| T01 | Valid early check-in, policy allows, ready room exists | `CONFIRMED` | Row + calendar + styled guest email |
| T02 | Early check-in; no room ready | `ALTERNATIVE_OFFERED` | No false early-check-in guarantee |
| T03 | Valid room upgrade with zero capacity | `ALTERNATIVE_OFFERED` | Inventory remains unchanged |
| T04 | Upgrade has extra cost, no guest consent | `ALTERNATIVE_OFFERED` | Requires follow-up; no auto-charge |
| T05 | Known amenity request | `CONFIRMED` (staff request only) | Prep task + accurate email wording |
| T06 | Special accessibility accommodation | `MANUAL_REVIEW` | Priority task; no unsupported promise |
| T07 | Same request ID submitted twice | `DUPLICATE` | No duplicate calendar/email/hold |
| T08 | Invalid email or missing booking ID | `INVALID` | Safe log / no risky guest send |
| T09 | Booking missing/cancelled | `MANUAL_REVIEW` | Staff verification, no confirmation |
| T10 | Inventory row missing / Google node fails | `MANUAL_REVIEW` / `ACTION_FAILED` | Fail-safe logging and alert |

**Live demo priority:** T01 (successful end-to-end) → T03 (fully booked case) → T07 (duplicate). Briefly show T06 if time. Save screenshots or execution IDs for debugging, but upload **only one** canvas screenshot as required.

### Quantitative impact to present without fabricating results

- **Metric:** staff touches per request (manual baseline versus automated path). Count only observed steps during testing.
- **Metric:** elapsed seconds from input arrival to guest email (record execution timestamps in demo).
- **Metric:** duplicate side effects prevented (run T07 and count events/emails).
- **Metric:** requests with clear auditable status (audit sheet completeness).

Show observed demo measurements; don't claim real hotel cost savings or guest satisfaction improvements without data. For scalability, explain migration from Sheets to a PMS/transactional data store.

---

## 11. Day-by-day execution plan (October 26–31)

| Date | Team outcome | Definition of done |
|---|---|---|
| **Mon Oct 26** | Gain cloud access; import organizer starter; inspect its request schema; set project scope | Starter HTTP Request runs in required instance; exact fields documented |
| **Tue Oct 27** | Create Sheets and credentials; normalization, validation, duplicate lookup | A seeded input lands in a consistent schema; Sheets reads work |
| **Wed Oct 28** | Implement Switch branches + policy/inventory decision engine | All four categories produce correct deterministic statuses |
| **Thu Oct 29** | Calendar, HTML emails, logging and audit updates | T01 and T03 complete all required actions |
| **Fri Oct 30** | Edge-case fixes, retry safety, test suite, one-page documentation | T01–T10 documented, no critical failures |
| **Sat Oct 31** | Freeze workflow, capture canvas, record 2–5 min video, submit | Submit **before** 10:00 PM; aim internally for 8:00 PM |

### Suggested division for three teammates

| Role | Owner responsibility | Deliverable |
|---|---|---|
| **Automation / n8n Lead** | Import official starter, node graph, normalization, routing, error paths | Reliable workflow + clean canvas |
| **Data / Integration Lead** | Google Sheets schemas, seed data, bookings, policy logic, Calendar/Gmail integrations | Working app nodes + test evidence |
| **QA / Pitch Lead** | Test matrix, branded HTML emails, one-page doc, demo script, screen recording | Submission assets + clear business story |

If only two people: combine QA/Pitch with integrations. Everyone should understand the full workflow for the live finals.

---

## 12. What exactly do we submit?

### Mandatory qualifying-round package

- [ ] **Team Name:** one identical registered name on every member's registration.
- [ ] **Team Members:** 1–3 members.
- [ ] **Workflow screenshot:** a single image of the **entire** n8n canvas (all branches visible).
- [ ] **Video:** 2–5 minutes, real workflow execution, explanation, and answers to the three Track C questions.
- [ ] **Workflow link:** URL to the working workflow on `khylepanganiban.app.n8n.cloud`.
- [ ] **Submission form:** https://khylepanganiban.app.n8n.cloud/form/QualifyingRoundSubmission
- [ ] **One-page documentation:** judging mentions it; prepare this PDF/page and attach only if the form provides a place, otherwise show it in video or share it using a permitted field. Don't invent an upload field.

### Internal backups (not explicitly required as form attachments)

- [ ] Original team workflow export (`.json`) with credentials/secrets removed.
- [ ] Clean synthetic Google Sheet with sample requests and availability.
- [ ] Demo recording source file and one-page README.
- [ ] A short list of tested scenarios/results.
- [ ] Exact final workflow URL and account access confirmed by team.

**Do not share secrets:** Redact access tokens, credential names if sensitive, guest emails, and private information from screenshots, exports, and videos.

---

## 13. Demo video script (target: ~4 minutes)

| Time | What to show / say |
|---|---|
| **0:00–0:25** | Problem: hotel staff manually reconcile room availability, policies, emails, and reminders. Introduce StayFlow and Track C. |
| **0:25–0:55** | Full-canvas view: identify starter HTTP Request, Switch/Code/Set, Sheets, Calendar, Gmail. Explain each stage briefly. |
| **0:55–1:45** | Execute valid early-check-in request. Show rule output, front-desk log row, calendar event, and Gmail HTML confirmation. |
| **1:45–2:25** | Execute fully booked upgrade. Show alternative result; verify no unsupported room assignment. |
| **2:25–3:05** | Execute duplicate request. Show lookup and that no second event/email/hold is created. |
| **3:05–3:40** | Answer explicit track questions: conditional routing/template injection; conflict + duplicate handling; operational impact and PMS scalability. |
| **3:40–4:00** | End with concise impact, tradeoff, and what we'd improve for the finals. |

### The three required track answers (say these explicitly)

**Q1 — How is routing policy-compliant?**  
“We normalize the provided request, use Switch to select the request category, then use policy and inventory lookups to calculate a deterministic decision. The email template is selected from that decision, so text cannot randomly promise an unavailable service.”

**Q2 — How do we prevent scheduling errors and duplicate requests?**  
“We validate booking details, check a stable request ID before creating external actions, use current date-specific inventory, and redirect unavailable or uncertain cases to alternatives or staff review. Our audit log records action state. We acknowledge that Sheets is not a transactional locking system and would rely on a PMS/database for guaranteed concurrent allocation.”

**Q3 — Why is this impactful and scalable?**  
“Routine requests require fewer manual lookups, each decision gets an auditable record, staff follow-ups go to Calendar, and guests receive timely consistent messages. We can extend the same rules to more properties, then replace the Sheets inventory adapter with a real PMS API and atomic reservation service.”

---

## 14. One-page documentation outline (for presentation points)

**Header:** StayFlow — Rule-Based Guest Request Automation & Front-Desk Log Sync  
**Problem:** Manual guest request decisions create delay, duplicate work, and inaccurate availability promises.  
**Solution:** A deterministic n8n pipeline that classifies requests, reads hotel policy + inventory, chooses a permitted outcome, logs it, schedules staff action, and emails guests.  
**Architecture:** Official HTTP Request → Set/Code/Switch → Google Sheets → Google Calendar → Gmail → Sheets audit.  
**Use cases:** Early check-in, room upgrade, amenities, special accommodations.  
**Safety/robustness:** Validation, duplicate ID check, no confirmation without availability, fallback to staff review, retry/audit states, HTML escaping.  
**Evidence:** Show execution screenshot + one successful and one adverse input with linked sheet/calendar/email results.  
**Impact:** Reduced manual handoffs (demo measured), consistent policy messaging, traceable operational tasks.  
**Limitations/future:** Google Sheets is a demo store, not atomic inventory; add PMS integration, concurrency controls, and SLA alerts for production.

Keep the final doc truly one page. The Markdown blueprint is the **build guide**, not the one-page judged documentation.

---

## 15. Common blockers and our fallback plan

| Blocker | What to do |
|---|---|
| Can't access the organizer n8n cloud | Contact organizers early; local instance cannot be the judged submission |
| Starter HTTP node fails | Diagnose URL/auth/request settings without replacing mandated node; ask organizers for the supported fix |
| Starter fields don't match sample schema | Update `01 — Normalize Input`; keep downstream contract unchanged |
| Sheet returns zero rows | Ensure exact date/type and row headers; explicitly route empty result to review |
| Google credentials unavailable | Resolve organizer workspace connection/permissions; use team-controlled test accounts only |
| Calendar staff slot conflicts | Create a non-blocking review task or flag manual scheduling; never claim a hold was secured |
| Gmail recipient is missing/invalid | Log error; don't send to an invented address |
| Concurrent room requests | Serialize capacity-changing steps if supported; otherwise manual-review contested allocations |
| HTML email has raw guest-entered markup | Escape interpolated user text before constructing HTML |
| Under 2 minutes / over 5 minutes | Rehearse; target approximately 4:00 |
| Only a flow screenshot, no live execution | Record actual HTTP → decisions → Sheets → Calendar → Gmail path |

---

## 16. Final quality gate (submission readiness)

**Functionality — 25%**

- [ ] Official starter HTTP node executed.
- [ ] At least one live run traversed all required node categories.
- [ ] Sheets changes, Calendar event, and delivered Gmail are observable.

**Technical Execution — 25%**

- [ ] Dates, names, IDs and room categories match across all services.
- [ ] Duplicate path produces no repeated side effects.
- [ ] Invalid / full / missing-data cases are handled.
- [ ] Calendar/email failures are visible in audit state.

**Creativity — 25%**

- [ ] Hotel policy is configurable, not just hard-coded demo branches.
- [ ] Every outcome provides an actionable next step.
- [ ] Special accommodation/uncertain cases reach the right staff queue.

**Presentation — 25%**

- [ ] One-screen workflow image is readable.
- [ ] Video 2–5 minutes and all three track questions answered explicitly.
- [ ] One-page documentation is ready.
- [ ] Team can explain the difference between a room hold and a confirmed reservation.

### Final submission check

- [ ] Workflow URL points to `khylepanganiban.app.n8n.cloud`.
- [ ] Screenshot is **one** full-canvas image.
- [ ] Video link/file works without asking judges for access.
- [ ] Demo contains no private credentials or genuine guest information.
- [ ] All members use the same team name.
- [ ] Form submitted by **October 31, 2026, 10:00 PM Manila time**.

---

## 17. Reference links

- **Official event instructions (primary source):** https://docs.google.com/document/d/1gjbyJSU14gMA-zMz5_aWI2LOFDNTRivPonhLEb5iLKY/edit
- **Organizer's n8n environment:** https://khylepanganiban.app.n8n.cloud
- **Official qualifying-round submission:** https://khylepanganiban.app.n8n.cloud/form/QualifyingRoundSubmission
- **n8n documentation:** https://docs.n8n.io/
- **n8n data mapping:** https://docs.n8n.io/data/data-mapping/data-mapping-ui/
- **n8n Gmail send operations:** https://docs.n8n.io/integrations/builtin/app-nodes/n8n-nodes-base.gmail/message-operations/

---

## Immediate next action

**Open the organizer's Track C template and run its HTTP Request node in the official n8n workspace.** Note the exact JSON fields it returns. Then implement normalization and the Google Sheets tabs. This is the single dependency that the rest of the blueprint is built around.
