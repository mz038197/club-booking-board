from __future__ import annotations


def make_slot_id(date: str, start: str, end: str, room: str) -> str:
    return f"{date}_{start}-{end}_{room}"
