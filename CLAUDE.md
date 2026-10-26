# StayFlow: n8n Buildathon Track C

Rule-based hotel guest request automation for the "Hack with the Flow" n8n Buildathon (Track C, Intelligent Customer Concierge). The plan lives in `StayFlow_Track_C_Buildathon_Blueprint.md`; the official rules are in the instructions PDF.

- The judged workflow must be built and executed on `khylepanganiban.app.n8n.cloud`. The local Docker n8n (`localhost:5678`) is for drafting and testing only.
- Input data must originate from the organizer's HTTP Request node (`GET https://khylepanganiban.app.n8n.cloud/webhook/GuestRequest`).
- Submission deadline: Saturday 2026-10-31, 10:00 PM Asia/Manila.

## Agent skills

### Issue tracker

Issues live as local markdown files under `.scratch/<feature>/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five canonical labels (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
