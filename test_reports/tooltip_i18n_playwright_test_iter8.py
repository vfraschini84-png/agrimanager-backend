"""
Focused Cropbook tooltip i18n bug verification for iteration 8.

Scope:
- User-reported bug: missing translations for hover/selector suggestions/tooltips.
- Primary retest: dynamic user-card edit/delete title attributes after switching language
  while staying inside Gestione Utenti.
- Regressions: header Gestione Utenti title, 5 navigation icon titles, console CSP/deprecation warnings.
"""

import asyncio
import json
from pathlib import Path
from playwright.async_api import async_playwright

URL = "https://c95dfaa0-006a-45f3-82cf-48bf48aa2b11.preview.emergentagent.com"
USERNAME = "admin"
PASSWORD = "96a0761f3943"
OUT = Path("/app/test_reports/tooltip_i18n_iter8_results.json")

EXPECTED_HEADER = {
    "it": "Gestione Utenti e Permessi",
    "en": "User & Permissions Management",
    "es": "Gestión de Usuarios y Permisos",
}

EXPECTED_NAV = {
    "it": {
        "[data-testid='nav-dettagli-btn']": "Dettagli lotto",
        "[data-testid='nav-ricavi-btn']": "Gestione Ricavi",
        "[data-testid='nav-costi-btn']": "Gestione Costi",
        "[data-testid='nav-bilancio-btn']": "Bilancio e Report",
        "[data-testid='nav-lista-btn']": "Lista Lotti",
    },
    "en": {
        "[data-testid='nav-dettagli-btn']": "Lot details",
        "[data-testid='nav-ricavi-btn']": "Revenue Management",
        "[data-testid='nav-costi-btn']": "Cost Management",
        "[data-testid='nav-bilancio-btn']": "Balance & Reports",
        "[data-testid='nav-lista-btn']": "Lots List",
    },
    "es": {
        "[data-testid='nav-dettagli-btn']": "Detalles de la parcela",
        "[data-testid='nav-ricavi-btn']": "Gestión de Ingresos",
        "[data-testid='nav-costi-btn']": "Gestión de Costos",
        "[data-testid='nav-bilancio-btn']": "Balance e Informes",
        "[data-testid='nav-lista-btn']": "Lista de Parcelas",
    },
}

EXPECTED_USER_TIPS = {
    "it": ("Modifica ruolo", "Elimina utente"),
    "en": ("Edit role", "Delete user"),
    "es": ("Editar rol", "Eliminar usuario"),
}


async def main():
    failures = []
    passes = []
    console_messages = []
    failed_requests = []
    response_errors = []

    def record(label, actual, expected):
        ok = actual == expected
        print(("PASS" if ok else "FAIL"), label, "actual=", repr(actual), "expected=", repr(expected))
        entry = {"label": label, "actual": actual, "expected": expected}
        (passes if ok else failures).append(entry)

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1920, "height": 1080})
        page.on("console", lambda msg: console_messages.append({"type": msg.type, "text": msg.text}))
        page.on("requestfailed", lambda req: failed_requests.append({"url": req.url, "failure": str(req.failure) if req.failure else "unknown"}))
        page.on("response", lambda res: response_errors.append({"url": res.url, "status": res.status}) if res.status >= 400 else None)

        await page.goto(URL, wait_until="domcontentloaded")
        await page.evaluate("localStorage.clear(); sessionStorage.clear();")
        await page.reload(wait_until="domcontentloaded")
        await page.wait_for_selector("#login-username", state="visible", timeout=15000)
        await page.fill("#login-username", USERNAME)
        await page.fill("#login-password", PASSWORD)
        await page.click("#login-form .btn.btn-primary")
        await page.wait_for_selector("#app-header", state="visible", timeout=15000)
        await page.wait_for_selector("[data-testid='lang-btn-it']", state="visible", timeout=10000)
        print("PASS login admin UI")

        async def click_lang(lang):
            await page.click(f"[data-testid='lang-btn-{lang}']")
            await page.wait_for_timeout(1800)

        async def go_home():
            if not await page.locator("#main-menu").is_visible():
                await page.click("#header-home-btn")
                await page.wait_for_selector("#main-menu", state="visible", timeout=10000)

        async def open_dettagli():
            await go_home()
            await page.click("#dettagli")
            await page.wait_for_selector("#dettagli-section.active", timeout=10000)

        # Regression Fix #1: header Gestione Utenti tooltip/title translates across languages.
        for lang, expected in EXPECTED_HEADER.items():
            await click_lang(lang)
            await page.hover("#btn-gestione-utenti")
            actual = await page.get_attribute("#btn-gestione-utenti", "title")
            record(f"header #btn-gestione-utenti title in {lang}", actual, expected)

        # Quick regression: 5 navigation icon title attributes translate across languages.
        for lang in ["it", "en", "es"]:
            await click_lang(lang)
            await open_dettagli()
            for selector, expected in EXPECTED_NAV[lang].items():
                active_selector = f"#dettagli-section.active {selector}"
                await page.hover(active_selector)
                actual = await page.get_attribute(active_selector, "title")
                record(f"nav icon {selector} title in {lang}", actual, expected)

        # Primary bug: open Gestione Utenti in IT, stay in section, switch EN then ES.
        await click_lang("it")
        await page.click("#btn-gestione-utenti")
        await page.wait_for_selector("#user-management-section.active", timeout=10000)
        await page.wait_for_selector("#users-list-container .btn-edit-small", state="attached", timeout=15000)
        await page.wait_for_selector("#users-list-container .btn-delete-small", state="attached", timeout=15000)
        print("PASS Gestione Utenti aperta con bottoni edit/delete presenti")

        for lang in ["it", "en", "es"]:
            if lang != "it":
                await click_lang(lang)
                await page.wait_for_selector("#user-management-section.active", timeout=10000)
                await page.wait_for_selector("#users-list-container .btn-edit-small", state="attached", timeout=15000)
                await page.wait_for_selector("#users-list-container .btn-delete-small", state="attached", timeout=15000)
                await page.wait_for_timeout(1200)
            expected_edit, expected_delete = EXPECTED_USER_TIPS[lang]
            edit_selector = "#users-list-container .btn-edit-small"
            delete_selector = "#users-list-container .btn-delete-small"
            await page.hover(edit_selector)
            record(f"dynamic user edit button title in {lang}", await page.get_attribute(edit_selector, "title"), expected_edit)
            await page.hover(delete_selector)
            record(f"dynamic user delete button title in {lang}", await page.get_attribute(delete_selector, "title"), expected_delete)

        csp_messages = [m for m in console_messages if "Content Security Policy" in m["text"] or "violates the following Content Security Policy" in m["text"]]
        deprecation_messages = [m for m in console_messages if "deprecated" in m["text"].lower() or "deprecation" in m["text"].lower()]
        record("console CSP errors", csp_messages, [])
        record("console deprecation warnings", deprecation_messages, [])

        # Get error messages using specific selectors
        error_text = await page.evaluate("""() => {
const errorElements = Array.from(document.querySelectorAll('.error, [class*="error"], [id*="error"]'));
return errorElements.map(el => el.textContent).join(", ");
}""")
        if error_text:
            print(f"Found error message: {error_text}")
        else:
            print("No error messages found on the page")

        await browser.close()

    result = {
        "passes": passes,
        "failures": failures,
        "console_messages": console_messages,
        "failed_requests": failed_requests,
        "response_errors": response_errors,
    }
    OUT.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {OUT}")
    print(f"Failures: {len(failures)}")
    if failures:
        raise SystemExit(1)


if __name__ == "__main__":
    asyncio.run(main())