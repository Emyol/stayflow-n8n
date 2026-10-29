# StayFlow

**Rule-based hotel guest concierge on n8n.** Our entry for the *Hack with the Flow* n8n Buildathon, Track C (Intelligent Customer Concierge). Qualifying-round deadline: **Saturday 2026-10-31, 10:00 PM Manila time.**

StayFlow pulls the organizer's batch of guest requests (early check-in, upgrades, dietary needs, airport transfers, and so on) and decides each one from hotel policy and live room inventory kept in Google Sheets. It logs every decision, schedules a staff task in Google Calendar, and sends the guest an HTML email through Gmail. It never confirms what policy or inventory can't back, and re-running it creates no duplicates.

> **New here?** Read [`docs/HANDOFF.md`](docs/HANDOFF.md) first: current status, what's left before the deadline, and how to get set up.

## Quickstart

Needs Node 22+. The core project has no npm dependencies.

```bash
npm test                                   # 131 offline tests, including the golden test over all 20 organizer requests
cp config/local.example.json config/local.json   # then fill in your own n8n credential ids
npm run build -- local                     # dist/stayflow-local.json  → import into your own n8n
npm run build -- cloud                     # dist/stayflow-cloud.json  → paste into the organizer cloud
                                           # (+ dist/stayflow-report-cloud.json, the optional admin Excel report)
```

Deploying, running, resetting the demo data and moving to the cloud are in [`docs/runbook.md`](docs/runbook.md).

## How it works

```
Organizer HTTP Request ─► Split + Set (normalize) ─► Sheets reads (catalog, policies, inventory, log)
  ─► Code: validate, classify, de-duplicate ─► Switch by category (9 routes + fallback)
  ─► Code: per-category rules ─► Code: plan staff task + email
  ─► Sheets log ─► Calendar task ─► Gmail ─► Sheets delivery status
                               (Calendar/Gmail failures branch off and are logged as FAILED)
```

Optional add-ons from blueprint v2 (both off the judged path, and failures in them never touch guest email or inventory): a private **Notion staff board** mirrored after the final audit, and an **admin Excel report** workflow (authenticated download or staff email). See the runbook.

On the organizer payload one run gives **13 confirmed, 3 alternatives, 4 staff reviews**: 20 calendar tasks and 20 emails in about 84 seconds. A second run skips all 20 as already processed.

## Repo map

| Path | What it is |
|---|---|
| `src/*.js` | All decision logic as plain functions: the single source of truth for the n8n Code nodes |
| `src/glue/*.js` | The thin n8n-only wrappers (`$input`, `$('Node')`) around those functions |
| `scripts/build-workflow.mjs` | Generates the n8n workflow JSON (main, Excel report, Notion resync) from `src/`, `config/` and the organizer starter |
| `scripts/notion-setup.mjs` | Creates the Notion Guest Request Board from the same schema the workflow writes |
| `test/` | `node:test` suites; `golden.test.mjs` checks all 20 organizer requests against `fixtures/expected-decisions.json` |
| `fixtures/` | Organizer starter template and payload (unchanged), expected outcomes, edge cases |
| `sheets/` | Seed CSVs for the four Google Sheet tabs |
| `config/` | `cloud.json` (shared) and `local.example.json` (copy to your own git-ignored `local.json`) |
| `video/` | 60-second Remotion pitch video; see [`video/README.md`](video/README.md) |
| `docs/` | Handoff, runbook, design spec, implementation plan |
| `StayFlow_Track_C_Buildathon_Blueprint.md` | The team's plan (v2: adds the Notion and Excel add-ons, §17–21) |
| `Hack with the Flow_ … Instructions.pdf` | Official rules and judging criteria |

## Live resources

- **Google Sheet:** [StayFlow — Harborlight Front Desk](https://docs.google.com/spreadsheets/d/18wno6DELat3xTkZs62UcYKlw_iRo9W2DtaCTZP2iyvk/edit), owned by Miel; ask for access.
- **Organizer n8n (judged):** https://khylepanganiban.app.n8n.cloud
- **Submission form:** https://khylepanganiban.app.n8n.cloud/form/QualifyingRoundSubmission
