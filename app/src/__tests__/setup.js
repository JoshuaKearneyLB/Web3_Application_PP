import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// Clear the DOM and localStorage between tests
afterEach(() => {
  cleanup()
  localStorage.clear()
})
