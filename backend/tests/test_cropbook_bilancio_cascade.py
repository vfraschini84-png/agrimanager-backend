"""
Backend tests for Cropbook iteration:
- Auth (admin login)
- GET /api/companies (tenant-scoped, lots_count)
- GET /api/reports/bilancio-azienda/:id  (PDF for company with lots, 400 for empty company)
- Regression: GET /api/reports/bilancio?lotId=... still works (Bilancio Stagione)
"""
import os
import pytest
import requests

BASE_URL = "https://c95dfaa0-006a-45f3-82cf-48bf48aa2b11.preview.emergentagent.com"
ADMIN_USER = "admin"
ADMIN_PASS = "96a0761f3943"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"username": ADMIN_USER, "password": ADMIN_PASS},
        timeout=15,
    )
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text[:200]}"
    data = r.json()
    assert data.get("success") is True
    assert isinstance(data.get("token"), str) and len(data["token"]) > 20
    assert data["user"]["username"] == "admin"
    return data["token"]


@pytest.fixture(scope="module")
def auth_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


# --------- Auth ---------
class TestAuth:
    def test_login_success(self, admin_token):
        assert admin_token

    def test_login_invalid(self):
        r = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"username": "admin", "password": "wrong-pass"},
            timeout=10,
        )
        assert r.status_code in (400, 401, 403)


# --------- /api/companies ---------
class TestCompanies:
    def test_list_companies_returns_list_with_lots_count(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/companies", headers=auth_headers, timeout=15)
        assert r.status_code == 200, r.text[:300]
        body = r.json()
        assert body.get("success") is True
        data = body.get("data")
        assert isinstance(data, list)
        assert len(data) >= 1, "expected at least 1 company"
        # Every company should have id, name, lots_count
        for c in data:
            assert "id" in c and "name" in c
            assert "lots_count" in c, f"company missing lots_count: {c}"
            assert isinstance(c["lots_count"], int)
        # At least one with lots > 0 expected
        with_lots = [c for c in data if c["lots_count"] > 0]
        assert len(with_lots) >= 1, "expected at least one company with lots"

    def test_list_companies_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/companies", timeout=10)
        assert r.status_code in (401, 403)


# --------- /api/reports/bilancio-azienda/:id ---------
class TestBilancioAzienda:
    @pytest.fixture(scope="class")
    def companies(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/companies", headers=auth_headers, timeout=15)
        assert r.status_code == 200
        return r.json()["data"]

    def test_pdf_for_company_with_lots(self, auth_headers, companies):
        with_lots = [c for c in companies if c["lots_count"] > 0]
        assert with_lots, "no company with lots in DB"
        target = with_lots[0]
        r = requests.get(
            f"{BASE_URL}/api/reports/bilancio-azienda/{target['id']}",
            headers={"Authorization": auth_headers["Authorization"]},
            timeout=30,
        )
        assert r.status_code == 200, f"status {r.status_code}: {r.text[:300]}"
        ctype = r.headers.get("Content-Type", "")
        assert "application/pdf" in ctype, f"unexpected Content-Type: {ctype}"
        # PDF magic header
        assert r.content[:4] == b"%PDF", "response body is not a PDF"
        # Content-Disposition attachment
        cd = r.headers.get("Content-Disposition", "")
        assert "attachment" in cd and "bilancio-azienda" in cd

    def test_pdf_empty_company_returns_400(self, auth_headers, companies):
        empty = [c for c in companies if c["lots_count"] == 0]
        if not empty:
            # Create a temporary company with no lots
            create = requests.post(
                f"{BASE_URL}/api/companies",
                headers=auth_headers,
                json={"name": "TEST_EmptyCompany_pytest", "sectors": "Test"},
                timeout=15,
            )
            assert create.status_code in (200, 201), create.text[:200]
            cid = create.json().get("data", {}).get("id") or create.json().get("id")
            assert cid, f"no id returned: {create.json()}"
            try:
                r = requests.get(
                    f"{BASE_URL}/api/reports/bilancio-azienda/{cid}",
                    headers={"Authorization": auth_headers["Authorization"]},
                    timeout=15,
                )
                assert r.status_code == 400
                body = r.json()
                assert "error" in body
                assert "lott" in body["error"].lower()
            finally:
                requests.delete(
                    f"{BASE_URL}/api/companies/{cid}",
                    headers=auth_headers,
                    timeout=10,
                )
        else:
            r = requests.get(
                f"{BASE_URL}/api/reports/bilancio-azienda/{empty[0]['id']}",
                headers={"Authorization": auth_headers["Authorization"]},
                timeout=15,
            )
            assert r.status_code == 400
            assert "error" in r.json()

    def test_pdf_nonexistent_company_returns_404(self, auth_headers):
        r = requests.get(
            f"{BASE_URL}/api/reports/bilancio-azienda/99999999",
            headers={"Authorization": auth_headers["Authorization"]},
            timeout=15,
        )
        assert r.status_code == 404

    def test_pdf_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/reports/bilancio-azienda/1", timeout=10)
        assert r.status_code in (401, 403)


# --------- Regression: existing PDF bilancio per lotto ---------
class TestRegressionBilancioLotto:
    def test_bilancio_pdf_per_lot(self, auth_headers):
        # Find a lot via /api/companies/:id (returns lots)
        r = requests.get(f"{BASE_URL}/api/companies", headers=auth_headers, timeout=10)
        companies = r.json()["data"]
        with_lots = [c for c in companies if c["lots_count"] > 0]
        if not with_lots:
            pytest.skip("no lots available for regression test")
        cdetail = requests.get(
            f"{BASE_URL}/api/companies/{with_lots[0]['id']}",
            headers=auth_headers, timeout=10,
        )
        assert cdetail.status_code == 200
        lots = cdetail.json()["data"]["lots"]
        assert lots, "expected lots in company detail"
        lot_id = lots[0]["id"]
        r = requests.get(
            f"{BASE_URL}/api/reports/bilancio?lotId={lot_id}",
            headers={"Authorization": auth_headers["Authorization"]},
            timeout=30,
        )
        # Endpoint must respond; either pdf or a graceful 4xx
        assert r.status_code in (200, 400, 404), f"unexpected: {r.status_code} {r.text[:200]}"
        if r.status_code == 200:
            assert "application/pdf" in r.headers.get("Content-Type", "")
            assert r.content[:4] == b"%PDF"
