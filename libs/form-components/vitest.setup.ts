// Расширенные матчеры для DOM тестирования
import '@testing-library/jest-dom/vitest'
// Мок для IndexedDB (требуется для offline функций)
import 'fake-indexeddb/auto'

// Polyfill для structuredClone (требуется для Chakra UI v3)
if (typeof globalThis.structuredClone === 'undefined') {
  globalThis.structuredClone = <T>(obj: T): T => JSON.parse(JSON.stringify(obj))
}
