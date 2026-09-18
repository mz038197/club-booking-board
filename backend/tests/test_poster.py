def test_poster_copy_returns_structured_text_only(client):
    response = client.post(
        "/poster/copy",
        json={
            "title": "吉他社迎新",
            "time": "9/25 13:00-15:00",
            "place": "301教室",
            "notes": "自備撥片",
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert set(body.keys()) == {"title", "time_place", "slogan", "body"}
    assert "吉他社迎新" in body["title"]
    assert "9/25 13:00-15:00" in body["time_place"]
    assert "301教室" in body["time_place"]
    assert "自備撥片" in body["body"]
    assert "image" not in body
    assert "url" not in body
