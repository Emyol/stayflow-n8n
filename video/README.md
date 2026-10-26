# StayFlow pitch video

A 60-second, 1920×1080 pitch video for StayFlow, built with [Remotion](https://www.remotion.dev/) (React → MP4). It is the opener for the 2–5 minute submission video, not the whole submission: the organizers also require a recording of the workflow running live on their n8n cloud and spoken answers to the three Track C questions.

## Commands

Run these inside `video/`.

```bash
npm i                                                        # first time only
npx remotion studio                                          # live preview + editing at http://localhost:3000
npx remotion render StayFlowPitch out/stayflow-pitch.mp4     # final MP4, about 19 MB
npx remotion still StayFlowPitch out/frame.png --frame=1000  # check a single frame
```

Rendered files go to `out/`, which is git-ignored. Re-render after pulling.

## Structure

| File | What it holds |
|---|---|
| `src/StayFlowPitch.tsx` | The 60 s timeline: seven scenes, 15-frame transitions, and the `VOICEOVER` list (file + start frame) |
| `src/scenes/*.tsx` | One file per scene: Hook, Problem, Reveal, Pipeline, Cases, Results, Close |
| `src/Root.tsx` | Registers the full video and each scene as its own composition (`StayFlowPitch-Scenes` folder in Studio) |
| `src/brand.ts`, `src/Backdrop.tsx` | Fonts (Space Grotesk, Inter), colours, shared background |
| `public/vo/*.mp3` | Voiceover, one clip per line |

## Facts on screen

Every number and case comes from the first full local run on 2026-10-26: 20 requests in 84 s (execution 3), a 13 / 3 / 4 split, REQ-2026-101 / 102 / 106 decisions and their calendar times, and the re-run creating nothing (execution 4). If a later cloud run gives different numbers, update `scenes/Results.tsx` and `scenes/Cases.tsx` so the video matches what the judges see.

## Changing timing or voiceover

- Scene lengths live in `StayFlowPitch.tsx` **and** `Root.tsx`; keep them equal. Total = sum of scenes − 6 × 15 transition frames = 1800.
- The `from` frame of each voiceover clip is the scene's start on the main timeline plus a few frames. Scene starts are listed in the comment above `VOICEOVER`.
- `Cases.tsx` sizes each case with `CASE_SLOTS` to fit its voiceover line.
- Voiceover was generated with ElevenLabs (voice "Justin Case – Warm, Trustworthy, Clear", model `eleven_v4`), one generation per line. A replacement line needs its new duration checked against the next clip's start frame.

Remotion is free for teams of up to 3 people.
