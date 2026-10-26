import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";

// Slow-drifting navy gradient with a faint grid: the shared stage for every scene.
export const Backdrop: React.FC = () => {
  const frame = useCurrentFrame();
  const drift = interpolate(frame, [0, 600], [0, 120]);

  return (
    <AbsoluteFill style={{ backgroundColor: "#0B1426", overflow: "hidden" }}>
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(circle at 20% 15%, rgba(31,56,100,0.85), transparent 55%), radial-gradient(circle at 85% 90%, rgba(242,181,68,0.12), transparent 50%)",
          translate: `${drift * 0.2}px ${drift * 0.1}px`,
        }}
      />
      <AbsoluteFill
        style={{
          backgroundImage:
            "linear-gradient(rgba(143,163,191,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(143,163,191,0.07) 1px, transparent 1px)",
          backgroundSize: "80px 80px",
          backgroundPosition: `${drift}px ${drift * 0.5}px`,
        }}
      />
    </AbsoluteFill>
  );
};
