import { ImageResponse } from "next/og"

export const runtime = "nodejs"
export const alt = "SportsPicks Analytics — Análisis deportivo cuantitativo"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "linear-gradient(135deg, #0d2b22 0%, #09090b 60%)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "20px", marginBottom: "32px" }}>
          <div
            style={{
              width: "72px",
              height: "72px",
              borderRadius: "20px",
              background: "linear-gradient(135deg, #34d399, #22d3ee)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "40px",
            }}
          >
            💎
          </div>
          <div style={{ fontSize: "34px", color: "#a1a1aa", fontWeight: 600 }}>
            SportsPicks Analytics
          </div>
        </div>
        <div
          style={{
            fontSize: "76px",
            fontWeight: 800,
            color: "white",
            lineHeight: 1.1,
            letterSpacing: "-2px",
          }}
        >
          Análisis deportivo
        </div>
        <div
          style={{
            fontSize: "76px",
            fontWeight: 800,
            background: "linear-gradient(90deg, #34d399, #22d3ee)",
            backgroundClip: "text",
            color: "transparent",
            lineHeight: 1.1,
            letterSpacing: "-2px",
          }}
        >
          cuantitativo y real
        </div>
        <div style={{ fontSize: "30px", color: "#71717a", marginTop: "32px" }}>
          Value picks · cuotas reales · modelo estadístico · cero invención
        </div>
      </div>
    ),
    { ...size },
  )
}
