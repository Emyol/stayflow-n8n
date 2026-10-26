import { AbsoluteFill, Easing, Interactive, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { Backdrop } from "../Backdrop";
import { bodyFont, colors, displayFont } from "../brand";

// Measured on the first full local run (execution 3) and the re-run (execution 4).
const STATS = [
  { value: 20, suffix: "", label: "requests decided" },
  { value: 84, suffix: "s", label: "end to end" },
  { value: 20, suffix: "", label: "staff tasks scheduled" },
  { value: 20, suffix: "", label: "guest emails sent" },
];

const SPLIT = [
  { label: "13 confirmed", share: 13, color: colors.confirmed },
  { label: "3 alternatives", share: 3, color: colors.alternative },
  { label: "4 staff reviews", share: 4, color: colors.review },
];

export const Results: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const ease = Easing.bezier(0.16, 1, 0.3, 1);

  return (
    <AbsoluteFill style={{ fontFamily: bodyFont }}>
      <Backdrop />
      <div style={{ position: "absolute", left: 120, right: 120, top: 120, display: "flex", justifyContent: "space-between" }}>
        {STATS.map((stat, i) => {
          const start = i * 6;
          const count = interpolate(frame, [start, start + 1.2 * fps], [0, stat.value], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: ease,
          });
          const p = interpolate(frame, [start, start + 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          return (
            <div key={stat.label} style={{ width: 380, opacity: p }}>
              <div style={{ fontFamily: displayFont, fontSize: 150, fontWeight: 700, color: colors.ink, lineHeight: 1 }}>
                {Math.round(count)}
                <span style={{ color: colors.gold }}>{stat.suffix}</span>
              </div>
              <div style={{ fontSize: 36, fontWeight: 500, color: colors.muted, marginTop: 12 }}>{stat.label}</div>
            </div>
          );
        })}
      </div>

      <div style={{ position: "absolute", left: 120, right: 120, top: 500 }}>
        <div style={{ display: "flex", height: 70, borderRadius: 14, overflow: "hidden" }}>
          {SPLIT.map((part, i) => {
            const grow = interpolate(frame, [1.4 * fps + i * 6, 2.4 * fps + i * 6], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: ease,
            });
            return <div key={part.label} style={{ flexGrow: part.share * grow, flexBasis: 0, backgroundColor: part.color }} />;
          })}
        </div>
        <div style={{ display: "flex", gap: 60, marginTop: 22 }}>
          {SPLIT.map((part, i) => (
            <div
              key={part.label}
              style={{
                fontSize: 36,
                fontWeight: 600,
                color: colors.ink,
                opacity: interpolate(frame, [2 * fps + i * 6, 2.5 * fps + i * 6], [0, 1], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                }),
              }}
            >
              <span style={{ color: part.color }}>■</span> {part.label}
            </div>
          ))}
        </div>
      </div>

      <AbsoluteFill style={{ justifyContent: "flex-end", padding: "0 120px 120px" }}>
        <Interactive.Div
          name="Rerun proof"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 40,
            opacity: interpolate(frame, [4.2 * fps, 4.8 * fps], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.16, 1, 0.3, 1),
            }),
            translate: interpolate(frame, [4.2 * fps, 4.8 * fps], ["0px 40px", "0px 0px"], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.16, 1, 0.3, 1),
            }),
          }}
        >
          <div style={{ fontFamily: displayFont, fontSize: 64, fontWeight: 700, color: "#E8EEF7" }}>Run it again:</div>
          <div
            style={{
              fontFamily: displayFont,
              fontSize: 64,
              fontWeight: 700,
              color: "#0B1426",
              backgroundColor: "#F2B544",
              padding: "8px 28px",
              borderRadius: 14,
            }}
          >
            0 duplicates
          </div>
          <div style={{ fontSize: 36, fontWeight: 500, color: "#8FA3BF" }}>No second email, task or room hold.</div>
        </Interactive.Div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
