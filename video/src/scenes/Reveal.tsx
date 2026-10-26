import { AbsoluteFill, Easing, Interactive, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { Backdrop } from "../Backdrop";
import { bodyFont, displayFont } from "../brand";

// Logo mark: three nodes joined by a flowing line, drawn on.
const Mark: React.FC<{ progress: number }> = ({ progress }) => (
  <svg width={200} height={200} viewBox="0 0 200 200">
    <rect x={8} y={8} width={184} height={184} rx={44} fill="#1F3864" stroke="#F2B544" strokeWidth={4} />
    <path
      d="M140 58 C 40 58, 40 100, 100 100 S 160 142, 60 142"
      fill="none"
      stroke="#F2B544"
      strokeWidth={14}
      strokeLinecap="round"
      strokeDasharray={300}
      strokeDashoffset={300 * (1 - progress)}
    />
    <circle cx={140} cy={58} r={13} fill="#E8EEF7" opacity={progress > 0.05 ? 1 : 0} />
    <circle cx={100} cy={100} r={13} fill="#E8EEF7" opacity={progress > 0.5 ? 1 : 0} />
    <circle cx={60} cy={142} r={13} fill="#E8EEF7" opacity={progress > 0.95 ? 1 : 0} />
  </svg>
);

export const Reveal: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const draw = interpolate(frame, [0.2 * fps, 1.4 * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.65, 0, 0.35, 1),
  });

  return (
    <AbsoluteFill style={{ fontFamily: bodyFont }}>
      <Backdrop />
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", gap: 36 }}>
        <Interactive.Div
          name="Mark"
          style={{
            scale: interpolate(frame, [0, 0.8 * fps], [0.6, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.spring({ damping: 200 }),
              output: "perceptual-scale",
            }),
          }}
        >
          <Mark progress={draw} />
        </Interactive.Div>
        <Interactive.Div
          name="Wordmark"
          style={{
            fontFamily: displayFont,
            fontSize: 168,
            fontWeight: 700,
            letterSpacing: -4,
            color: "#E8EEF7",
            opacity: interpolate(frame, [0.9 * fps, 1.5 * fps], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.16, 1, 0.3, 1),
            }),
            translate: interpolate(frame, [0.9 * fps, 1.5 * fps], ["0px 30px", "0px 0px"], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.16, 1, 0.3, 1),
            }),
          }}
        >
          StayFlow
        </Interactive.Div>
        <Interactive.Div
          name="Tagline"
          style={{
            fontSize: 48,
            fontWeight: 500,
            color: "#8FA3BF",
            opacity: interpolate(frame, [1.6 * fps, 2.2 * fps], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.16, 1, 0.3, 1),
            }),
          }}
        >
          A rule-based guest concierge, built on n8n
        </Interactive.Div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
