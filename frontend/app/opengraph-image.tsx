import { ImageResponse } from "next/og";

export const alt = "Just In Time Study Hub and Coworking Space in Manila";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "center",
          background:
            "linear-gradient(135deg, #fffcf7 0%, #fff2d6 58%, #f6d58f 100%)",
          color: "#2d2520",
          display: "flex",
          height: "100%",
          justifyContent: "center",
          padding: "64px 76px",
          position: "relative",
          width: "100%",
        }}
      >
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
          }}
        >
          <div
            style={{
              alignItems: "center",
              display: "flex",
              fontSize: 25,
              fontWeight: 700,
              letterSpacing: 2,
              textTransform: "uppercase",
            }}
          >
            <span
              style={{
                alignItems: "center",
                background: "#e5a930",
                borderRadius: 18,
                color: "white",
                display: "flex",
                fontSize: 24,
                height: 64,
                justifyContent: "center",
                marginRight: 20,
                width: 64,
              }}
            >
              JIT
            </span>
            Just In Time Study Hub
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
            }}
          >
            <span>Your space for</span>
            <span style={{ color: "#c4860e" }}>focused success.</span>
          </div>
          <div
            style={{
              color: "#6b5e52",
              display: "flex",
              fontSize: 29,
              marginTop: 42,
            }}
          >
            Study &amp; coworking spaces · Mendiola, Manila
          </div>
        </div>
      </div>
    ),
    size,
  );
}
