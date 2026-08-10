import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { BrandMark } from "./BrandMark";
import { SceneBackground } from "./SceneBackground";

type FeatureSceneProps = {
  image: string;
  eyebrow: string;
  title: string;
  description: string;
  accent: string;
  index: string;
};

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const ease = Easing.bezier(0.22, 1, 0.36, 1);

export const FeatureScene = ({ image, eyebrow, title, description, accent, index }: FeatureSceneProps) => {
  const frame = useCurrentFrame();
  const textIn = interpolate(frame, [4, 31], [0, 1], { ...clamp, easing: ease });
  const screenIn = interpolate(frame, [8, 38], [0, 1], { ...clamp, easing: ease });
  const screenScale = interpolate(frame, [0, 105], [1.035, 1], clamp);
  const progress = interpolate(frame, [0, 105], [0, 1], clamp);

  return (
    <AbsoluteFill style={{ fontFamily: "Arial, Helvetica, sans-serif", color: "white" }}>
      <SceneBackground accent={accent} particles={false} />
      <div style={{ position: "absolute", left: 80, top: 54 }}>
        <BrandMark muted />
      </div>
      <div style={{ position: "absolute", right: 80, top: 68, display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ width: 140, height: 2, backgroundColor: "rgba(255,255,255,.12)" }}>
          <div style={{ width: `${progress * 100}%`, height: "100%", backgroundColor: accent }} />
        </div>
        <div style={{ fontFamily: "monospace", fontSize: 14, color: "rgba(255,255,255,.42)" }}>{index} / 04</div>
      </div>

      <div style={{ position: "absolute", left: 92, top: 218, width: 490, opacity: textIn, transform: `translateX(${(1 - textIn) * -35}px)` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 14, fontWeight: 800, letterSpacing: 3.2, textTransform: "uppercase", color: accent }}>
          <span style={{ width: 34, height: 2, backgroundColor: accent }} />
          {eyebrow}
        </div>
        <div style={{ marginTop: 34, fontSize: 66, lineHeight: 1.04, fontWeight: 680, letterSpacing: -3.2 }}>{title}</div>
        <div style={{ marginTop: 28, fontSize: 23, lineHeight: 1.52, color: "rgba(255,255,255,.52)" }}>{description}</div>
        <div style={{ marginTop: 54, display: "flex", gap: 12 }}>
          {["Leads", "Equipe", "Resultados"].map((label) => (
            <span key={label} style={{ border: "1px solid rgba(255,255,255,.12)", padding: "11px 15px", fontSize: 12, fontWeight: 700, letterSpacing: 1.4, textTransform: "uppercase", color: "rgba(255,255,255,.42)" }}>
              {label}
            </span>
          ))}
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          left: 650,
          top: 184,
          width: 1180,
          height: 712,
          overflow: "hidden",
          border: "1px solid rgba(255,255,255,.16)",
          backgroundColor: "#090b10",
          boxShadow: "0 52px 140px rgba(0,0,0,.62)",
          opacity: screenIn,
          transform: `translateX(${(1 - screenIn) * 48}px) scale(${screenScale})`,
          transformOrigin: "center",
        }}
      >
        <div style={{ height: 48, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px", borderBottom: "1px solid rgba(255,255,255,.1)", background: "rgba(255,255,255,.035)" }}>
          <div style={{ display: "flex", gap: 8 }}>
            <span style={{ width: 9, height: 9, backgroundColor: "rgba(255,255,255,.24)" }} />
            <span style={{ width: 9, height: 9, backgroundColor: "rgba(255,255,255,.16)" }} />
            <span style={{ width: 9, height: 9, backgroundColor: "rgba(255,255,255,.1)" }} />
          </div>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 3, color: "rgba(255,255,255,.34)" }}>SOLAIRE W+ CRM</div>
          <div style={{ width: 54, height: 9, border: "1px solid rgba(255,255,255,.12)" }} />
        </div>
        <div style={{ position: "relative", width: "100%", height: 664, overflow: "hidden", backgroundColor: "#000" }}>
          <Img src={staticFile(image)} style={{ width: "100%", height: "100%", objectFit: "contain", objectPosition: "top" }} />
          <div style={{ position: "absolute", inset: 0, boxShadow: `inset 0 0 100px ${accent}10` }} />
        </div>
      </div>

      <div style={{ position: "absolute", left: 92, right: 92, bottom: 48, height: 1, backgroundColor: "rgba(255,255,255,.1)" }} />
    </AbsoluteFill>
  );
};
