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
const CELLS: { col: number; row: number; room: number; flash: Flash; periodSecs: number; delaySecs: number }[] = [
  { col: 1, row: 2, room: 5, flash: "breathe", periodSecs: 7.8, delaySecs: 2.1 },
  { col: 3, row: 5, room: 2, flash: "breathe", periodSecs: 13.4, delaySecs: 5.6 },
  { col: 5, row: 1, room: 1, flash: "blink", periodSecs: 11.6, delaySecs: 3.5 },
  { col: 7, row: 2, room: 2, flash: "blink", periodSecs: 10.5, delaySecs: 9.5 },
  { col: 6, row: 4, room: 3, flash: "flicker", periodSecs: 8.7, delaySecs: 5.4 },
  { col: 8, row: 6, room: 4, flash: "blink", periodSecs: 14.2, delaySecs: 12.9 },
  { col: 9, row: 0, room: 6, flash: "blink", periodSecs: 13.5, delaySecs: 9.3 },
  { col: 11, row: 6, room: 1, flash: "blink", periodSecs: 11.0, delaySecs: 1.3 },
  { col: 13, row: 7, room: 3, flash: "blink", periodSecs: 11.2, delaySecs: 9.5 },
  { col: 16, row: 7, room: 8, flash: "blink", periodSecs: 11.2, delaySecs: 0.7 },
  { col: 17, row: 0, room: 4, flash: "blink", periodSecs: 6.2, delaySecs: 1.8 },
  { col: 18, row: 0, room: 3, flash: "flicker", periodSecs: 11.9, delaySecs: 8.8 },
  { col: 20, row: 1, room: 4, flash: "flicker", periodSecs: 12.1, delaySecs: 7.7 },
  { col: 22, row: 3, room: 1, flash: "breathe", periodSecs: 10.0, delaySecs: 1.3 },
  { col: 21, row: 5, room: 2, flash: "flicker", periodSecs: 14.5, delaySecs: 0.9 },
  { col: 24, row: 2, room: 5, flash: "blink", periodSecs: 9.4, delaySecs: 2.0 },
  { col: 23, row: 6, room: 6, flash: "flicker", periodSecs: 10.2, delaySecs: 5.0 },
  { col: 26, row: 4, room: 8, flash: "blink", periodSecs: 8.4, delaySecs: 3.7 },
  { col: 27, row: 1, room: 6, flash: "flicker", periodSecs: 15.9, delaySecs: 2.5 },
  { col: 28, row: 6, room: 3, flash: "blink", periodSecs: 13.1, delaySecs: 0.3 },
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
              animationDuration: `${c.periodSecs}s`,
              animationDelay: `-${c.delaySecs}s`,
            }}
          />
        ))}
      </div>
      <div className={s.fade} />
    </div>
  );
}
