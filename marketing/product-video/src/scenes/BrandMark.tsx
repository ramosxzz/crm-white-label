export const BrandMark = ({ muted = false }: { muted?: boolean }) => {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 18, opacity: muted ? 0.62 : 1 }}>
      <div
        style={{
          width: 58,
          height: 58,
          border: "1px solid rgba(255,255,255,.22)",
          background: "rgba(255,255,255,.08)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 19,
          fontWeight: 800,
          letterSpacing: -1,
          color: "white",
        }}
      >
        W+
      </div>
      <div>
        <div style={{ fontSize: 24, fontWeight: 720, letterSpacing: -0.5, color: "white" }}>Solaire W+</div>
        <div style={{ marginTop: 4, fontSize: 10, fontWeight: 700, letterSpacing: 4, color: "rgba(255,255,255,.42)" }}>CRM</div>
      </div>
    </div>
  );
};
