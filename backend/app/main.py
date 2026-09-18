from __future__ import annotations

import os
import sqlite3
import uuid
from collections.abc import Generator

from fastapi import Depends, FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware

from app.db import connect, init_db
from app.errors import ApiError, register_error_handlers
from app.models import (
    BoardSlot,
    BookingCreateRequest,
    BookingResponse,
    PosterCopyRequest,
    PosterCopyResponse,
    SlotsReplaceRequest,
)
from app.slot_id import make_slot_id

# Local Vite / frontend only (http://localhost:* and http://127.0.0.1:*).
LOCAL_DEV_CORS_ORIGIN_REGEX = r"http://(localhost|127\.0\.0\.1)(:\d+)?"


def create_app(db_path: str = "booking.db") -> FastAPI:
    init_db(db_path)
    app = FastAPI(title="Club classroom booking board")
    app.add_middleware(
        CORSMiddleware,
        allow_origin_regex=LOCAL_DEV_CORS_ORIGIN_REGEX,
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    register_error_handlers(app)

    def get_conn() -> Generator[sqlite3.Connection, None, None]:
        conn = connect(db_path)
        try:
            yield conn
        finally:
            conn.close()

    @app.put("/sessions/{session_id}/slots")
    def replace_slots(
        session_id: str,
        body: SlotsReplaceRequest,
        conn: sqlite3.Connection = Depends(get_conn),
    ) -> dict:
        incoming: dict[str, dict] = {}
        for slot in body.slots:
            slot_id = make_slot_id(slot.date, slot.start, slot.end, slot.room)
            incoming[slot_id] = {
                "slot_id": slot_id,
                "date": slot.date,
                "start": slot.start,
                "end": slot.end,
                "room": slot.room,
            }

        conn.execute("BEGIN IMMEDIATE")
        try:
            booked = {
                row["slot_id"]
                for row in conn.execute(
                    "SELECT slot_id FROM bookings WHERE session_id = ?",
                    (session_id,),
                )
            }
            existing = [
                row["slot_id"]
                for row in conn.execute(
                    "SELECT slot_id FROM slots WHERE session_id = ?",
                    (session_id,),
                )
            ]
            to_remove = [slot_id for slot_id in existing if slot_id not in incoming]
            if any(slot_id in booked for slot_id in to_remove):
                raise ApiError(
                    409,
                    "CONFLICT",
                    "Cannot remove a slot that is already booked",
                )
            for slot_id in to_remove:
                conn.execute(
                    "DELETE FROM slots WHERE session_id = ? AND slot_id = ?",
                    (session_id, slot_id),
                )
            for slot in incoming.values():
                conn.execute(
                    """
                    INSERT INTO slots (session_id, slot_id, date, start, end, room)
                    VALUES (:session_id, :slot_id, :date, :start, :end, :room)
                    ON CONFLICT (session_id, slot_id) DO NOTHING
                    """,
                    {"session_id": session_id, **slot},
                )
            conn.execute("COMMIT")
        except ApiError:
            conn.execute("ROLLBACK")
            raise
        except sqlite3.IntegrityError:
            conn.execute("ROLLBACK")
            raise ApiError(
                409,
                "CONFLICT",
                "Cannot remove a slot that is already booked",
            ) from None
        except Exception:
            conn.execute("ROLLBACK")
            raise

        return {"slots": list(incoming.values())}

    @app.get("/sessions/{session_id}/board")
    def get_board(
        session_id: str,
        conn: sqlite3.Connection = Depends(get_conn),
    ) -> dict:
        rows = conn.execute(
            """
            SELECT
                s.slot_id, s.date, s.start, s.end, s.room,
                b.student_id AS booked_by
            FROM slots s
            LEFT JOIN bookings b
              ON b.session_id = s.session_id AND b.slot_id = s.slot_id
            WHERE s.session_id = ?
            ORDER BY s.date, s.start, s.room
            """,
            (session_id,),
        ).fetchall()
        slots = []
        for row in rows:
            item = BoardSlot(
                slot_id=row["slot_id"],
                date=row["date"],
                start=row["start"],
                end=row["end"],
                room=row["room"],
                status="booked" if row["booked_by"] else "open",
                booked_by=row["booked_by"],
            )
            slots.append(item.to_public())
        return {"slots": slots}

    @app.post("/sessions/{session_id}/bookings", status_code=201)
    def create_booking(
        session_id: str,
        body: BookingCreateRequest,
        conn: sqlite3.Connection = Depends(get_conn),
    ) -> BookingResponse:
        booking_id = str(uuid.uuid4())
        conn.execute("BEGIN IMMEDIATE")
        try:
            slot = conn.execute(
                "SELECT slot_id FROM slots WHERE session_id = ? AND slot_id = ?",
                (session_id, body.slot_id),
            ).fetchone()
            if slot is None:
                raise ApiError(400, "INVALID_SLOT", "Slot is not offered for this session")
            conn.execute(
                """
                INSERT INTO bookings (booking_id, session_id, slot_id, student_id)
                VALUES (?, ?, ?, ?)
                """,
                (booking_id, session_id, body.slot_id, body.student_id),
            )
            conn.execute("COMMIT")
        except sqlite3.IntegrityError as exc:
            conn.execute("ROLLBACK")
            if "UNIQUE" in str(exc):
                raise ApiError(409, "SLOT_TAKEN", "This slot is already booked") from None
            raise ApiError(400, "INVALID_SLOT", "Slot is not offered for this session") from None
        except Exception:
            conn.execute("ROLLBACK")
            raise

        return BookingResponse(
            booking_id=booking_id,
            slot_id=body.slot_id,
            student_id=body.student_id,
        )

    @app.delete("/sessions/{session_id}/bookings/{booking_id}", status_code=204)
    def cancel_booking(
        session_id: str,
        booking_id: str,
        student_id: str | None = Query(None, description="Owner student id"),
        conn: sqlite3.Connection = Depends(get_conn),
    ) -> None:
        row = conn.execute(
            """
            SELECT booking_id, student_id FROM bookings
            WHERE session_id = ? AND booking_id = ?
            """,
            (session_id, booking_id),
        ).fetchone()
        if row is None:
            raise ApiError(404, "NOT_FOUND", "Booking does not exist")
        if not student_id or row["student_id"] != student_id:
            raise ApiError(403, "NOT_OWNER", "Only the booking owner can cancel")
        conn.execute(
            "DELETE FROM bookings WHERE session_id = ? AND booking_id = ?",
            (session_id, booking_id),
        )

    @app.post("/poster/copy")
    def poster_copy(body: PosterCopyRequest) -> PosterCopyResponse:
        notes = body.notes.strip() if body.notes else ""
        body_text = (
            f"歡迎參加「{body.title}」！時間地點：{body.time}，{body.place}。"
            + (f"備註：{notes}" if notes else "")
        )
        return PosterCopyResponse(
            title=body.title,
            time_place=f"{body.time} @ {body.place}",
            slogan=f"一起來！{body.title}",
            body=body_text,
        )

    return app


def create_default_app() -> FastAPI:
    return create_app(os.environ.get("DATABASE_PATH", "booking.db"))
