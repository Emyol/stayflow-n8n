# StayFlow: n8n Buildathon Track C

Rule-based hotel guest request automation for the "Hack with the Flow" n8n Buildathon (Track C). Start with `README.md` for the overview and `docs/HANDOFF.md` for current status and open work.

## Hard constraints

- The judged workflow is built and run on `khylepanganiban.app.n8n.cloud`. A local Docker n8n (`localhost:5678`) is for testing only.
- Input data comes only from the organizer's HTTP Request node (`GET https://khylepanganiban.app.n8n.cloud/webhook/GuestRequest`). The two organizer nodes stay byte-identical to `fixtures/organizer-starter-template.json`; a build test enforces this.
- No AI/LLM nodes. Track C is judged as rule-based.
- Deadline: Saturday 2026-10-31, 10:00 PM Asia/Manila.

## Changing behaviour

- `src/*.js` is the single source of truth for every n8n Code node. Edit there, then `npm test`, then `npm run build -- local|cloud` and re-import. Code edited inside n8n is overwritten by the next build.
- `src/` files hold only top-level `function` declarations and `var` constants: no `const`/`let` at top level, no `import`/`require`, no n8n globals (`$input`, `$`). Both the tests (`scripts/lib/modules.mjs`) and the build concatenate them, so a file that breaks the rule breaks both.
- n8n-only code lives in `src/glue/*.js`.
- `fixtures/expected-decisions.json` is the oracle for the 20 organizer requests. Change it only when the spec's intended outcome changes; a golden-test failure is otherwise a code bug.
- Write the failing test first (`node:test`, files in `test/`), then the code.
- Per-machine settings live in `config/local.json` (git-ignored; template `config/local.example.json`).

## Docs to reach for

- **Deploying, running, resetting demo data, moving to the cloud:** `docs/runbook.md`
- **Why a rule behaves the way it does:** `docs/superpowers/specs/2026-10-26-stayflow-track-c-design.md` (decision table §5, expected outcomes §8, calls made §11)
- **The pitch video:** `video/README.md`

## Agent skills

### Issue tracker

Issues live as local markdown files under `.scratch/<feature>/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five canonical labels (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
