from __future__ import annotations

SLOT_ID_SEP = "_"


def make_slot_id(date: str, start: str, end: str, room: str) -> str:
    return f"{date}_{start}-{end}_{room}"
