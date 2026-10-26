import { AbsoluteFill, Easing, Interactive, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { Backdrop } from "../Backdrop";
import { bodyFont, colors, displayFont } from "../brand";

const NODES = [
  { title: "Guest requests", tool: "HTTP Request" },
  { title: "Validate & classify", tool: "Set + Code" },
  { title: "Route by type", tool: "Switch · 8 lanes" },
  { title: "Policy + rooms", tool: "Sheets rules" },
  { title: "Audit log", tool: "Google Sheets" },
  { title: "Staff task", tool: "Google Calendar" },
  { title: "Guest email", tool: "Gmail" },
];

const NODE_W = 220;
const NODE_H = 150;
const LINE_Y = 500;
const nodeX = (i: number) => 110 + i * 250;
const centerX = (i: number) => nodeX(i) + NODE_W / 2;

// 13 confirmed, 3 alternatives, 4 reviews: the real first-run split.
const OUTCOMES = [
  ...Array(13).fill(colors.confirmedGlow),
  ...Array(3).fill(colors.alternativeGlow),
  ...Array(4).fill(colors.reviewGlow),
].map((c, i, all) => all[(i * 7) % all.length]);

export const Pipeline: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const startX = centerX(0);
  const endX = centerX(6);
  const rulesX = centerX(3);

  return (
    <AbsoluteFill style={{ fontFamily: bodyFont }}>
      <Backdrop />
      <AbsoluteFill style={{ padding: "110px 110px 0" }}>
        <Interactive.Div
          name="Title"
          style={{
            fontFamily: displayFont,
            fontSize: 84,
            fontWeight: 700,
            color: "#E8EEF7",
            opacity: interpolate(frame, [0, 0.5 * fps], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.16, 1, 0.3, 1),
            }),
          }}
        >
          One run. Every request handled.
        </Interactive.Div>
      </AbsoluteFill>

      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
        {NODES.slice(0, -1).map((_, i) => {
          const start = 14 + i * 12;
          const p = interpolate(frame, [start, start + 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          const x1 = nodeX(i) + NODE_W;
          const x2 = nodeX(i + 1);
          return (
            <line
              key={i}
              x1={x1}
              y1={LINE_Y}
              x2={x1 + (x2 - x1) * p}
              y2={LINE_Y}
              stroke="#8FA3BF"
              strokeOpacity={0.6}
              strokeWidth={4}
            />
          );
        })}
        {OUTCOMES.map((color, i) => {
          const start = 2.6 * fps + i * 6;
          const t = interpolate(frame, [start, start + 4 * fps], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.45, 0, 0.55, 1),
          });
          if (t <= 0 || t >= 1) return null;
          const x = startX + (endX - startX) * t;
          const decided = x > rulesX;
          return (
            <circle
              key={i}
              cx={x}
              cy={LINE_Y + (decided ? ((i % 3) - 1) * 18 : 0)}
              r={decided ? 13 : 10}
              fill={decided ? color : "#F2B544"}
              opacity={0.95}
            />
          );
        })}
      </svg>

      {NODES.map((node, i) => {
        const start = 8 + i * 12;
        const p = interpolate(frame, [start, start + 14], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.bezier(0.16, 1, 0.3, 1),
        });
        return (
          <div
            key={node.title}
            style={{
              position: "absolute",
              left: nodeX(i),
              top: LINE_Y - NODE_H / 2,
              width: NODE_W,
              height: NODE_H,
              borderRadius: 22,
              backgroundColor: i === 3 ? "#F2B544" : "#16233D",
              border: `2px solid ${i === 3 ? "#F2B544" : "rgba(143,163,191,0.45)"}`,
              boxShadow: "0 16px 36px rgba(0,0,0,0.35)",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              padding: "0 20px",
              opacity: p,
              scale: `${0.85 + 0.15 * p}`,
            }}
          >
            <div style={{ fontSize: 28, fontWeight: 700, lineHeight: 1.15, color: i === 3 ? "#0B1426" : colors.ink }}>
              {node.title}
            </div>
            <div style={{ fontSize: 21, fontWeight: 500, marginTop: 8, color: i === 3 ? "#3B2A05" : colors.muted }}>
              {node.tool}
            </div>
          </div>
        );
      })}

      <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 150, gap: 30 }}>
        <Interactive.Div
          name="Legend"
          style={{
            display: "flex",
            gap: 64,
            fontSize: 40,
            fontWeight: 600,
            color: "#E8EEF7",
            opacity: interpolate(frame, [5 * fps, 5.6 * fps], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.16, 1, 0.3, 1),
            }),
          }}
        >
          <span><span style={{ color: "#4CAF50" }}>●</span> Confirmed</span>
          <span><span style={{ color: "#F0A030" }}>●</span> Alternative offered</span>
          <span><span style={{ color: "#4A90E2" }}>●</span> Staff review</span>
        </Interactive.Div>
        <Interactive.Div
          name="Caption"
          style={{
            fontSize: 44,
            fontWeight: 500,
            color: "#8FA3BF",
            opacity: interpolate(frame, [7 * fps, 7.6 * fps], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.16, 1, 0.3, 1),
            }),
          }}
        >
          Decided by editable hotel policy and live room inventory. No AI guesswork.
        </Interactive.Div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
