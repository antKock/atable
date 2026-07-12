// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import RecoveryCodeInput from './RecoveryCodeInput'

afterEach(cleanup)

// Régression #3 : coller le code reçu par email doit fonctionner (sur certaines
// WebView mobiles, coller dans un champ contrôlé ne déclenche pas d'onChange
// fiable — d'où le handler onPaste explicite).
describe('RecoveryCodeInput — coller le code', () => {
  const setup = () => {
    const onChange = vi.fn()
    render(<RecoveryCodeInput value="" onChange={onChange} label="Code à 6 chiffres" />)
    return { onChange, input: screen.getByLabelText('Code à 6 chiffres') }
  }

  const paste = (input: HTMLElement, text: string) =>
    fireEvent.paste(input, { clipboardData: { getData: () => text } })

  it('extrait les 6 chiffres du presse-papier', () => {
    const { onChange, input } = setup()
    paste(input, '123456')
    expect(onChange).toHaveBeenCalledWith('123456')
  })

  it('nettoie séparateurs et espaces collés (« 123 456 », « 12-34-56 »)', () => {
    const { onChange, input } = setup()
    paste(input, '  12-34 56 ')
    expect(onChange).toHaveBeenCalledWith('123456')
  })

  it('tronque au-delà de 6 chiffres', () => {
    const { onChange, input } = setup()
    paste(input, '12345678')
    expect(onChange).toHaveBeenCalledWith('123456')
  })

  it('ignore un collage sans aucun chiffre', () => {
    const { onChange, input } = setup()
    paste(input, 'aucun-chiffre')
    expect(onChange).not.toHaveBeenCalled()
  })
})
