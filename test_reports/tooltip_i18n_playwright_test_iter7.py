"""
Focused Cropbook tooltip i18n bug verification for iteration 7.

Scope:
- User-reported bug: missing translations for hover/selector suggestions/tooltips.
- Verifies fixed regressions from iteration 6 in real UI: header Gestione Utenti title,
  dynamic user-card action titles after language switch, nav icon titles, and console regressions.

Run with Playwright Python if available:
    python3 /app/test_reports/tooltip_i18n_playwright_test_iter7.py
"""

import asyncio
from playwright.async_api import async_playwright

URL = "https://c95dfaa0-006a-45f3-82cf-48bf48aa2b11.preview.emergentagent.com"
USERNAME = "admin"
PASSWORD = "96a0761f3943"

EXPECTED_NAV = {
    "it": {
        "#dettagli-section.active [data-testid='nav-dettagli-btn']": "Dettagli lotto",
        "#dettagli-section.active [data-testid='nav-ricavi-btn']": "Gestione Ricavi",
        "#dettagli-section.active [data-testid='nav-costi-btn']": "Gestione Costi",
        "#dettagli-section.active [data-testid='nav-bilancio-btn']": "Bilancio e Report",
        "#dettagli-section.active [data-testid='nav-lista-btn']": "Lista Lotti",
        "#btn-gestione-utenti": "Gestione Utenti e Permessi",
    },
    "en": {
        "#dettagli-section.active [data-testid='nav-dettagli-btn']": "Lot details",
        "#dettagli-section.active [data-testid='nav-ricavi-btn']": "Revenue Management",
        "#dettagli-section.active [data-testid='nav-costi-btn']": "Cost Management",
        "#dettagli-section.active [data-testid='nav-bilancio-btn']": "Balance & Reports",
        "#dettagli-section.active [data-testid='nav-lista-btn']": "Lots List",
        "#btn-gestione-utenti": "User & Permissions Management",
    },
    "es": {
        "#dettagli-section.active [data-testid='nav-dettagli-btn']": "Detalles de la parcela",
        "#dettagli-section.active [data-testid='nav-ricavi-btn']": "Gestión de Ingresos",
        "#dettagli-section.active [data-testid='nav-costi-btn']": "Gestión de Costos",
        "#dettagli-section.active [data-testid='nav-bilancio-btn']": "Balance e Informes",
        "#dettagli-section.active [data-testid='nav-lista-btn']": "Lista de Parcelas",
        "#btn-gestione-utenti": "Gestión de Usuarios y Permisos",
    },
}

USER_TIPS = {
    "it": ("Modifica ruolo", "Elimina utente"),
    "en": ("Edit role", "Delete user"),
    "es": ("Editar rol", "Eliminar usuario"),
}


async def main():
    failures = []
    console_messages = []
    requests = []

    def check(label, actual, expected):
        ok = actual == expected
        print(("PASS" if ok else "FAIL"), label, "actual=", repr(actual), "expected=", repr(expected))
        if not ok:
            failures.append({"label": label, "actual": actual, "expected": expected})

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1920, "height": 1080})
        page.on("console", lambda msg: console_messages.append(f"{msg.type}: {msg.text}"))
        page.on("request", lambda req: requests.append(req.url))

        await page.goto(URL, wait_until="domcontentloaded")
        await page.evaluate("localStorage.clear()")
        await page.reload(wait_until="domcontentloaded")
        await page.wait_for_selector("#login-username", state="visible")
        await page.fill("#login-username", USERNAME)
        await page.fill("#login-password", PASSWORD)
        await page.click("#login-form .btn.btn-primary")
        await page.wait_for_selector("#app-header", state="visible")
        await page.wait_for_selector("[data-testid='lang-btn-it']", state="visible")
        print("PASS login admin UI")

        async def go_home():
            if not await page.locator("#main-menu").is_visible():
                await page.click("#header-home-btn")
                await page.wait_for_selector("#main-menu", state="visible")

        async def open_dettagli():
            await go_home()
            await page.click("#dettagli")
            await page.wait_for_selector("#dettagli-section.active")

        for lang in ["it", "en", "es"]:
            await page.click(f"[data-testid='lang-btn-{lang}']")
            await page.wait_for_timeout(900)
            await open_dettagli()
            for selector, expected in EXPECTED_NAV[lang].items():
                await page.hover(selector)
                check(f"nav/header title {selector} in {lang}", await page.get_attribute(selector, "title"), expected)

        await page.click("[data-testid='lang-btn-it']")
        await page.wait_for_timeout(700)
        await page.click("#btn-gestione-utenti")
        await page.wait_for_selector("#user-management-section.active")
        await page.wait_for_selector("#users-list-container .btn-edit-small", state="attached")
        await page.wait_for_selector("#users-list-container .btn-delete-small", state="attached")
        print("PASS Gestione Utenti aperta con bottoni azione presenti")

        for lang in ["it", "en", "es"]:
            await page.click(f"[data-testid='lang-btn-{lang}']")
            await page.wait_for_timeout(1600)
            expected_edit, expected_delete = USER_TIPS[lang]
            edit_selector = "#users-list-container .btn-edit-small"
            delete_selector = "#users-list-container .btn-delete-small"
            await page.hover(edit_selector)
            check(f"user edit title in {lang}", await page.get_attribute(edit_selector, "title"), expected_edit)
            await page.hover(delete_selector)
            check(f"user delete title in {lang}", await page.get_attribute(delete_selector, "title"), expected_delete)

        csp_messages = [m for m in console_messages if "Content Security Policy" in m or "google.translate" in m or "translate.googleapis" in m]
        apple_warning_messages = [m for m in console_messages if "apple-mobile-web-app-capable" in m and "deprecated" in m.lower()]
        google_translate_requests = [u for u in requests if "translate.googleapis" in u or "translate.google" in u or "google.com/translate" in u]
        check("console CSP/Google Translate errors", csp_messages, [])
        check("console deprecated apple mobile warning", apple_warning_messages, [])
        check("Google Translate network requests", google_translate_requests, [])

        error_text = await page.evaluate("""() => {
            const errorElements = Array.from(document.querySelectorAll('.error, [class*="error"], [id*="error"]'));
            return errorElements.map(el => el.textContent).join(", ");
        }""")
        if error_text:
            print(f"Found error message: {error_text}")
        else:
            print("No error messages found on the page")

        await browser.close()

    print(f"Failures: {len(failures)}")
    if failures:
        raise SystemExit(1)


if __name__ == "__main__":
    asyncio.run(main())