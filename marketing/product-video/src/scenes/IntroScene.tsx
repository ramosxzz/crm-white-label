import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { BrandMark } from "./BrandMark";
import { SceneBackground } from "./SceneBackground";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const ease = Easing.bezier(0.22, 1, 0.36, 1);

export const IntroScene = () => {
  const frame = useCurrentFrame();
  const entrance = interpolate(frame, [0, 28], [0, 1], { ...clamp, easing: ease });
  const titleReveal = interpolate(frame, [12, 52], [0, 1], { ...clamp, easing: ease });
  const previewReveal = interpolate(frame, [36, 78], [0, 1], { ...clamp, easing: ease });

  return (
    <AbsoluteFill style={{ fontFamily: "Arial, Helvetica, sans-serif", color: "white" }}>
      <SceneBackground accent="#2563EB" />
      <div style={{ position: "absolute", left: 86, top: 64, opacity: entrance, transform: `translateY(${(1 - entrance) * -14}px)` }}>
        <BrandMark />
      </div>
      <div style={{ position: "absolute", right: 86, top: 84, fontSize: 13, fontWeight: 700, letterSpacing: 4, color: "rgba(165,243,252,.72)", opacity: entrance }}>
        SUA OPERAÇÃO, CONECTADA
      </div>

      <div style={{ position: "absolute", inset: "160px 100px 90px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
        <div
          style={{
            fontSize: 174,
            lineHeight: 0.94,
            fontWeight: 820,
            letterSpacing: -10,
            background: "linear-gradient(100deg, #FFFFFF 8%, #93C5FD 58%, #22D3EE 100%)",
            WebkitBackgroundClip: "text",
            color: "transparent",
            opacity: titleReveal,
            transform: `translateY(${(1 - titleReveal) * 42}px) scale(${0.96 + titleReveal * 0.04})`,
          }}
        >
          CRM W+
        </div>
        <div style={{ marginTop: 30, fontSize: 43, fontWeight: 560, letterSpacing: -1.7, opacity: titleReveal }}>
          Sua operação inteira. Uma experiência só.
        </div>
        <div style={{ marginTop: 20, fontSize: 22, lineHeight: 1.5, color: "rgba(255,255,255,.54)", opacity: titleReveal }}>
          Leads, atendimento, agenda, automações e gestão comercial em um único ambiente.
        </div>

        <div
          style={{
            position: "absolute",
            top: 315,
            width: 1060,
            height: 596,
            overflow: "hidden",
            border: "1px solid rgba(255,255,255,.16)",
            backgroundColor: "#090b10",
            boxShadow: "0 50px 130px rgba(0,0,0,.62)",
            opacity: previewReveal,
            transform: `translateY(${(1 - previewReveal) * 54}px) perspective(1400px) rotateX(${(1 - previewReveal) * 5}deg)`,
          }}
        >
          <Img
            src={staticFile("showcase/dashboard.png")}
            style={{ width: "100%", height: "100%", objectFit: "contain", objectPosition: "top" }}
          />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent 38%, rgba(5,7,12,.9) 100%)" }} />
        </div>
      </div>
    </AbsoluteFill>
  );
};
