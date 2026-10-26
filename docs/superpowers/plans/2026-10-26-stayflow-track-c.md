# StayFlow Track C Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the StayFlow n8n workflow. It takes the organizer's 20 guest requests, decides each one with rules from Google Sheets, logs it, creates a staff Calendar task, and emails the guest. Re-runs are idempotent.

**Architecture:** All decision logic is plain JavaScript in `src/`, made of top-level function declarations with no imports or exports. Node tests load it through a `vm` loader. A build script concatenates the same files into n8n Code nodes and emits one workflow JSON per environment (`local`, `cloud`). The workflow is imported into the local Docker n8n with the n8n CLI and executed through the n8n MCP.

**Tech Stack:** Node 22 (`node:test`, `node:vm`, no npm dependencies), n8n 2.43.7 in Docker, and the nodes Google Sheets 4.5, Google Calendar 1.3, Gmail 2.1, Switch 3.2, If 2.2, Set 3.4, Split Out 1, Code 2, No-Op 1, Sticky Note 1.

**Spec:** `docs/superpowers/specs/2026-10-26-stayflow-track-c-design.md`

## Global Constraints

- The organizer nodes are copied **byte-identical** (name, type, typeVersion, parameters) from `fixtures/organizer-starter-template.json`: `When clicking ‘Execute workflow’` (manualTrigger) and `Guest Request Submissions` (httpRequest 4.5, `url: https://khylepanganiban.app.n8n.cloud/webhook/GuestRequest`).
- There are no AI or LLM nodes and no npm dependencies.
- Hotel times are local with offset `+08:00`. Every calendar time is an ISO string shaped like `2026-11-02T09:30:00+08:00`.
- Statuses: `CONFIRMED`, `ALTERNATIVE_OFFERED`, `MANUAL_REVIEW`, `INVALID`, `DUPLICATE`. `calendar_status` ∈ `PENDING|CREATED|FAILED|NOT_NEEDED`; `email_status` ∈ `PENDING|SENT|FAILED|SKIPPED`.
- `GuestRequests` columns, in order: `request_id, received_at, confirmation_number, guest_name, guest_email, request_type, category, priority, check_in_date, check_out_date, room_type, request_details, requested_time, status, decision_code, decision_reason, staff_action, calendar_status, calendar_event_id, email_status, email_recipient, email_sent_at, processed_at, last_updated_at`.
- Spreadsheet ID `18wno6DELat3xTkZs62UcYKlw_iRo9W2DtaCTZP2iyvk`. Tabs: `RequestCatalog`, `HotelPolicies`, `RoomInventory`, `GuestRequests`.
- Local credential IDs and names come from `config/local.json`.
- **`src/` file rule:** only top-level `function` declarations and `var` constants. No `const`/`let` at top level (they don't become `vm` context globals), no `import`/`require`/`module.exports`, and no n8n globals (`$input`, `$`, `$json`).
- All guest-supplied text is HTML-escaped before it goes into email HTML.

## Review Focus

- Request labels with different case, spacing or `&`/`and` (`"early check in"`, `"LATE CHECK-OUT"`, `"Laundry and Dry Cleaning"`) should still classify. Pinned in Task 2.
- Free-text times like `10 AM`, `4pm`, `12 PM` and `12:15 AM` should parse to `10:00`, `16:00`, `12:00` and `00:15`. Pinned in Task 1.
- Guest details containing `<script>` or `&` should appear escaped in the email, never as markup. Pinned in Task 4.
- If a staff member blanks a policy cell (e.g. `earliest_early_checkin`), the request goes to `MANUAL_REVIEW` with `POLICY_NOT_CONFIGURED`; nothing crashes and nothing is approved. Pinned in Task 3.
- An empty request log (Sheets returns one `{}` item because of "Always Output Data") and numeric strings from Sheets (`"3"`) should be handled as no rows and as numbers. Pinned in Task 2.

---

## File Structure

```
package.json                     scripts: test, build
scripts/lib/modules.mjs          concatModules(names) / loadModules(names): the one place src/ is stitched
scripts/build-workflow.mjs       emits dist/stayflow-<env>.json
src/time.js                      HH:MM math, local ISO formatting, night ranges
src/text.js                      free-text extraction + HTML escape + label normalization
src/reference.js                 policies / catalog / inventory from sheet rows
src/intake.js                    FIELD_MAP, normalizeSubmission, validateRequest, classifyBatch
src/rules.js                     FIXED_DECISIONS, decideBatch (per-category rules + ledgers)
src/plan.js                      planActions: calendar + email + log fields
src/email.js                     renderEmail: subject + HTML
src/inventory.js                 collectInventoryChanges
src/glue/*.js                    n8n-only Code node bodies (use $input / $())
config/local.json, config/cloud.json
test/helpers/sheets.mjs          CSV → row objects (reads sheets/*.csv)
test/helpers/pipeline.mjs        runPipeline(): mirrors the workflow in Node
test/*.test.mjs                  one file per src module + golden + build
fixtures/expected-decisions.json golden outcomes (§8 of the spec)
fixtures/edge-cases.json         synthetic submissions for robustness tests
```

---

### Task 1: Scaffold, module loader, time and text helpers

**Files:**
- Create: `package.json`, `scripts/lib/modules.mjs`, `src/time.js`, `src/text.js`
- Test: `test/time.test.mjs`, `test/text.test.mjs`

**Interfaces:**
- Produces:
  - `modules.mjs`: `concatModules(names: string[]) => string` reads `src/<name>.js` in order, joined by `\n`. `loadModules(names: string[]) => object` runs that string in a fresh `vm` context and returns the context.
  - `time.js`: `toMinutes(hhmm: string) => number|null`, `fromMinutes(m: number) => "HH:MM"`, `localIso(date: "YYYY-MM-DD", hhmm: string, offset="+08:00") => string`, `addMinutesIso(iso: string, minutes: number) => string` (keeps the original offset), `nowPlusHoursIso(now: Date, hours: number, offset="+08:00") => string` (seconds set to `00`), `stayNights(checkIn, checkOut) => string[]`, `isIsoDate(s) => boolean`.
  - `text.js`: `parseTimes(text) => string[]` ("HH:MM", in order), `lastTime(text) => string|null`, `parseTextDate(text, year: number) => "YYYY-MM-DD"|null`, `parseWeightLbs(text) => number|null`, `findLinkedBookings(text, own: string) => string[]`, `findTargetRoomType(text, roomTypes: string[], current: string) => string|null`, `escapeHtml(s) => string`, `normalizeLabel(s) => string`.

- [ ] **Step 1: Create `package.json`.** Set `"type": "module"` and `"private": true`, with scripts `"test": "node --test"` and `"build": "node scripts/build-workflow.mjs"`.

- [ ] **Step 2: Write failing tests** in `test/time.test.mjs` and `test/text.test.mjs`. Both load modules with `loadModules(['time','text'])`.

```js
// time
assert.equal(toMinutes('10:30'), 630); assert.equal(toMinutes('bad'), null);
assert.equal(fromMinutes(570), '09:30');
assert.equal(localIso('2026-11-02', '09:30'), '2026-11-02T09:30:00+08:00');
assert.equal(addMinutesIso('2026-11-02T09:30:00+08:00', 60), '2026-11-02T10:30:00+08:00');
assert.equal(addMinutesIso('2026-11-02T23:30:00+08:00', 60), '2026-11-03T00:30:00+08:00');
assert.equal(nowPlusHoursIso(new Date('2026-10-26T12:00:00Z'), 2), '2026-10-26T22:00:00+08:00');
assert.deepEqual(stayNights('2026-11-03', '2026-11-05'), ['2026-11-03', '2026-11-04']);
assert.equal(isIsoDate('2026-02-30'), false); assert.equal(isIsoDate('2026-11-02'), true);
// text
assert.deepEqual(parseTimes('Landing at 9:00 AM, check-in around 10:30 AM'), ['09:00', '10:30']);
assert.equal(lastTime('extend from 11:00 AM to 4:00 PM'), '16:00');
assert.deepEqual(parseTimes('10 AM, 4pm, 12 PM, 12:15 AM'), ['10:00', '16:00', '12:00', '00:15']);
assert.equal(lastTime('no times here'), null);
assert.equal(parseTextDate('Arriving at NAIA Terminal 3 at 2:30 PM on Nov 1.', 2026), '2026-11-01');
assert.equal(parseTextDate('dinner on Nov 8th at 8:00 PM', 2026), '2026-11-08');
assert.equal(parseTextDate('on November 6th', 2026), '2026-11-06');
assert.equal(parseWeightLbs('a 15-pound trained therapy dog'), 15);
assert.equal(parseWeightLbs('a 10 kg dog'), 22.05);   // round to 2 decimals
assert.deepEqual(findLinkedBookings('under HTL-11923 and HTL-11924', 'HTL-11923'), ['HTL-11924']);
assert.equal(findTargetRoomType('upgrade to an Ocean View Suite', ['Standard Queen','Ocean View Suite','Penthouse Suite'], 'Standard Queen'), 'Ocean View Suite');
assert.equal(escapeHtml('<b>"Tom" & \'Jo\'</b>'), '&lt;b&gt;&quot;Tom&quot; &amp; &#39;Jo&#39;&lt;/b&gt;');
assert.equal(normalizeLabel('  Laundry & Dry-Cleaning '), 'laundry and dry cleaning');
```

- [ ] **Step 3: Run `npm test`.** Expected: FAIL, because `src/time.js` doesn't exist yet.

- [ ] **Step 4: Implement `scripts/lib/modules.mjs`, `src/time.js` and `src/text.js`** with the signatures above.
  - Time regex: `/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/gi` (12 AM → 00, 12 PM → 12).
  - Date regex: month name or 3-letter abbreviation, then the day with an optional ordinal suffix.
  - Weight regex: `/(\d+(?:\.\d+)?)\s*-?\s*(lbs?|pounds?|kg)\b/i`.
  - `normalizeLabel`: lowercase, `&` → ` and `, every non-alphanumeric run → one space, trim.
  - `findTargetRoomType` matches case-insensitively and picks the longest name that differs from `current`.
  - `addMinutesIso` does its arithmetic in UTC, then re-applies the offset string.

- [ ] **Step 5: Run `npm test`.** Expected: all time and text tests PASS.

- [ ] **Step 6: Commit** with `git add package.json scripts src test && git commit -m "feat: add module loader and time/text helpers"`.

---

### Task 2: Reference data and intake (normalize, validate, classify, dedupe)

**Files:**
- Create: `src/reference.js`, `src/intake.js`, `test/helpers/sheets.mjs`, `fixtures/edge-cases.json`
- Test: `test/reference.test.mjs`, `test/intake.test.mjs`

**Interfaces:**
- Consumes: Task 1 helpers (`normalizeLabel`, `isIsoDate`, `parseTimes`).
- Produces:
  - `sheets.mjs`: `readSheet(tab: string) => object[]` parses `sheets/<tab>.csv`, handling quoted fields; every value stays a string.
  - `reference.js`:
    - `buildPolicies(rows) => object` maps `policy_key` → trimmed string value and skips rows without a key.
    - `policyTime(p, key) => "HH:MM"|null`, `policyNumber(p, key) => number|null` and `policyBool(p, key) => boolean|null` return null when the value is blank or unparseable.
    - `buildCatalog(rows) => Map<normalizedLabel, {category, base_priority, schedule_from_text: boolean}>`.
    - `buildInventory(rows) => Map<inventory_key, {date, room_type, total_rooms, reserved_rooms, blocked_rooms, active_holds, early_ready_rooms}>` with numbers coerced through `Number()`.
    - `available(row) => number`, computed as `max(0, total − reserved − blocked − holds)`.
    - `inventoryRoomTypes(inv) => string[]`.
    - `buildLogIndex(rows) => {byRequestId: Map<id,row>, rows: row[]}`, ignoring rows without `request_id`.
  - `intake.js`:
    - `var FIELD_MAP` is an array of `[outputField, sourcePath]` pairs: `request_id←request_id`, `received_at←timestamp`, `confirmation_number←booking.confirmation_number`, `guest_name←booking.guest_name`, `guest_email←booking.email`, `check_in_date←booking.check_in_date`, `check_out_date←booking.check_out_date`, `room_type←booking.room_type`, `request_type←booking.request_type`, `request_details←booking.request_details`.
    - `normalizeSubmission(sub) => object` produces trimmed strings, with missing values becoming `''`.
    - `validateRequest(req) => string[]` returns error messages, exactly these strings: `missing request_id`, `missing confirmation_number`, `missing guest_name`, `invalid email`, `invalid check_in_date`, `invalid check_out_date`, `check_out_date must be after check_in_date`.
    - `classifyBatch(requests, {catalog, policies, log}) => object[]` returns each request plus `{route, category, priority, base_priority, schedule_from_text, validation_errors, duplicate_of, email_valid}`.

`classifyBatch` applies spec §5.1 in order:
1. **Already processed:** the `request_id` is in `log.byRequestId`, so `route = 'already_processed'`.
2. **Invalid:** `validation_errors` is non-empty, so `route = 'invalid'`. A missing `request_id` becomes `NOID-<confirmation_number|UNKNOWN>-<received_at|index>`.
3. **Classify:** `category` comes from the catalog, or `'other'` if the label isn't found.
4. **Priority:** `HIGH` if `base_priority` is HIGH or the lowercased details contain any comma-separated `high_priority_keywords`; otherwise `NORMAL`.
5. **Duplicate:** the same `confirmation_number|category` as a log row with a different `request_id` whose status isn't `INVALID`/`DUPLICATE`, or as an earlier non-invalid request in this batch, gives `route = 'duplicate'` and `duplicate_of = <that request_id>`.
6. Otherwise `route = category`.

- [ ] **Step 1: Write `fixtures/edge-cases.json`.** It's an array of raw submissions in the organizer's shape: an invalid email `not-an-email`; check-out equal to check-in; an empty `guest_name`; request type `Spa Booking` (unknown); two submissions with the same confirmation number and `Early Check-In` but different request IDs; label `early check in` in lowercase; and details containing `<script>alert(1)</script> & co`.

- [ ] **Step 2: Write failing tests.**

```js
// reference
const p = buildPolicies(readSheet('HotelPolicies'));
assert.equal(policyTime(p, 'standard_checkin_time'), '14:00');
assert.equal(policyNumber(p, 'upgrade_hold_hours'), 24);
assert.equal(policyBool(p, 'pets_allowed'), true);
assert.equal(policyTime({ earliest_early_checkin: '' }, 'earliest_early_checkin'), null);
const inv = buildInventory(readSheet('RoomInventory'));
assert.equal(available(inv.get('2026-11-08|Penthouse Suite')), 1);
assert.equal(available({ total_rooms: '3', reserved_rooms: '5', blocked_rooms: 0, active_holds: 0 }), 0);
assert.equal(buildLogIndex([{}]).rows.length, 0);              // alwaysOutputData empty item
// intake (organizer payload)
const reqs = payload.submissions.map(normalizeSubmission);
assert.equal(reqs[0].confirmation_number, 'HTL-88219');
const out = classifyBatch(reqs, ctx);                          // ctx from sheets CSVs + empty log
assert.deepEqual(countBy(out, 'route'), { early_checkin: 2, room_upgrade: 1, special_care: 3, service_request: 8, late_checkout: 2, room_preference: 3, pet_stay: 1 });
assert.equal(out.find(r => r.request_id === 'REQ-2026-103').priority, 'HIGH');
assert.equal(out.find(r => r.request_id === 'REQ-2026-115').priority, 'HIGH');   // "Urgent"
assert.equal(out.find(r => r.request_id === 'REQ-2026-117').priority, 'NORMAL');
// re-run: every id already logged
const logged = classifyBatch(reqs, { ...ctx, log: buildLogIndex(reqs.map(r => ({ request_id: r.request_id, status: 'CONFIRMED' }))) });
assert.ok(logged.every(r => r.route === 'already_processed'));
// edge cases
assert.deepEqual(validateRequest({ ...good, guest_email: 'not-an-email' }), ['invalid email']);
assert.deepEqual(validateRequest({ ...good, check_out_date: good.check_in_date }), ['check_out_date must be after check_in_date']);
// edge-case batch: unknown → 'other'; lowercase label → 'early_checkin'; second same-booking early check-in → 'duplicate' with duplicate_of = first id
// logged duplicate: log row {request_id:'REQ-OLD', confirmation_number:'HTL-88219', category:'early_checkin', status:'CONFIRMED'} makes REQ-2026-101 route 'duplicate', duplicate_of 'REQ-OLD'
```

- [ ] **Step 3: Run `npm test`.** Expected: the new tests FAIL.
- [ ] **Step 4: Implement `test/helpers/sheets.mjs`, `src/reference.js` and `src/intake.js`.**
- [ ] **Step 5: Run `npm test`.** Expected: PASS.
- [ ] **Step 6: Commit** with `git commit -m "feat: add reference data builders and intake classification"`, after `git add` on the new files.

---

### Task 3: Category rules

**Files:**
- Create: `src/rules.js`
- Test: `test/rules.test.mjs`

**Interfaces:**
- Consumes: Task 1 and Task 2 functions. `ctx = {policies, inventory, catalog, now: Date}`.
- Produces:
  - `var FIXED_DECISIONS` gives `{status, decision_code, staff_action}` for three routes:
    - `invalid` → `INVALID`, `INVALID_REQUEST`, "Ask guest for corrected details"
    - `duplicate` → `DUPLICATE`, `DUPLICATE_REQUEST`, "None: already handled under original request"
    - `other` → `MANUAL_REVIEW`, `UNRECOGNIZED_REQUEST_TYPE`, "Review request manually"
  - `fixedDecisionReason(route, item) => string`:
    - invalid: `validation_errors.join('; ')`
    - duplicate: `'Same booking and request type as ' + duplicate_of`
    - other: `'Request type "' + request_type + '" is not in the request catalog'`
  - `decideBatch(route, items, ctx) => object[]` returns each item plus `{status, decision_code, decision_reason, staff_action, requested_time, target_room_type, pet_weight_lbs, inventory_changes: [{inventory_key, field: 'early_ready_rooms'|'active_holds', delta}]}`. Fields that don't apply are `''` or `[]`. Routes `invalid`, `duplicate` and `other` use `FIXED_DECISIONS`.

Codes and statuses are exactly those in spec §5.3. Each category checks its required policies first. If any is `null`, the result is `MANUAL_REVIEW` / `POLICY_NOT_CONFIGURED`:
- early_checkin: `early_checkin_enabled`, `standard_checkin_time`, `earliest_early_checkin`
- late_checkout: `late_checkout_enabled`, `standard_checkout_time`, `latest_late_checkout`
- room_upgrade: `upgrades_enabled`, `upgrade_hold_hours`
- service_request: `services_enabled`
- pet_stay: `pets_allowed`, `pet_max_weight_lbs`, `pet_fee_per_night`

The remaining codes, which spec §5.3 implies without naming:

| Code | Status |
|---|---|
| `EARLY_CHECKIN_DISABLED` | ALTERNATIVE_OFFERED |
| `LATE_CHECKOUT_DISABLED` | ALTERNATIVE_OFFERED |
| `LATE_CHECKOUT_TOO_LATE` | ALTERNATIVE_OFFERED |
| `UPGRADES_DISABLED` | ALTERNATIVE_OFFERED |
| `PETS_NOT_ALLOWED` | ALTERNATIVE_OFFERED |
| `PET_OVER_LIMIT` | ALTERNATIVE_OFFERED |
| `TIME_NOT_FOUND` | MANUAL_REVIEW |
| `INVENTORY_NOT_FOUND` | MANUAL_REVIEW |
| `TARGET_ROOM_NOT_FOUND` | MANUAL_REVIEW |
| `PET_WEIGHT_NOT_FOUND` | MANUAL_REVIEW |
| `SERVICES_DISABLED` | MANUAL_REVIEW |

**Ledgers:** within one `decideBatch` call, early check-in subtracts already-allocated ready rooms per `inventory_key`, and upgrade adds batch holds to `active_holds` before checking `available`.

- [ ] **Step 1: Write failing tests.** Use the organizer payload plus the CSV sheets, with `now = new Date('2026-10-26T12:00:00Z')`.

```js
const d = id => byId(decided, id);
assert.equal(d('REQ-2026-101').decision_code, 'EARLY_CHECKIN_CONFIRMED');
assert.deepEqual(d('REQ-2026-101').inventory_changes, [{ inventory_key: '2026-11-02|Deluxe King Suite', field: 'early_ready_rooms', delta: -1 }]);
assert.equal(d('REQ-2026-101').requested_time, '10:30');
assert.equal(d('REQ-2026-115').decision_code, 'NO_READY_ROOM');
assert.equal(d('REQ-2026-102').decision_code, 'UPGRADE_UNAVAILABLE');
assert.deepEqual(d('REQ-2026-102').inventory_changes, []);
assert.equal(d('REQ-2026-105').decision_code, 'LATE_CHECKOUT_CONFIRMED');
assert.equal(d('REQ-2026-120').decision_code, 'LATE_CHECKOUT_UNAVAILABLE');
assert.equal(d('REQ-2026-109').decision_code, 'PET_STAY_CONFIRMED');
assert.equal(d('REQ-2026-111').decision_code, 'LINKED_BOOKING_CHECK');
assert.equal(d('REQ-2026-108').decision_code, 'PREFERENCE_NOTED');
assert.equal(d('REQ-2026-106').status, 'MANUAL_REVIEW');
// ledger: two early check-ins, same date/type, 1 ready room → first CONFIRMED, second NO_READY_ROOM
// upgrade available: seed a row with available 2 → UPGRADE_HELD_AWAITING_APPROVAL, status ALTERNATIVE_OFFERED, one +1 active_holds change per night
// policy blanked: policies.earliest_early_checkin = '' → REQ-2026-101 is MANUAL_REVIEW / POLICY_NOT_CONFIGURED
// missing inventory row: delete '2026-11-08|Penthouse Suite' → REQ-2026-105 INVENTORY_NOT_FOUND
// pet over limit: details '60-pound dog' → PET_OVER_LIMIT; no weight → PET_WEIGHT_NOT_FOUND
// time ≥ standard: details 'arrive 3:00 PM' → CONFIRMED / STANDARD_CHECKIN_APPLIES, no inventory change
```

- [ ] **Step 2: Run `npm test`.** Expected: FAIL.
- [ ] **Step 3: Implement `src/rules.js`.** Write `decision_reason` and `staff_action` as one plain sentence each, naming the concrete fact, e.g. "Ocean View Suite has no availability on 2026-11-03".
- [ ] **Step 4: Run `npm test`.** Expected: PASS.
- [ ] **Step 5: Commit** with `git commit -m "feat: add category decision rules with in-batch ledgers"`.

---

### Task 4: Action planning: calendar, email and log fields

**Files:**
- Create: `src/plan.js`, `src/email.js`
- Test: `test/plan.test.mjs`, `test/email.test.mjs`

**Interfaces:**
- Consumes: decided items from Task 3, plus `ctx` (with `catalog` for `schedule_from_text`).
- Produces:
  - `planActions(item, ctx) => object` returns the item plus every `GuestRequests` column (any missing value set to `''`) and `{calendar_needed: boolean, calendar_summary, calendar_start, calendar_end, calendar_description, email_needed: boolean, email_template: 'confirmed'|'alternative'|'review'|'needs_info'|'', email_to, email_subject, email_html, sender_name}`. It sets `calendar_status` to `PENDING` or `NOT_NEEDED`, `email_status` to `PENDING` or `SKIPPED`, `email_recipient = email_to`, and `processed_at = last_updated_at = ctx.now.toISOString()`.
  - `renderEmail(item, policies) => {subject, html}`.

Rules:
- Calendar follows spec §5.4 exactly:
  - 30-minute events.
  - `EARLY_CHECKIN_CONFIRMED`: start = requested time − 60 min, end = requested time.
  - `schedule_from_text` services: start at the parsed date and time, 60 minutes.
  - Alternative codes not listed in §5.4: no event.
  - The summary is prefixed with `[HIGH] ` when priority is HIGH and ends with ` — <request_id> (<confirmation_number>)`.
- Email template by status: `CONFIRMED` → `confirmed`, `ALTERNATIVE_OFFERED` → `alternative`, `MANUAL_REVIEW` → `review`, `INVALID` with `email_valid` → `needs_info`. Anything else gets no email.
- Recipient: `demo_recipient_override` if set, otherwise `guest_email`.
- Subjects are exactly as in spec §5.5.
- The HTML follows spec §5.5:
  - navy `#1F3864` header
  - status pill colours: confirmed `#2E7D32`, alternative `#B26A00`, review `#1565C0`, needs_info `#616161`
  - inline styles only, table layout
  - footer shows the original recipient when the override is in use
  - a decision sentence for each code that names the concrete fact: time, room type, fee or reason

- [ ] **Step 1: Write failing tests.**

```js
const plan = id => planActions(byId(decided, id), ctx);
assert.equal(plan('REQ-2026-101').calendar_start, '2026-11-02T09:30:00+08:00');
assert.equal(plan('REQ-2026-101').calendar_end, '2026-11-02T10:30:00+08:00');
assert.equal(plan('REQ-2026-110').calendar_start, '2026-11-01T14:30:00+08:00');
assert.equal(plan('REQ-2026-110').calendar_end, '2026-11-01T15:30:00+08:00');
assert.equal(plan('REQ-2026-103').calendar_start, '2026-10-26T22:00:00+08:00');
assert.ok(plan('REQ-2026-103').calendar_summary.startsWith('[HIGH] '));
assert.ok(plan('REQ-2026-103').calendar_summary.endsWith(' — REQ-2026-103 (HTL-90312)'));
assert.equal(plan('REQ-2026-111').calendar_start, '2026-10-27T20:00:00+08:00');
assert.equal(plan('REQ-2026-102').email_template, 'alternative');
assert.equal(plan('REQ-2026-102').email_subject, 'Harborlight Hotel | An option for your request — REQ-2026-102');
assert.equal(plan('REQ-2026-101').email_to, 'eleanor.vance@example.com');        // override blank
assert.equal(planActions(item101, ctxWithOverride('team@example.com')).email_to, 'team@example.com');
assert.match(planActions(item101, ctxWithOverride('team@example.com')).email_html, /eleanor\.vance@example\.com/);
// duplicate → calendar_needed false, email_needed false, statuses NOT_NEEDED / SKIPPED
// invalid with valid email → needs_info; invalid with 'not-an-email' → email_needed false
// escaping: details '<script>alert(1)</script> & co' → html contains '&lt;script&gt;' and not '<script>'
// every GuestRequests column is a key of the planned item
```

- [ ] **Step 2: Run `npm test`.** Expected: FAIL.
- [ ] **Step 3: Implement `src/email.js`, then `src/plan.js`.**
- [ ] **Step 4: Run `npm test`.** Expected: PASS.
- [ ] **Step 5: Render all 20 emails to `dist/email-preview/<request_id>.html`** with a throwaway script, open three of them (101, 102, 103) in a browser, and confirm they look right. Delete the throwaway script afterwards.
- [ ] **Step 6: Commit** with `git commit -m "feat: add calendar and email action planning"`.

---

### Task 5: Inventory changes and golden pipeline test

**Files:**
- Create: `src/inventory.js`, `test/helpers/pipeline.mjs`, `fixtures/expected-decisions.json`
- Test: `test/inventory.test.mjs`, `test/golden.test.mjs`

**Interfaces:**
- Consumes: everything above.
- Produces:
  - `collectInventoryChanges(items, inventory) => [{inventory_key, early_ready_rooms}|{inventory_key, active_holds}]`. It sums the deltas per key and field and returns one object per key and field, holding the **new absolute value** from the read inventory plus the summed delta. Each object carries only the field that changed.
  - `runPipeline({submissions, sheets: {catalog, policies, inventory, log}, now}) => {planned: object[], alreadyProcessed: object[], inventoryWrites: object[]}` mirrors the workflow: normalize → classify → split off `already_processed` → `decideBatch` per route → `planActions` → `collectInventoryChanges` over the early_checkin and room_upgrade outputs.

- [ ] **Step 1: Write `fixtures/expected-decisions.json`** from spec §8. Use one object per request with `request_id`, `category`, `status`, `decision_code`, `priority`, `calendar_start` (null where there's no event) and `email_template`. Priorities are HIGH for 103, 106 and 115, NORMAL for the rest. Calendar starts use `now = 2026-10-26T12:00:00Z`:

| Request | calendar_start |
|---|---|
| 101 | 2026-11-02T09:30:00+08:00 |
| 102 | 2026-11-03T09:00:00+08:00 |
| 103 | 2026-10-26T22:00:00+08:00 |
| 104 | 2026-11-07T09:00:00+08:00 |
| 105 | 2026-11-08T11:00:00+08:00 |
| 106 | 2026-10-26T22:00:00+08:00 |
| 107 | 2026-11-05T09:00:00+08:00 |
| 108 | 2026-11-03T09:00:00+08:00 |
| 109 | 2026-11-06T09:00:00+08:00 |
| 110 | 2026-11-01T14:30:00+08:00 |
| 111 | 2026-10-27T20:00:00+08:00 |
| 112 | 2026-11-02T09:00:00+08:00 |
| 113 | 2026-11-05T09:00:00+08:00 |
| 114 | 2026-11-03T09:00:00+08:00 |
| 115 | 2026-11-04T11:30:00+08:00 |
| 116 | 2026-11-09T09:00:00+08:00 |
| 117 | 2026-10-27T20:00:00+08:00 |
| 118 | 2026-11-08T20:00:00+08:00 |
| 119 | 2026-11-01T09:00:00+08:00 |
| 120 | 2026-11-15T11:00:00+08:00 |

- [ ] **Step 2: Write failing tests.**

```js
const r = runPipeline({ submissions, sheets, now });
for (const exp of expected) assert.deepEqual(pick(byId(r.planned, exp.request_id), Object.keys(exp)), exp);
assert.deepEqual(countBy(r.planned, 'status'), { CONFIRMED: 13, ALTERNATIVE_OFFERED: 3, MANUAL_REVIEW: 4 });
assert.deepEqual(r.inventoryWrites, [{ inventory_key: '2026-11-02|Deluxe King Suite', early_ready_rooms: 0 }]);
// second run with log = first run's planned rows → planned.length 0, alreadyProcessed.length 20, inventoryWrites []
// edge-case fixture run: no throw; every planned item has a status from the five allowed values
```

- [ ] **Step 3: Run `npm test`.** Expected: FAIL.
- [ ] **Step 4: Implement `src/inventory.js` and `test/helpers/pipeline.mjs`.**
- [ ] **Step 5: Run `npm test`.** Expected: all suites PASS. If a golden row disagrees, fix the code, not the fixture, unless the fixture contradicts spec §8.
- [ ] **Step 6: Commit** with `git commit -m "test: add golden pipeline test for organizer payload"`.

---

### Task 6: Workflow builder

**Files:**
- Create: `scripts/build-workflow.mjs`, `src/glue/classify.js`, `src/glue/rules.js`, `src/glue/plan.js`, `src/glue/inventory.js`, `config/cloud.json`
- Modify: `config/local.json`, which gains `"workflowId": "stayflowTrackC01"`
- Test: `test/build.test.mjs`

**Interfaces:**
- Consumes: `concatModules`, `FIELD_MAP`, `FIXED_DECISIONS`. The script reads the latter two with `loadModules`.
- Produces: `buildWorkflow(env: 'local'|'cloud') => object`, exported, plus a CLI that writes `dist/stayflow-<env>.json`. The cloud config has the same spreadsheet and calendar, `credentials` entries with `name` only (no `id`), and no `workflowId`.

Nodes, named exactly. Code nodes are `runOnceForAllItems` unless marked "each".

| Node | Type / key settings |
|---|---|
| `When clicking ‘Execute workflow’`, `Guest Request Submissions` | copied from the fixture |
| `Split Out Submissions` | splitOut, `fieldToSplitOut: submissions` |
| `Normalize Fields` | set 3.4, one string assignment per `FIELD_MAP` entry: `={{ String($json.<path> ?? '').trim() }}`, `includeOtherFields: false` |
| `Read Request Catalog`, `Read Hotel Policies`, `Read Room Inventory`, `Read Request Log` | googleSheets 4.5 read, `documentId {mode:'id'}`, `sheetName {mode:'name'}`, `executeOnce: true`; the log read also has `alwaysOutputData: true` |
| `Classify, Validate & Dedupe` | code: modules `time,text,reference,intake` + `glue/classify.js` (reads `$('Normalize Fields').all()` and the four reads) |
| `New Request?` | if 2.2: `$json.route` not-equals `already_processed`; false → `Already Processed: No Action` (noOp) |
| `Route by Category` | switch 3.2 rules on `$json.route`, outputs renamed in this order: `invalid, duplicate, early_checkin, late_checkout, room_upgrade, room_preference, service_request, pet_stay, special_care`, fallback output renamed `other` |
| `Decision: Invalid`, `Decision: Duplicate`, `Decision: Manual Review` | set 3.4, `includeOtherFields: true`; status, decision_code and staff_action from `FIXED_DECISIONS[route]`; `decision_reason` expression matching `fixedDecisionReason` |
| `Rules: Early Check-In`, `Rules: Late Check-Out`, `Rules: Room Upgrade`, `Rules: Room Preference`, `Rules: Service Request`, `Rules: Pet Stay`, `Rules: Special Care` | code: modules `time,text,reference,rules` + `glue/rules.js` with `__ROUTE__` replaced |
| `Plan Staff Task & Email` | code: modules `time,text,reference,plan,email` + `glue/plan.js`; all 10 decision nodes connect here |
| `Log Request` | googleSheets 4.5 appendOrUpdate on `GuestRequests`, `columns.mappingMode: autoMapInputData`, `matchingColumns: ['request_id']`, schema = the 24 columns, options `cellFormat: RAW`, `handlingExtraData: ignoreIt` |
| `Carry Plan Forward` | code (each): `return { json: $('Plan Staff Task & Email').item.json };` |
| `Needs Staff Task?` | if 2.2 on `$json.calendar_needed` is true |
| `Create Staff Task` | googleCalendar 1.3 event create, calendar `{mode:'id', value: config.calendarId}`, start/end from `$json.calendar_start/end`, additionalFields `summary`, `description`; `onError: continueErrorOutput` |
| `Calendar Created` / `Calendar Failed` | code (each): `{...$('Needs Staff Task?').item.json, calendar_status: 'CREATED'|'FAILED', calendar_event_id: $json.id ?? ''}` |
| `Send Guest Email?` | if 2.2 on `$json.email_needed` is true; inputs: Calendar Created, Calendar Failed, `Needs Staff Task?` false |
| `Send Guest Email` | gmail 2.1 message send, `sendTo/subject/message` from `email_to/email_subject/email_html`, `emailType: html`, options `appendAttribution: false`, `senderName: ={{ $json.sender_name }}`; `onError: continueErrorOutput` |
| `Email Sent` / `Email Failed` | code (each): `{...$('Send Guest Email?').item.json, email_status: 'SENT'|'FAILED', email_sent_at: <ISO now or ''>, last_updated_at: <ISO now>}` |
| `Update Request Log` | same settings as `Log Request`; inputs: Email Sent, Email Failed, `Send Guest Email?` false |
| `Collect Inventory Changes` | code: modules `reference,inventory` + `glue/inventory.js`; inputs: Rules: Early Check-In, Rules: Room Upgrade |
| `Update Room Inventory` | googleSheets 4.5 update on `RoomInventory`, autoMap, `matchingColumns: ['inventory_key']`, schema = the 8 inventory columns (no `available_rooms`), `handlingExtraData: ignoreIt` |
| Sticky notes | `Intake`, `Reference data`, `Rules`, `Actions`, `Audit`, each a one-line description, drawn behind its node group |

Other build settings:
- **Credentials:** each Google node gets `credentials: { <type>: config.credentials[<type>] }`.
- **Workflow settings:** `{ executionOrder: 'v1', timezone: 'Asia/Manila', saveManualExecutions: true }`.
- **Name:** `StayFlow | Track C | Guest Request Automation`.
- **Layout:** left-to-right columns 240 px apart, with branches stacked 140 px apart. No two nodes overlap.

- [ ] **Step 1: Write failing tests.**

```js
const wf = buildWorkflow('local');
const node = n => wf.nodes.find(x => x.name === n);
const starter = JSON.parse(readFileSync('fixtures/organizer-starter-template.json'));
for (const s of starter.nodes) assert.deepEqual(pick(node(s.name), ['type','typeVersion','parameters']), pick(s, ['type','typeVersion','parameters']));
for (const t of ['n8n-nodes-base.httpRequest','n8n-nodes-base.switch','n8n-nodes-base.code','n8n-nodes-base.set','n8n-nodes-base.googleSheets','n8n-nodes-base.googleCalendar','n8n-nodes-base.gmail'])
  assert.ok(wf.nodes.some(n => n.type === t), t);
assert.equal(wf.connections['Route by Category'].main.length, 10);
assert.equal(node('Create Staff Task').onError, 'continueErrorOutput');
assert.equal(node('Read Request Log').alwaysOutputData, true);
assert.equal(node('Create Staff Task').credentials.googleCalendarOAuth2Api.id, '0CSUjXdiJ80r648M');
assert.equal(buildWorkflow('cloud').nodes.find(n => n.name === 'Send Guest Email').credentials.gmailOAuth2.id, undefined);
// every connection target names an existing node; every non-sticky node except the trigger has an incoming connection
// every Code node's jsCode parses: new Function(jsCode) does not throw (wrap in an async function body)
```

- [ ] **Step 2: Run `npm test`.** Expected: FAIL.
- [ ] **Step 3: Implement the glue files, `config/cloud.json` and `scripts/build-workflow.mjs`.** Each glue file builds `ctx` from the read nodes with `$('Read …').all().map(i => i.json)` and `now = new Date()`, calls the pure function, and returns `items.map(json => ({ json }))`.
- [ ] **Step 4: Run `npm test && npm run build -- local && npm run build -- cloud`.** Expected: PASS, and both files are in `dist/`.
- [ ] **Step 5: Commit** with `git commit -m "feat: generate n8n workflow JSON from src modules"`, adding `scripts src config test`. `dist/` is ignored: add it to `.gitignore` in this step.

---

### Task 7: Local deployment and live verification

**Files:**
- Modify: Google Sheet `HotelPolicies!B21` (`demo_recipient_override`), set to the inbox the user chooses.
- Create: `docs/runbook.md`, holding the import, run, reset and cloud-paste steps exactly as executed below.

- [ ] **Step 1: Import.** Run `docker cp dist/stayflow-local.json n8n:/tmp/stayflow.json && docker exec n8n n8n import:workflow --input=/tmp/stayflow.json`. Expected: "Successfully imported 1 workflow". Confirm with MCP `get_workflow_details` (id `stayflowTrackC01`): 36 functional nodes plus 5 sticky notes, no credential warnings.
- [ ] **Step 2: First run.** MCP `execute_workflow` (manual), then `get_workflow_execution` with `includeData`. Expected: status `success`, `Plan Staff Task & Email` total items 20, and `Already Processed: No Action` with 0 items.
- [ ] **Step 3: Check the side effects.**
  - `GuestRequests` has 20 rows with 13/3/4 statuses, `calendar_status` CREATED on 20 rows (every request in §8 has an event), and `email_status` SENT on 20 rows.
  - `RoomInventory!H2` (`early_ready_rooms` for 2026-11-02 Deluxe King Suite) is `0`.
  - Calendar has an event "Prepare early check-in — REQ-2026-101 (HTL-88219)" on 2026-11-02 at 09:30.
  - The demo inbox has 20 emails; open 101, 102 and 103.
- [ ] **Step 4: Re-run.** Expected:
  - `Already Processed: No Action` gets 20 items.
  - `Plan Staff Task & Email` doesn't execute.
  - The row count stays 20, no new calendar events or emails, and `RoomInventory!H2` stays `0`.
- [ ] **Step 5: Failure path.** Temporarily set the `Create Staff Task` calendar ID to `invalid-calendar-id` through MCP `update_workflow`. Clear the `GuestRequests` rows and restore `RoomInventory!H2` to `1`, then run. Expected: `calendar_status` FAILED on the rows, `email_status` SENT, and the execution succeeds. Restore the calendar ID afterwards.
- [ ] **Step 6: Reset for the demo.** Clear `GuestRequests` rows 2+, set `RoomInventory!H2` to `1`, and delete the test calendar events with the Google Calendar MCP (only the events whose titles contain `REQ-2026-`).
- [ ] **Step 7: Write `docs/runbook.md`.** Commit with `git commit -m "docs: add local runbook"`.

---

## Execution notes
- Tasks 1 to 6 need no network and can be checked entirely with `npm test`. Task 7 needs Docker n8n running, the three credentials connected, and the demo inbox decision.
- If `n8n import:workflow` doesn't refresh an already-open editor tab, reload the tab. If the import is rejected because of the fixed ID, delete the old workflow through MCP `archive_workflow` and import again.
