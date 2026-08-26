interface LandingSocialCardProps {
  readonly height: 600 | 630;
}

export function LandingSocialCard({ height }: LandingSocialCardProps) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        position: "relative",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: height === 630 ? "62px 76px" : "54px 76px",
        color: "#17271f",
        background: "#f3ebdc",
        fontFamily: "sans-serif",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: "0 auto 0 48px",
          width: "2px",
          display: "flex",
          background: "#cfc3b1",
        }}
      />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center" }}>
          <div
            style={{
              width: "68px",
              height: "68px",
              display: "flex",
              position: "relative",
              marginRight: "22px",
            }}
          >
            <div
              style={{
                position: "absolute",
                left: "0",
                top: "20px",
                width: "30px",
                height: "30px",
                display: "flex",
                background: "#a64b2a",
                transform: "rotate(45deg)",
              }}
            />
            <div
              style={{
                position: "absolute",
                left: "20px",
                top: "0",
                width: "48px",
                height: "68px",
                display: "flex",
                background: "#123d2c",
              }}
            />
            <div
              style={{
                position: "absolute",
                right: "10px",
                top: "18px",
                width: "14px",
                height: "14px",
                display: "flex",
                background: "#fffaf0",
              }}
            />
            <div
              style={{
                position: "absolute",
                right: "9px",
                bottom: "11px",
                width: "24px",
                height: "5px",
                display: "flex",
                background: "#fffaf0",
              }}
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                display: "flex",
                color: "#123d2c",
                fontSize: "48px",
                fontWeight: 800,
                lineHeight: 1,
                letterSpacing: "-0.04em",
              }}
            >
              TryVit
            </div>
            <div
              style={{
                display: "flex",
                marginTop: "10px",
                color: "#526158",
                fontSize: "15px",
                fontWeight: 700,
                letterSpacing: "0.11em",
                textTransform: "uppercase",
              }}
            >
              Food intelligence · Poland and Germany
            </div>
          </div>
        </div>
        <div
          style={{
            display: "flex",
            padding: "10px 14px",
            border: "1px solid #817564",
            color: "#8e3d22",
            fontSize: "15px",
            fontWeight: 800,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
          }}
        >
          01 → 02 → 03 → 04
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", maxWidth: "920px" }}>
        <div
          style={{
            display: "flex",
            color: "#8e3d22",
            fontSize: "17px",
            fontWeight: 800,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
          }}
        >
          Food intelligence · Dane o żywności · Lebensmittelinformation
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            marginTop: "18px",
            fontSize: height === 630 ? "46px" : "42px",
            fontWeight: 750,
            lineHeight: 1.08,
            letterSpacing: "-0.045em",
          }}
        >
          <div style={{ display: "flex" }}>Evidence stays visible.</div>
          <div style={{ display: "flex" }}>Źródła pozostają widoczne.</div>
          <div style={{ display: "flex" }}>Evidenz bleibt sichtbar.</div>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          paddingTop: "18px",
          borderTop: "2px solid #817564",
          color: "#526158",
          fontSize: "19px",
        }}
      >
        <div style={{ display: "flex" }}>01 → 02 → 03 → 04</div>
        <div style={{ display: "flex", fontWeight: 700 }}>tryvit.app</div>
      </div>
    </div>
  );
}
