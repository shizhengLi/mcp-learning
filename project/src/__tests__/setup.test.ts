import { describe, it, expect } from '@jest/globals'

describe('Basic Setup', () => {
  it('should run basic tests', () => {
    expect(true).toBe(true)
  })

  it('should have test environment', () => {
    process.env.NODE_ENV = 'test'
    expect(process.env.NODE_ENV).toBe('test')
  })
})
