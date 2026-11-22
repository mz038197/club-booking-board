"use client";

import { useEffect, useRef, useState } from "react";
import { ui } from "@/app/ui";
import { holdNameError, type CellDialog as CellDialogContent } from "@/board/cell-dialog";
import s from "./board.module.css";

/**
 * In-page modal for a 日展開 cell action, replacing window.prompt/confirm (which block
 * the page and can't be driven by automation). A native <dialog> shown with showModal():
 * focus stays inside, Esc and 取消 close it. 設保留 also asks for the optional name.
 */
export function CellDialog({
  content,
  onConfirm,
  onClose,
}: {
  content: CellDialogContent;
  /** Called with the trimmed 保留 name (設保留) or "" (other actions). */
  onConfirm: (name: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState("");
  const error = content.nameField ? holdNameError(name) : null;

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => dialog?.close();
  }, []);

  return (
    <dialog
      ref={ref}
      className={s.dialog}
      aria-labelledby="cell-dialog-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <form
        method="dialog"
        onSubmit={(e) => {
          e.preventDefault();
          if (error) return;
          onConfirm(name.trim());
        }}
        style={{ display: "grid", gap: 12 }}
      >
        <h2 id="cell-dialog-title" style={{ ...ui.h2, margin: 0 }}>
          {content.title}
        </h2>
        <p style={{ ...ui.muted, margin: 0 }}>{content.message}</p>
        {content.nameField ? (
          <label style={{ display: "grid", gap: 4 }}>
            <span style={ui.label}>{content.nameField.label}</span>
            <input
              autoFocus
              value={name}
              placeholder={content.nameField.placeholder}
              onChange={(e) => setName(e.target.value)}
              aria-invalid={error ? true : undefined}
              style={ui.input}
            />
            {error ? (
              <span role="alert" style={{ fontSize: 12, color: "var(--danger)" }}>
                {error}
              </span>
            ) : null}
          </label>
        ) : null}
        <div style={{ ...ui.row, justifyContent: "flex-end" }}>
          <button type="button" style={ui.buttonOutline} onClick={onClose} autoFocus={!content.nameField}>
            取消
          </button>
          <button
            type="submit"
            disabled={Boolean(error)}
            style={content.danger ? ui.buttonDanger : { ...ui.buttonPrimary, padding: "6px 12px" }}
          >
            {content.confirmLabel}
          </button>
        </div>
      </form>
    </dialog>
  );
}
