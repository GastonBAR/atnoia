import { ImageResponse } from "next/og";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#0f294a",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <div
            style={{
              width: 10,
              height: 24,
              background: "#ffffff",
              borderRadius: 3,
            }}
          />
          <div
            style={{
              width: 10,
              height: 10,
              background: "#ffffff",
              borderRadius: "50%",
              marginTop: 7,
            }}
          />
        </div>
      </div>
    ),
    { ...size },
  );
}
