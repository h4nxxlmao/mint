import { ImageResponse } from "next/og";
import { site } from "@/lib/site";

export const alt = "mint - cryptographically secure secrets and IDs from your terminal";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          overflow: "hidden",
          background: "#070a08",
          color: "#edf6f0",
          padding: "58px 64px",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            position: "absolute",
            right: "-80px",
            top: "-160px",
            width: "730px",
            height: "730px",
            display: "flex",
            background: "radial-gradient(circle, rgba(80,190,140,0.26) 0%, rgba(7,10,8,0) 68%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: "1px",
            display: "flex",
            background: "rgba(141,240,195,0.22)",
          }}
        />

        <div style={{ display: "flex", flexDirection: "column", width: "100%", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <div
              style={{
                width: "46px",
                height: "46px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "1px solid rgba(141,240,195,0.4)",
                borderRadius: "12px",
                background: "rgba(141,240,195,0.1)",
                color: "#8df0c3",
                fontSize: "22px",
                marginRight: "14px",
              }}
            >
              m
            </div>
            <div style={{ display: "flex", fontSize: "27px", letterSpacing: "-1px" }}>
              mint<span style={{ color: "#8df0c3" }}>_</span>
            </div>
            <div
              style={{
                display: "flex",
                marginLeft: "22px",
                padding: "7px 13px",
                border: "1px solid #2a4436",
                borderRadius: "8px",
                color: "#a0b4a8",
                fontSize: "16px",
              }}
            >
              @xnah/mint
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
            <div style={{ display: "flex", flexDirection: "column", width: "660px" }}>
              <div
                style={{
                  display: "flex",
                  color: "#8df0c3",
                  fontSize: "17px",
                  letterSpacing: "2px",
                  textTransform: "uppercase",
                  marginBottom: "18px",
                }}
              >
                CSPRNG only. Zero dependencies.
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  fontSize: "64px",
                  lineHeight: 1.04,
                  letterSpacing: "-3.4px",
                  fontWeight: 700,
                }}
              >
                <span>Randomness</span>
                <span>you can ship.</span>
              </div>
              <div
                style={{
                  display: "flex",
                  color: "#a0b4a8",
                  fontSize: "24px",
                  lineHeight: 1.45,
                  marginTop: "22px",
                  maxWidth: "600px",
                }}
              >
                Secure secrets, passwords and IDs from your terminal. Protect them with mint guard.
              </div>
            </div>

            <div
              style={{
                width: "380px",
                display: "flex",
                flexDirection: "column",
                border: "1px solid #22352b",
                borderRadius: "18px",
                background: "#0a110d",
                padding: "22px",
                boxShadow: "0 30px 70px rgba(0,0,0,0.45)",
              }}
            >
              <div style={{ display: "flex", color: "#7d9186", fontSize: "14px", marginBottom: "16px" }}>
                mint session
              </div>
              <div style={{ display: "flex", color: "#8df0c3", fontSize: "18px", marginBottom: "8px" }}>
                $ mint uuid
              </div>
              <div style={{ display: "flex", color: "#edf6f0", fontSize: "17px", marginBottom: "20px" }}>
                33c6e3de-6cb2-4075-b21c
              </div>
              <div style={{ display: "flex", color: "#8df0c3", fontSize: "18px", marginBottom: "8px" }}>
                $ mint guard scan
              </div>
              <div style={{ display: "flex", color: "#f4c874", fontSize: "16px", marginBottom: "5px" }}>
                ! 1 finding in 184 files
              </div>
              <div style={{ display: "flex", color: "#ff8b8b", fontSize: "15px", marginBottom: "18px" }}>
                CRITICAL github-token ghp_...9f
              </div>
              <div style={{ display: "flex", color: "#7d9186", fontSize: "14px" }}>
                preview only · no network
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {["39 generators", "32 guard rules", "MIT license"].map((item) => (
              <div
                key={item}
                style={{
                  display: "flex",
                  border: "1px solid #2a4436",
                  borderRadius: "7px",
                  padding: "7px 12px",
                  color: "#a0b4a8",
                  fontSize: "15px",
                  marginRight: "8px",
                }}
              >
                {item}
              </div>
            ))}
            <div style={{ display: "flex", color: "#7d9186", fontSize: "16px", marginLeft: "auto" }}>{site.url}</div>
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
