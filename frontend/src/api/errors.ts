import { API_ERROR_CODES, type ApiErrorCode } from './types.ts'

export class ApiError extends Error {
  readonly status: number
  readonly code: ApiErrorCode | undefined
  readonly body: unknown

  constructor(status: number, code: ApiErrorCode | undefined, body: unknown, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.body = body
  }
}

export function isApiErrorCode(value: unknown): value is ApiErrorCode {
  return typeof value === 'string' && (API_ERROR_CODES as readonly string[]).includes(value)
}

export function parseErrorBody(body: unknown): ApiErrorCode | undefined {
  if (typeof body !== 'object' || body === null) return undefined
  if (!('code' in body)) return undefined
  return isApiErrorCode(body.code) ? body.code : undefined
}

export function formatApiError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'CONFLICT') {
      return `無法儲存（CONFLICT）：不可移除已有預約的格子。`
    }
    if (error.code) {
      return `請求失敗（${error.code}，HTTP ${error.status}）`
    }
    return `請求失敗（HTTP ${error.status}）`
  }
  if (error instanceof Error) {
    return error.message
  }
  return '發生未知錯誤'
}

export async function apiErrorFromResponse(response: Response): Promise<ApiError> {
  let body: unknown
  const text = await response.text()
  if (text) {
    try {
      body = JSON.parse(text)
    } catch {
      body = text
    }
  }
  const code = parseErrorBody(body)
  const message = code
    ? `API error ${code} (${response.status})`
    : `API error (${response.status})`
  return new ApiError(response.status, code, body, message)
}
