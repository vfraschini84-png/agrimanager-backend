"""
Focused Cropbook tooltip i18n verification used for bug_verification_6.

Run (if Playwright Python is available in the environment):
    python3 /app/test_reports/tooltip_i18n_playwright_test.py

The testing agent executed the same assertions through MCP browser automation.
"""

import asyncio
from playwright.async_api import async_playwright

URL = "https://c95dfaa0-006a-45f3-82cf-48bf48aa2b11.preview.emergentagent.com"
USERNAME = "admin"
PASSWORD = "96a0761f3943"

EXPECTED_NAV = {
    "it": ["Dettagli lotto", "Gestione Ricavi", "Gestione Costi", "Bilancio e Report", "Lista Lotti", "Gestione Utenti e Permessi"],
    "en": ["Lot details", "Revenue Management", "Cost Management", "Balance & Reports", "Lots List", "User & Permissions Management"],
    "es": ["Detalles de la parcela", "Gestión de Ingresos", "Gestión de Costos", "Balance e Informes", "Lista de Parcelas", "Gestión de Usuarios y Permisos"],
}

GPS = {
    "it": 'Clicca "Aggiungerò dopo" se vuoi inserire le coordinate in un secondo momento',
    "en": 'Click "Add later" if you want to enter coordinates later',
    "es": 'Haz clic en "Añadir más tarde" si quieres introducir las coordenadas más tarde',
}

COSTS = {
    "it": "Importa il totale costi (personale + mezzi tecnici + ammortamenti) dalla sezione Gestione Costi",
    "en": "Import total costs (personnel + technical means + amortizations) from Cost Management section",
    "es": "Importa los costos totales (personal + medios técnicos + amortizaciones) desde la sección Gestión de Costos",
}

USER_TIPS = {
    "it": ("Modifica ruolo", "Elimina utente"),
    "en": ("Edit role", "Delete user"),
    "es": ("Editar rol", "Eliminar usuario"),
}


async def main():
    failures = []

    def check(label, actual, expected):
        ok = actual == expected
        print(("PASS" if ok else "FAIL"), label, "actual=", repr(actual), "expected=", repr(expected))
        if not ok:
            failures.append({"label": label, "actual": actual, "expected": expected})

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1920, "height": 1080})
        await page.goto(URL)
        await page.evaluate("localStorage.clear()")
        await page.reload()
        await page.fill("#login-username", USERNAME)
        await page.fill("#login-password", PASSWORD)
        await page.click("#login-form .btn.btn-primary")
        await page.wait_for_selector("#app-header", state="visible")

        nav_selectors = [
            "#dettagli-section.active [data-testid='nav-dettagli-btn']",
            "#dettagli-section.active [data-testid='nav-ricavi-btn']",
            "#dettagli-section.active [data-testid='nav-costi-btn']",
            "#dettagli-section.active [data-testid='nav-bilancio-btn']",
            "#dettagli-section.active [data-testid='nav-lista-btn']",
            "#btn-gestione-utenti",
        ]

        async def go_home():
            if not await page.locator("#main-menu").is_visible():
                await page.click("#header-home-btn")
                await page.wait_for_selector("#main-menu", state="visible")

        async def open_card(card, active):
            await go_home()
            await page.click(card)
            await page.wait_for_selector(active)

        for lang in ["it", "en", "es"]:
            await page.click(f"[data-testid='lang-btn-{lang}']")
            await page.wait_for_timeout(500)

            # Header flag tooltips intentionally stay native.
            check(f"flag IT title in {lang}", await page.get_attribute("[data-testid='lang-btn-it']", "title"), "Italiano")
            check(f"flag EN title in {lang}", await page.get_attribute("[data-testid='lang-btn-en']", "title"), "English")
            check(f"flag ES title in {lang}", await page.get_attribute("[data-testid='lang-btn-es']", "title"), "Español")

            await open_card("#dettagli", "#dettagli-section.active")
            for selector, expected in zip(nav_selectors, EXPECTED_NAV[lang]):
                check(f"nav/header title {selector} in {lang}", await page.get_attribute(selector, "title"), expected)

            await open_card("#registrazione", "#registrazione-section.active")
            await page.hover("#registrazione-section .tooltip")
            check(f"GPS custom tooltip in {lang}", (await page.inner_text("#registrazione-section .tooltip .tooltiptext")).strip(), GPS[lang])

            await open_card("#economia", "#gestione-economica-section.active")
            check(
                f"Aggiorna da Costi title in {lang}",
                await page.get_attribute("#gestione-economica-section.active [data-i18n-title='eco.import_costs_tooltip']", "title"),
                COSTS[lang],
            )

        # Dynamic user-card titles: render in IT, then change language while the section stays open.
        await page.click("[data-testid='lang-btn-it']")
        await page.click("#btn-gestione-utenti")
        await page.wait_for_selector("#user-management-section.active")
        await page.wait_for_timeout(1500)
        for lang in ["it", "en", "es"]:
            await page.click(f"[data-testid='lang-btn-{lang}']")
            await page.wait_for_timeout(500)
            expected_edit, expected_delete = USER_TIPS[lang]
            check(f"user edit title in {lang}", await page.get_attribute("#users-list-container .btn-edit-small", "title"), expected_edit)
            check(f"user delete title in {lang}", await page.get_attribute("#users-list-container .btn-delete-small", "title"), expected_delete)

        await browser.close()

    print(f"Failures: {len(failures)}")
    if failures:
        raise SystemExit(1)


if __name__ == "__main__":
    asyncio.run(main())