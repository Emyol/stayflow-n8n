# STAYFLOW — Track C n8n Buildathon Blueprint

**Project:** StayFlow — Rule-Based Hotel Guest Concierge & Front-Desk Automation  
**Competition:** Hack with the Flow: n8n Buildathon — Qualifying Round  
**Track:** C — Intelligent Customer Concierge  
**Official challenge:** *Rule-Based Guest Request Automation & Front-Desk Log Sync*  
**Blueprint updated:** October 26, 2026 (Philippines)  
**Deadline:** **Saturday, October 31, 2026, 10:00 PM (Asia/Manila)**  
**If qualified:** Top 3 teams per track compete **November 7, 2026, 1:00–6:00 PM** (NCR, venue TBA).

> **Project status:** The team reports that the StayFlow core site/workflow is already built. Sections 1–16 preserve the original core implementation and compliance plan; **new Sections 17–21** are a post-build integration plan for **Notion front-desk operations** and **Excel reporting/export**. The core implementation has not been independently inspected; verify it against the quality gate before expanding. Both integrations are **optional enhancements**, not substitutes for any required Track C nodes.

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
**Nice to have after MVP:** **Notion operations dashboard and `.xlsx` reporting (detailed in Sections 17–21)**, SLA escalation, follow-up digest, visual hotel branding.  
**Do not waste qualifying-round time on:** AI agent, chatbot, Facebook integration, payments, realistic PMS integration, multi-property database, auto-publishing content. **If a guest-facing site already exists, reuse it; do not rebuild it just to add Notion/Excel.**

---

## 2. Organizer compliance matrix

| Requirement | Our implementation | Proof in submission |
|---|---|---|
| **HTTP Request** from official starter | Receive or generate incoming guest request from organizer's provided node | Show it executing with real output |
| **Logic & Data**: Switch / Filter / Code / Set | Normalize payload, validate, route by request type, evaluate policy and availability, compose email | Show decision branches and Code/Set outputs |
| **Google Sheets** | Read availability/policy/booking rows; log and update requests | Show before/after sheet rows |
| **Google Calendar** | Create operational reminder, room hold, or staff follow-up | Open the created event |
| **Gmail** | Send styled HTML guest outcome email | Open received example email |
| **Notion (optional)** | Mirror each processed request to an internal staff board | Show one correctly synced Notion card |
| **Excel/XLSX (optional)** | Produce an admin-only report from Sheets records | Open actual downloaded `.xlsx` in Excel or compatible app |
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

**Optional additions:** After `15 — Update Request Audit`, branch to `16 — Sync Notion` (non-blocking). For Excel, use a separate protected admin/reporting path that **reads the existing Sheets data** and runs `Convert to File → XLSX`. Do not mix its on-demand trigger with the mandatory Track C HTTP Request path. Full node plans appear in Sections 17–21.

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
email_status,email_sent_at,created_at,last_updated_at,
notion_page_id,notion_sync_status,notion_last_synced_at
```

Recommended statuses: `RECEIVED`, `CONFIRMED`, `ALTERNATIVE_OFFERED`, `MANUAL_REVIEW`, `INVALID`, `REJECTED`, `ACTION_FAILED`, `EMAIL_SENT` (or keep business status and delivery status separate).

**Avoid mixing business status with delivery status:** prefer `status=CONFIRMED` and `email_status=SENT` over changing the business outcome to `EMAIL_SENT`. Also keep `notion_sync_status` separate: an unavailable Notion API must not change the hotel decision. **New columns are additive; do not rename the columns your finished workflow already uses.**

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

### Phase F — Optional Notion + Excel extension (after the core passes tests)

- [ ] Add a **best-effort Notion projection** after the core log is updated, using existing `request_id` and decision state; see Section 17.
- [ ] Make Notion writes idempotent. A repeated run must update the same page rather than create a duplicate.
- [ ] Add an **admin-only** on-demand export path to read `GuestRequests` and convert rows into XLSX; see Section 18.
- [ ] Test both add-ons independently; a Notion failure or Excel export failure must not break the required guest-confirmation flow.
- [ ] Hide or disable the extras if they cannot be demonstrated safely before submission.

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

**Live demo priority:** T01 (successful end-to-end) → T03 (fully booked case) → T07 (duplicate). Briefly show a **Notion card and Excel export only after proving the five required categories**. Add-on tests N01–N06 and X01–X07 are in Section 19. Save screenshots or execution IDs for debugging, but upload **only one** canvas screenshot as required.

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

### Post-core add-on sprint (if the workflow is already complete)

| Order | Priority | Deliverable | Stop condition |
|---|---|---|---|
| 1 | Critical | Re-run T01/T03/T07 on official instance | All five mandatory categories work; no regression |
| 2 | High | Notion DB + create/update sync + retry flag | N01–N04 pass |
| 3 | Medium | One-sheet XLSX export from existing Sheets data | X01–X04 pass |
| 4 | Optional | Admin-site download button, summary XLSX, overdue follow-up view | Only if no demo or submission risk |
| 5 | Critical | Freeze, rehearse, submit before Oct 31, 10 PM | Finished qualifying-round package |

**Team constraint:** No additional feature should delay the required video, screenshot, workflow URL, or one-page documentation.

### Suggested division for three teammates

| Role | Owner responsibility | Deliverable |
|---|---|---|
| **Automation / n8n Lead** | Import official starter, node graph, normalization, routing, error paths | Reliable workflow + clean canvas |
| **Data / Integration Lead** | Google Sheets schemas, seed data, bookings, policy logic, Calendar/Gmail integrations | Working app nodes + test evidence |
| **QA / Pitch Lead** | Test matrix, branded HTML emails, one-page doc, demo script, screen recording; own Excel reporting if core QA is done | Submission assets + clear business story |

**For the add-on sprint:** Automation Lead handles Notion branch, Data Lead owns schema/mapping, QA/Pitch Lead tests the XLSX file and demo. Reassign by actual team availability; do not risk incomplete core integrations.

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
- [ ] Optional: Notion database link **for internal team only**, report sample `.xlsx`, and add-on failure evidence.
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
| **3:40–4:15 (optional)** | Show Notion request board and one downloaded Excel report, if both work and the recording remains under 5:00. |
| **4:15–4:30 (optional)** | End with concise impact and tradeoff. **If optional features are not demo-ready, use the original 4-minute ending instead.** |

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
**Optional operational layer:** Notion as a non-authoritative staff board, Excel as an on-demand reporting file. **Limitations/future:** Google Sheets is a demo store, not atomic inventory; add PMS integration, concurrency controls, and SLA alerts for production.

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
| Under 2 minutes / over 5 minutes | Rehearse; target approximately 4:00–4:30 with extras, never above 5:00 |
| Notion sync fails / credentials revoked | Keep Sheets as authoritative, mark `notion_sync_status=FAILED`, retry safely; do not resend guest email |
| Excel export endpoint is publicly accessible | Disable public endpoint; enforce server-side admin authentication or deliver only to a verified internal mailbox |
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

**Optional enhancements — only after the four judging categories pass**

- [ ] Notion displays the same `request_id`, status, and assigned follow-up as Sheets.
- [ ] Reprocessing the same ID does **not** create a second Notion page.
- [ ] Excel export opens as a real XLSX and contains only allowed fields.
- [ ] Add-ons cannot block guest confirmations or silently alter availability.

### Final submission check

- [ ] Workflow URL points to `khylepanganiban.app.n8n.cloud`.
- [ ] Screenshot is **one** full-canvas image.
- [ ] Video link/file works without asking judges for access.
- [ ] Demo contains no private credentials or genuine guest information.
- [ ] All members use the same team name.
- [ ] Form submitted by **October 31, 2026, 10:00 PM Manila time**.

---

## 17. Add-on #1 — Notion front-desk operations dashboard (implementation-ready)

### 17.1 Goal and architecture

**User story:** A front-desk employee opens a single Notion board to see new and unresolved hotel guest requests, search by request ID, and identify follow-up work **without accessing the raw n8n canvas**.

**Important:** Notion is a **read-oriented mirror** of the Google Sheets `GuestRequests` log. **Google Sheets remains the source of truth** for the competition's availability, hotel rules, request decisions, and audit. Never let changing a Notion status silently reserve a room or send a guest email. Manual Notion edits do not automatically update Sheets in this version.

```text
Mandatory judged path (unchanged)
HTTP Request (organizer) → Validate → Sheets lookup → Rules → Sheets audit
                                                  → Calendar → Gmail → Sheets final audit
                                                                   |
                                                                   v
                                                    [16 — Prepare Notion Payload]
                                                                   |
                                                    [17 — Find Notion Page by request_id]
                                                         /                    \
                                              Existing page                No page
                                                  |                          |
                                      [18a — Update Page]           [18b — Create Page]
                                                         \                    /
                                                          [19 — Save Notion ID/status]
                                                                   |
                                                          [Optional staff board]

On Notion error → log sync failure in Sheets / retry queue; DO NOT re-run Calendar or Gmail.
```

*Attach the projection to the final audited status if you want the first card to show email delivery details. If the original flow is already branching, use an explicitly constructed Set payload so changes in `$json` from Gmail/Sheets don't erase required keys.*

### 17.2 Set up the database in Notion (10–20-minute configuration)

1. Create a **private** Notion page: `StayFlow | Front Desk`.
2. Inside it create a **database**, named `Guest Request Board` (full-page or inline).
3. Add the following properties. Notion's required page-title property may be named `Request` instead of `Name`.
4. Create views: **Board by Status**, **Pending Review** (filtered `MANUAL_REVIEW`/`ALTERNATIVE_OFFERED`), **Arrivals This Week**, and **All Requests**.
5. Give the n8n Notion integration access to this database/page. Use n8n's saved credential, not a token pasted in a Code or Set node.

| Notion property | Notion type | Map from Sheets/n8n | Required? |
|---|---|---|---|
| `Request` | Title | `{{request_id}} — {{request_type}}` | Yes |
| `Request ID` | Rich text | `request_id` | Yes, unique logical key |
| `Booking ID` | Rich text | `booking_id` | Yes |
| `Request Type` | Select | `Early Check-in`, `Room Upgrade`, `Amenity`, `Accommodation` | Yes |
| `Status` | Status or Select | `RECEIVED`, `CONFIRMED`, `ALTERNATIVE_OFFERED`, `MANUAL_REVIEW`, `INVALID`, `REJECTED`, `ACTION_FAILED` | Yes |
| `Arrival Date` | Date | `stay_date` | Yes when available |
| `Staff Action` | Rich text | `staff_action` | Yes |
| `Decision Reason` | Rich text | `decision_reason` (sanitize/shorten) | Recommended |
| `Priority` | Select | `High`, `Normal`, `Low` (derived from policy) | Recommended |
| `Calendar Event ID` | Rich text | `calendar_event_id` | Recommended |
| `Email Delivery` | Select | `PENDING`, `SENT`, `FAILED`, `SKIPPED` | Recommended |
| `Last Sync` | Date | `last_updated_at` / sync timestamp ISO8601 | Recommended |
| `Assigned To` | People | Only if a real staff Notion user is known | Optional |

**Notion status compatibility:** Create matching status/select options in the UI before using them in automation; exact Notion API property handling may differ by integration/database version. Use the credential's actual returned database/data-source ID in the n8n node; never hard-code a guessed ID.

**Guest privacy:** For buildathon tests, use synthetic hotel data. Only show the minimum staff-required information in Notion; **omit the email address and freeform private guest notes** from the default board. Do not publish the board to the web.

### 17.3 Add the n8n nodes to your existing workflow

| Order | Suggested name | n8n node/action | Key settings / output |
|---|---|---|---|
| N1 | `16 — Prepare Notion Payload` | **Edit Fields (Set)** | Pass stable `request_id`, decision, date, task, calendar ID and email status; preserve item linking |
| N2 | `17 — Lookup Notion Page` | **Notion → Database Page → Get Many** with filter if available, or Notion API/data-source query | Filter on exact `Request ID`, not title; handle zero results |
| N3 | `18 — Existing Notion Page?` | **IF** | True when a matching page ID exists |
| N4a | `19a — Update Notion Card` | **Notion → Database Page → Update** | Pass stored/found Notion page ID and map changed properties |
| N4b | `19b — Create Notion Card` | **Notion → Database Page → Create** | Parent: `Guest Request Board`; map all required properties |
| N5 | `20 — Store Notion Sync Outcome` | **Google Sheets → Update Row** | Write `notion_page_id`, `notion_sync_status=SYNCED`, `notion_last_synced_at` |
| N6 | `21 — Handle Notion Failure` | **IF / error branch + Sheets update** | Set sync status `FAILED` and capture a safe error summary; do not touch main decision |

**Alternative to N2:** If a valid `notion_page_id` is already stored on the matching Sheet row, use it for Update. On missing/stale ID, query Notion by `Request ID` before Create. The `Get Many`/filter UI can vary by n8n version; use **HTTP Request authenticated with the Notion credential to query the correct database/data source** if the node does not expose an exact filter. Preserve HTTP starter input; this Notion read is supplemental.

**First-time setup:** Create one sample card and inspect the Notion node output to record the true page `id`. **Never deduce** page IDs from titles or guest names.

### 17.4 Suggested normalized Notion sync payload

```json
{
  "request_id": "REQ-1001",
  "booking_id": "BKG-1001",
  "request_type": "early_checkin",
  "notion_type": "Early Check-in",
  "status": "CONFIRMED",
  "priority": "Normal",
  "stay_date": "2026-11-03",
  "staff_action": "Prepare room for early arrival",
  "decision_reason": "Early-ready room available under hotel policy",
  "calendar_event_id": "event-id-from-calendar-node",
  "email_status": "SENT",
  "last_updated_at": "2026-10-26T13:00:00+08:00"
}
```

**Use this object only after the existing workflow has generated these values.** Dates/IDs above are fictional. Use the same `request_id` found in `GuestRequests` and the exact status used by the hotel rule engine. If your live workflow uses other status names, make one explicit mapping table instead of introducing silent mismatches.

### 17.5 Idempotency and failure rules

- **Notion is a projection, not the transaction:** a failed Notion write must not cause guest email/calendar to be replayed.
- **Upsert by `request_id`:** read `notion_page_id`; if absent, query Notion `Request ID`; Update the existing record, Create only if no match. Store the final page ID in Sheets. Avoid creating a page when a previous create may have succeeded but the response timed out—query again first.
- **Store sync state independently:** `PENDING` → `SYNCED` or `FAILED`; store `notion_last_synced_at` on success. Optionally add `notion_last_error` to Sheets for debugging (no tokens or raw guest data).
- **Rate limits and retries:** use n8n retry/error handling with backoff for transient failures. Limit retry count and send failed records to a staff-visible queue; never let unlimited loops generate pages.
- **Concurrent executions:** Notion's find-then-create is not an atomic uniqueness constraint; if two executions can race, serialize the Notion creation stage or do a periodic duplicate reconciliation by `Request ID`.
- **Board edits:** treat statuses as **display only** initially. To make them actionable later, design a separate authenticated staff-approval workflow that validates bookings/policy/availability before updating Sheets and only then sending a guest response.

### 17.6 Definition of done — Notion

- [ ] Notion integration has access only to the required workspace/database.
- [ ] Every completed core request appears in one Notion card with matching status.
- [ ] Re-running an existing `request_id` updates one page; no duplicate card.
- [ ] Fully booked upgrade displays `ALTERNATIVE_OFFERED`, not `CONFIRMED`.
- [ ] Temporarily disabling Notion credentials shows `FAILED` sync without resending guest email.
- [ ] Staff board is private and contains only fictional demonstration records.

---

## 18. Add-on #2 — Excel report generation and download

### 18.1 Goal and recommended architecture

**User story:** A hotel manager clicks **Export Report** in StayFlow, chooses a date range, and downloads a real Excel `.xlsx` file summarizing processed guest requests. A fallback route sends the XLSX to a staff-controlled email if the site download is not ready.

**Recommended:** Use n8n's built-in **Convert to File → Convert to XLSX**. This does **not** require Microsoft 365 Excel API access. It creates an Excel-compatible file directly from JSON rows. Do not move the master records from Google Sheets to Excel.

```text
OPTION 1 — Best for existing StayFlow admin site (separate protected workflow)
[Admin Export button / authenticated server]
       ↓
[Webhook: /stayflow/reports/export]  <-- server-side authorize staff access
       ↓
[Validate date range + max row count]
       ↓
[Google Sheets: read GuestRequests]
       ↓
[Code: filter + sanitize + compute report fields]
       ↓
[Convert to File: Convert to XLSX, binary field = data]
       ↓
[Respond to Webhook: Binary File, source = data]
       ↓
[Browser download: StayFlow_Guest_Requests_YYYY-MM-DD.xlsx]

OPTION 2 — Easiest safe fallback (separate manual/reporting workflow)
[Manual Trigger / authorized Schedule Trigger]
       ↓
[Read Sheets → Clean/Filter → Convert to XLSX]
       ↓
[Gmail: Send with attachment binary field data to authorized staff]
```

**Important competition boundary:** **Neither option may replace the organizer's mandatory HTTP Request trigger/data input in the judged Track C workflow.** Keep this as a separate optional internal reporting workflow on the **same organizer-designated n8n instance** (if permitted) or a clearly subordinate branch. The five core required nodes must remain visibly functional regardless of export outcome. Do not assume the event organizers will assess the extra workflow as part of the qualifying submission.

### 18.2 Report columns (one-sheet MVP)

Export the following columns from `GuestRequests`, in this display order. Map from your actual sheet headers if they differ.

| Excel header | Source/derivation | Format |
|---|---|---|
| `Request ID` | `request_id` | Text |
| `Booking ID` | `booking_id` | Text |
| `Request Type` | `request_type` | Text |
| `Stay Date` | `stay_date` | `YYYY-MM-DD` text/date |
| `Decision` | `status` | Text |
| `Reason` | `decision_reason` | Text, truncated if needed |
| `Staff Action` | `staff_action` | Text |
| `Email Status` | `email_status` | Text |
| `Calendar Event Created` | `Boolean(calendar_event_id)` | `Yes` or `No` |
| `Created At` | `created_at` | ISO timestamp |
| `Email Sent At` | `email_sent_at` | ISO timestamp or blank |
| `Response Minutes` | difference between sent and received timestamps | Number or blank |
| `Notion Synced` | `notion_sync_status` | Text |

**Do not export** private guest notes, unnecessary guest personal data, or credentials. For the demo, remove `guest_name` and `guest_email` from the report entirely. A production per-guest report would need role-based access and an explicit data-retention policy.

### 18.3 Exact n8n node configuration — downloadable XLSX

| Order | Node | Configuration |
|---|---|---|
| X1 | `Webhook — Admin Export` | Separate `GET` or `POST` endpoint. Use `POST` with a validated JSON date range for the site. Set response mode **Using Respond to Webhook Node**. |
| X2 | `Code — Validate Filter` | Validate `start_date`, `end_date`, date order, max range (e.g. 31 days). Reject unauthenticated or invalid requests **before reading Sheets**. |
| X3 | `Google Sheets — Get Rows` | Get rows from `GuestRequests`; handle pagination if your selected node/API configuration limits results. Enable **Always Output Data** or equivalent empty-path handling so the next Code node runs even for an empty sheet. |
| X4 | `Code — Prepare Rows` | Produce **one n8n item per exported row** with clean Excel column names. Filter date range, calculate `Response Minutes`, sanitize formula-like strings. Return a single control item for **empty or too-large** reports. |
| X5 | `Switch — Report Result` | Route `__empty_export=true` to an explicit no-records JSON response; route `__too_many_rows=true` to a size-limit error; route normal row items to XLSX conversion. Do not turn control items into spreadsheet rows. |
| X6 | `Convert to File — Convert to XLSX` | Choose **Convert to XLSX**, output file field `data`, `Header Row=On`, `Sheet Name=Guest Requests`, `File Name=StayFlow_Guest_Requests_YYYY-MM-DD.xlsx` (use an actual evaluated expression). |
| X7 | `Respond to Webhook` | **Respond With = Binary File**; choose binary field `data`. Add content-type and content-disposition headers when supported. |

**Response headers (download route):**

```http
Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
Content-Disposition: attachment; filename="StayFlow_Guest_Requests_2026-10-26.xlsx"
Cache-Control: no-store
```

The `Respond to Webhook` node requires an actual preceding Webhook node configured to use it. It returns **one binary file** from the first incoming item, which is exactly what `Convert to XLSX` creates.

**Authentication is not optional:** A public webhook URL plus a hidden button is **not security**. Restrict the download endpoint to authenticated staff. Prefer a backend that verifies a user session and makes a server-to-server request; if using n8n Webhook authentication, configure and test it in the organizer instance. Never embed a reusable n8n webhook secret in browser-side JavaScript or a public repository. If secure auth is unavailable, use **Option 2** (send report only to a verified internal email).

### 18.4 Prepare row transformation (n8n Code node example)

Use **Run Once for All Items** after Google Sheets returns raw `GuestRequests` rows. Replace the column names if your sheet uses display labels. The example assumes `startDate` and `endDate` are available from the validated request—wire these from `X2`, for example with an explicit node reference, not guessed item linkage.

```js
// Example for the Code node; adapt to actual n8n node names and field shapes.
const { startDate, endDate } = $('Code — Validate Filter').first().json;
const rows = $input.all().map(item => item.json);

function excelText(value) {
  let text = String(value ?? '').replace(/[\r\n]+/g, ' ').trim();
  // Protect against spreadsheet formula injection in downloaded reports.
  if (/^[=+\-@\t]/.test(text)) text = "'" + text;
  return text.slice(0, 500);
}
function responseMinutes(createdAt, sentAt) {
  if (!createdAt || !sentAt) return '';
  const a = Date.parse(createdAt), b = Date.parse(sentAt);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return '';
  return Math.round((b - a) / 60000 * 100) / 100;
}
const selected = rows.filter(row => {
  const date = String(row.created_at ?? '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && date >= startDate && date <= endDate;
});

if (selected.length === 0) return [{ json: { __empty_export: true } }];
if (selected.length > 500) {
  return [{ json: { __too_many_rows: true, count: selected.length } }];
}

return selected.map(r => ({
  json: {
    'Request ID': excelText(r.request_id),
    'Booking ID': excelText(r.booking_id),
    'Request Type': excelText(r.request_type),
    'Stay Date': excelText(r.stay_date),
    'Decision': excelText(r.status),
    'Reason': excelText(r.decision_reason),
    'Staff Action': excelText(r.staff_action),
    'Email Status': excelText(r.email_status),
    'Calendar Event Created': r.calendar_event_id ? 'Yes' : 'No',
    'Created At': excelText(r.created_at),
    'Email Sent At': excelText(r.email_sent_at),
    'Response Minutes': responseMinutes(r.created_at, r.email_sent_at),
    'Notion Synced': excelText(r.notion_sync_status),
  },
}));
```

**Important:** This example is a mapping template, not proof that the user's live Sheet columns match it. Test in n8n's output preview. Empty filtering must go to the no-records branch instead of `Convert to XLSX`. Set the Sheets read node to emit an empty item when there are no rows, so `Code — Prepare Rows` can produce the control item. Configure the Switch to route on the control flags; its normal/default path passes actual row items. The 500-row limit is a configurable demo safety limit, **not** permission to silently truncate a larger export. The example compares dates in the timestamp as written; ensure `created_at` uses **consistent ISO timestamps in Asia/Manila** or normalize all timestamps to that zone first.

### 18.5 Management metrics (optional bonus)

Build these metrics from the **same filtered rows**, separate from the one-sheet raw report:

| Metric | Rule |
|---|---|
| Total requests | Count filtered `GuestRequests` rows |
| Confirmed | Count business `status=CONFIRMED` |
| Alternatives offered | Count `ALTERNATIVE_OFFERED` |
| Manual review | Count `MANUAL_REVIEW` |
| Rejected / invalid | Count those states separately |
| Email delivery rate | `SENT` / eligible-to-send rows (label denominator) |
| Average response time | Mean minutes for rows with both valid timestamps |
| Requests by type | Group by normalized request type |
| Notion sync rate | `SYNCED` / eligible rows |

**Do not pretend these are real-world KPIs:** Label sample data as synthetic. Display summary metric counts on the StayFlow admin UI, or generate a **separate** `StayFlow_Summary.xlsx` from one or several rows. A single `Convert to XLSX` step typically creates **one worksheet**; do not promise a multi-sheet formatted Excel dashboard without adding a verified workbook-editing mechanism (for example, Microsoft Graph/Excel 365 via authenticated API or a trusted workbook template process).

### 18.6 Optional admin-site feature

If the StayFlow site has an internal admin dashboard already, add a small panel (don't rebuild the app):

```text
┌───────────────────────────────────────────────────────┐
│ Operations Reports                                   │
│ From [2026-10-01]  To [2026-10-26]                    │
│ [Export Guest Requests (.xlsx)]                      │
│ Only authorized hotel staff can download reports.    │
└───────────────────────────────────────────────────────┘
```

- On click: request an **authenticated server endpoint** (not a browser-exposed shared secret).
- Show loading, empty-results, and error states; only download when a valid XLSX response arrives.
- Use `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` for file responses.
- Log an admin report export event if you need auditability, but do not log guests' full notes.
- If the site is static-only with no secure backend session, prefer the authorized staff-email fallback.

### 18.7 Definition of done — Excel

- [ ] Exported binary is a true `.xlsx`, not a CSV merely renamed to `.xlsx`.
- [ ] A filtered request row appears with correct status, type, dates, and response-time calculation.
- [ ] Empty selection returns a clear no-records result.
- [ ] Unauthorized callers cannot obtain the guest report.
- [ ] Opening the export in Excel/LibreOffice shows a sensible header row and no formula execution from user-provided text.
- [ ] Running export does not write to hotel inventory, resend guest emails, or create calendar events.

---

## 19. Integration test matrix — Notion and Excel

| Test | Situation | Expected outcome | Evidence |
|---|---|---|---|
| **N01** | New confirmed early check-in | Exactly one Notion card | Matching request ID/status |
| **N02** | Re-run same request | Same Notion page updated | Same page ID, no duplicate |
| **N03** | Fully booked upgrade | Status `ALTERNATIVE_OFFERED` | Notion board + original Sheet row |
| **N04** | Notion API fails/times out | `notion_sync_status=FAILED` | Core Gmail/Calendar stay completed exactly once |
| **N05** | One previously failed sync retried | Existing request card repaired | No re-send to guest |
| **N06** | Staff edits a Notion card | Sheets policy and booking stay unchanged | No two-way edit side effect |
| **X01** | Request rows for a selected valid date range | Downloadable XLSX opens | File + correct headers/data |
| **X02** | Selected range contains no requests | Clear empty state | No fabricated data |
| **X03** | Invalid/reversed date interval | Rejected input | Validation, no report leak |
| **X04** | Unauthorized report attempt | 401/403 or equivalent denial | No XLSX response |
| **X05** | Malicious formula-like text in notes/fields | Escaped, treated as text | Workbook does not execute formula |
| **X06** | Several hundred demo rows | Complete or gracefully limited report | Verified row count |
| **X07** | Excel export fails | Export error isolated | Core request processing still works |

**QA rule:** Do not mark N02 passed merely because there are no two visible cards on the current board view: check the full database for matching Request IDs. Check X01 by opening the actual file, not just seeing a green n8n execution.

---

## 20. Priority plan, team execution, and on-stage story

### 20.1 Time-boxed post-build implementation plan

| Priority | Add-on task | Practical deliverable |
|---|---|---|
| **P0 — mandatory** | Re-test official Track C starter and core flow | Existing five categories still execute correctly |
| **P1 — high** | Notion DB schema + credentials | Private `Guest Request Board` ready |
| **P1 — high** | Create/Update page sync and idempotency | N01–N04 working |
| **P2 — medium** | Read Sheets + Convert to XLSX | Real single-sheet export, X01–X03 working |
| **P2 — medium** | Secure export delivery | Authenticated download or internal Gmail attachment |
| **P3 — optional** | Site export button, metrics, overdue filters | Polish only if P0/P1/P2 tests are stable |
| **P0 — mandatory** | Final 2–5-minute pitch and one-page documentation | Ready by Oct 31, 10:00 PM Manila time |

### 20.2 Suggested team ownership

- **Member A — n8n systems:** owns Notion node branch, best-effort error handling, request ID mapping.
- **Member B — data/reporting:** owns Sheets field contract, export transformation, XLSX content/security.
- **Member C — QA/demo/frontend:** verifies existing site/admin login, tests Notion/Excel, prepares one-page story, recording and screenshot.

### 20.3 Updated elevator pitch

> “StayFlow is an auditable, rules-driven hotel concierge. The organizer's guest request triggers deterministic policy and room-availability checks, then StayFlow logs the decision, schedules a front-desk action, and sends a polished guest email. We also mirror tasks to a private Notion staff board and generate Excel management reports—without compromising the core request workflow.”

### 20.4 Suggested 4:30 video distribution if extras are polished

| Time | Visual | Message |
|---|---|---|
| 0:00–0:25 | Hotel guest-request problem | Why manual front-desk work is costly |
| 0:25–0:55 | Official n8n full canvas | Identify required HTTP, logic, Sheets, Calendar, Gmail nodes |
| 0:55–1:45 | Early check-in happy path | Show correct decision, Sheet row, Calendar, guest Gmail |
| 1:45–2:25 | Full upgrade + duplicate | Alternatives and no duplicate side effects |
| 2:25–3:00 | Notion board | Staff sees matching request statuses; one request ID = one card |
| 3:00–3:25 | Excel report | Export one real XLSX with headers and filtered sample rows |
| 3:25–4:15 | Three required Track C pitch answers | Rules, edge cases, operations/scaling |
| 4:15–4:30 | Closing | One-line outcome and realistic production caveat |

**Fall-back:** If any add-on is not stable, cut Notion/Excel from the video and spend that time on edge-case reliability. A live qualifying-round failure costs more than an optional integration adds.

### 20.5 One-page judged documentation — insert this short add-on paragraph

**Operational visibility:** “Processed requests are mirrored to a private Notion board for staff triage, and managers can produce an Excel report of requests, outcomes, and response times. Google Sheets stays authoritative; these extensions are isolated from room-allocation and guest-email execution.”

For the one-page sheet, include a mini flow like this:

```text
Required: HTTP Request → Rules → Sheets → Calendar/Gmail → Audit
                                         ├── Notion staff mirror (optional)
                                         └── Excel report export (optional)
```

**One screenshot rule:** The organizer requests **one full-canvas n8n screenshot**. Keep the judged canvas readable, showing all required nodes. Do not substitute the Notion UI or the Excel file for that screenshot. The 2–5-minute video may show their UI if time allows.

---

## 21. Final decisions and handoff checklist

### What stays unchanged

- **Track:** C — Rule-Based Guest Request Automation & Front-Desk Log Sync.
- **Source of guest input:** the original organizer-provided HTTP Request nodes.
- **Core execution:** policy logic + Google Sheets + Google Calendar + Gmail on the designated cloud instance.
- **Hotel decisions:** never determined by Notion status changes or XLSX report generation.
- **Submission deadline:** Saturday, October 31, 2026, **10:00 PM** Manila time.

### Updated release checklist

- [ ] Core Track C workflow still passes T01/T03/T07 after adding branches.
- [ ] Notion `Guest Request Board` exists and is private.
- [ ] Notion create/update operation upserts by `request_id` and saves `notion_page_id`.
- [ ] Notion API failure is recoverable without re-running Calendar or Gmail.
- [ ] Excel export reads current Sheet data and generates a valid `.xlsx`.
- [ ] Report is accessible only to an authenticated hotel admin or verified internal mailbox.
- [ ] Xlsx formula injection and privacy checks pass.
- [ ] Only one full-canvas n8n screenshot is submitted; required nodes remain visible.
- [ ] Demo stays between 2 and 5 minutes and covers all three Track C questions.
- [ ] Original JSON workflow and its credentials are backed up/redacted safely.
- [ ] Team freezes and submits before the cutoff.

### What you should implement next, in order

1. Verify the live core workflow is passing its original tests.
2. Add the three `GuestRequests` Notion sync fields **without deleting any existing columns**.
3. Create the private Notion database and finish a single-page Create/Update sync.
4. Add Excel `Read Sheets → Code → Convert to XLSX` and prove the file opens.
5. Add secure distribution (admin endpoint or verified staff email), then rerun tests.
6. Capture proof, record the pitch, and submit. **Stop building new features once the core submission is ready.**

---

## 22. Reference links

- **Official event instructions (primary source):** https://docs.google.com/document/d/1gjbyJSU14gMA-zMz5_aWI2LOFDNTRivPonhLEb5iLKY/edit
- **Organizer's n8n environment:** https://khylepanganiban.app.n8n.cloud
- **Official qualifying-round submission:** https://khylepanganiban.app.n8n.cloud/form/QualifyingRoundSubmission
- **n8n documentation:** https://docs.n8n.io/
- **n8n data mapping:** https://docs.n8n.io/data/data-mapping/data-mapping-ui/
- **n8n Gmail send operations:** https://docs.n8n.io/integrations/builtin/app-nodes/n8n-nodes-base.gmail/message-operations/
- **n8n Notion node:** https://docs.n8n.io/integrations/builtin/app-nodes/n8n-nodes-base.notion/
- **n8n Convert to File node (XLSX):** https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.converttofile/
- **n8n Respond to Webhook (binary file):** https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.respondtowebhook/

---

## Immediate next action (updated for finished core)

**Re-run T01, T03, and T07 on the live official workflow and make a safe backup. Then create the private Notion database and wire its idempotent post-audit sync.** Once N01–N04 pass, implement the native XLSX report exporter. Keep the original required workflow operational throughout.
