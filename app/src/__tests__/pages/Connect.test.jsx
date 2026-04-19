import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import Connect from '../../pages/Connect.jsx'

describe('Connect page', () => {
  it('renders the connect wallet heading', () => {
    render(<Connect />)
    expect(screen.getByRole('heading', { name: /connect your wallet/i })).toBeInTheDocument()
  })

  it('renders the instructional text', () => {
    render(<Connect />)
    expect(screen.getByText(/Access to the app is gated/i)).toBeInTheDocument()
  })

  it('renders without requiring any props', () => {
    expect(() => render(<Connect />)).not.toThrow()
  })
})
