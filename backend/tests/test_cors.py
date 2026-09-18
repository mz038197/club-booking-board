def test_cors_allows_vite_default_origin(client):
    response = client.get(
        "/sessions/demo/board",
        headers={"Origin": "http://localhost:5173"},
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"


def test_cors_allows_127_0_0_1_dev_origin(client):
    response = client.get(
        "/sessions/demo/board",
        headers={"Origin": "http://127.0.0.1:5174"},
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://127.0.0.1:5174"


def test_cors_preflight_allows_vite_origin(client):
    response = client.options(
        "/sessions/demo/bookings",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        },
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"
    assert "POST" in response.headers.get("access-control-allow-methods", "")


def test_cors_does_not_allow_non_localhost_origin(client):
    response = client.get(
        "/sessions/demo/board",
        headers={"Origin": "https://evil.example"},
    )
    assert response.status_code == 200
    assert "access-control-allow-origin" not in response.headers
