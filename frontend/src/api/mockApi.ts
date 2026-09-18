import type { MockBoardApi } from './client.ts'
import { ApiError } from './errors.ts'
import type { BoardSlot, BoardResponse, SlotSpec } from './types.ts'
import { formatSlotId, slotKey } from '../board/slotId.ts'

function cloneSlots(slots: BoardSlot[]): BoardSlot[] {
  return slots.map((slot) => ({ ...slot }))
}

function slotIdentity(slot: SlotSpec): string {
  return slotKey(slot)
}

export function createMockBoardApi(seed?: Record<string, BoardSlot[]>): MockBoardApi {
  const sessions = new Map<string, BoardSlot[]>()
  if (seed) {
    for (const [sessionId, slots] of Object.entries(seed)) {
      sessions.set(sessionId, cloneSlots(slots))
    }
  }

  const getSlots = (sessionId: string): BoardSlot[] => {
    const existing = sessions.get(sessionId)
    if (!existing) {
      sessions.set(sessionId, [])
      return []
    }
    return existing
  }

  const api: MockBoardApi = {
    async getBoard(sessionId: string): Promise<BoardResponse> {
      return { slots: cloneSlots(getSlots(sessionId)) }
    },

    async replaceAvailableSlots(sessionId: string, next: SlotSpec[]): Promise<void> {
      const current = getSlots(sessionId)
      const nextKeys = new Set(next.map(slotIdentity))
      const bookedBeingRemoved = current.filter(
        (slot) => slot.status === 'booked' && !nextKeys.has(slotIdentity(slot)),
      )
      if (bookedBeingRemoved.length > 0) {
        throw new ApiError(409, 'CONFLICT', { code: 'CONFLICT' }, 'API error CONFLICT (409)')
      }

      const previousByKey = new Map(current.map((slot) => [slotIdentity(slot), slot]))
      const replaced: BoardSlot[] = next.map((spec) => {
        const previous = previousByKey.get(slotIdentity(spec))
        if (previous) {
          return { ...previous, ...spec, slot_id: formatSlotId(spec) }
        }
        return {
          ...spec,
          slot_id: formatSlotId(spec),
          status: 'open',
        }
      })
      sessions.set(sessionId, replaced)
    },

    async book(sessionId: string, slotId: string, bookedBy: string): Promise<void> {
      const slots = getSlots(sessionId)
      const slot = slots.find((item) => item.slot_id === slotId)
      if (!slot) {
        throw new ApiError(404, 'NOT_FOUND', { code: 'NOT_FOUND' }, 'API error NOT_FOUND (404)')
      }
      if (slot.status === 'booked') {
        throw new ApiError(409, 'SLOT_TAKEN', { code: 'SLOT_TAKEN' }, 'API error SLOT_TAKEN (409)')
      }
      slot.status = 'booked'
      slot.booked_by = bookedBy
    },

    async cancel(sessionId: string, slotId: string, bookedBy: string): Promise<void> {
      const slots = getSlots(sessionId)
      const slot = slots.find((item) => item.slot_id === slotId)
      if (!slot || slot.status !== 'booked') {
        throw new ApiError(404, 'NOT_FOUND', { code: 'NOT_FOUND' }, 'API error NOT_FOUND (404)')
      }
      if (slot.booked_by !== bookedBy) {
        throw new ApiError(403, 'NOT_OWNER', { code: 'NOT_OWNER' }, 'API error NOT_OWNER (403)')
      }
      slot.status = 'open'
      delete slot.booked_by
    },
  }

  return api
}

export const DEMO_SESSION_ID = 'demo'

export const DEMO_SLOTS: BoardSlot[] = [
  {
    slot_id: '2026-09-25_13:00-15:00_301',
    date: '2026-09-25',
    start: '13:00',
    end: '15:00',
    room: '301',
    status: 'open',
  },
  {
    slot_id: '2026-09-25_13:00-15:00_302',
    date: '2026-09-25',
    start: '13:00',
    end: '15:00',
    room: '302',
    status: 'booked',
    booked_by: '第三組',
  },
  {
    slot_id: '2026-09-25_15:10-17:10_301',
    date: '2026-09-25',
    start: '15:10',
    end: '17:10',
    room: '301',
    status: 'open',
  },
  {
    slot_id: '2026-09-25_15:10-17:10_303',
    date: '2026-09-25',
    start: '15:10',
    end: '17:10',
    room: '303',
    status: 'open',
  },
  {
    slot_id: '2026-09-25_15:10-17:10_304',
    date: '2026-09-25',
    start: '15:10',
    end: '17:10',
    room: '304',
    status: 'booked',
    booked_by: '第五組',
  },
  {
    slot_id: '2026-09-25_15:10-17:10_305',
    date: '2026-09-25',
    start: '15:10',
    end: '17:10',
    room: '305',
    status: 'open',
  },
  {
    slot_id: '2026-09-26_13:00-15:00_301',
    date: '2026-09-26',
    start: '13:00',
    end: '15:00',
    room: '301',
    status: 'open',
  },
]

export function createDemoMockApi(): MockBoardApi {
  return createMockBoardApi({ [DEMO_SESSION_ID]: DEMO_SLOTS })
}
