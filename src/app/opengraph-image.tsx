import { ImageResponse } from 'next/og'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

export const runtime = 'nodejs'
export const alt = 'Mijote'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

// Fraunces isn't available to Satori unless we hand it the font data. Pull just
// the "Mijote" glyphs from Google Fonts (same source next/font already uses at
// build → no new dependency); no UA → Google returns a TrueType src we can read.
async function loadFraunces(text: string): Promise<ArrayBuffer> {
  const url = `https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,700&text=${encodeURIComponent(text)}`
  const css = await (await fetch(url)).text()
  const match = css.match(/src: url\((https:\/\/[^)]+)\) format\('(?:opentype|truetype)'\)/)
  if (!match) throw new Error('Fraunces font source not found in Google CSS')
  return (await fetch(match[1])).arrayBuffer()
}

// Brand hero for link previews — mirrors the pre-foyer onboarding screen:
// sage radial background, cocotte mark, "Mijote" wordmark in Fraunces (cream).
export default async function OpenGraphImage() {
  const fraunces = await loadFraunces('Mijote')
  const cocotte = await readFile(
    join(process.cwd(), 'public', 'cocotte-illustration.svg'),
  )
  const cocotteUri = `data:image/svg+xml;base64,${cocotte.toString('base64')}`

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
          background:
            'radial-gradient(circle at 50% 42%, #B6C4A8 0%, #9AAD8C 55%, #6B7F5C 100%)',
        }}
      >
        <img src={cocotteUri} width={300} height={300} alt="" />
        <span
          style={{
            fontFamily: 'Fraunces',
            fontSize: 210,
            fontWeight: 700,
            lineHeight: 1,
            letterSpacing: '-0.03em',
            color: '#F5F1E8',
            marginTop: 4,
          }}
        >
          Mijote
        </span>
      </div>
    ),
    {
      ...size,
      fonts: [{ name: 'Fraunces', data: fraunces, style: 'normal', weight: 700 }],
    },
  )
}
