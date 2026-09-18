from concurrent.futures import ThreadPoolExecutor, as_completed

SESSION = "race-session"
SLOT = {
    "date": "2026-09-25",
    "start": "13:00",
    "end": "15:00",
    "room": "301",
}
SLOT_ID = "2026-09-25_13:00-15:00_301"


def test_parallel_bookings_of_same_slot_exactly_one_success(client):
    client.put(f"/sessions/{SESSION}/slots", json={"slots": [SLOT]})
    n = 20

    def book(i: int):
        return client.post(
            f"/sessions/{SESSION}/bookings",
            json={"slot_id": SLOT_ID, "student_id": f"student-{i}"},
        )

    with ThreadPoolExecutor(max_workers=n) as pool:
        responses = [fut.result() for fut in as_completed(pool.submit(book, i) for i in range(n))]

    successes = [r for r in responses if r.status_code == 201]
    taken = [r for r in responses if r.status_code == 409]
    assert len(successes) == 1
    assert len(taken) == n - 1
    assert all(r.json()["code"] == "SLOT_TAKEN" for r in taken)
    board = client.get(f"/sessions/{SESSION}/board").json()["slots"][0]
    assert board["status"] == "booked"
