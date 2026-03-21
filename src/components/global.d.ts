export {}

declare global {
  interface globalThis {
    electronAPI: ElectronAPI
  }

  interface ElectronAPI {
    invoke(channel: string, data?: unknown): Promise<unknown>
    on(channel: string, callback: (data: unknown) => void): () => void
  }

  var electronAPI: ElectronAPI
}