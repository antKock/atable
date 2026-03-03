import { ImageResponse } from 'next/og'

export const alt = 'atable — Votre bibliothèque de recettes personnelle'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#F8FAF7',
        }}
      >
        <span
          style={{
            fontFamily: 'Georgia, serif',
            fontSize: 160,
            fontWeight: 700,
            lineHeight: 1,
            letterSpacing: '-0.02em',
          }}
        >
          <span style={{ color: '#1A1F1A' }}>a</span>
          <span style={{ color: '#6E7A38' }}>table</span>
        </span>
        <span
          style={{
            marginTop: 32,
            fontFamily: 'sans-serif',
            fontSize: 44,
            color: '#6B6B6B',
          }}
        >
          Votre bibliothèque de recettes personnelle
        </span>
      </div>
    ),
    { ...size }
  )
}
