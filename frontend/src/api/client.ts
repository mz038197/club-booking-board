import { apiErrorFromResponse } from './errors.ts'
import type { BoardResponse, SlotSpec } from './types.ts'

export type BoardApi = {
  getBoard: (sessionId: string) => Promise<BoardResponse>
  replaceAvailableSlots: (sessionId: string, slots: SlotSpec[]) => Promise<void>
}

export type MockBoardApi = BoardApi & {
  book: (sessionId: string, slotId: string, bookedBy: string) => Promise<void>
  cancel: (sessionId: string, slotId: string, bookedBy: string) => Promise<void>
}

function joinUrl(baseUrl: string, path: string): string {
  const trimmed = baseUrl.replace(/\/+$/, '')
  return `${trimmed}${path}`
}

export function createHttpBoardApi(baseUrl: string, fetchImpl: typeof fetch = fetch): BoardApi {
  return {
    async getBoard(sessionId: string): Promise<BoardResponse> {
      const response = await fetchImpl(
        joinUrl(baseUrl, `/sessions/${encodeURIComponent(sessionId)}/board`),
        { headers: { Accept: 'application/json' } },
      )
      if (!response.ok) {
        throw await apiErrorFromResponse(response)
      }
      return (await response.json()) as BoardResponse
    },

    async replaceAvailableSlots(sessionId: string, slots: SlotSpec[]): Promise<void> {
      const response = await fetchImpl(
        joinUrl(baseUrl, `/sessions/${encodeURIComponent(sessionId)}/slots`),
        {
          method: 'PUT',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ slots }),
        },
      )
      if (!response.ok) {
        throw await apiErrorFromResponse(response)
      }
    },
  }
}

export function defaultApiBaseUrl(): string {
  const fromEnv = import.meta.env.VITE_API_BASE_URL
  if (typeof fromEnv === 'string' && fromEnv.trim()) {
    return fromEnv.trim()
  }
  return 'http://localhost:3000'
}
