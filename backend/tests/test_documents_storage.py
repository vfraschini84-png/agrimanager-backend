"""
Cropbook - Lot documents on Emergent Object Storage (/api/documents)
Covers upload/list/download/delete, validation, RBAC (uploader/admin/operator/viewer) and tenant isolation.
"""
import os
import time
import pytest
import requests

BASE = os.environ.get("REACT_APP_BACKEND_URL", "https://app-review-56.preview.emergentagent.com").rstrip("/")
API = f"{BASE}/api"
NOW = int(time.time() * 1000)
PDF_BYTES = b"%PDF-1.4\n%TEST_doc\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n" + os.urandom(64)
PNG_BYTES = (b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89"
             b"\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82")


def H(tok):
    return {"Authorization": f"Bearer {tok}"}


def register(username, token=None, role="admin"):
    body = {"username": username, "email": f"{username}@test.it", "password": "password123", "role": role}
    if not token:
        body["privacy_accepted"] = True
    r = requests.post(f"{API}/auth/register", json=body, headers=H(token) if token else {}, timeout=20)
    assert r.status_code == 201, r.text
    return r.json()["token"]


def upload(tok, lot, name="TEST_doc.pdf", data=PDF_BYTES, category="contratto", year=None, notes="TEST_note", mime="application/pdf"):
    form = {"category": category, "notes": notes}
    if year:
        form["year"] = str(year)
    return requests.post(f"{API}/documents/lot/{lot}", headers=H(tok), data=form,
                         files={"file": (name, data, mime)}, timeout=60)


@pytest.fixture(scope="module")
def ctx():
    a = register(f"TEST_doca_{NOW}")
    b = register(f"TEST_docb_{NOW}")
    op1 = register(f"TEST_docop1_{NOW}", token=a, role="operatore")
    op2 = register(f"TEST_docop2_{NOW}", token=a, role="operatore")
    vis = register(f"TEST_docvis_{NOW}", token=a, role="visitatore")
    r = requests.post(f"{API}/lots", headers=H(a), json={"location": f"TEST_LA_{NOW}", "product_type": "olivo",
                                                       "company_name": f"TEST_CoA_{NOW}"}, timeout=20)
    assert r.status_code < 300, r.text
    lot = (r.json().get("data") or r.json()).get("id")
    lr = requests.post(f"{API}/auth/login", json={"username": "admin", "password": "9ded04059b99"}, timeout=20)
    sa = lr.json().get("token") if lr.status_code == 200 else None
    return dict(a=a, b=b, op1=op1, op2=op2, vis=vis, lot=lot, sa=sa)


# ---- Upload & validation
class TestUpload:
    def test_upload_pdf_and_list(self, ctx):
        r = upload(ctx["a"], ctx["lot"])
        assert r.status_code == 201, r.text
        d = r.json()["data"]
        assert d["original_name"] == "TEST_doc.pdf" and d["category"] == "contratto"
        assert d["content_type"] == "application/pdf" and d["size"] == len(PDF_BYTES)
        assert d["can_delete"] is True and d["notes"] == "TEST_note"
        ctx["doc_pdf"] = d["id"]
        lst = requests.get(f"{API}/documents/lot/{ctx['lot']}?group=documenti", headers=H(ctx["a"]), timeout=20).json()["data"]
        assert any(x["id"] == d["id"] for x in lst)

    def test_upload_analisi_requires_year(self, ctx):
        r = upload(ctx["a"], ctx["lot"], category="analisi")
        assert r.status_code == 400, r.text
        r = upload(ctx["a"], ctx["lot"], name="TEST_ana.pdf", category="analisi", year=2025)
        assert r.status_code == 201, r.text
        assert r.json()["data"]["year"] == 2025
        ctx["doc_ana"] = r.json()["data"]["id"]

    def test_group_filters(self, ctx):
        ana = requests.get(f"{API}/documents/lot/{ctx['lot']}?group=analisi", headers=H(ctx["a"]), timeout=20).json()["data"]
        docs = requests.get(f"{API}/documents/lot/{ctx['lot']}?group=documenti", headers=H(ctx["a"]), timeout=20).json()["data"]
        allx = requests.get(f"{API}/documents/lot/{ctx['lot']}", headers=H(ctx["a"]), timeout=20).json()["data"]
        assert all(x["category"] == "analisi" for x in ana) and len(ana) == 1
        assert all(x["category"] != "analisi" for x in docs) and len(docs) == 1
        assert len(allx) == 2

    def test_reject_exe(self, ctx):
        r = upload(ctx["a"], ctx["lot"], name="TEST_mal.exe", data=b"MZ" * 100, mime="application/octet-stream")
        assert r.status_code == 400, r.text

    def test_reject_invalid_category(self, ctx):
        r = upload(ctx["a"], ctx["lot"], category="bogus")
        assert r.status_code == 400, r.text

    def test_reject_no_file(self, ctx):
        r = requests.post(f"{API}/documents/lot/{ctx['lot']}", headers=H(ctx["a"]), data={"category": "altro"}, timeout=20)
        assert r.status_code == 400, r.text

    def test_reject_too_large(self, ctx):
        big = b"0" * (20 * 1024 * 1024 + 10)
        r = upload(ctx["a"], ctx["lot"], name="TEST_big.pdf", data=big)
        assert r.status_code == 413, r.text[:300]

    def test_upload_unauth(self, ctx):
        r = requests.post(f"{API}/documents/lot/{ctx['lot']}", files={"file": ("x.pdf", PDF_BYTES)}, timeout=20)
        assert r.status_code == 401

    def test_upload_nonexistent_lot(self, ctx):
        r = upload(ctx["a"], 99999999)
        assert r.status_code == 404, r.text


# ---- Download
class TestDownload:
    def test_download_binary_identical(self, ctx):
        r = requests.get(f"{API}/documents/{ctx['doc_pdf']}/download", headers=H(ctx["a"]), timeout=60)
        assert r.status_code == 200
        assert r.content == PDF_BYTES
        assert r.headers["Content-Type"].startswith("application/pdf")
        assert "attachment" in r.headers["Content-Disposition"] and "TEST_doc.pdf" in r.headers["Content-Disposition"]

    def test_download_inline(self, ctx):
        r = requests.get(f"{API}/documents/{ctx['doc_pdf']}/download?inline=1", headers=H(ctx["a"]), timeout=60)
        assert r.status_code == 200 and r.headers["Content-Disposition"].startswith("inline")

    def test_png_roundtrip(self, ctx):
        r = upload(ctx["op1"], ctx["lot"], name="TEST_photo.png", data=PNG_BYTES, category="altro", mime="image/png")
        assert r.status_code == 201, r.text
        ctx["doc_op1"] = r.json()["data"]["id"]
        d = requests.get(f"{API}/documents/{ctx['doc_op1']}/download", headers=H(ctx["op1"]), timeout=60)
        assert d.status_code == 200 and d.content == PNG_BYTES and d.headers["Content-Type"].startswith("image/png")

    def test_download_404(self, ctx):
        r = requests.get(f"{API}/documents/99999999/download", headers=H(ctx["a"]), timeout=20)
        assert r.status_code == 404


# ---- RBAC & tenant isolation
class TestPermissions:
    def test_can_delete_flags(self, ctx):
        op2_list = requests.get(f"{API}/documents/lot/{ctx['lot']}", headers=H(ctx["op2"]), timeout=20).json()["data"]
        flags = {x["id"]: x["can_delete"] for x in op2_list}
        assert flags[ctx["doc_op1"]] is False and flags[ctx["doc_pdf"]] is False
        op1_list = requests.get(f"{API}/documents/lot/{ctx['lot']}", headers=H(ctx["op1"]), timeout=20).json()["data"]
        assert {x["id"]: x["can_delete"] for x in op1_list}[ctx["doc_op1"]] is True

    def test_viewer_list_download_ok_upload_forbidden(self, ctx):
        r = requests.get(f"{API}/documents/lot/{ctx['lot']}", headers=H(ctx["vis"]), timeout=20)
        assert r.status_code == 200 and len(r.json()["data"]) >= 3
        assert all(x["can_delete"] is False for x in r.json()["data"])
        d = requests.get(f"{API}/documents/{ctx['doc_pdf']}/download", headers=H(ctx["vis"]), timeout=60)
        assert d.status_code == 200 and d.content == PDF_BYTES
        u = upload(ctx["vis"], ctx["lot"])
        assert u.status_code == 403, u.text
        dl = requests.delete(f"{API}/documents/{ctx['doc_pdf']}", headers=H(ctx["vis"]), timeout=20)
        assert dl.status_code == 403

    def test_other_tenant_blocked(self, ctx):
        b = ctx["b"]
        assert requests.get(f"{API}/documents/lot/{ctx['lot']}", headers=H(b), timeout=20).status_code == 403
        assert requests.get(f"{API}/documents/{ctx['doc_pdf']}/download", headers=H(b), timeout=20).status_code == 403
        assert requests.delete(f"{API}/documents/{ctx['doc_pdf']}", headers=H(b), timeout=20).status_code == 403
        assert upload(b, ctx["lot"]).status_code == 403

    def test_operator_cannot_delete_others(self, ctx):
        r = requests.delete(f"{API}/documents/{ctx['doc_op1']}", headers=H(ctx["op2"]), timeout=20)
        assert r.status_code == 403
        r = requests.delete(f"{API}/documents/{ctx['doc_pdf']}", headers=H(ctx["op2"]), timeout=20)
        assert r.status_code == 403

    def test_uploader_can_delete_then_404(self, ctx):
        r = requests.delete(f"{API}/documents/{ctx['doc_op1']}", headers=H(ctx["op1"]), timeout=20)
        assert r.status_code == 200 and r.json()["success"] is True
        assert requests.get(f"{API}/documents/{ctx['doc_op1']}/download", headers=H(ctx["op1"]), timeout=20).status_code == 404
        lst = requests.get(f"{API}/documents/lot/{ctx['lot']}", headers=H(ctx["a"]), timeout=20).json()["data"]
        assert ctx["doc_op1"] not in [x["id"] for x in lst]
        assert requests.delete(f"{API}/documents/{ctx['doc_op1']}", headers=H(ctx["op1"]), timeout=20).status_code == 404

    def test_tenant_admin_deletes_operator_file(self, ctx):
        r = upload(ctx["op2"], ctx["lot"], name="TEST_op2.pdf")
        assert r.status_code == 201
        did = r.json()["data"]["id"]
        assert requests.delete(f"{API}/documents/{did}", headers=H(ctx["a"]), timeout=20).status_code == 200

    def test_superadmin_deletes_any(self, ctx):
        if not ctx["sa"]:
            pytest.skip("super-admin login failed")
        lst = requests.get(f"{API}/documents/lot/{ctx['lot']}", headers=H(ctx["sa"]), timeout=20)
        assert lst.status_code == 200 and all(x["can_delete"] for x in lst.json()["data"])
        assert requests.delete(f"{API}/documents/{ctx['doc_ana']}", headers=H(ctx["sa"]), timeout=20).status_code == 200
        assert requests.delete(f"{API}/documents/{ctx['doc_pdf']}", headers=H(ctx["a"]), timeout=20).status_code == 200
