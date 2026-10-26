import { AbsoluteFill, Easing, Interactive, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { Backdrop } from "../Backdrop";
import { bodyFont, colors, displayFont } from "../brand";

// Real requests from the organizer payload.
const REQUESTS = [
  { type: "Early Check-In", guest: "Eleanor Vance", note: "Landing 9:00 AM, check-in around 10:30?" },
  { type: "Room Upgrade", guest: "Robert Langdon", note: "10th anniversary, Ocean View Suite?" },
  { type: "Dietary Preference", guest: "Sophia Martinez", note: "Severe gluten and nut allergies" },
  { type: "Accessibility Request", guest: "Arthur Pendelton", note: "Wheelchair, roll-in shower" },
  { type: "Late Check-Out", guest: "Clara Oswald", note: "Flight at 8 PM, out by 4 PM?" },
  { type: "Airport Transfer", guest: "Victor Frankenstein", note: "NAIA T3, 2:30 PM, 4 suitcases" },
  { type: "Pet Accommodation", guest: "Beatrice Prior", note: "15-pound therapy dog" },
  { type: "In-Room Dining Booking", guest: "Dante Alighieri", note: "Candlelit dinner, Nov 8, 8 PM" },
  { type: "Connecting Rooms", guest: "Gemma Teller", note: "Two bookings, one family" },
  { type: "Special Occasion", guest: "Hannah Abbott", note: "Prosecco and strawberries" },
  { type: "Workstation Setup", guest: "Julian Bashir", note: "Dual monitors, ergonomic chair" },
  { type: "Quiet Room / Location", guest: "Liam Gallagher", note: "Away from elevators" },
];

// Deterministic scatter for the pile of cards on the right.
const slot = (i: number) => ({
  x: 980 + ((i * 137) % 560),
  y: 170 + ((i * 89) % 640),
  r: ((i * 53) % 24) - 12,
});

export const Hook: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill style={{ fontFamily: bodyFont }}>
      <Backdrop />
      {REQUESTS.map((req, i) => {
        const start = 8 + i * 7;
        const p = interpolate(frame, [start, start + 18], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.bezier(0.16, 1, 0.3, 1),
        });
        const s = slot(i);
        return (
          <div
            key={req.guest}
            style={{
              position: "absolute",
              left: s.x,
              top: s.y,
              width: 380,
              padding: "20px 24px",
              borderRadius: 16,
              backgroundColor: "#F7F9FC",
              boxShadow: "0 18px 40px rgba(0,0,0,0.35)",
              opacity: p,
              translate: `${(1 - p) * 300}px ${(1 - p) * -60}px`,
              rotate: `${s.r * p}deg`,
            }}
          >
            <div style={{ fontSize: 18, fontWeight: 700, color: colors.navy, letterSpacing: 0.5, textTransform: "uppercase" }}>
              {req.type}
            </div>
            <div style={{ fontSize: 26, fontWeight: 600, color: "#1D2733", marginTop: 6 }}>{req.guest}</div>
            <div style={{ fontSize: 20, color: "#5F6B7A", marginTop: 4 }}>{req.note}</div>
          </div>
        );
      })}
      <AbsoluteFill style={{ padding: "150px 0 0 140px", width: 860 }}>
        <Interactive.Div
          name="Time stamp"
          style={{
            fontFamily: displayFont,
            fontSize: 44,
            fontWeight: 500,
            color: "#F2B544",
            opacity: interpolate(frame, [0, 0.6 * fps], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.16, 1, 0.3, 1),
            }),
          }}
        >
          Monday, 8:00 AM
        </Interactive.Div>
        <Interactive.Div
          name="Headline"
          style={{
            fontFamily: displayFont,
            fontSize: 112,
            fontWeight: 700,
            lineHeight: 1.02,
            color: "#E8EEF7",
            marginTop: 28,
            opacity: interpolate(frame, [0.4 * fps, 1.2 * fps], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.16, 1, 0.3, 1),
            }),
            translate: interpolate(frame, [0.4 * fps, 1.2 * fps], ["0px 40px", "0px 0px"], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.16, 1, 0.3, 1),
            }),
          }}
        >
          20 guest requests.
        </Interactive.Div>
        <Interactive.Div
          name="Subhead"
          style={{
            fontFamily: displayFont,
            fontSize: 112,
            fontWeight: 700,
            lineHeight: 1.02,
            color: "#8FA3BF",
            opacity: interpolate(frame, [1.6 * fps, 2.4 * fps], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.16, 1, 0.3, 1),
            }),
            translate: interpolate(frame, [1.6 * fps, 2.4 * fps], ["0px 40px", "0px 0px"], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.16, 1, 0.3, 1),
            }),
          }}
        >
          One front desk.
        </Interactive.Div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
