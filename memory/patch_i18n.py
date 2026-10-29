import re

P = '/app/www/js/cropbook.js'
s = open(P).read()
miss = []


def rep(a, b, count=1, all_=False):
    global s
    if a not in s:
        miss.append(a[:80])
        return
    s = s.replace(a, b) if all_ else s.replace(a, b, count)


# ---------- prodotti ----------
rep("""        // Inizializza il sistema di autenticazione
        async function initAuthSystem() {""", """const trType = v => trProductType(v, getCurrentLang());
const trProd = v => trProduct(v, getCurrentLang());
        // Inizializza il sistema di autenticazione
        async function initAuthSystem() {""")
rep("${esc(l.product_type)}${l.product_category ? ' / ' + esc(l.product_category) : ''}",
    "${esc(trType(l.product_type))}${l.product_category ? ' / ' + esc(trProd(l.product_category)) : ''}")
rep("productInfo = ` - ${lotData.product_category}`;", "productInfo = ` - ${trProd(lotData.product_category)}`;")
rep("${lotData.product_type}${productInfo}", "${trType(lotData.product_type)}${productInfo}")
rep("${lot.product_type} - ${lot.variety}", "${trType(lot.product_type)}${lot.variety ? ' - ' + lot.variety : ''}")
s, n = re.subn(r"(\n\s*)\$\{lot\.product_type\}(\s*\n)", r"\1${trType(lot.product_type)}\2", s)
if n < 2:
    miss.append('lot.product_type standalone %d' % n)
rep("productInfo = ` - ${lot.product_category}`;", "productInfo = ` - ${trProd(lot.product_category)}`;")
rep("<strong>${lot.product_type}</strong>", "<strong>${trType(lot.product_type)}</strong>")
rep("${lot.product_category ? ` - ${lot.product_category}` : ''}", "${lot.product_category ? ` - ${trProd(lot.product_category)}` : ''}")
rep("'Tipo Prodotto': lot.product_type,", "'Tipo Prodotto': trType(lot.product_type),", all_=True)
rep("'Prodotto': lot.product_category || '',", "'Prodotto': trProd(lot.product_category) || '',", all_=True)
rep("'Prodotto': lot.product_category || (lot.product_category === '' ? '' : 'N/D'),", "'Prodotto': trProd(lot.product_category) || '',")
rep("""    categorySelect.innerHTML = '<option value="">Seleziona prodotto</option>';""",
    """    categorySelect.innerHTML = `<option value="">${t('reg_lot.select_product')}</option>`;""")
rep("""            option.value = product;
            option.textContent = product;""", """            option.value = product;
            option.textContent = trProd(product);""")

# ---------- dettagli / lista ----------
rep("Superficie: ${lotData.field_size} ettari", "${t('common.area')}: ${lotData.field_size} ${t('lot.hectares')}")
rep("Superficie: ${lot.field_size} ettari", "${t('common.area')}: ${lot.field_size} ${t('lot.hectares')}")
rep('target="_blank">Vedi su Mappa</a>', 'target="_blank">${t(\'lot.view_on_map\')}</a>')
rep("<em>Coordinate non inserite</em>", "<em>${t('lot.no_coordinates')}</em>")
rep("<strong>Informazioni di base del lotto</strong>", "<strong>${t('lot.basic_info')}</strong>")
rep("<i class=\"fas fa-info-circle\"></i> Dettagli Lotto: ${lotData.company_name}", "<i class=\"fas fa-info-circle\"></i> ${t('lot.details_of')}: ${lotData.company_name}")
rep("<small>ID: ${lot.id} - Creato: ${new Date(lot.created_at).toLocaleDateString()} da ${lot.createdBy || 'Utente'}</small>",
    "<small>ID: ${lot.id} - ${t('lot.created_on')}: ${new Date(lot.created_at).toLocaleDateString(getCurrentLang())} ${t('lot.by')} ${lot.created_by || lot.owner_username || t('lot.user')}</small>")
rep('title="Naviga su Maps"', 'title="${t(\'lot.tip.navigate\')}"')
rep('title="Aggiungi coordinate GPS"', 'title="${t(\'lot.tip.add_gps\')}"')
rep('title="Vedi dettagli completi"', 'title="${t(\'lot.tip.details\')}"')
rep('onclick="goToEconomicManagement(${lot.id})" title="Gestione Economica"', 'onclick="goToEconomicManagement(${lot.id})" title="${t(\'nav.tip.gestione_economica\')}"')
rep('setTimeout(() => loadCostiLotDetails(${lot.id}), 300);" title="Gestione Costi"', 'setTimeout(() => loadCostiLotDetails(${lot.id}), 300);" title="${t(\'nav.tip.gestione_costi\')}"')
rep("${lot.variety || 'Nessuna varietà'}", "${lot.variety || t('lot.no_variety')}", all_=True)
rep("viewAllItem.innerHTML = '<i class=\"fas fa-list\"></i> Vedi tutti i lotti';", "viewAllItem.innerHTML = `<i class=\"fas fa-list\"></i> ${t('lot.view_all')}`;", all_=True)
rep("""                    ? `Nessuna attività di raccolta per la stagione ${stagioneSel}`
                    : 'Nessuna attività di raccolta registrata';""", """                    ? t('det.no_harvest_season', { season: stagioneSel })
                    : t('det.no_harvest');""")

# ---------- costi / economica / bilancio ----------
rep("""select.innerHTML = '<option value="">Seleziona attività predefinita...</option>' +""", """select.innerHTML = `<option value="">${t('costi.select_predefined')}</option>` +""")
rep("""container.innerHTML = '<p style="text-align: center; color: #666;">Nessuna attività registrata</p>';""", """container.innerHTML = `<p style="text-align: center; color: #666;">${t('costi.no_activities')}</p>`;""")
rep("<strong>📅 Stagione ${currentCostiStagione || currentTariffeStagione} - ${records.length} attività</strong>",
    "<strong>📅 ${t('common.season')} ${currentCostiStagione || currentTariffeStagione} - ${records.length} ${t('costi.activities_count')}</strong>")
rep("<strong>📅 Stagione ${currentCostiStagione || currentTariffeStagione} - 0 registrazioni</strong>",
    "<strong>📅 ${t('common.season')} ${currentCostiStagione || currentTariffeStagione} - 0 ${t('costi.records_count')}</strong>")
rep("""<p style="text-align: center; color: #666;">Nessun costo registrato</p>""", """<p style="text-align: center; color: #666;">${t('costi.no_costs')}</p>""")
rep("<strong>📅 Stagione ${currentCostiStagione || currentTariffeStagione} - ${records.length} registrazioni | Totale: €",
    "<strong>📅 ${t('common.season')} ${currentCostiStagione || currentTariffeStagione} - ${records.length} ${t('costi.records_count')} | ${t('costi.total')}: €")
rep("counter.textContent = totali === 0 ? '0 beni' : `${attivi}/${totali} attivi`;",
    "counter.textContent = totali === 0 ? `0 ${t('costi.assets_count')}` : `${attivi}/${totali} ${t('costi.active_count')}`;")
rep("""            Nessun bene durevole registrato per questo lotto.""", """            ${t('costi.no_durables')}""")
rep("""container.innerHTML = '<p style="text-align: center; color: #666; padding: 20px;">Nessuna registrazione economica</p>';""",
    """container.innerHTML = `<p style="text-align: center; color: #666; padding: 20px;">${t('eco.no_records')}</p>`;""")
rep("""<strong style="font-size: 1.1rem;">📅 Stagione ${stagione}</strong>""", """<strong style="font-size: 1.1rem;">📅 ${t('common.season')} ${stagione}</strong>""")
rep("${regs.length} registrazione${regs.length !== 1 ? 'i' : ''}", "${regs.length} ${t(regs.length !== 1 ? 'eco.records_many' : 'eco.records_one')}")
rep("stagioneSelect.innerHTML += `<option value=\"${s}\">📅 Stagione ${s}</option>`;", "stagioneSelect.innerHTML += `<option value=\"${s}\">📅 ${t('common.season')} ${s}</option>`;")
rep("stagioni.map(s => `<option value=\"${s}\">📅 Stagione ${s}</option>`)", "stagioni.map(s => `<option value=\"${s}\">📅 ${t('common.season')} ${s}</option>`)")
rep("? ` · 📅 Stagione ${currentBilancioAziendaStagione}`", "? ` · 📅 ${t('common.season')} ${currentBilancioAziendaStagione}`")
rep('style="color:#4CAF50;"></i> Ricavi</span>', 'style="color:#4CAF50;"></i> ${t(\'bilancio.revenue\')}</span>')
rep('style="color:#f44336;"></i> Costi</span>', 'style="color:#f44336;"></i> ${t(\'bilancio.costs\')}</span>')
rep("""'<span class="ms-chip ms-chip-empty">Nessun costo</span>'""", """`<span class="ms-chip ms-chip-empty">${t('bilancio.no_cost')}</span>`""")

# beni durevoli: traduzione dopo clonazione
rep("""    const clone = template.content.cloneNode(true);
    const beneDiv = clone.querySelector('.bene-durevole-item');
    beneDiv.dataset.index = beniDurevoliCount;""", """    const clone = template.content.cloneNode(true);
    const beneDiv = clone.querySelector('.bene-durevole-item');
    translateBeneItem(beneDiv);
    beneDiv.dataset.index = beniDurevoliCount;""")
rep("""    const clone = template.content.cloneNode(true);
    const beneDiv = clone.querySelector('.bene-durevole-item');
    beneDiv.dataset.index = beniDurevoliCostiCount;""", """    const clone = template.content.cloneNode(true);
    const beneDiv = clone.querySelector('.bene-durevole-item');
    translateBeneItem(beneDiv);
    beneDiv.dataset.index = beniDurevoliCostiCount;""")
rep("""function aggiungiBeneDurevole() {""", """function translateBeneItem(el) {
    el.querySelectorAll('[data-i18n]').forEach(n => { n.textContent = t(n.getAttribute('data-i18n')); });
    el.querySelectorAll('[data-i18n-placeholder]').forEach(n => { n.placeholder = t(n.getAttribute('data-i18n-placeholder')); });
    el.querySelectorAll('.bene-anni option').forEach(o => { o.textContent = t(o.value === '1' ? 'costi.year_one' : 'costi.years_n', { n: o.value }); });
}

function aggiungiBeneDurevole() {""")

# ---------- gestione permessi ----------
rep("""<label for="user-permission-select"><i class="fas fa-user"></i> Seleziona Utente</label>""", """<label for="user-permission-select"><i class="fas fa-user"></i> ${t('perm.select_user')}</label>""")
rep("""                <option value="">Seleziona un utente</option>
            </select>""", """                <option value="">${t('perm.select_user_opt')}</option>
            </select>""")
rep("""    userSelect.innerHTML = '<option value="">Seleziona un utente</option>';""", """    userSelect.innerHTML = `<option value="">${t('perm.select_user_opt')}</option>`;""")
rep("""option.textContent = `${user.username} (${user.role})${user.email ? ` - ${user.email}` : ''}`;""", """option.textContent = `${user.username} (${roleLabel(user.role)})${user.email ? ` - ${user.email}` : ''}`;""")
rep("""userSelect.innerHTML = '<option value="">Errore caricamento utenti</option>';""", """userSelect.innerHTML = `<option value="">${t('perm.load_error')}</option>`;""")
rep("""permissionsContainer.innerHTML = '<p style="color: red;">Utente non trovato</p>';""", """permissionsContainer.innerHTML = `<p style="color: red;">${t('perm.user_not_found')}</p>`;""")
rep("""                <h4><i class="fas fa-user-cog"></i> Permessi per: ${username}</h4>
                <p>Ruolo: <span class="role-badge role-${user.role}">${user.role}</span></p>
                <p>Email: ${user.email || 'N/D'}</p>
                <p><small><i class="fas fa-info-circle"></i> I permessi sono completamente personalizzabili</small></p>""",
    """                <h4><i class="fas fa-user-cog"></i> ${t('perm.for')}: ${username}</h4>
                <p>${t('perm.role')}: <span class="role-badge role-${user.role}">${roleLabel(user.role)}</span></p>
                <p>Email: ${user.email || 'N/D'}</p>
                <p><small><i class="fas fa-info-circle"></i> ${t('perm.customizable')}</small></p>""")
rep("<i class=\"fas fa-save\"></i> Salva Permessi", "<i class=\"fas fa-save\"></i> ${t('perm.save')}")
rep("<i class=\"fas fa-check-circle\"></i> Abilita Tutto", "<i class=\"fas fa-check-circle\"></i> ${t('perm.enable_all')}")
rep("<i class=\"fas fa-times-circle\"></i> Disabilita Tutto", "<i class=\"fas fa-times-circle\"></i> ${t('perm.disable_all')}")
rep("<i class=\"fas fa-undo\"></i> Ripristina Vuoti", "<i class=\"fas fa-undo\"></i> ${t('perm.reset_empty')}")
rep("""permissionsContainer.innerHTML = '<p style="color: red;">❌ Errore nel caricamento dei permessi</p>';""", """permissionsContainer.innerHTML = `<p style="color: red;">❌ ${t('perm.load_error')}</p>`;""")
i = s.index("        function getPermissionDisplayName(permission) {")
j = s.index("        function editUser(userId) {")
s = s[:i] + """        function getPermissionDisplayName(permission) {
    return t('perm.name.' + permission);
}

function getPermissionDescription(permission) {
    return t('perm.desc.' + permission);
}

function roleLabel(role) {
    const key = 'role.' + role;
    const label = t(key);
    return label === key ? role : label;
}
        
""" + s[j:]
rep("""<span class="role-badge role-${user.role}">${user.role}</span>
                    ${subBadge}""", """<span class="role-badge role-${user.role}">${roleLabel(user.role)}</span>
                    ${subBadge}""")
rep("""title="${subUsers.length} sotto-utenti\"""", """title="${subUsers.length} ${t('users.sub_users')}\"""")

# ---------- re-render al cambio lingua ----------
rep("""        const dettagliSection = document.getElementById('dettagli-section');
        if (dettagliSection && dettagliSection.classList.contains('active')) {
            populateDettagliStagioneSelect();""", """        const typeSelect = document.getElementById('product-type');
        const catSelect = document.getElementById('product-category');
        if (typeSelect && catSelect && typeSelect.value) {
            const prev = catSelect.value;
            populateProductCategories(typeSelect.value);
            catSelect.value = prev;
            if (prev === 'altri') document.getElementById('custom-product-container').style.display = 'block';
        }
        document.querySelectorAll('.bene-durevole-item').forEach(translateBeneItem);
        const costiSection = document.getElementById('gestione-costi-section');
        if (costiSection && costiSection.classList.contains('active') && currentCostiLotId) loadCostiLotDetails(currentCostiLotId);
        const ecoSection = document.getElementById('gestione-economica-section');
        if (ecoSection && ecoSection.classList.contains('active') && currentEconomicLotId) loadEconomicLotDetails(currentEconomicLotId);
        const dettagliSection = document.getElementById('dettagli-section');
        if (dettagliSection && dettagliSection.classList.contains('active') && currentLotId) {
            loadLotDetails(currentLotId);
        } else if (dettagliSection && dettagliSection.classList.contains('active')) {
            populateDettagliStagioneSelect();""")

open(P, 'w').write(s)
print('MISSING:', miss)
