"""
Phase 2 (backend error translations) + Phase 3 (PDF report translations) i18n tests.
Uses X-Language header + ?lang=xx query for PDF endpoints.
"""
import os
import io
import pytest
import requests
from pdfminer.high_level import extract_text

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://c95dfaa0-006a-45f3-82cf-48bf48aa2b11.preview.emergentagent.com').rstrip('/')
API = f"{BASE_URL}/api"

ADMIN_USER = "admin"
ADMIN_PASS = "96a0761f3943"


# ---------- fixtures ----------
@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"username": ADMIN_USER, "password": ADMIN_PASS}, timeout=15)
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    tok = r.json().get("token") or r.json().get("accessToken")
    assert tok, f"no token in response: {r.text}"
    return tok


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


# ---------- Phase 2: token_missing error translation ----------
class TestTokenMissingTranslation:
    def test_no_lang_header_defaults_italian(self):
        r = requests.get(f"{API}/lots", timeout=10)
        assert r.status_code == 401
        body = r.json()
        msg = body.get("error") or body.get("message") or ""
        assert "Token non fornito" in msg or "non fornito" in msg.lower(), f"expected IT default, got {body}"

    def test_x_language_en(self):
        r = requests.get(f"{API}/lots", headers={"X-Language": "en"}, timeout=10)
        assert r.status_code == 401
        body = r.json()
        msg = body.get("error") or body.get("message") or ""
        assert "Token not provided" in msg, f"expected EN, got {body}"

    def test_x_language_es(self):
        r = requests.get(f"{API}/lots", headers={"X-Language": "es"}, timeout=10)
        assert r.status_code == 401
        body = r.json()
        msg = body.get("error") or body.get("message") or ""
        assert "Token no proporcionado" in msg, f"expected ES, got {body}"

    def test_accept_language_fallback_en(self):
        r = requests.get(f"{API}/lots", headers={"Accept-Language": "en-US,en;q=0.9"}, timeout=10)
        assert r.status_code == 401
        body = r.json()
        msg = body.get("error") or body.get("message") or ""
        assert "Token not provided" in msg, f"Accept-Language EN not honored: {body}"


# ---------- Phase 2: credentials_invalid translation ----------
class TestCredentialsInvalidTranslation:
    def test_wrong_password_es(self):
        r = requests.post(f"{API}/auth/login",
                          json={"username": ADMIN_USER, "password": "WRONG_PW"},
                          headers={"X-Language": "es"}, timeout=10)
        assert r.status_code in (400, 401)
        body = r.json()
        msg = body.get("error") or body.get("message") or ""
        assert "Credenciales no válidas" in msg, f"expected ES, got {body}"

    def test_wrong_password_en(self):
        r = requests.post(f"{API}/auth/login",
                          json={"username": ADMIN_USER, "password": "WRONG_PW"},
                          headers={"X-Language": "en"}, timeout=10)
        assert r.status_code in (400, 401)
        body = r.json()
        msg = body.get("error") or body.get("message") or ""
        assert "Invalid credentials" in msg, f"expected EN, got {body}"

    def test_wrong_password_default_it(self):
        r = requests.post(f"{API}/auth/login",
                          json={"username": ADMIN_USER, "password": "WRONG_PW"}, timeout=10)
        assert r.status_code in (400, 401)
        body = r.json()
        msg = body.get("error") or body.get("message") or ""
        assert "Credenziali non valide" in msg, f"expected IT default, got {body}"


# ---------- Phase 2: no_lots_in_company translation ----------
class TestNoLotsInCompanyTranslation:
    """Requires a company with zero lots. We fetch companies and pick one with 0 lots, if any.
       If we can't find one, we skip (not the responsibility of this test to create data)."""

    def _find_empty_company(self, admin_headers):
        r = requests.get(f"{API}/companies", headers=admin_headers, timeout=10)
        if r.status_code != 200:
            return None
        companies = r.json() if isinstance(r.json(), list) else r.json().get("companies", [])
        # Try to find one with lot_count == 0 or fetch lots for each
        for c in companies:
            if c.get("lot_count") == 0 or c.get("lots_count") == 0:
                return c
        # Otherwise pick first, might not have lots
        return companies[0] if companies else None

    def test_bilancio_azienda_no_lots_en(self, admin_headers):
        r = requests.get(f"{API}/companies", headers=admin_headers, timeout=10)
        if r.status_code != 200:
            pytest.skip("cannot list companies")
        body = r.json()
        companies = body.get("data") if isinstance(body, dict) else body
        if not companies:
            pytest.skip("no companies exist")

        # Find a company with 0 lots
        empty = [c for c in companies if (c.get("lots_count") or 0) == 0]
        if not empty:
            pytest.skip("no company with 0 lots — cannot trigger error")
        cid = empty[0].get("id")
        r = requests.get(f"{API}/economic/bilancio-azienda/{cid}",
                         headers={**admin_headers, "X-Language": "en"}, timeout=10)
        assert r.status_code >= 400, f"expected error, got {r.status_code}"
        msg = (r.json().get("error") or r.json().get("message") or "")
        assert "The company has no lots registered" in msg, f"expected EN phrase, got: {msg}"

    def test_bilancio_azienda_no_lots_es(self, admin_headers):
        r = requests.get(f"{API}/companies", headers=admin_headers, timeout=10)
        if r.status_code != 200:
            pytest.skip("cannot list companies")
        body = r.json()
        companies = body.get("data") if isinstance(body, dict) else body
        if not companies:
            pytest.skip("no companies exist")
        empty = [c for c in companies if (c.get("lots_count") or 0) == 0]
        if not empty:
            pytest.skip("no company with 0 lots")
        cid = empty[0].get("id")
        r = requests.get(f"{API}/economic/bilancio-azienda/{cid}",
                         headers={**admin_headers, "X-Language": "es"}, timeout=10)
        assert r.status_code >= 400
        msg = (r.json().get("error") or r.json().get("message") or "")
        assert "La empresa no tiene parcelas registradas" in msg, f"expected ES phrase, got: {msg}"


# ---------- Phase 3: PDF report translations ----------
class TestPDFReportTranslations:
    """PDF is binary; we check Content-Type and search the raw PDF bytes for translated strings.
       Note: PDFs encoded may or may not contain literal UTF-8 strings depending on library —
       we look for ASCII substrings that should appear as text objects."""

    def _company_id(self, admin_headers, with_lots=True):
        r = requests.get(f"{API}/companies", headers=admin_headers, timeout=10)
        if r.status_code != 200:
            return None
        body = r.json()
        companies = body.get("data") if isinstance(body, dict) else body
        if not companies:
            return None
        if with_lots:
            for c in companies:
                if (c.get("lots_count") or 0) > 0:
                    return c.get("id")
        return companies[0].get("id")

    def _lot_id(self, admin_headers):
        r = requests.get(f"{API}/lots", headers=admin_headers, timeout=10)
        if r.status_code != 200:
            return None
        body = r.json()
        lots = body.get("data") if isinstance(body, dict) else body
        return lots[0].get("id") if lots else None

    def test_bilancio_azienda_pdf_en(self, admin_headers):
        cid = self._company_id(admin_headers, with_lots=True)
        if not cid:
            pytest.skip("no company with lots available")
        r = requests.get(f"{API}/reports/bilancio-azienda/{cid}?lang=en",
                         headers=admin_headers, timeout=30)
        assert r.status_code == 200, f"PDF EN status {r.status_code}: {r.text[:200]}"
        assert "pdf" in r.headers.get("content-type", "").lower()
        text = extract_text(io.BytesIO(r.content))
        assert "Company Balance" in text, f"missing 'Company Balance' in:\n{text[:400]}"
        assert "Period: All seasons" in text, f"missing 'Period: All seasons'"
        for term in ["Revenue", "Personnel", "Amort.", "Balance", "TOTAL", "Lot", "Product"]:
            assert term in text, f"missing EN term '{term}'"

    def test_bilancio_azienda_pdf_es(self, admin_headers):
        cid = self._company_id(admin_headers, with_lots=True)
        if not cid:
            pytest.skip("no company with lots")
        r = requests.get(f"{API}/reports/bilancio-azienda/{cid}?lang=es",
                         headers=admin_headers, timeout=30)
        assert r.status_code == 200
        text = extract_text(io.BytesIO(r.content))
        assert "Balance de Empresa" in text
        assert "Periodo: Todas las temporadas" in text
        for term in ["Ingresos", "Costos", "Personal", "Medios", "TOTAL", "Parcela", "Producto"]:
            assert term in text, f"missing ES term '{term}'"

    def test_bilancio_lot_pdf_en(self, admin_headers):
        lid = self._lot_id(admin_headers)
        if not lid:
            pytest.skip("no lot available")
        r = requests.get(f"{API}/reports/bilancio/{lid}?lang=en", headers=admin_headers, timeout=30)
        assert r.status_code == 200, f"lot PDF EN status {r.status_code}: {r.text[:200]}"
        text = extract_text(io.BytesIO(r.content))
        expected = ["Last 5 Seasons Comparison",
                    "Personnel Cost Detail by Activity",
                    "Technical Means Cost Detail by Category",
                    "Amortizations Detail by Durable Asset"]
        missing = [e for e in expected if e not in text]
        assert len(missing) <= 1, f"missing EN sections: {missing}\nPDF text sample:\n{text[:600]}"

    def test_bilancio_lot_pdf_es(self, admin_headers):
        lid = self._lot_id(admin_headers)
        if not lid:
            pytest.skip("no lot available")
        r = requests.get(f"{API}/reports/bilancio/{lid}?lang=es", headers=admin_headers, timeout=30)
        assert r.status_code == 200
        text = extract_text(io.BytesIO(r.content))
        expected = ["Comparación Últimas 5 Temporadas",
                    "Detalle Costo Personal por Actividad",
                    "Detalle Costo Medios Técnicos por Categoría",
                    "Detalle Amortizaciones por Bien Duradero"]
        missing = [e for e in expected if e not in text]
        assert len(missing) <= 1, f"missing ES sections: {missing}\nPDF text sample:\n{text[:600]}"


# ---------- UX BUG FIX (sync): PUT /api/users/language after login ----------
class TestLanguageSync:
    def test_put_language_persists(self, admin_headers):
        # Set to EN
        r = requests.put(f"{API}/users/language", json={"language": "en"}, headers=admin_headers, timeout=10)
        assert r.status_code == 200, r.text
        # Verify via GET
        r2 = requests.get(f"{API}/users/me/language", headers=admin_headers, timeout=10)
        assert r2.status_code == 200
        assert r2.json().get("language") == "en"
        # Reset to IT for cleanliness
        requests.put(f"{API}/users/language", json={"language": "it"}, headers=admin_headers, timeout=10)

    def test_put_language_invalid_rejected(self, admin_headers):
        r = requests.put(f"{API}/users/language", json={"language": "fr"}, headers=admin_headers, timeout=10)
        assert r.status_code == 400
