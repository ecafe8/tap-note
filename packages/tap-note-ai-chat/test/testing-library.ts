import '@testing-library/jest-dom'
import { cleanup } from '@testing-library/react/pure'
import { afterEach } from 'bun:test'

// bun:test 不像 jest 自动 cleanup,需手动注册 afterEach
afterEach(() => {
  cleanup()
})
