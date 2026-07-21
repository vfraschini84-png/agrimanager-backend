"""
Live IDOR smoke test against the public preview URL.
Creates two fresh tenants, TenantA and TenantB, and verifies that
Tenant A cannot mutate any of Tenant B's resources.
"""
import os
import time
import pytest
import requests

BASE = os.environ.get("REACT_APP_BACKEND_URL",
                     "https://c95dfaa0-006a-45f3-82cf-48bf48aa2b11.preview.emergentagent.com").rstrip("/")
API = f"{BASE}/api"
NOW = int(time.time() * 1000)


def _register(username, token=None, role="admin"):
    headers = {"Content-Type": "application/json"}
    body = {
        "username": username,
        "email": f"{username}@test.it",
        "password": "password123",
        "role": role,
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"
    else:
        body["privacy_accepted"] = True
    return requests.post(f"{API}/auth/register", json=body, headers=headers, timeout=15)


def _login(username, password="password123"):
    return requests.post(f"{API}/auth/login",
                         json={"username": username, "password": password}, timeout=15)


@pytest.fixture(scope="module")
def tenants():
    a_user = f"live_a_{NOW}"
    b_user = f"live_b_{NOW}"

    ra = _register(a_user)
    assert ra.status_code == 201, ra.text
    a_tok = ra.json()["token"]

    rb = _register(b_user)
    assert rb.status_code == 201, rb.text
    b_tok = rb.json()["token"]

    # Lots
    la = requests.post(f"{API}/lots",
                       headers={"Authorization": f"Bearer {a_tok}"},
                       json={"location": f"LA_{NOW}", "area": 1, "product_type": "olivo",
                             "company_name": f"CoA_{NOW}"}, timeout=15)
    assert la.status_code < 300, la.text
    a_lot = (la.json().get("data") or la.json()).get("id")

    lb = requests.post(f"{API}/lots",
                       headers={"Authorization": f"Bearer {b_tok}"},
                       json={"location": f"LB_{NOW}", "area": 2, "product_type": "vite",
                             "company_name": f"CoB_{NOW}"}, timeout=15)
    assert lb.status_code < 300, lb.text
    b_lot = (lb.json().get("data") or lb.json()).get("id")

    # B creates resources
    act = requests.post(f"{API}/activities",
                        headers={"Authorization": f"Bearer {b_tok}"},
                        json={"lot_id": b_lot, "date": "2026-06-01", "kg": 500, "notes": "B"},
                        timeout=15)
    assert act.status_code == 201, act.text
    b_act = act.json()["id"]

    ana = requests.post(f"{API}/analyses",
                        headers={"Authorization": f"Bearer {b_tok}"},
                        json={"lot_id": b_lot, "year": 2026, "filename": "t.pdf",
                              "originalName": "t.pdf", "fileUrl": "/uploads/t.pdf",
                              "fileSize": 1024, "notes": "B"}, timeout=15)
    assert ana.status_code == 201, ana.text
    b_ana = ana.json()["id"]

    pers = requests.post(f"{API}/costi/personale",
                         headers={"Authorization": f"Bearer {b_tok}"},
                         json={"lot_id": b_lot, "stagione_agricola": "2026",
                               "data_attivita": "2026-06-01", "numero_operatori": 2,
                               "qualifica": "standard", "ore_lavorate": 8,
                               "attivita": "raccolta"}, timeout=15)
    assert pers.status_code == 201, pers.text
    b_pers = pers.json()["id"]

    mez = requests.post(f"{API}/costi/mezzi",
                        headers={"Authorization": f"Bearer {b_tok}"},
                        json={"lot_id": b_lot, "stagione_agricola": "2026",
                              "data_registrazione": "2026-06-01", "descrizione": "rame",
                              "importo": 150, "categoria": "fitofarmaci"}, timeout=15)
    assert mez.status_code == 201, mez.text
    b_mez = mez.json()["id"]

    return {
        "a_tok": a_tok, "b_tok": b_tok, "a_lot": a_lot, "b_lot": b_lot,
        "b_act": b_act, "b_ana": b_ana, "b_pers": b_pers, "b_mez": b_mez,
        "a_user": a_user, "b_user": b_user,
    }


def H(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


# ---- Activities ----
def test_A_cannot_delete_B_activity(tenants):
    r = requests.delete(f"{API}/activities/{tenants['b_act']}", headers=H(tenants["a_tok"]))
    assert r.status_code == 403, r.text


def test_A_cannot_create_activity_on_B_lot(tenants):
    r = requests.post(f"{API}/activities", headers=H(tenants["a_tok"]),
                      json={"lot_id": tenants["b_lot"], "date": "2026-06-01", "kg": 1, "notes": "x"})
    assert r.status_code == 403, r.text


# ---- Analyses ----
def test_A_cannot_delete_B_analysis(tenants):
    r = requests.delete(f"{API}/analyses/{tenants['b_ana']}", headers=H(tenants["a_tok"]))
    assert r.status_code == 403, r.text


def test_A_cannot_create_analysis_on_B_lot(tenants):
    r = requests.post(f"{API}/analyses", headers=H(tenants["a_tok"]),
                      json={"lot_id": tenants["b_lot"], "year": 2026, "filename": "x.pdf",
                            "originalName": "x.pdf", "fileUrl": "/uploads/x.pdf", "fileSize": 1})
    assert r.status_code == 403, r.text


# ---- costi personale ----
def test_A_cannot_delete_B_costo_personale(tenants):
    r = requests.delete(f"{API}/costi/personale/{tenants['b_pers']}", headers=H(tenants["a_tok"]))
    assert r.status_code == 403, r.text


def test_A_cannot_put_B_costo_personale(tenants):
    r = requests.put(f"{API}/costi/personale/{tenants['b_pers']}", headers=H(tenants["a_tok"]),
                     json={"numero_operatori": 999})
    assert r.status_code == 403, r.text


def test_A_cannot_create_costo_personale_on_B_lot(tenants):
    r = requests.post(f"{API}/costi/personale", headers=H(tenants["a_tok"]),
                      json={"lot_id": tenants["b_lot"], "stagione_agricola": "2026",
                            "data_attivita": "2026-06-01", "numero_operatori": 1,
                            "qualifica": "standard", "ore_lavorate": 1, "attivita": "x"})
    assert r.status_code == 403, r.text


# ---- costi mezzi ----
def test_A_cannot_delete_B_costo_mezzi(tenants):
    r = requests.delete(f"{API}/costi/mezzi/{tenants['b_mez']}", headers=H(tenants["a_tok"]))
    assert r.status_code == 403, r.text


def test_A_cannot_create_costo_mezzi_on_B_lot(tenants):
    r = requests.post(f"{API}/costi/mezzi", headers=H(tenants["a_tok"]),
                      json={"lot_id": tenants["b_lot"], "stagione_agricola": "2026",
                            "data_registrazione": "2026-06-01", "descrizione": "x",
                            "importo": 10, "categoria": "fitofarmaci"})
    assert r.status_code == 403, r.text


# ---- GET regression ----
def test_A_cannot_read_B_costi_personale(tenants):
    r = requests.get(f"{API}/costi/personale/{tenants['b_lot']}/2026", headers=H(tenants["a_tok"]))
    assert r.status_code == 403, r.text


def test_A_cannot_read_B_costi_mezzi(tenants):
    r = requests.get(f"{API}/costi/mezzi/{tenants['b_lot']}/2026", headers=H(tenants["a_tok"]))
    assert r.status_code == 403, r.text


# ---- Legit access ----
def test_B_can_delete_own_activity(tenants):
    c = requests.post(f"{API}/activities", headers=H(tenants["b_tok"]),
                      json={"lot_id": tenants["b_lot"], "date": "2026-06-03", "kg": 1, "notes": "y"})
    assert c.status_code == 201, c.text
    new_id = c.json()["id"]
    d = requests.delete(f"{API}/activities/{new_id}", headers=H(tenants["b_tok"]))
    assert d.status_code == 200, d.text


def test_B_can_put_own_costo_personale(tenants):
    r = requests.put(f"{API}/costi/personale/{tenants['b_pers']}", headers=H(tenants["b_tok"]),
                     json={"note": "own update"})
    assert r.status_code == 200, r.text


# ---- RBAC: viewer cannot mutate ----
@pytest.fixture(scope="module")
def viewer_token(tenants):
    vu = f"live_view_{NOW}"
    r = _register(vu, token=tenants["b_tok"], role="viewer")
    assert r.status_code == 201, r.text
    l = _login(vu)
    assert l.status_code == 200, l.text
    return l.json()["token"]


def test_viewer_cannot_delete_costo_personale(tenants, viewer_token):
    r = requests.delete(f"{API}/costi/personale/{tenants['b_pers']}", headers=H(viewer_token))
    assert r.status_code == 403, r.text


def test_viewer_cannot_delete_activity(tenants, viewer_token):
    r = requests.delete(f"{API}/activities/{tenants['b_act']}", headers=H(viewer_token))
    assert r.status_code == 403, r.text


def test_viewer_cannot_post_costi_mezzi(tenants, viewer_token):
    r = requests.post(f"{API}/costi/mezzi", headers=H(viewer_token),
                      json={"lot_id": tenants["b_lot"], "stagione_agricola": "2026",
                            "data_registrazione": "2026-06-01", "descrizione": "x",
                            "importo": 10, "categoria": "fitofarmaci"})
    assert r.status_code == 403, r.text


# ---- Platform super-admin regression ----
def test_super_admin_can_delete_any_activity(tenants):
    # login as super-admin (username=admin)
    l = requests.post(f"{API}/auth/login",
                     json={"username": "admin", "password": "96a0761f3943"}, timeout=15)
    assert l.status_code == 200, l.text
    admin_tok = l.json()["token"]
    # create a throwaway activity for tenant B, then admin deletes it
    c = requests.post(f"{API}/activities", headers=H(tenants["b_tok"]),
                      json={"lot_id": tenants["b_lot"], "date": "2026-06-05", "kg": 1, "notes": "z"})
    assert c.status_code == 201, c.text
    aid = c.json()["id"]
    d = requests.delete(f"{API}/activities/{aid}", headers=H(admin_tok))
    assert d.status_code == 200, d.text
