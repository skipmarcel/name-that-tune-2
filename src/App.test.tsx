import { render, screen } from '@testing-library/react'
import App from './App'

describe('App', () => {
  it('renders the game title', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: /song sleuth/i })).toBeInTheDocument()
  })
})
