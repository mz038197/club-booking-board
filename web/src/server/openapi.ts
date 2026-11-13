/**
 * 學生專用 OpenAPI 3.0 document, hand-written for MiTAC Agent Builder:
 * `servers[0].url` = Base URL, operationId = tool name (= API 呼叫紀錄 動作),
 * Chinese descriptions (the Agent reads them), student endpoints only.
 * test/student/openapi.test.ts checks it against the real routes.
 * Served at GET /api/v1/openapi.json and copied from the Agent Builder 設定 card.
 */

const SLOT_ID_EXAMPLE = "2026-12-09_13:00-14:00_A101";

/** Every error code a student endpoint can answer with. */
export const STUDENT_ERROR_CODES = [
  "UNAUTHORIZED",
  "NOT_A_STUDENT",
  "BOOKING_CLOSED",
  "ROUTER_UNAVAILABLE",
  "SLOT_TAKEN",
  "INVALID_SLOT",
  "NOT_OWNER",
  "NOT_FOUND",
  "LIMIT_REACHED",
  "INVALID_POSTER",
  "INVALID_REQUEST",
  "INTERNAL_ERROR",
] as const;

const errorRef = (name: string) => ({ $ref: `#/components/responses/${name}` });

/** Responses every student operation can give before reaching its own logic. */
const commonErrors = {
  "401": errorRef("Unauthorized"),
  "403": errorRef("Forbidden"),
  "500": errorRef("InternalError"),
  "503": errorRef("RouterUnavailable"),
};

const errorResponse = (description: string) => ({
  description,
  content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
});

const json = (schemaName: string) => ({
  "application/json": { schema: { $ref: `#/components/schemas/${schemaName}` } },
});

export function studentOpenApi(apiBaseUrl: string) {
  return {
    openapi: "3.0.3",
    info: {
      title: "社團教室預約（學生用）",
      version: "2.0.0",
      description:
        "讓學生的 Agent 查看社團教室的可借格、預約、取消自己的預約，並寫活動海報文案。" +
        "身分由課堂金鑰決定（Agent Builder 以 OAuth 2.0 使用者授權取得），不需要也不接受學號或堂課代號；" +
        "所有操作都作用在學生所屬班級的「目前堂課」。錯誤一律回傳 { code, message }，message 可直接轉述給學生。",
    },
    servers: [{ url: apiBaseUrl, description: "正式環境" }],
    security: [{ classroomKey: [] }],
    paths: {
      "/slots": {
        get: {
          operationId: "listSlots",
          summary: "列出目前堂課的所有可借格",
          description:
            "回傳目前堂課的所有可借格（日期、時段、教室）與它是可借還是已借；已借的可借格附上預約者的顯示名稱。預約前先呼叫這個找出可借的 slot_id。",
          responses: {
            "200": { description: "目前堂課與它的可借格", content: json("SlotList") },
            ...commonErrors,
          },
        },
      },
      "/bookings": {
        get: {
          operationId: "listMyBookings",
          summary: "列出我在目前堂課的預約",
          description: "只回傳呼叫者自己的預約。要取消預約時，從這裡取得 booking_id。",
          responses: {
            "200": { description: "目前堂課與我的預約", content: json("MyBookings") },
            ...commonErrors,
          },
        },
        post: {
          operationId: "bookSlot",
          summary: "預約一個可借格",
          description:
            "以 slot_id 預約目前堂課的一個可借格。一個可借格只能被一人預約；每人可預約的格數有上限。" +
            "堂課暫停或不在開放時間內時無法預約（403 BOOKING_CLOSED）。",
          requestBody: {
            required: true,
            description: "要預約的可借格",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/BookSlotRequest" },
                example: { slot_id: SLOT_ID_EXAMPLE },
              },
            },
          },
          responses: {
            "201": { description: "預約成功，回傳這筆預約", content: json("Booking") },
            "400": errorResponse("INVALID_REQUEST：請求內容不是 JSON 或缺少 slot_id；INVALID_SLOT：目前堂課沒有這個可借格"),
            "401": errorRef("Unauthorized"),
            "403": errorRef("Forbidden"),
            "409": errorResponse("SLOT_TAKEN：這個可借格已被別人預約；LIMIT_REACHED：已達每人可預約的上限"),
            "500": errorRef("InternalError"),
            "503": errorRef("RouterUnavailable"),
          },
        },
      },
      "/bookings/{id}": {
        delete: {
          operationId: "cancelBooking",
          summary: "取消我的一筆預約",
          description:
            "以 booking_id 取消自己在目前堂課的預約，只能取消自己的。堂課暫停或不在開放時間內時無法取消（403 BOOKING_CLOSED）。",
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              description: "要取消的預約編號（listMyBookings 或 bookSlot 回傳的 booking_id）",
              schema: { type: "string", format: "uuid" },
            },
          ],
          responses: {
            "204": { description: "已取消，沒有回應內容" },
            "401": errorRef("Unauthorized"),
            "403": errorResponse(
              "NOT_OWNER：這筆預約不是你的；NOT_A_STUDENT：不是課堂金鑰；BOOKING_CLOSED：沒有堂課、已暫停或不在開放時間",
            ),
            "404": errorResponse("NOT_FOUND：目前堂課沒有這筆預約"),
            "500": errorRef("InternalError"),
            "503": errorRef("RouterUnavailable"),
          },
        },
      },
      "/poster/copy": {
        post: {
          operationId: "writePosterCopy",
          summary: "寫活動海報文案",
          description:
            "依活動名稱、時間、地點（與備註）產生海報文字：標題、時間地點、slogan、內文。只產生文字，不產生圖片；相同輸入得到相同結果。",
          requestBody: {
            required: true,
            description: "活動資料",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/PosterCopyRequest" },
                example: { title: "吉他社迎新", time: "12/9 13:00-14:00", place: "A101", notes: "自備撥片" },
              },
            },
          },
          responses: {
            "200": { description: "海報文案", content: json("PosterCopy") },
            "400": errorResponse("INVALID_POSTER：缺少 title、time 或 place，或欄位不是文字"),
            ...commonErrors,
          },
        },
      },
    },
    components: {
      securitySchemes: {
        classroomKey: {
          type: "http",
          scheme: "bearer",
          description: "課堂金鑰（Classroom API Key）。Agent Builder 以 OAuth 2.0 使用者授權向 router 取得，每位學生一把。",
        },
      },
      responses: {
        Unauthorized: errorResponse("UNAUTHORIZED：沒有金鑰，或金鑰無效、已停用、課堂尚未開始、已過期"),
        Forbidden: errorResponse(
          "NOT_A_STUDENT：這把金鑰不是學生的課堂金鑰；BOOKING_CLOSED：班級還沒有堂課（預約與取消另有：堂課已暫停、不在開放時間）",
        ),
        InternalError: errorResponse("INTERNAL_ERROR：伺服器發生錯誤，請稍後再試"),
        RouterUnavailable: errorResponse("ROUTER_UNAVAILABLE：暫時無法確認身分，請稍後再試"),
      },
      schemas: {
        Session: {
          type: "object",
          description: "目前堂課",
          required: ["id", "name"],
          properties: {
            id: { type: "string", format: "uuid", description: "堂課編號" },
            name: { type: "string", description: "堂課名稱，例如「12/09 社團教室」" },
          },
        },
        Slot: {
          type: "object",
          description: "一個可借格：某天某時段的一間教室",
          required: ["slot_id", "date", "start", "end", "room", "status"],
          properties: {
            slot_id: {
              type: "string",
              description: "可借格代號，格式 {日期}_{開始}-{結束}_{教室}；預約時傳這個",
              example: SLOT_ID_EXAMPLE,
            },
            date: { type: "string", description: "日期 YYYY-MM-DD", example: "2026-12-09" },
            start: { type: "string", description: "開始時間 HH:MM", example: "13:00" },
            end: { type: "string", description: "結束時間 HH:MM", example: "14:00" },
            room: { type: "string", description: "教室", example: "A101" },
            status: { type: "string", enum: ["open", "booked"], description: "open＝可借；booked＝已借" },
            booked_by: { type: "string", description: "預約者的顯示名稱（只有 booked 時才有）" },
          },
        },
        SlotList: {
          type: "object",
          description: "目前堂課與它的所有可借格",
          required: ["session", "slots"],
          properties: {
            session: { description: "目前堂課", allOf: [{ $ref: "#/components/schemas/Session" }] },
            slots: { type: "array", description: "可借格，依日期、時間、教室排序", items: { $ref: "#/components/schemas/Slot" } },
          },
        },
        Booking: {
          type: "object",
          description: "一筆預約",
          required: ["booking_id", "slot_id", "date", "start", "end", "room", "booked_at"],
          properties: {
            booking_id: { type: "string", format: "uuid", description: "預約編號；取消時傳這個" },
            slot_id: { type: "string", description: "預約的可借格代號", example: SLOT_ID_EXAMPLE },
            date: { type: "string", description: "日期 YYYY-MM-DD" },
            start: { type: "string", description: "開始時間 HH:MM" },
            end: { type: "string", description: "結束時間 HH:MM" },
            room: { type: "string", description: "教室" },
            booked_at: { type: "string", format: "date-time", description: "預約時間（ISO 8601）" },
          },
        },
        MyBookings: {
          type: "object",
          description: "目前堂課與我的預約",
          required: ["session", "bookings"],
          properties: {
            session: { description: "目前堂課", allOf: [{ $ref: "#/components/schemas/Session" }] },
            bookings: { type: "array", description: "我在目前堂課的預約", items: { $ref: "#/components/schemas/Booking" } },
          },
        },
        BookSlotRequest: {
          type: "object",
          description: "預約請求",
          required: ["slot_id"],
          properties: {
            slot_id: { type: "string", description: "要預約的可借格代號（從 listSlots 取得）", example: SLOT_ID_EXAMPLE },
          },
        },
        PosterCopyRequest: {
          type: "object",
          description: "海報的活動資料",
          required: ["title", "time", "place"],
          properties: {
            title: { type: "string", description: "活動名稱", example: "吉他社迎新" },
            time: { type: "string", description: "活動時間（自由格式）", example: "12/9 13:00-14:00" },
            place: { type: "string", description: "活動地點", example: "A101" },
            notes: { type: "string", nullable: true, description: "備註（可省略），會寫進內文" },
          },
        },
        PosterCopy: {
          type: "object",
          description: "海報文案（只有文字）",
          required: ["title", "time_place", "slogan", "body"],
          properties: {
            title: { type: "string", description: "標題" },
            time_place: { type: "string", description: "時間地點，例如「12/9 13:00-14:00 @ A101」" },
            slogan: { type: "string", description: "標語" },
            body: { type: "string", description: "內文" },
          },
        },
        Error: {
          type: "object",
          description: "錯誤回應",
          required: ["code", "message"],
          properties: {
            code: {
              type: "string",
              enum: [...STUDENT_ERROR_CODES],
              description:
                "錯誤代碼：UNAUTHORIZED 金鑰無效或過期；NOT_A_STUDENT 不是學生的課堂金鑰；BOOKING_CLOSED 沒有堂課、已暫停或不在開放時間；" +
                "ROUTER_UNAVAILABLE 暫時無法確認身分；SLOT_TAKEN 可借格已被預約；INVALID_SLOT 沒有這個可借格；NOT_OWNER 不是自己的預約；" +
                "NOT_FOUND 找不到預約；LIMIT_REACHED 已達每人上限；INVALID_POSTER 海報資料不完整；INVALID_REQUEST 請求格式錯誤；INTERNAL_ERROR 伺服器錯誤",
            },
            message: { type: "string", description: "給學生看的中文說明，可直接轉述" },
          },
        },
      },
    },
  };
}
