import { ImageResponse } from "next/og";

import { BRAND_CATCHPHRASE_BARE, BRAND_NAME, BRAND_OG_ALT, BRAND_OG_LABEL } from "@/lib/brand";
import { brandMarkDataUri } from "@/lib/brand-image";

export const alt = BRAND_OG_ALT;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 44,
        background: "linear-gradient(160deg, #2c4762 0%, #22384d 45%, #1c2f41 100%)",
        color: "#ffffff",
      }}
    >
      <img src={brandMarkDataUri()} width={176} height={176} alt="" />
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
        <div style={{ fontSize: 78, fontWeight: 700, letterSpacing: -1.5 }}>{BRAND_NAME}</div>
        <div style={{ fontSize: 30, color: "#b8c7d6" }}>{BRAND_CATCHPHRASE_BARE}</div>
        {/* A15-20: a shared link's picture says the data is invented. */}
        <div
          style={{
            marginTop: 10,
            padding: "8px 22px",
            borderRadius: 999,
            border: "2px solid #b8c7d6",
            fontSize: 28,
            fontWeight: 600,
            color: "#ffffff",
          }}
        >
          {BRAND_OG_LABEL}
        </div>
      </div>
    </div>,
    { ...size },
  );
}
