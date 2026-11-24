import s from "./hero-grid.module.css";

/**
 * The 首頁 hero's background: a faint 時段 × 教室 grid whose cells flash in 教室色,
 * as if bookings were landing. Purely decorative (aria-hidden); each cell has its own
 * flash shape, period and offset so the whole never settles into a rhythm.
 * The plane is 30 columns wide and centered, so `col` 15 is the middle of the screen.
 */
type Flash = "breathe" | "blink" | "flicker";

const CELL = 64;

// Timings fixed here (not Math.random) so every render, server and client, is identical.
const CELLS: { col: number; row: number; room: number; flash: Flash; secs: number; offset: number }[] = [
  { col: 1, row: 2, room: 5, flash: "breathe", secs: 7.8, offset: 2.1 },
  { col: 3, row: 5, room: 2, flash: "breathe", secs: 13.4, offset: 5.6 },
  { col: 5, row: 1, room: 1, flash: "blink", secs: 11.6, offset: 3.5 },
  { col: 7, row: 2, room: 2, flash: "blink", secs: 10.5, offset: 9.5 },
  { col: 6, row: 4, room: 3, flash: "flicker", secs: 8.7, offset: 5.4 },
  { col: 8, row: 6, room: 4, flash: "blink", secs: 14.2, offset: 12.9 },
  { col: 9, row: 0, room: 6, flash: "blink", secs: 13.5, offset: 9.3 },
  { col: 11, row: 6, room: 1, flash: "blink", secs: 11.0, offset: 1.3 },
  { col: 13, row: 7, room: 3, flash: "blink", secs: 11.2, offset: 9.5 },
  { col: 16, row: 7, room: 8, flash: "blink", secs: 11.2, offset: 0.7 },
  { col: 17, row: 0, room: 4, flash: "blink", secs: 6.2, offset: 1.8 },
  { col: 18, row: 0, room: 3, flash: "flicker", secs: 11.9, offset: 8.8 },
  { col: 20, row: 1, room: 4, flash: "flicker", secs: 12.1, offset: 7.7 },
  { col: 22, row: 3, room: 1, flash: "breathe", secs: 10.0, offset: 1.3 },
  { col: 21, row: 5, room: 2, flash: "flicker", secs: 14.5, offset: 0.9 },
  { col: 24, row: 2, room: 5, flash: "blink", secs: 9.4, offset: 2.0 },
  { col: 23, row: 6, room: 6, flash: "flicker", secs: 10.2, offset: 5.0 },
  { col: 26, row: 4, room: 8, flash: "blink", secs: 8.4, offset: 3.7 },
  { col: 27, row: 1, room: 6, flash: "flicker", secs: 15.9, offset: 2.5 },
  { col: 28, row: 6, room: 3, flash: "blink", secs: 13.1, offset: 0.3 },
];

export function HeroGrid() {
  return (
    <div aria-hidden className={s.backdrop}>
      <div className={s.plane}>
        {CELLS.map((c) => (
          <span
            key={`${c.col}-${c.row}`}
            className={`${s.cell} ${s[c.flash]}`}
            style={{
              left: c.col * CELL + 1,
              top: c.row * CELL + 1,
              background: `var(--room-${c.room})`,
              animationDuration: `${c.secs}s`,
              animationDelay: `-${c.offset}s`,
            }}
          />
        ))}
      </div>
      <div className={s.fade} />
    </div>
  );
}
