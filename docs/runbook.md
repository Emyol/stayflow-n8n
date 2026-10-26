# StayFlow runbook

Everything below was executed against the local Docker n8n on 2026-10-26.

## Build

```bash
npm test                  # 83 tests, all offline
cp config/local.example.json config/local.json   # once per machine; fill in your n8n credential ids + calendar id
npm run build -- local    # dist/stayflow-local.json  (credential ids for this machine)
npm run build -- cloud    # dist/stayflow-cloud.json  (credential names only)
```

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

Expected first run: 20 `GuestRequests` rows (13 CONFIRMED, 3 ALTERNATIVE_OFFERED, 4 MANUAL_REVIEW), 20 Calendar events, 20 emails to the `demo_recipient_override` inbox, and `RoomInventory!H2` going from 1 to 0.

Expected re-run: every request goes to **Already Processed: No Action**; nothing is created or sent.

## Reset for a demo

1. Clear `GuestRequests` rows 2 and below (keep the header).
2. Set `RoomInventory!H2` (`early_ready_rooms`, 2026-11-02 Deluxe King Suite) back to `1`.
3. Delete the previous run's Calendar events (titles end in `— REQ-2026-1xx (HTL-…)`).

## Failure-path check

Temporarily set **Create Staff Task** → calendar to `stayflow-missing-calendar@example.com` and **Send Guest Email** → To to `not-a-valid-recipient`, reset, then run. Expected: the execution still succeeds and every row shows `calendar_status = FAILED`, `email_status = FAILED`. Re-import the clean build afterwards.

## Move to the organizer cloud

1. Decide which Google account the cloud credentials will sign in as. If it is not the account that owns the StayFlow sheet and calendar, share the spreadsheet (Editor) and the calendar ("Make changes to events") with it, and set `calendarId` in `config/cloud.json` to a calendar that account can write to. Then `npm run build -- cloud`.
2. In https://khylepanganiban.app.n8n.cloud create a new workflow, open `dist/stayflow-cloud.json`, copy everything and paste onto the canvas.
3. Create the three Google credentials there (Sheets, Calendar, Gmail) and select them on every Google node; nodes show a warning until a credential is picked.
4. In the workflow settings, set the timezone to Asia/Manila if it did not carry over.
5. Reset the sheet, run once, and confirm the expected first-run result above before recording.
