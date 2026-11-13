"use client";

import { useRouter } from "next/navigation";
import type { ClassRef } from "@/server/router-gateway/types";

/** 班級選單: switching goes to that 班級's page. */
export function ClassPicker({ classes, value }: { classes: ClassRef[]; value?: number }) {
  const router = useRouter();
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
      <span style={{ color: "#71717a" }}>班級</span>
      <select
        aria-label="班級"
        value={value ?? ""}
        onChange={(e) => router.push(`/admin/classes/${e.target.value}`)}
        style={{ border: "1px solid #e4e4e7", borderRadius: 6, padding: "6px 8px", fontSize: 14, background: "#fff" }}
      >
        {value === undefined ? (
          <option value="" disabled>
            選擇班級
          </option>
        ) : null}
        {classes.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </label>
  );
}
