const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Whether `value` is a UUID string (ids from a URL are checked before they reach a uuid column). */
export const isUuid = (value: unknown): value is string => typeof value === "string" && UUID.test(value);
