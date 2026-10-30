import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";

export const alt = "Just In Time Study Hub and Coworking Space in Manila";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpenGraphImage() {
  const logo = await readFile(path.join(process.cwd(), "public", "images", "logo.png"));
  const logoUrl = `data:image/png;base64,${logo.toString("base64")}`;

  return new ImageResponse(
    <div
      style={{
        alignItems: "center",
        background: "#fffcf7",
        color: "#2d2520",
        display: "flex",
        height: "100%",
        justifyContent: "center",
        padding: "64px 76px",
        position: "relative",
        width: "100%",
      }}>
      <div
        style={{
          background: "#e5a930",
          borderRadius: 999,
          height: 360,
          opacity: 0.13,
          position: "absolute",
          right: -80,
          top: -110,
          width: 360,
        }}
      />
      <div
        style={{
          background: "#d97757",
          borderRadius: 999,
          bottom: -160,
          height: 360,
          left: -120,
          opacity: 0.09,
          position: "absolute",
          width: 360,
        }}
      />
      <div
        style={{
          alignItems: "flex-start",
          display: "flex",
          flexDirection: "column",
          maxWidth: 1020,
          width: "100%",
        }}>
        <div
          style={{
            display: "flex",
          }}>
          <img
            alt="Just In Time Study Hub and Coworking Space"
            src={logoUrl}
            style={{
              height: 142,
              objectFit: "contain",
              width: 294,
            }}
          />
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            fontSize: 70,
            fontWeight: 800,
            letterSpacing: -3,
            lineHeight: 1.06,
            marginTop: 50,
          }}>
          <span>You are</span>
          <span style={{ color: "#c4860e" }}>just in time.</span>
        </div>
        <div
          style={{
            color: "#6b5e52",
            display: "flex",
            fontSize: 29,
            marginTop: 42,
          }}>
          Study Hub &amp; Coworking Spaces · Mendiola, Manila
        </div>
      </div>
    </div>,
    size,
  );
}
