"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ui } from "@/app/ui";
import type { CellDialogContent } from "@/board/cell-dialog";
import { holdNameError } from "@/board/hold-name";
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
  /** Called with the trimmed 保留 name for 設保留, "" for the actions without a name field. */
  onConfirm: (name: string) => void;
  onClose: () => void;
}) {
  const id = useId();
  const ref = useRef<HTMLDialogElement>(null);
  const firstFocus = useRef<HTMLInputElement & HTMLButtonElement>(null);
  const [name, setName] = useState("");
  const error = content.nameField ? holdNameError(name) : null;

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    // Focus after showModal(): an element inside a closed <dialog> can't take focus.
    firstFocus.current?.focus();
    return () => dialog?.close();
  }, []);

  return (
    <dialog
      ref={ref}
      className={s.dialog}
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-message`}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (error) return;
          onConfirm(name.trim());
        }}
        style={{ display: "grid", gap: 12 }}
      >
        <h2 id={`${id}-title`} style={{ ...ui.h2, margin: 0 }}>
          {content.title}
        </h2>
        <p id={`${id}-message`} style={{ ...ui.muted, margin: 0 }}>
          {content.message}
        </p>
        {content.nameField ? (
          <div style={{ display: "grid", gap: 4 }}>
            <label htmlFor={`${id}-name`} style={ui.label}>
              {content.nameField.label}
            </label>
            <input
              id={`${id}-name`}
              ref={firstFocus}
              value={name}
              placeholder={content.nameField.placeholder}
              onChange={(e) => setName(e.target.value)}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? `${id}-error` : undefined}
              style={ui.input}
            />
            {error ? (
              <span id={`${id}-error`} role="alert" style={{ fontSize: 12, color: "var(--danger)" }}>
                {error}
              </span>
            ) : null}
          </div>
        ) : null}
        <div style={{ ...ui.row, justifyContent: "flex-end" }}>
          <button
            type="button"
            ref={content.nameField ? undefined : firstFocus}
            style={ui.buttonOutline}
            onClick={onClose}
          >
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
