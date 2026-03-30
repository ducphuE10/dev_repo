from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


def test_root_returns_hello_world():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json() == {"message": "Hello, World!"}


def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_root_content_type():
    response = client.get("/")
    assert response.headers["content-type"] == "application/json"
