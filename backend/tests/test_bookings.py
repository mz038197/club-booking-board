SESSION = "class-2026-09-18"
SLOT = {
    "date": "2026-09-25",
    "start": "13:00",
    "end": "15:00",
    "room": "301",
}
SLOT_ID = "2026-09-25_13:00-15:00_301"


def _open_slot(client):
    client.put(f"/sessions/{SESSION}/slots", json={"slots": [SLOT]})


def test_book_open_slot_returns_201_and_marks_board_booked(client):
    _open_slot(client)
    response = client.post(
        f"/sessions/{SESSION}/bookings",
        json={"slot_id": SLOT_ID, "student_id": "stu-42"},
    )
    assert response.status_code == 201
    body = response.json()
    assert body["slot_id"] == SLOT_ID
    assert body["student_id"] == "stu-42"
    assert "booking_id" in body
    board = client.get(f"/sessions/{SESSION}/board").json()["slots"][0]
    assert board["status"] == "booked"
    assert board["booked_by"] == "stu-42"


def test_book_taken_slot_returns_slot_taken(client):
    _open_slot(client)
    client.post(
        f"/sessions/{SESSION}/bookings",
        json={"slot_id": SLOT_ID, "student_id": "s1"},
    )
    response = client.post(
        f"/sessions/{SESSION}/bookings",
        json={"slot_id": SLOT_ID, "student_id": "s2"},
    )
    assert response.status_code == 409
    assert response.json()["code"] == "SLOT_TAKEN"


def test_book_unknown_slot_returns_invalid_slot(client):
    response = client.post(
        f"/sessions/{SESSION}/bookings",
        json={"slot_id": SLOT_ID, "student_id": "s1"},
    )
    assert response.status_code == 400
    assert response.json()["code"] == "INVALID_SLOT"


def test_owner_can_cancel_and_slot_becomes_open(client):
    _open_slot(client)
    booking_id = client.post(
        f"/sessions/{SESSION}/bookings",
        json={"slot_id": SLOT_ID, "student_id": "s1"},
    ).json()["booking_id"]
    response = client.delete(
        f"/sessions/{SESSION}/bookings/{booking_id}",
        params={"student_id": "s1"},
    )
    assert response.status_code == 204
    board = client.get(f"/sessions/{SESSION}/board").json()["slots"][0]
    assert board["status"] == "open"
    assert "booked_by" not in board


def test_cancel_wrong_owner_returns_not_owner(client):
    _open_slot(client)
    booking_id = client.post(
        f"/sessions/{SESSION}/bookings",
        json={"slot_id": SLOT_ID, "student_id": "s1"},
    ).json()["booking_id"]
    response = client.delete(
        f"/sessions/{SESSION}/bookings/{booking_id}",
        params={"student_id": "s2"},
    )
    assert response.status_code == 403
    assert response.json()["code"] == "NOT_OWNER"


def test_cancel_missing_booking_returns_not_found(client):
    response = client.delete(
        f"/sessions/{SESSION}/bookings/does-not-exist",
        params={"student_id": "s1"},
    )
    assert response.status_code == 404
    assert response.json()["code"] == "NOT_FOUND"
