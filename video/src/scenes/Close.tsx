import { AbsoluteFill, Easing, Interactive, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { Backdrop } from "../Backdrop";
import { bodyFont, displayFont } from "../brand";

export const Close: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill style={{ fontFamily: bodyFont }}>
      <Backdrop />
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", gap: 24, padding: "0 160px", textAlign: "center" }}>
        <Interactive.Div
          name="Line one"
          style={{
            fontFamily: displayFont,
            fontSize: 100,
            fontWeight: 700,
            lineHeight: 1.05,
            color: "#E8EEF7",
            opacity: interpolate(frame, [0, 0.6 * fps], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.16, 1, 0.3, 1),
            }),
          }}
        >
          Every request answered.
        </Interactive.Div>
        <Interactive.Div
          name="Line two"
          style={{
            fontFamily: displayFont,
            fontSize: 100,
            fontWeight: 700,
            lineHeight: 1.05,
            color: "#F2B544",
            opacity: interpolate(frame, [1 * fps, 1.6 * fps], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.16, 1, 0.3, 1),
            }),
          }}
        >
          Nothing promised the hotel can't keep.
        </Interactive.Div>
        <Interactive.Div
          name="Signature"
          style={{
            marginTop: 70,
            fontSize: 44,
            fontWeight: 600,
            color: "#8FA3BF",
            opacity: interpolate(frame, [2.4 * fps, 3 * fps], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.16, 1, 0.3, 1),
            }),
          }}
        >
          StayFlow · Hack with the Flow n8n Buildathon · Track C
        </Interactive.Div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
