import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 32,
          height: 32,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
          borderRadius: 8,
        }}
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle cx="14" cy="14" r="9" stroke="white" strokeWidth="2.5" fill="none" />
          <line x1="21" y1="21" x2="28" y2="28" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="14" cy="14" r="3.5" stroke="white" strokeWidth="1.5" fill="none" opacity="0.6" />
          <circle cx="14" cy="14" r="1.2" fill="white" />
        </svg>
      </div>
    ),
    { ...size }
  );
}
