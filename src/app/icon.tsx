import { ImageResponse } from 'next/og'

export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 32,
          height: 32,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#F8FAF7',
          borderRadius: 8,
        }}
      >
        <span
          style={{
            fontFamily: 'Georgia, serif',
            fontSize: 18,
            fontWeight: 700,
            lineHeight: 1,
            letterSpacing: '-0.02em',
          }}
        >
          <span style={{ color: '#1A1F1A' }}>a</span>
          <span style={{ color: '#6E7A38' }}>t</span>
        </span>
      </div>
    ),
    { ...size }
  )
}
