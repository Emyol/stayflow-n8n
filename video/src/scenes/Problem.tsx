import { AbsoluteFill, Easing, Interactive, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { Backdrop } from "../Backdrop";
import { bodyFont, colors, displayFont } from "../brand";

const STEPS = ["Read the request", "Check hotel policy", "Check room availability", "Write the reply", "Set a staff reminder"];

export const Problem: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill style={{ fontFamily: bodyFont }}>
      <Backdrop />
      <AbsoluteFill style={{ padding: "130px 140px" }}>
        <Interactive.Div
          name="Lead"
          style={{
            fontFamily: displayFont,
            fontSize: 64,
            fontWeight: 700,
            color: "#E8EEF7",
            opacity: interpolate(frame, [0, 0.5 * fps], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.16, 1, 0.3, 1),
            }),
          }}
        >
          Every single one, by hand:
        </Interactive.Div>
        <div style={{ marginTop: 56, display: "flex", flexDirection: "column", gap: 26 }}>
          {STEPS.map((step, i) => {
            const start = 0.6 * fps + i * 0.45 * fps;
            const p = interpolate(frame, [start, start + 10], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.16, 1, 0.3, 1),
            });
            return (
              <div
                key={step}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 28,
                  opacity: p,
                  translate: `${(1 - p) * -40}px 0px`,
                }}
              >
                <div
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 32,
                    border: `3px solid ${colors.gold}`,
                    color: colors.gold,
                    fontFamily: displayFont,
                    fontSize: 32,
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {i + 1}
                </div>
                <div style={{ fontSize: 52, fontWeight: 600, color: colors.ink }}>{step}</div>
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "flex-end", paddingRight: 170 }}>
        <Interactive.Div
          name="Times twenty"
          style={{
            fontFamily: displayFont,
            fontSize: 300,
            fontWeight: 700,
            color: "#E25555",
            opacity: interpolate(frame, [3.2 * fps, 3.7 * fps], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.16, 1, 0.3, 1),
            }),
            scale: interpolate(frame, [3.2 * fps, 3.9 * fps], [1.6, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.spring({ damping: 200 }),
              output: "perceptual-scale",
            }),
          }}
        >
          ×20
        </Interactive.Div>
      </AbsoluteFill>
      <AbsoluteFill style={{ justifyContent: "flex-end", padding: "0 140px 110px" }}>
        <Interactive.Div
          name="Consequence"
          style={{
            fontSize: 46,
            fontWeight: 500,
            color: "#8FA3BF",
            opacity: interpolate(frame, [4 * fps, 4.6 * fps], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.16, 1, 0.3, 1),
            }),
          }}
        >
          Slow replies. Inconsistent promises. Forgotten follow-ups.
        </Interactive.Div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
