"""Tests for i18n language preference endpoints (Phase 1 P0)."""
import os
import pytest
import requests

BASE_URL = "https://c95dfaa0-006a-45f3-82cf-48bf48aa2b11.preview.emergentagent.com/api"
ADMIN_USER = "admin"
ADMIN_PASS = "96a0761f3943"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/auth/login",
                      json={"username": ADMIN_USER, "password": ADMIN_PASS},
                      timeout=15)
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    tok = r.json().get("token")
    assert tok, "no token in login response"
    return tok


@pytest.fixture(scope="module")
def auth_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


def test_get_language_authenticated_returns_current(auth_headers):
    r = requests.get(f"{BASE_URL}/users/me/language", headers=auth_headers, timeout=10)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "language" in data
    assert data["language"] in ("it", "en", "es")


def test_get_language_requires_auth():
    r = requests.get(f"{BASE_URL}/users/me/language", timeout=10)
    assert r.status_code in (401, 403)


def test_put_language_valid_en(auth_headers):
    r = requests.put(f"{BASE_URL}/users/language",
                     headers=auth_headers, json={"language": "en"}, timeout=10)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get("success") is True
    assert data.get("language") == "en"

    # GET verifies persistence
    r2 = requests.get(f"{BASE_URL}/users/me/language", headers=auth_headers, timeout=10)
    assert r2.status_code == 200
    assert r2.json().get("language") == "en"


def test_put_language_valid_es(auth_headers):
    r = requests.put(f"{BASE_URL}/users/language",
                     headers=auth_headers, json={"language": "es"}, timeout=10)
    assert r.status_code == 200
    assert r.json().get("language") == "es"

    r2 = requests.get(f"{BASE_URL}/users/me/language", headers=auth_headers, timeout=10)
    assert r2.json().get("language") == "es"


def test_put_language_valid_it_restore(auth_headers):
    """Restore admin to 'it' so login-screen default stays consistent for later runs."""
    r = requests.put(f"{BASE_URL}/users/language",
                     headers=auth_headers, json={"language": "it"}, timeout=10)
    assert r.status_code == 200
    assert r.json().get("language") == "it"


def test_put_language_invalid_de(auth_headers):
    r = requests.put(f"{BASE_URL}/users/language",
                     headers=auth_headers, json={"language": "de"}, timeout=10)
    assert r.status_code == 400, r.text
    assert "error" in r.json()


def test_put_language_invalid_empty(auth_headers):
    r = requests.put(f"{BASE_URL}/users/language",
                     headers=auth_headers, json={"language": ""}, timeout=10)
    assert r.status_code == 400


def test_put_language_requires_auth():
    r = requests.put(f"{BASE_URL}/users/language",
                     json={"language": "en"},
                     headers={"Content-Type": "application/json"}, timeout=10)
    assert r.status_code in (401, 403)
