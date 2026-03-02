import { describe, it, expect } from 'vitest'
import { generateJoinCode } from './join-code'

const CODE_REGEX = /^[A-Z]+-\d{4}$/

describe('generateJoinCode', () => {
  it('returns a string matching /^[A-Z]+-\\d{4}$/', () => {
    const code = generateJoinCode()
    expect(code).toMatch(CODE_REGEX)
  })

  it('zero-pads numbers below 1000', () => {
    // Run many times to hit low numbers statistically
    const codes = Array.from({ length: 200 }, () => generateJoinCode())
    codes.forEach(code => {
      expect(code).toMatch(CODE_REGEX)
      const digits = code.split('-')[1]
      expect(digits).toHaveLength(4)
    })
  })

  it('produces different codes on subsequent calls', () => {
    const codes = new Set(Array.from({ length: 20 }, () => generateJoinCode()))
    // Should have at least some variety across 20 calls
    expect(codes.size).toBeGreaterThan(1)
  })

  it('contains only uppercase letters before the dash', () => {
    for (let i = 0; i < 50; i++) {
      const code = generateJoinCode()
      const word = code.split('-')[0]
      expect(word).toMatch(/^[A-Z]+$/)
    }
  })
})
