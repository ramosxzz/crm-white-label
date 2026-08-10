import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { BrandMark } from "./BrandMark";
import { SceneBackground } from "./SceneBackground";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const ease = Easing.bezier(0.22, 1, 0.36, 1);

export const OutroScene = () => {
  const frame = useCurrentFrame();
  const reveal = interpolate(frame, [4, 36], [0, 1], { ...clamp, easing: ease });
  const cta = interpolate(frame, [28, 58], [0, 1], { ...clamp, easing: ease });

  return (
    <AbsoluteFill style={{ fontFamily: "Arial, Helvetica, sans-serif", color: "white", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
      <SceneBackground accent="#2563EB" />
      <div style={{ position: "absolute", top: 74, opacity: reveal }}>
        <BrandMark />
      </div>
      <div style={{ width: 1320, opacity: reveal, transform: `translateY(${(1 - reveal) * 34}px)` }}>
        <div style={{ fontSize: 91, lineHeight: 1.02, fontWeight: 720, letterSpacing: -4.5 }}>
          Mais clareza para vender.<br />Mais contexto para atender.
        </div>
        <div style={{ marginTop: 28, fontSize: 27, lineHeight: 1.5, color: "rgba(255,255,255,.53)" }}>
          Descubra como o CRM W+ pode organizar a sua operação.
        </div>
        <div
          style={{
            display: "inline-flex",
            marginTop: 48,
            padding: "22px 34px",
            backgroundColor: "white",
            color: "#05070c",
            fontSize: 21,
            fontWeight: 800,
            opacity: cta,
            transform: `translateY(${(1 - cta) * 18}px)`,
          }}
        >
          Solicite uma demonstração&nbsp;&nbsp;→
        </div>
      </div>
      <div style={{ position: "absolute", bottom: 72, fontSize: 13, fontWeight: 700, letterSpacing: 3.5, color: "rgba(255,255,255,.34)" }}>
        LEADS&nbsp;&nbsp;·&nbsp;&nbsp; WHATSAPP&nbsp;&nbsp;·&nbsp;&nbsp; FUNIL&nbsp;&nbsp;·&nbsp;&nbsp; AGENDA&nbsp;&nbsp;·&nbsp;&nbsp; AUTOMAÇÕES
      </div>
    </AbsoluteFill>
  );
};
