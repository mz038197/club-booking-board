SESSION = "class-2026-09-18"

SLOT = {
    "date": "2026-09-25",
    "start": "13:00",
    "end": "15:00",
    "room": "301",
}
SLOT_ID = "2026-09-25_13:00-15:00_301"


def test_put_slots_then_board_lists_them_as_open(client):
    response = client.put(
        f"/sessions/{SESSION}/slots",
        json={"slots": [SLOT]},
    )
    assert response.status_code == 200
    board = client.get(f"/sessions/{SESSION}/board")
    assert board.status_code == 200
    assert board.json() == {
        "slots": [
            {
                "slot_id": SLOT_ID,
                "date": "2026-09-25",
                "start": "13:00",
                "end": "15:00",
                "room": "301",
                "status": "open",
            }
        ]
    }


def test_put_slots_full_replace_drops_unbooked_slots(client):
    client.put(
        f"/sessions/{SESSION}/slots",
        json={
            "slots": [
                SLOT,
                {
                    "date": "2026-09-25",
                    "start": "15:00",
                    "end": "17:00",
                    "room": "302",
                },
            ]
        },
    )
    client.put(
        f"/sessions/{SESSION}/slots",
        json={"slots": [SLOT]},
    )
    board = client.get(f"/sessions/{SESSION}/board").json()["slots"]
    assert [s["slot_id"] for s in board] == [SLOT_ID]


def test_put_slots_does_not_remove_booked_slot(client):
    client.put(f"/sessions/{SESSION}/slots", json={"slots": [SLOT]})
    book = client.post(
        f"/sessions/{SESSION}/bookings",
        json={"slot_id": SLOT_ID, "student_id": "s1"},
    )
    assert book.status_code == 201
    response = client.put(f"/sessions/{SESSION}/slots", json={"slots": []})
    assert response.status_code == 409
    assert response.json()["code"] == "CONFLICT"
    board = client.get(f"/sessions/{SESSION}/board").json()["slots"]
    assert board[0]["status"] == "booked"
    assert board[0]["booked_by"] == "s1"


def test_put_conflict_does_not_delete_other_open_slots(client):
    other = {
        "date": "2026-09-25",
        "start": "15:00",
        "end": "17:00",
        "room": "302",
    }
    client.put(f"/sessions/{SESSION}/slots", json={"slots": [SLOT, other]})
    client.post(
        f"/sessions/{SESSION}/bookings",
        json={"slot_id": SLOT_ID, "student_id": "s1"},
    )
    response = client.put(f"/sessions/{SESSION}/slots", json={"slots": []})
    assert response.status_code == 409
    assert response.json()["code"] == "CONFLICT"
    ids = {s["slot_id"] for s in client.get(f"/sessions/{SESSION}/board").json()["slots"]}
    assert ids == {SLOT_ID, "2026-09-25_15:00-17:00_302"}
