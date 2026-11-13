"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { ui } from "@/app/ui";

/** 二段確認：第一次按顯示 `confirmLabel`，3 秒內再按一次才執行. */
export function ConfirmButton({
  label,
  confirmLabel,
  onConfirm,
  style = ui.buttonOutline,
  disabled = false,
}: {
  label: string;
  confirmLabel: string;
  onConfirm: () => void;
  style?: CSSProperties;
  disabled?: boolean;
}) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = window.setTimeout(() => setArmed(false), 3000);
    return () => window.clearTimeout(t);
  }, [armed]);
  return (
    <button
      type="button"
      disabled={disabled}
      style={armed ? { ...style, ...ui.buttonDanger, padding: style.padding } : style}
      onClick={() => {
        if (!armed) return setArmed(true);
        setArmed(false);
        onConfirm();
      }}
    >
      {armed ? confirmLabel : label}
    </button>
  );
}
