export type SlotStatus = 'open' | 'booked'

export type SlotSpec = {
  date: string
  start: string
  end: string
  room: string
}

export type BoardSlot = SlotSpec & {
  slot_id: string
  status: SlotStatus
  booked_by?: string
}

export type BoardResponse = {
  slots: BoardSlot[]
}

export type ReplaceSlotsRequest = {
  slots: SlotSpec[]
}

export type ApiErrorCode =
  | 'SLOT_TAKEN'
  | 'NOT_OWNER'
  | 'NOT_FOUND'
  | 'INVALID_SLOT'
  | 'CONFLICT'
  | 'INVALID_POSTER'
  | 'INVALID_REQUEST'

export const API_ERROR_CODES: readonly ApiErrorCode[] = [
  'SLOT_TAKEN',
  'NOT_OWNER',
  'NOT_FOUND',
  'INVALID_SLOT',
  'CONFLICT',
  'INVALID_POSTER',
  'INVALID_REQUEST',
]
