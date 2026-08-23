export function mockLocalStorage() {
  const data = new Map()
  globalThis.localStorage = {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
  }
  return data
}

export function readDB() {
  return JSON.parse(globalThis.localStorage.getItem('muye-design-platform-v5'))
}
