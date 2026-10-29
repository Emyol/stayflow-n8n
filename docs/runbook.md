# StayFlow runbook

Everything below was executed against the local Docker n8n on 2026-10-26.

## Build

```bash
npm test                  # 131 tests, all offline
cp config/local.example.json config/local.json   # once per machine; fill in your n8n credential ids + calendar id
npm run build -- local    # dist/stayflow-*-local.json  (credential ids for this machine)
npm run build -- cloud    # dist/stayflow-*-cloud.json  (credential names only)
```

Each build writes up to three workflows:

| File | What it is |
|---|---|
| `stayflow-<env>.json` | The judged Track C workflow. Includes the Notion mirror only when `notion.databaseId` is set. |
| `stayflow-report-<env>.json` | Admin Excel report, a separate workflow (see *Excel report* below). |
| `stayflow-notion-resync-<env>.json` | Retries the Notion mirror for rows not yet `SYNCED`. Only built when `notion.databaseId` is set. |

Find your credential ids with the n8n MCP `list_credentials` tool, or in the URL when you open a credential in n8n.

Edit logic in `src/`, never inside the n8n Code nodes: the build overwrites them.

## Deploy locally

```bash
MSYS_NO_PATHCONV=1 docker cp dist/stayflow-local.json n8n:/tmp/stayflow.json
MSYS_NO_PATHCONV=1 docker exec n8n n8n import:workflow --input=/tmp/stayflow.json
```

The workflow id is fixed (`stayflowTrackC01`), so re-importing replaces it in place. Reload an open editor tab afterwards.

## Run

Open http://localhost:5678/workflow/stayflowTrackC01 and click **Execute workflow** (or run it through the n8n MCP in manual mode). A full first run of the 20 organizer requests takes about 80 seconds.

Expected first run: 20 `GuestRequests` rows (13 CONFIRMED, 3 ALTERNATIVE_OFFERED, 4 MANUAL_REVIEW), 20 Calendar events, 20 emails to the `demo_recipient_override` inbox, `RoomInventory!H2` going from 1 to 0 (the early check-in), and `RoomInventory!G6` going from 0 to 1 (the late check-out hold for REQ-2026-105).

Expected re-run: every request goes to **Already Processed: No Action**; nothing is created or sent.

With the Notion mirror on, the first run also creates 20 cards on the Guest Request Board and writes `notion_sync_status = SYNCED`, `notion_page_id` and `notion_last_synced_at` on every row.

## Reset for a demo

1. Clear `GuestRequests` rows 2 and below (keep the header).
2. Set `RoomInventory!H2` (`early_ready_rooms`, 2026-11-02 Deluxe King Suite) back to `1`, and `RoomInventory!G6` (`active_holds`, 2026-11-08 Penthouse Suite) back to `0`.
3. Delete the previous run's Calendar events (titles end in `— REQ-2026-1xx (HTL-…)`).
4. Notion cards can stay: the next run finds each card by `Request ID` and updates it instead of adding a second one.

## Failure-path check

Temporarily set **Create Staff Task** → calendar to `stayflow-missing-calendar@example.com` and **Send Guest Email** → To to `not-a-valid-recipient`, reset, then run. Expected: the execution still succeeds and every row shows `calendar_status = FAILED`, `email_status = FAILED`. Re-import the clean build afterwards.

## Move to the organizer cloud

1. Decide which Google account the cloud credentials will sign in as. If it is not the account that owns the StayFlow sheet and calendar, share the spreadsheet (Editor) and the calendar ("Make changes to events") with it, and set `calendarId` in `config/cloud.json` to a calendar that account can write to. Then `npm run build -- cloud`.
2. **Create the three Google credentials first**, named exactly `Google Sheets (StayFlow)`, `Google Calendar (StayFlow)` and `Gmail (StayFlow)`. On import, n8n binds all 9 Google nodes to credentials by name (verified locally), so exact names save picking a credential on every node.
3. In https://khylepanganiban.app.n8n.cloud create a new workflow, then use the workflow menu → **Import from File** and pick `dist/stayflow-cloud.json` (about 240 KB). Pasting the JSON onto the canvas also works.
4. **Open `Send Guest Email` and re-select `Gmail (StayFlow)` in its Credential dropdown, then save.** On the organizer cloud (2026-10-27) the Sheets and Calendar nodes bound by name, but the Gmail node *showed* the credential while the run failed with "Node does not have any credentials set" on every email. Re-selecting it fixed this. Check the other Google nodes the same way if any shows a warning.
5. In the workflow settings, check the timezone is Asia/Manila.
6. Reset the sheet, run once, and confirm the expected first-run result above before recording.

## Notion staff board (optional, blueprint v2 §17)

A private Notion board that mirrors every audited request, one card per `request_id`. Google Sheets stays the source of truth: editing a card changes nothing in the sheet, inventory or email. Leave it off until all of these steps are done. A Notion node with no credential stops a manual run before it starts, so don't build with a database id until the credential exists.

1. **Add three headers** to the right of `last_updated_at` in the live `GuestRequests` tab: `notion_page_id`, `notion_sync_status`, `notion_last_synced_at`. Without them, the sync status is silently dropped.
2. In Notion, create an integration (https://www.notion.so/profile/integrations, *Internal*, read + update + insert content) and copy its secret.
3. Create a private page `StayFlow | Front Desk` and share it with the integration (page **⋯** → *Connections*).
4. Create the board from the code's own schema: `NOTION_TOKEN=<secret> node scripts/notion-setup.mjs <page-url-or-id>`. It prints `notion.databaseId`. Add the views by hand: Board by Status, Pending Review (`MANUAL_REVIEW` or `ALTERNATIVE_OFFERED`), Arrivals This Week, All Requests.
5. In n8n, create a **Notion API** credential named exactly `Notion (StayFlow)` with the same secret.
6. Put the id in `config/<env>.json` → `"notion": { "databaseId": "…" }` (and the credential id under `credentials.notionApi.id` for local), then rebuild and re-import.

The cards carry the decision only: no guest email or free-text request details.

**Failure behaviour.** Each Notion call retries 3 times, 1.5 s apart, one request at a time (Notion allows about 3 a second). After that the item goes to **Notion Failed**: the row is written with `notion_sync_status = FAILED` and the run carries on. Calendar and Gmail have already run and are never repeated. A full outage adds about 40 s to a 20-request run.

**Retrying.** Import `stayflow-notion-resync-<env>.json` once, and click *Execute workflow* after Notion is back. It reads `GuestRequests`, picks every processed row whose `notion_sync_status` is not `SYNCED`, and upserts those cards. Running it again does nothing.

## Excel report (optional, blueprint v2 §18)

A separate workflow, `StayFlow | Admin Excel Report`. It reads `GuestRequests` only and never touches inventory, Calendar or guest email. The file has one sheet, `Guest Requests`, with the 13 columns of blueprint §18.2. Booking ID is `confirmation_number`, Stay Date is `check_in_date`, and Created At is `processed_at`. Response Minutes runs from `processed_at` to `email_sent_at`. Guest names, emails and notes are left out, and text starting with `= + - @` is prefixed with `'`.

1. Create a **Header Auth** credential named exactly `StayFlow Report Key`: name `X-StayFlow-Key`, value a long random secret. Share it with staff only, never in a browser page or this repo.
2. Import `dist/stayflow-report-cloud.json` as a new workflow and check the Gmail node's credential (same re-select issue as the main workflow).
3. **Email fallback:** click *Execute workflow*. The last 31 days go to `reportRecipient` from the config as `StayFlow_Guest_Requests_<date>.xlsx`.
4. **Download:** publish the workflow, then:

   ```bash
   curl -X POST https://khylepanganiban.app.n8n.cloud/webhook/stayflow-report \
     -H 'X-StayFlow-Key: <secret>' -H 'Content-Type: application/json' \
     -d '{"start_date":"2026-10-25","end_date":"2026-10-31"}' -o report.xlsx
   ```

   | Situation | Response |
   |---|---|
   | Missing or wrong key | 403 from n8n; the workflow does not run |
   | Bad, reversed or over-31-day range | 400 with a message |
   | No requests in range | 200 with `{"message": "No guest requests…", "count": 0}` |
   | More than 500 requests | 413 with a message; never a truncated file |
   | Otherwise | 200, the `.xlsx` as an attachment, `Cache-Control: no-store` |

## Verified on 2026-10-29 (local n8n 2.45.5, Google nodes stubbed)

Each run used the built JSON on a real n8n 2.45.5, with only the Google Sheets, Calendar and Gmail nodes swapped for stubs. Notion calls went through the real HTTP Request nodes and saved credential to a local mock of the Notion API. Report calls went through the real Webhook, Header Auth, Convert to File and Respond to Webhook nodes.

- Main workflow, Notion off (the current cloud build): 13 / 3 / 4, all 20 match `expected-decisions.json`, and the re-run skips all 20.
- N01, N03: 20 cards created, 20 rows `SYNCED`; REQ-2026-102 shows `ALTERNATIVE_OFFERED`.
- N02: after a sheet reset, the re-run updated the same 20 cards (no new ones).
- N04: with Notion returning 503, all 20 were still calendared and emailed once, the run succeeded, and every row was `FAILED`.
- N05: the resync repaired all 20; a second resync selected nothing.
- X01–X05: 403 without or with a wrong key, 400 reversed range, 200 empty message, a real `.xlsx` (header + 20 rows, no guest PII), and formula-like text stored as plain strings. The email fallback sent one `.xlsx` attachment.

Not verified against real Notion or the organizer cloud yet.
