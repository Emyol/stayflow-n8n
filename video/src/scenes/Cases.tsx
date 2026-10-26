import { AbsoluteFill, Easing, interpolate, Sequence, useCurrentFrame, useVideoConfig } from "remotion";
import { Backdrop } from "../Backdrop";
import { bodyFont, colors, displayFont } from "../brand";

type Case = {
  id: string;
  type: string;
  guest: string;
  quote: string;
  checks: { text: string; pass: boolean }[];
  status: string;
  color: string;
  headline: string;
  effects: string[];
};

// All three are real rows from the first full run (GuestRequests sheet + Calendar).
const CASES: Case[] = [
  {
    id: "REQ-2026-101",
    type: "Early Check-In",
    guest: "Eleanor Vance",
    quote: "Requesting early check-in around 10:30 AM if room is available.",
    checks: [
      { text: "10:30 is after the 10:00 earliest check-in", pass: true },
      { text: "Ready Deluxe King Suites on Nov 2: 1", pass: true },
    ],
    status: "CONFIRMED",
    color: colors.confirmed,
    headline: "Early check-in confirmed for 10:30",
    effects: ["Staff task: Nov 2, 09:30, prepare room", "Guest email: confirmation sent", "Inventory: ready rooms 1 → 0"],
  },
  {
    id: "REQ-2026-102",
    type: "Room Upgrade",
    guest: "Robert Langdon",
    quote: "Inquiring if a complimentary or discounted upgrade to an Ocean View Suite is available.",
    checks: [
      { text: "Requested room found: Ocean View Suite", pass: true },
      { text: "Ocean View Suite on Nov 3: fully booked", pass: false },
    ],
    status: "ALTERNATIVE",
    color: colors.alternative,
    headline: "No false promise. Current room kept.",
    effects: ["Staff task: Nov 3, 09:00, re-check upgrade", "Guest email: honest alternative", "Inventory: unchanged"],
  },
  {
    id: "REQ-2026-106",
    type: "Accessibility Request",
    guest: "Arthur Pendelton",
    quote: "Traveling with an elderly family member using a wheelchair. Requesting a ground-floor room near the elevator.",
    checks: [
      { text: "Category: special care, needs a person", pass: true },
      { text: "“wheelchair” raises priority to HIGH", pass: true },
    ],
    status: "STAFF REVIEW",
    color: colors.review,
    headline: "A person confirms it within 2 hours",
    effects: ["Staff task: [HIGH] review, due in 2 hours", "Guest email: request under review", "Nothing promised automatically"],
  },
];

const ease = Easing.bezier(0.16, 1, 0.3, 1);
const appear = (frame: number, start: number) =>
  interpolate(frame, [start, start + 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });

const CaseView: React.FC<{ c: Case }> = ({ c }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const req = appear(frame, 0);
  const out = appear(frame, 2.2 * fps);

  return (
    <AbsoluteFill>
      <div
        style={{
          position: "absolute",
          left: 120,
          top: 320,
          width: 600,
          padding: 40,
          borderRadius: 24,
          backgroundColor: "#F7F9FC",
          opacity: req,
          translate: `${(1 - req) * -60}px 0px`,
        }}
      >
        <div style={{ fontSize: 22, fontWeight: 700, color: colors.navy, letterSpacing: 1 }}>{c.id}</div>
        <div style={{ fontFamily: displayFont, fontSize: 48, fontWeight: 700, color: "#1D2733", marginTop: 10 }}>{c.type}</div>
        <div style={{ fontSize: 28, fontWeight: 600, color: "#3B4652", marginTop: 6 }}>{c.guest}</div>
        <div
          style={{
            marginTop: 24,
            padding: "16px 20px",
            borderLeft: "5px solid #C9D2DC",
            backgroundColor: "#EEF2F7",
            fontSize: 26,
            lineHeight: 1.4,
            color: "#3B4652",
          }}
        >
          “{c.quote}”
        </div>
      </div>

      <div style={{ position: "absolute", left: 780, top: 410, width: 380, display: "flex", flexDirection: "column", gap: 28 }}>
        {c.checks.map((check, i) => {
          const p = appear(frame, 0.8 * fps + i * 0.6 * fps);
          return (
            <div key={check.text} style={{ display: "flex", gap: 18, alignItems: "flex-start", opacity: p, translate: `0px ${(1 - p) * 20}px` }}>
              <div
                style={{
                  flexShrink: 0,
                  width: 52,
                  height: 52,
                  borderRadius: 26,
                  backgroundColor: check.pass ? colors.confirmedGlow : colors.danger,
                  color: "#0B1426",
                  fontSize: 32,
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {check.pass ? "✓" : "✕"}
              </div>
              <div style={{ fontSize: 30, fontWeight: 500, lineHeight: 1.3, color: colors.ink }}>{check.text}</div>
            </div>
          );
        })}
      </div>

      <div
        style={{
          position: "absolute",
          left: 1220,
          top: 320,
          width: 580,
          padding: 40,
          borderRadius: 24,
          backgroundColor: "#16233D",
          border: `3px solid ${c.color}`,
          opacity: out,
          scale: `${0.9 + 0.1 * out}`,
        }}
      >
        <div
          style={{
            display: "inline-block",
            padding: "10px 24px",
            borderRadius: 30,
            backgroundColor: c.color,
            color: "#FFFFFF",
            fontSize: 28,
            fontWeight: 700,
            letterSpacing: 1,
          }}
        >
          {c.status}
        </div>
        <div style={{ fontFamily: displayFont, fontSize: 46, fontWeight: 700, lineHeight: 1.15, color: colors.ink, marginTop: 24 }}>
          {c.headline}
        </div>
        <div style={{ marginTop: 26, display: "flex", flexDirection: "column", gap: 14 }}>
          {c.effects.map((effect, i) => {
            const p = appear(frame, 2.8 * fps + i * 0.35 * fps);
            return (
              <div key={effect} style={{ fontSize: 28, fontWeight: 500, color: colors.muted, opacity: p }}>
                {effect}
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// Per-case slots, sized to each case's voiceover line.
export const CASE_SLOTS = [130, 172, 160];
const CASE_STARTS = CASE_SLOTS.map((_, i) => CASE_SLOTS.slice(0, i).reduce((a, b) => a + b, 0));

export const Cases: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill style={{ fontFamily: bodyFont }}>
      <Backdrop />
      <div
        style={{
          position: "absolute",
          left: 120,
          top: 110,
          fontSize: 32,
          fontWeight: 700,
          letterSpacing: 3,
          color: colors.gold,
          opacity: interpolate(frame, [0, 0.4 * fps], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        }}
      >
        REAL REQUESTS, REAL DECISIONS
      </div>
      {CASES.map((c, i) => (
        <Sequence key={c.id} name={c.id} from={CASE_STARTS[i]} durationInFrames={CASE_SLOTS[i]} layout="absolute-fill">
          <CaseView c={c} />
        </Sequence>
      ))}
      <div style={{ position: "absolute", right: 120, top: 110, display: "flex", gap: 14 }}>
        {CASES.map((c, i) => (
          <div
            key={c.id}
            style={{
              width: 60,
              height: 8,
              borderRadius: 4,
              backgroundColor: frame >= CASE_STARTS[i] ? colors.gold : "rgba(143,163,191,0.3)",
            }}
          />
        ))}
      </div>
    </AbsoluteFill>
  );
};
