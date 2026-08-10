import { AbsoluteFill, interpolate, random, useCurrentFrame } from "remotion";

export const SceneBackground = ({ accent = "#2563EB", particles = true }: { accent?: string; particles?: boolean }) => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill style={{ overflow: "hidden", backgroundColor: "#05070c" }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at 70% 28%, ${accent}36 0%, transparent 38%), radial-gradient(circle at 18% 82%, #4F46E528 0%, transparent 34%)`,
        }}
      />
      <AbsoluteFill
        style={{
          opacity: 0.12,
          backgroundImage:
            "linear-gradient(rgba(148,163,184,.2) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,.2) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
          maskImage: "linear-gradient(to bottom, black, transparent 88%)",
        }}
      />
      {particles &&
        Array.from({ length: 76 }).map((_, index) => {
          const x = random(`particle-x-${index}`) * 1920;
          const y = random(`particle-y-${index}`) * 1080;
          const size = 2 + random(`particle-size-${index}`) * 4;
          const drift = interpolate(frame, [0, 120], [0, 28 + random(`particle-drift-${index}`) * 32]);
          const opacity = 0.08 + random(`particle-opacity-${index}`) * 0.28;
          return (
            <div
              key={index}
              style={{
                position: "absolute",
                left: x,
                top: y + drift,
                width: size,
                height: size,
                backgroundColor: index % 4 === 0 ? accent : "#E0F2FE",
                opacity,
                boxShadow: index % 4 === 0 ? `0 0 12px ${accent}` : undefined,
              }}
            />
          );
        })}
      <AbsoluteFill style={{ background: "radial-gradient(circle at center, transparent 30%, rgba(5,7,12,.7) 100%)" }} />
    </AbsoluteFill>
  );
};
