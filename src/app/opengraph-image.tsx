import { ImageResponse } from 'next/og'

export const alt = 'Mijote — Tes recettes, réunies comme par magie'
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
          background: 'linear-gradient(180deg, #F5F1E8 0%, #EDE8E0 100%)',
        }}
      >
        <span
          style={{
            fontFamily: 'Georgia, serif',
            fontSize: 220,
            fontWeight: 700,
            lineHeight: 1,
            letterSpacing: '-0.02em',
            color: '#1A1F1A',
          }}
        >
          Mijote
        </span>
        <span
          style={{
            marginTop: 40,
            fontFamily: 'Georgia, serif',
            fontSize: 56,
            color: '#6E7A38',
            textAlign: 'center',
            lineHeight: 1.3,
            fontStyle: 'italic',
          }}
        >
          Tes recettes, réunies comme par magie
        </span>
      </div>
    ),
    { ...size }
  )
}
