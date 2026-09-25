const views = [
  ["inicio", "⌂", "Inicio"],
  ["resumen", "⌂", "Resumen"],
  ["parcelas", "▤", "Parcelas"],
  ["ficha", "◫", "Ficha de parcela"],
  ["comparativa", "◎", "Comparativa"],
  ["costes", "€", "Costes"],
  ["topografia", "▱", "Topografía"],
  ["vivienda", "⌁", "Vivienda"],
  ["modelos", "▧", "Modelos"],
  ["simulador", "◈", "Simulador"],
  ["viabilidad", "◇", "Viabilidad"],
  ["entrevistas", "☑", "Entrevistas"],
  ["documentacion", "✓", "Documentación"],
  ["plan", "↗", "Plan del proyecto"],
  ["ayuda", "?", "Ayuda"],
  ["about", "i", "About"]
];

const BUILD = "20260925-1";
const money = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const num = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1 });
let DATA;
let weights = { cost: 35, slope: 35, views: 15, share: 10, direct: 5 };

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[ch]));
const pct = (value) => `${Math.round(value)}%`;
const slopeClass = (slope) => slope == null ? "Pendiente sin informe" : slope < 6 ? "Suave" : slope < 10 ? "Moderada" : "Alta";
const docStorageKey = (parcelId, docName) => `villa-layos-doc:${parcelId}:${docName}`;
const planStorageKey = (phase, item) => `villa-layos-plan:${phase}:${item}`;
const simStorageKey = (field) => `villa-layos-sim:${field}`;
const simulationSelection = () => {
  const parcel = DATA.parcels.find((item) => item.id === localStorage.getItem(simStorageKey("parcel"))) || scoreParcels()[0].parcel;
  const priced = houseCatalog().filter((item) => item.price != null);
  const house = priced.find((item) => item.id === localStorage.getItem(simStorageKey("house"))) || priced.find((item) => item.fit === "objetivo") || priced[0];
  return { parcel, house };
};
const slopeBadge = (parcel) => {
  if (!parcel.topography?.hasReport) return `<span class="badge warn">Manual</span>`;
  const cls = parcel.topography.slope < 6 ? "ok" : parcel.topography.slope < 10 ? "warn" : "bad";
  return `<span class="badge ${cls}">QGIS ${num.format(parcel.topography.slope)}%</span>`;
};
const pdfButton = (href, label = "Abrir PDF") => `<a class="button-link" href="${encodeURI(href)}" target="_blank" rel="noreferrer">${label}</a>`;
const reportCount = () => DATA.parcels.filter((p) => p.topography?.hasReport).length;
const houseCatalog = () => DATA.house.catalog || [];
const housePriceWithVat = (house) => {
  if (!house || house.price == null) return null;
  if (house.vatIncluded === true) return Math.round(house.price);
  const vat = DATA.house.budgetAssumptions?.houseVat ?? DATA.house.simulatorAssumptions.vat;
  return Math.round(house.price * (1 + vat));
};
const chapterAmount = (house, chapter) => (house?.coveredChapters || []).includes(chapter.id) ? 0 : chapter.amount;
const budgetAssumptions = () => DATA.house.budgetAssumptions || {
  houseVat: DATA.house.simulatorAssumptions.vat,
  extrasVat: 0.21,
  licenseRate: DATA.house.simulatorAssumptions.licenseIcioRate,
  ajdRate: 0.015,
  contingencyRate: DATA.house.simulatorAssumptions.contingencyRate,
  budgetReference: DATA.house.simulatorAssumptions.budgetReference,
  chapters: []
};
const projectBudget = (parcel, house) => {
  if (!parcel || !house || house.price == null) return null;
  const a = budgetAssumptions();
  const houseNet = house.vatIncluded === true ? Math.round(house.price / (1 + a.houseVat)) : Math.round(house.price);
  const houseVat = house.vatIncluded === true ? Math.round(house.price - houseNet) : Math.round(houseNet * a.houseVat);
  const houseGross = houseNet + houseVat;
  const chapters = a.chapters.map((chapter) => ({ ...chapter, amount: chapterAmount(house, chapter) }));
  const houseChapters = chapters.filter((chapter) => chapter.tax === "house");
  const extraChapters = chapters.filter((chapter) => chapter.tax === "extras");
  const noTaxChapters = chapters.filter((chapter) => chapter.tax === "none");
  const sum = (items) => items.reduce((total, item) => total + item.amount, 0);
  const houseExtrasNet = sum(houseChapters);
  const otherExtrasNet = sum(extraChapters);
  const noTax = sum(noTaxChapters);
  const taxableHouse = houseNet + houseExtrasNet;
  const taxableExtras = otherExtrasNet;
  const license = Math.round(taxableHouse * a.licenseRate);
  const ajd = Math.round(taxableHouse * a.ajdRate);
  const vatHouse = Math.round(taxableHouse * a.houseVat);
  const vatExtras = Math.round(taxableExtras * a.extrasVat);
  const constructionBeforeContingency = taxableHouse + taxableExtras + noTax + license + ajd + vatHouse + vatExtras;
  const contingency = Math.round(constructionBeforeContingency * a.contingencyRate);
  const parcelReady = acquisitionCost(parcel);
  const constructionTotal = constructionBeforeContingency + contingency;
  return {
    scenario: a.scenario || "desfavorable",
    parcelReady,
    houseNet,
    houseVat,
    houseGross,
    chapters,
    houseExtrasNet,
    otherExtrasNet,
    noTax,
    taxableHouse,
    taxableExtras,
    license,
    ajd,
    vatHouse,
    vatExtras,
    constructionBeforeContingency,
    contingency,
    constructionTotal,
    total: parcelReady + constructionTotal,
    budgetReference: a.budgetReference,
    delta: a.budgetReference - (parcelReady + constructionTotal)
  };
};
const budgetRows = (budget) => [
  ["Parcela lista para proyecto", money.format(budget.parcelReady)],
  ["Vivienda base", money.format(budget.houseNet)],
  ["Partidas vivienda al 10%", money.format(budget.houseExtrasNet)],
  ["Partidas exteriores/técnicas al 21%", money.format(budget.otherExtrasNet)],
  ["Partidas sin IVA directo", money.format(budget.noTax)],
  ["Licencia / ICIO estimado", money.format(budget.license)],
  ["AJD estimado", money.format(budget.ajd)],
  ["IVA vivienda 10%", money.format(budget.vatHouse)],
  ["IVA extras 21%", money.format(budget.vatExtras)],
  ["Contingencia", money.format(budget.contingency)],
  ["Total proyecto", money.format(budget.total)]
];
const visibleBudgetChapters = (budget) => budget.chapters.filter((chapter) => chapter.amount > 0);
const missingBudgetChapters = (house) => {
  const covered = new Set(house?.coveredChapters || []);
  return budgetAssumptions().chapters.filter((chapter) => !covered.has(chapter.id));
};
const coveredBudgetChapters = (house) => {
  const covered = new Set(house?.coveredChapters || []);
  return budgetAssumptions().chapters.filter((chapter) => covered.has(chapter.id));
};
const selectedBudget = () => {
  const { parcel, house } = simulationSelection();
  return { parcel, house, budget: projectBudget(parcel, house) };
};
const modelVisual = (item) => `<div class="model-visual"><span>${esc(item.provider.split(" ")[0])}</span><strong>${esc(item.model)}</strong><small>${item.area ? `${num.format(item.area)} m²` : "Superficie pendiente"}</small></div>`;
const providerOptions = (catalog) => ["Todos los proveedores", ...new Set(catalog.map((item) => item.provider))];
const fitOptions = (catalog) => ["Todos los encajes", ...new Set(catalog.map((item) => item.fit))];
const housePriceLabel = (house) => {
  if (!house || house.price == null) return "Sin precio";
  if (house.vatIncluded === true) return "IVA incluido o tratado como incluido";
  if (house.vatIncluded === false) return "IVA 10% añadido";
  return "IVA 10% añadido por prudencia";
};
const finishLevel = (house) => {
  const text = [house?.provider, house?.model, house?.fit, house?.included, house?.notes].join(" ").toLowerCase();
  if (text.includes("iconic") || text.includes("premium") || text.includes("comfort") || text.includes("lujo")) return 4;
  if (text.includes("prime") || text.includes("objetivo") || text.includes("controlado")) return 3;
  if (text.includes("essential") || text.includes("básic") || text.includes("basic") || text.includes("compacta")) return 1;
  return 2;
};
const houseSortValue = (house, key, parcel) => {
  if (key === "price") return house.price == null ? Infinity : housePriceWithVat(house);
  if (key === "total") {
    const budget = projectBudget(parcel, house);
    return budget ? budget.total : Infinity;
  }
  if (key === "finish") return finishLevel(house);
  if (key === "area") return house.area || Infinity;
  return `${house.provider} ${house.model}`.toLowerCase();
};
const simulationTotals = (parcel, house) => {
  const budget = projectBudget(parcel, house);
  if (!budget) return null;
  return {
    ...budget,
    houseReady: budget.houseGross,
    permit: budget.license,
    civilWorks: budget.houseExtrasNet,
    utilityConnections: budget.otherExtrasNet,
    externalWorks: 0,
    technicalExtras: 0
  };
};
const planItems = () => DATA.plan.flatMap((phase) => phase.items.map((item) => ({ phase: phase.phase, item })));
const planProgress = () => {
  const items = planItems();
  if (!items.length) return 0;
  return items.filter(({ phase, item }) => localStorage.getItem(planStorageKey(phase, item)) === "1").length / items.length * 100;
};
const updatePlanProgress = () => {
  const progress = planProgress();
  $("#planProgress").textContent = pct(progress);
  $("#planProgressBar").style.width = pct(progress);
};
const acquisitionCost = (parcel) => {
  const a = DATA.costAssumptions;
  const formal = parcel.price * (1 + a.itp + a.notary + a.registry + a.contingency);
  return Math.round(formal + a.management + a.bankPayments + a.studies);
};
const perM2 = (parcel) => acquisitionCost(parcel) / parcel.area;
const topographicScore = (parcel) => {
  if (!parcel.topography?.hasReport) {
    const manual = (parcel.manualSlope || "").toLowerCase();
    if (manual.includes("plana")) return 11;
    if (manual.includes("semi")) return 8;
    return 5;
  }
  const slope = parcel.topography.slope;
  return Math.max(0, Math.min(20, 20 - slope * 1.35));
};
const scoreParcels = () => {
  const costs = DATA.parcels.map(acquisitionCost);
  const minCost = Math.min(...costs);
  const maxCost = Math.max(...costs);
  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0) || 1;
  return DATA.parcels.map((parcel) => {
    const costNorm = maxCost === minCost ? 1 : (maxCost - acquisitionCost(parcel)) / (maxCost - minCost);
    const slopeNorm = topographicScore(parcel) / 20;
    const viewsNorm = parcel.golfViews === "Si" ? 1 : parcel.golfViews === "Semi" ? .55 : 0;
    const shareNorm = parcel.golfShare === "Si" ? 1 : 0;
    const directNorm = parcel.seller === "Particular" ? 1 : 0;
    const score = (
      costNorm * weights.cost +
      slopeNorm * weights.slope +
      viewsNorm * weights.views +
      shareNorm * weights.share +
      directNorm * weights.direct
    ) / totalWeight * 100;
    return { parcel, score, costNorm, slopeNorm, viewsNorm, shareNorm, directNorm };
  }).sort((a, b) => b.score - a.score);
};

function headerContent(kicker, title, sub) {
  return `<div class="header"><div class="eyebrow">${kicker}</div><h2>${title}</h2><p class="sub">${sub}</p></div>`;
}

function header(kicker, title, sub, extra = "") {
  return `<div class="sticky-head">${headerContent(kicker, title, sub)}${extra}</div>`;
}

function stat(label, value, hint = "") {
  return `<div class="card solid"><div class="metric">${value}<small>${label}${hint ? ` · ${hint}` : ""}</small></div></div>`;
}

function rows(items) {
  return items.map(([label, value]) => `<div class="row"><span>${label}</span><strong>${value}</strong></div>`).join("");
}

function renderNav() {
  $("#nav").innerHTML = views.map(([id, icon, label]) => `<button data-view="${id}" class="${id === "inicio" ? "active" : ""}"><span class="icon">${icon}</span>${label}</button>`).join("");
  $$("#nav button").forEach((button) => button.addEventListener("click", () => openView(button.dataset.view)));
}

function openView(id, options = {}) {
  if (id === "inicio") renderInicio();
  if (id === "resumen") renderResumen();
  if (id === "modelos") renderModelos();
  if (id === "simulador") renderSimulador();
  if (id === "viabilidad") renderViabilidad();
  $$(".view").forEach((view) => view.classList.toggle("active", view.id === id));
  $$("#nav button").forEach((button) => button.classList.toggle("active", button.dataset.view === id));
  const active = views.find(([viewId]) => viewId === id);
  $("#mobileTitle").textContent = active ? active[2] : "Villa Layos";
  $("#sidebar").classList.remove("open");
  $("#menuButton").classList.remove("open");
  $("#overlay").classList.remove("show");
  if (!options.preserveScroll) window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  if (location.hash !== `#${id}`) history.replaceState(null, "", `#${id}`);
  updatePlanProgress();
}

function renderInicio() {
  const { parcel, house } = simulationSelection();
  const totals = simulationTotals(parcel, house);
  const budget = DATA.house.simulatorAssumptions.budgetReference;
  const difference = totals ? budget - totals.total : null;
  const currentPhase = DATA.plan.find((phase) => phase.items.some((item) => localStorage.getItem(planStorageKey(phase.phase, item)) !== "1"));
  $("#inicio").innerHTML = `
    <section class="home-layout">
      <div class="home-cover">
        <img src="assets/foto%20inicio.jpg" alt="Inspiración visual para la casa definitiva en Villa Layos">
        <div class="home-shade"></div>
        <div class="home-copy">
          <div class="eyebrow">Villa Layos · Casa definitiva</div>
          <h2>Una vivienda<br>con calma</h2>
          <p>Un proyecto para convertir una parcela bien elegida en una vivienda serena, eficiente y preparada para vivir muchos años con calma.</p>
          <button class="home-cta" type="button" data-go="resumen">Ver resumen del proyecto</button>
        </div>
      </div>
      <div class="home-panel">
        <div class="section-heading">
          <div class="eyebrow">Estado vivo</div>
          <h3>El proyecto de un vistazo</h3>
          <p>Combinación actual · escenario desfavorable estimado</p>
        </div>
        <div class="home-facts">
          <div><strong>${esc(parcel.name)}</strong><span>Parcela seleccionada</span></div>
          <div><strong>${money.format(acquisitionCost(parcel))}</strong><span>Parcela lista para proyecto · adquisición, impuestos y gastos</span></div>
          <div><strong>${house ? `${esc(house.provider)} · ${esc(house.model)}` : "Pendiente de elegir"}</strong><span>Vivienda seleccionada</span></div>
          <div><strong>${totals ? money.format(totals.houseReady) : "Sin precio"}</strong><span>Precio vivienda de referencia · ${housePriceLabel(house)}</span></div>
          <div><strong>${totals ? money.format(totals.total) : "Pendiente de precio"}</strong><span>Total desfavorable estimado · parcela, vivienda, obra, trámites, impuestos y contingencia</span></div>
          <div><strong>${money.format(budget)}</strong><span>Presupuesto de referencia</span></div>
          <div class="${difference == null ? "" : difference < 0 ? "budget-over" : "budget-within"}"><strong>${difference == null ? "Pendiente de precio" : money.format(Math.abs(difference))}</strong><span>${difference == null ? "Diferencia frente al presupuesto" : difference < 0 ? "Exceso sobre el presupuesto" : difference > 0 ? "Margen a favor del presupuesto" : "Presupuesto ajustado sin margen"}</span></div>
          <div><strong>Estado actual de decisión</strong><span>${esc(currentPhase?.phase || "Timeline completado")} · ${pct(planProgress())} del plan completado</span></div>
        </div>
      </div>
    </section>
  `;
  $("#inicio [data-go]").addEventListener("click", (event) => openView(event.currentTarget.dataset.go));
}

function renderResumen() {
  const ranked = scoreParcels();
  const { parcel, house, budget } = selectedBudget();
  const qgisCount = reportCount();
  const currentPhase = DATA.plan.find((phase) => phase.items.some((item) => localStorage.getItem(planStorageKey(phase.phase, item)) !== "1"));
  $("#resumen").innerHTML = `
    ${header("Resumen", "Proyecto completo parcela + vivienda", "Vista viva de la combinación activa del simulador: terreno, vivienda, presupuesto completo, documentación crítica y avance real del plan.")}
    <div class="grid cols-4">
      ${stat("Parcela activa", esc(parcel.name), `${money.format(acquisitionCost(parcel))} lista para proyecto`)}
      ${stat("Vivienda activa", house ? esc(house.model) : "Pendiente", house ? esc(house.provider) : "elige modelo")}
      ${stat("Total proyecto", budget ? money.format(budget.total) : "Sin precio", budget ? budget.scenario : "pendiente")}
      ${stat("Margen contra 300.000 EUR", budget ? money.format(Math.abs(budget.delta)) : "—", budget ? (budget.delta < 0 ? "exceso" : "a favor") : "pendiente")}
    </div>
    <div class="grid cols-2">
      <div class="card dark">
        <h3>Regla de decisión</h3>
        <p>${esc(DATA.project.decisionRule)}</p>
        <div class="row"><span>Estado actual</span><strong>${esc(currentPhase?.phase || "Timeline completado")}</strong></div>
        <div class="row"><span>Plan completado</span><strong>${pct(planProgress())}</strong></div>
        <div class="row"><span>Informes QGIS</span><strong>${qgisCount}/${DATA.parcels.length}</strong></div>
      </div>
      <div class="card">
        <h3>Combinación activa</h3>
        <ul class="list">
          <li>Parcela: ${esc(parcel.name)} · ${money.format(acquisitionCost(parcel))} con impuestos y gastos de adquisición.</li>
          <li>Vivienda: ${house ? `${esc(house.provider)} · ${esc(house.model)} · ${esc(house.priceLabel)}` : "pendiente de modelo con precio"}.</li>
          <li>Escenario: ${budget ? `${money.format(budget.total)} completo con partidas, impuestos y contingencia.` : "sin cálculo completo por falta de precio."}</li>
          <li>Antes de comprometer dinero: presupuesto cerrado, nota simple, urbanismo, geotécnico/topográfico y reserva intacta.</li>
        </ul>
      </div>
    </div>
    <div class="grid cols-4">
      ${stat("1 · Parcela", "Criba", "coste + QGIS")}
      ${stat("2 · Seguridad", "Docs", "jurídico + urbanismo")}
      ${stat("3 · Vivienda", "Modelo", "catálogo + presupuesto")}
      ${stat("4 · Proyecto", "Ejecución", "sin consumir reserva")}
    </div>
    <div class="card">
      <h3>Ranking preliminar explicable</h3>
      <div class="bars">${ranked.slice(0, 7).map((r) => `
        <div class="barline"><span>${esc(r.parcel.name)}</span><div class="bar"><i style="width:${r.score}%"></i></div><strong>${num.format(r.score)}</strong></div>
      `).join("")}</div>
      <p class="source">No es una certeza técnica: combina coste, pendiente, vistas, acción de golf y venta directa. Las parcelas sin informe QGIS usan solo clasificación manual penalizada.</p>
    </div>
    <div class="notice notice-spaced">${esc(DATA.project.topographyDisclaimer)}</div>
  `;
}

function renderParcelas() {
  $("#parcelas").innerHTML = `
    ${header("Inventario", "Parcelas comparables", "Tabla filtrable con coste desfavorable, topografía QGIS, atributos de golf y estado documental.", `
      <div class="toolbar sticky-toolbar">
        <input id="parcelSearch" placeholder="Buscar parcela, vendedor, contacto o nota">
        <select id="parcelStatus"><option value="">Todos los estados</option>${[...new Set(DATA.parcels.map((p) => p.status))].map((s) => `<option>${esc(s)}</option>`).join("")}</select>
        <select id="parcelTopo"><option value="">Toda la topografía</option><option value="qgis">Con informe QGIS</option><option value="manual">Solo manual</option></select>
        <select id="parcelSort"><option value="rank">Orden: ranking</option><option value="price">Precio anuncio</option><option value="total">Precio total</option><option value="slope">Inclinación</option><option value="seller">Vendedor</option></select>
        <select id="parcelSortDir"><option value="asc">Menor a mayor</option><option value="desc">Mayor a menor</option></select>
      </div>
    `)}
    <div class="scroll-body table-scroll-body">
      <div class="table-wrap scroll-table"><table class="data-table parcel-table"><colgroup><col><col><col><col><col><col><col><col></colgroup><thead><tr>
        <th>Parcela</th><th class="num">Precio</th><th class="num">Total desf.</th><th class="num">€/m²</th><th>Pendiente</th><th>Golf</th><th>Vendedor</th><th>Estado</th>
      </tr></thead><tbody id="parcelRows"></tbody></table></div>
    </div>
  `;
  ["parcelSearch", "parcelStatus", "parcelTopo", "parcelSort", "parcelSortDir"].forEach((id) => $(`#${id}`).addEventListener("input", drawParcelRows));
  drawParcelRows();
}

function drawParcelRows() {
  const text = ($("#parcelSearch").value || "").toLowerCase();
  const status = $("#parcelStatus").value;
  const topo = $("#parcelTopo").value;
  const sortKey = $("#parcelSort").value;
  const dir = $("#parcelSortDir").value === "desc" ? -1 : 1;
  const rankMap = new Map(scoreParcels().map((item, index) => [item.parcel.id, index]));
  const valueFor = (parcel) => {
    if (sortKey === "price") return parcel.price;
    if (sortKey === "total") return acquisitionCost(parcel);
    if (sortKey === "slope") return parcel.topography?.hasReport ? parcel.topography.slope : 99;
    if (sortKey === "seller") return `${parcel.seller} ${parcel.contact || ""}`.toLowerCase();
    return rankMap.get(parcel.id) ?? 999;
  };
  const filtered = DATA.parcels.filter((p) => {
    const hay = [p.name, p.seller, p.contact, p.note].join(" ").toLowerCase();
    return (!text || hay.includes(text)) && (!status || p.status === status) && (!topo || (topo === "qgis" ? p.topography.hasReport : !p.topography.hasReport));
  }).sort((a, b) => {
    const av = valueFor(a);
    const bv = valueFor(b);
    if (typeof av === "string" || typeof bv === "string") return String(av).localeCompare(String(bv), "es") * dir;
    return (av - bv) * dir;
  });
  $("#parcelRows").innerHTML = filtered.map((p) => `
    <tr>
      <td><strong>${esc(p.name)}</strong><span class="source parcel-note">${esc(p.note || "Sin nota adicional")}</span></td>
      <td class="num nowrap">${money.format(p.price)}</td>
      <td class="num nowrap">${money.format(acquisitionCost(p))}</td>
      <td class="num nowrap">${money.format(perM2(p))}</td>
      <td class="compact-lines nowrap">${slopeBadge(p)} <span class="source">${p.topography.hasReport ? `${esc(slopeClass(p.topography.slope))} · ${num.format(p.topography.relief)} m` : esc(p.manualSlope)}</span></td>
      <td class="compact-lines nowrap">Vista ${esc(p.golfViews)} · Acc. ${esc(p.golfShare || "No")}</td>
      <td class="compact-lines">${esc(p.seller)}<br><span class="source">${esc(p.contact || "Sin contacto")}</span></td>
      <td>${statusBadge(p.status)}</td>
    </tr>
  `).join("");
}

function statusBadge(status) {
  const cls = status.includes("Finalista") ? "ok" : status.includes("Descart") || status.includes("Baja") ? "bad" : "warn";
  return `<span class="badge ${cls}">${esc(status)}</span>`;
}

function renderFicha() {
  $("#ficha").innerHTML = `
    ${header("Ficha individual", "Parcela, coste y riesgos", "Selector con datos económicos, topográficos, documentación disponible, riesgos y enlaces de origen.")}
    <div class="toolbar"><div class="selector-card"><label for="parcelSelect">Parcela</label><select id="parcelSelect">${DATA.parcels.map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join("")}</select></div></div>
    <div id="parcelCard"></div>
  `;
  $("#parcelSelect").addEventListener("change", drawFicha);
  drawFicha();
}

function drawFicha() {
  const p = DATA.parcels.find((item) => item.id === $("#parcelSelect").value);
  const t = p.topography;
  $("#parcelCard").innerHTML = `
    <div class="grid cols-3">
      ${stat("Precio anunciado", money.format(p.price), `${num.format(p.area)} m²`)}
      ${stat("Coste desfavorable", money.format(acquisitionCost(p)), `${money.format(perM2(p))}/m²`)}
      ${stat("IBI estimado", money.format(p.ibi), "anual")}
    </div>
    <div class="grid cols-2">
      <div class="card">${rows([
        ["Estado", statusBadge(p.status)],
        ["Vendedor", esc(p.seller)],
        ["Contacto", esc(p.contact || "Pendiente")],
        ["Vistas al golf", esc(p.golfViews)],
        ["Acción de golf", esc(p.golfShare || "No")],
        ["Enlace", p.link ? pdfButton(p.link, "Idealista") : "Sin enlace en calculadora"]
      ])}</div>
      <div class="card">
        <h3>Topografía</h3>
        ${t.hasReport ? rows([
          ["Referencia", esc(t.reference)],
          ["Pendiente media plano", `${num.format(t.slope)}%`],
          ["Categoría calculada", esc(slopeClass(t.slope))],
          ["Cotas mínima / máxima", `${num.format(t.zMin)} / ${num.format(t.zMax)} m`],
          ["Desnivel", `${num.format(t.relief)} m`],
          ["RMSE plano", `${num.format(t.rmse)} m`],
          ["Fuente", `${esc(t.crs)}, malla ${t.gridM} m, vuelo ${t.sourceYear}`],
          ["Informe", pdfButton(t.report, "PDF preliminar")]
        ]) : `<p class="sub">${esc(t.quality)}</p>`}
      </div>
    </div>
    <div class="grid cols-2">
      <div class="card"><h3>Documentación disponible</h3><ul class="list">${p.docs.map((d) => `<li>${esc(d)}</li>`).join("")}</ul></div>
      <div class="card"><h3>Riesgos</h3><ul class="list"><li>Coste de obra civil pendiente de validar.</li><li>Nota simple, cargas y urbanismo no cerrados.</li><li>${esc(t.quality)}</li></ul></div>
    </div>
  `;
}

function renderComparativa() {
  $("#comparativa").innerHTML = `
    ${header("Modelo multicriterio", "Ranking configurable", "Puntuación transparente y prudente. Sirve para criba, no para decidir una compra sin documentación técnica y jurídica.", `
      <div class="weight-grid">${Object.entries({ cost: "Coste", slope: "Pendiente", views: "Vistas", share: "Acción golf", direct: "Venta directa" }).map(([key, label]) => `
        <div class="weight"><label><span>${label}</span><strong id="w-${key}">${weights[key]}</strong></label><input type="range" min="0" max="60" value="${weights[key]}" data-weight="${key}"></div>
      `).join("")}</div>
    `)}
    <div class="scroll-body table-scroll-body">
      <div class="table-wrap scroll-table"><table class="data-table"><thead><tr><th>#</th><th>Parcela</th><th class="num">Puntos</th><th class="num">Coste</th><th class="num">Pendiente</th><th>Lectura</th></tr></thead><tbody id="rankingRows"></tbody></table></div>
    </div>
    <p class="source fixed-source">La pendiente usa métrica QGIS cuando existe. Si no existe, se usa una aproximación manual con menor confianza.</p>
  `;
  $$("input[data-weight]").forEach((input) => input.addEventListener("input", () => {
    weights[input.dataset.weight] = Number(input.value);
    $(`#w-${input.dataset.weight}`).textContent = input.value;
    drawRanking();
  }));
  drawRanking();
}

function drawRanking() {
  $("#rankingRows").innerHTML = scoreParcels().map((r, i) => `
    <tr><td>${i + 1}</td><td><strong>${esc(r.parcel.name)}</strong><br><span class="source">${esc(r.parcel.status)}</span></td><td class="num">${num.format(r.score)}</td><td class="num">${money.format(acquisitionCost(r.parcel))}</td><td class="num">${r.parcel.topography.hasReport ? `${num.format(r.parcel.topography.slope)}%` : "Manual"}</td><td>${r.score > 68 ? "Finalista preliminar" : r.score > 58 ? "Mantener en observación" : "Baja prioridad relativa"}</td></tr>
  `).join("");
}

function renderCostes() {
  const selectedId = $("#costParcelSelect")?.value || scoreParcels()[0].parcel.id;
  const selected = DATA.parcels.find((p) => p.id === selectedId) || scoreParcels()[0].parcel;
  const a = DATA.costAssumptions;
  const parts = [
    ["Precio de compra", selected.price],
    ["ITP desfavorable 9%", selected.price * a.itp],
    ["Notaría + Registro", selected.price * (a.notary + a.registry)],
    ["Gestoría + medios de pago", a.management + a.bankPayments],
    ["Estudios previos", a.studies],
    ["Contingencia adquisición 3%", selected.price * a.contingency]
  ];
  $("#costes").innerHTML = `
    ${header("Economía", "Coste completo antes de proyecto", "La calculadora separa adquisición de parcela de vivienda, licencia, obra civil, acometidas, urbanización y construcción.")}
    <div class="toolbar"><div class="selector-card"><label for="costParcelSelect">Detalle de costes</label><select id="costParcelSelect">${DATA.parcels.map((p) => `<option value="${p.id}" ${p.id === selected.id ? "selected" : ""}>${esc(p.name)} · ${money.format(acquisitionCost(p))}</option>`).join("")}</select></div></div>
    <div class="grid cols-2">
      <div class="card dark"><h3>Parcela de referencia</h3><div class="metric">${esc(selected.name)}<small>${money.format(acquisitionCost(selected))} · escenario desfavorable</small></div></div>
      <div class="card"><h3>Regla de caja</h3><p class="sub">El fondo personal de ${money.format(DATA.project.reserveProtected)} no se consume en parcela, impuestos, técnicos, licencias, vivienda, urbanización, suministros ni desviaciones.</p></div>
    </div>
    <div class="grid cols-2">
      <div class="card">${rows(parts.map(([k, v]) => [k, money.format(v)]).concat([["Total parcela lista para proyecto", money.format(acquisitionCost(selected))]]))}</div>
      <div class="card"><h3>Costes no incluidos</h3><ul class="list"><li>Proyecto, dirección facultativa, licencia e ICIO.</li><li>Movimiento de tierras, cimentación, contenciones y drenaje.</li><li>Acometidas definitivas, vallado, jardinería, piscina y equipamiento.</li><li>Construcción de vivienda y garaje.</li></ul></div>
    </div>
    <div class="card"><h3>Costes ocultos habituales</h3><ul class="list">${DATA.hiddenCosts.map((item) => `<li><strong>${esc(item.label)}:</strong> ${esc(item.amount)} · ${esc(item.note)}</li>`).join("")}</ul></div>
    <div class="card cost-comparison-card"><h3>Comparativa de coste total</h3><div class="bars">${DATA.parcels.slice().sort((a,b)=>acquisitionCost(a)-acquisitionCost(b)).map((p) => `<div class="barline"><span>${esc(p.name)}</span><div class="bar"><i style="width:${Math.min(100, acquisitionCost(p) / 110000 * 100)}%"></i></div><strong>${money.format(acquisitionCost(p))}</strong></div>`).join("")}</div></div>
  `;
  $("#costParcelSelect").addEventListener("change", renderCostes);
}

function renderTopografia() {
  const withTopo = DATA.parcels.filter((p) => p.topography.hasReport).sort((a, b) => a.topography.slope - b.topography.slope);
  $("#topografia").innerHTML = `
    ${header("QGIS / MDT02", "Topografía real disponible", "Resumen de informes preliminares localizados. Las categorías se calculan desde pendiente, desnivel y cotas, no desde etiquetas manuales.")}
    <div class="scroll-body">
      <div class="notice notice-spaced">${esc(DATA.project.topographyDisclaimer)}</div>
      <div class="card topo-summary"><h3>Informes incorporados</h3><div class="metric">${withTopo.length}/${DATA.parcels.length}<small>PDF QGIS/MDT02 disponibles en esta versión</small></div></div>
      <div class="grid cols-3 topo-grid">
        ${withTopo.map((p) => stat(p.name, `${num.format(p.topography.slope)}%`, `${slopeClass(p.topography.slope)} · ${num.format(p.topography.relief)} m desnivel`)).join("")}
      </div>
      <div class="table-wrap scroll-table"><table class="data-table"><thead><tr><th>Parcela</th><th class="num">Pendiente</th><th class="num">Desnivel</th><th class="num">Cotas</th><th class="num">RMSE</th><th>Informe</th></tr></thead><tbody>
        ${withTopo.map((p) => `<tr><td><strong>${esc(p.name)}</strong><br><span class="source">${esc(p.topography.reference)}</span></td><td class="num">${num.format(p.topography.slope)}%</td><td class="num">${num.format(p.topography.relief)} m</td><td class="num">${num.format(p.topography.zMin)}-${num.format(p.topography.zMax)} m</td><td class="num">${num.format(p.topography.rmse)} m</td><td>${pdfButton(p.topography.report, "PDF")}</td></tr>`).join("")}
      </tbody></table></div>
    </div>
  `;
}

function renderVivienda() {
  const catalog = houseCatalog();
  const priced = catalog.filter((item) => item.price != null);
  const noPrice = catalog.length - priced.length;
  $("#vivienda").innerHTML = `
    ${header("Programa", "Vivienda industrializada de bajo mantenimiento", "Concepto actual: vivienda de una planta, 100-120 m2, bloque técnico alto y plataforma residencial inferior cuando la parcela lo pida.")}
    <div class="grid cols-2">
      <div class="card dark"><h3>Concepto activo</h3><p>${esc(DATA.house.concept)}</p></div>
      <div class="card"><h3>Programa funcional</h3><ul class="list">${DATA.house.program.map((item) => `<li>${esc(item)}</li>`).join("")}</ul></div>
    </div>
    <section class="section-gap"><div class="card"><h3>Sistemas constructivos</h3><div class="table-wrap"><table class="data-table"><thead><tr><th>Sistema</th><th>Encaje</th><th>Coste</th><th>Huella</th><th>Lectura</th></tr></thead><tbody>${DATA.house.systems.map((s) => `<tr><td><strong>${esc(s.name)}</strong></td><td>${esc(s.fit)}</td><td>${esc(s.cost)}</td><td>${esc(s.carbon)}</td><td>${esc(s.note)}</td></tr>`).join("")}</tbody></table></div></div></section>
    <section class="section-gap">
      <div class="section-heading">
        <div class="eyebrow">Empresas consultadas</div>
        <h3>Proveedores de vivienda industrializada</h3>
        <p>Referencias iniciales para contraste de precio, alcance incluido y riesgos de presupuesto.</p>
      </div>
      <div class="grid cols-2">${DATA.house.providers.map((p) => `<div class="card"><h3>${p.url ? `<a class="linked-title" href="${esc(p.url)}" target="_blank" rel="noreferrer">${esc(p.name)}</a>` : esc(p.name)}</h3><p><strong>${esc(p.reference)}</strong></p><p class="sub">${esc(p.risk)}</p></div>`).join("")}</div>
    </section>
    <section class="section-gap">
      <div class="card">
        <h3>Modelos localizados</h3>
        <p>${catalog.length} modelos incorporados: ${priced.length} con precio y ${noPrice} pendientes de presupuesto.</p>
        <p><button class="button-link" id="openModelos" type="button">Abrir catálogo de modelos</button></p>
      </div>
    </section>
  `;
  $("#openModelos").addEventListener("click", () => openView("modelos"));
}

function renderModelos() {
  const catalog = houseCatalog();
  const priced = catalog.filter((item) => item.price != null);
  const noPrice = catalog.length - priced.length;
  $("#modelos").innerHTML = `
    ${header("Catálogo", "Modelos de vivienda localizados", "Catálogo filtrable de viviendas industrializadas y prefabricadas. El coste total se calcula con la parcela activa del simulador.")}
    <div class="section-heading fixed-block">
      <div class="eyebrow">Catálogo y precios</div>
      <h3>Modelos localizados</h3>
      <p>${catalog.length} modelos incorporados: ${priced.length} con precio y ${noPrice} pendientes de presupuesto. Pulsa cualquier ficha para abrir superficie, alcance, riesgos y notas.</p>
    </div>
    <div class="toolbar fixed-block">
      <input id="houseSearch" placeholder="Buscar proveedor, modelo o nota">
      <select id="houseProvider">${providerOptions(catalog).map((value, index) => `<option value="${index ? esc(value) : ""}">${esc(value)}</option>`).join("")}</select>
      <select id="houseFit">${fitOptions(catalog).map((value, index) => `<option value="${index ? esc(value) : ""}">${esc(value)}</option>`).join("")}</select>
      <select id="houseSort"><option value="provider">Orden: proveedor</option><option value="price">Precio vivienda</option><option value="total">Precio total con parcela activa</option><option value="finish">Nivel de acabado</option><option value="area">Superficie</option></select>
      <select id="houseSortDir"><option value="asc">Menor a mayor</option><option value="desc">Mayor a menor</option></select>
    </div>
    <div class="scroll-body">
      <div class="model-grid" id="houseCards"></div>
    </div>
  `;
  ["houseSearch", "houseProvider", "houseFit", "houseSort", "houseSortDir"].forEach((id) => $(`#${id}`).addEventListener("input", drawHouseCards));
  drawHouseCards();
}

function drawHouseCards() {
  const catalog = houseCatalog();
  const text = ($("#houseSearch").value || "").toLowerCase();
  const provider = $("#houseProvider").value;
  const fit = $("#houseFit").value;
  const sortKey = $("#houseSort").value;
  const dir = $("#houseSortDir").value === "desc" ? -1 : 1;
  const { parcel } = simulationSelection();
  const filtered = catalog.filter((item) => {
    const hay = [item.provider, item.model, item.fit, item.priceLabel, item.included, item.excluded, item.notes].join(" ").toLowerCase();
    return (!text || hay.includes(text)) && (!provider || item.provider === provider) && (!fit || item.fit === fit);
  }).sort((a, b) => {
    const av = houseSortValue(a, sortKey, parcel);
    const bv = houseSortValue(b, sortKey, parcel);
    if (typeof av === "string" || typeof bv === "string") return String(av).localeCompare(String(bv), "es") * dir;
    return (av - bv) * dir;
  });
  $("#houseCards").innerHTML = filtered.map((item) => {
    const covered = coveredBudgetChapters(item);
    const missing = missingBudgetChapters(item);
    return `
      <details class="model-card">
        <summary>
          ${modelVisual(item)}
          <div class="model-summary">
            <strong>${esc(item.provider)}</strong>
            <span>${esc(item.model)} · ${item.area ? `${num.format(item.area)} m²` : "superficie pendiente"}</span>
            <b>${esc(item.priceLabel)}</b>
          </div>
        </summary>
        <div class="model-detail">
          <div>${rows([
            ["Encaje", esc(item.fit)],
            ["Confianza", esc(item.confidence)],
            ["Nivel acabado estimado", `${finishLevel(item)}/4`],
            ["Total con parcela activa", projectBudget(parcel, item) ? money.format(projectBudget(parcel, item).total) : "Sin precio"],
            ["Impuestos", esc(housePriceLabel(item))]
          ])}</div>
          <p><strong>Incluye / información importante</strong><br>${esc(item.included)}</p>
          <p><strong>Riesgo o pendiente</strong><br>${esc(item.excluded)}</p>
          <p class="source">${esc(item.notes || "Sin nota adicional.")}</p>
          ${covered.length ? `<p class="source"><strong>Marcado como cubierto:</strong> ${covered.map((chapter) => esc(chapter.label)).join(" · ")}</p>` : ""}
          ${missing.length ? `<p class="source"><strong>Partidas comparativas que el simulador puede sumar:</strong> ${missing.slice(0, 5).map((chapter) => esc(chapter.label)).join(" · ")}${missing.length > 5 ? "…" : ""}</p>` : ""}
          <p>${pdfButton(item.url, "Abrir web")}</p>
        </div>
      </details>`;
  }).join("");
}

function renderSimulador() {
  const catalog = houseCatalog();
  const { parcel, house } = simulationSelection();
  const budget = projectBudget(parcel, house);
  $("#simulador").innerHTML = `
    ${header("Escenarios", "Simulador parcela + vivienda", "Cruza una parcela con un modelo de vivienda prefabricada para estimar el coste completo antes de decidir. Es una criba económica, no un presupuesto cerrado.")}
    <div class="toolbar">
      <div class="selector-card"><label for="simParcelSelect">Parcela</label><select id="simParcelSelect">${DATA.parcels.map((p) => `<option value="${p.id}" ${p.id === parcel.id ? "selected" : ""}>${esc(p.name)} · ${money.format(acquisitionCost(p))}</option>`).join("")}</select></div>
      <div class="selector-card"><label for="simHouseSelect">Vivienda</label><select id="simHouseSelect">${catalog.map((item) => `<option value="${item.id}" ${item.id === house?.id ? "selected" : ""} ${item.price == null ? "disabled" : ""}>${esc(item.provider)} · ${esc(item.model)} · ${esc(item.priceLabel)}</option>`).join("")}</select></div>
    </div>
    ${budget ? `
      <div class="grid cols-4">
        ${stat("Parcela lista", money.format(budget.parcelReady), parcel.name)}
        ${stat("Vivienda + IVA prudente", money.format(budget.houseGross), housePriceLabel(house))}
        ${stat("Total proyecto", money.format(budget.total), budget.delta < 0 ? `+${money.format(Math.abs(budget.delta))} sobre ref.` : `${money.format(budget.delta)} bajo ref.`)}
        ${stat("Referencia presupuesto", money.format(budget.budgetReference), budget.scenario)}
      </div>
      <div class="grid cols-2">
        <div class="card dark"><h3>Combinación activa</h3><div class="metric">${esc(parcel.name)}<small>${esc(house.provider)} · ${esc(house.model)} · ${num.format(house.area)} m²</small></div></div>
        <div class="card"><h3>Lectura</h3><p class="sub">${budget.delta < 0 ? "Escenario tensionado: pide precio cerrado antes de avanzar y busca reducir alcance, parcela o capítulos exteriores." : "Escenario dentro de referencia preliminar, pendiente de presupuesto real, normativa y capítulos excluidos."}</p></div>
      </div>
      <div class="grid cols-2">
        <div class="card"><h3>Desglose estimado</h3>${rows(budgetRows(budget))}</div>
        <div class="card"><h3>Incluido / pendiente</h3><p><strong>${esc(house.priceLabel)}</strong></p><p class="sub">${esc(house.included)}</p><p class="source">${esc(house.excluded)}</p><p>${pdfButton(house.url, "Abrir web")}</p></div>
      </div>
      <div class="card">
        <h3>Partidas comparativas sumadas</h3>
        <div class="table-wrap"><table class="data-table budget-table"><thead><tr><th>Partida</th><th>Impuesto</th><th class="num">Base</th></tr></thead><tbody>
          ${visibleBudgetChapters(budget).map((chapter) => `<tr><td><strong>${esc(chapter.label)}</strong></td><td>${chapter.tax === "house" ? "IVA 10%" : chapter.tax === "extras" ? "IVA 21%" : "Sin IVA directo"}</td><td class="num">${money.format(chapter.amount)}</td></tr>`).join("")}
        </tbody></table></div>
        ${coveredBudgetChapters(house).length ? `<p class="source">Tratadas como ya cubiertas por esta referencia: ${coveredBudgetChapters(house).map((chapter) => esc(chapter.label)).join(" · ")}.</p>` : ""}
      </div>
    ` : `<div class="notice">Esta vivienda no tiene precio publicado suficiente para simular. Pide presupuesto cerrado y vuelve a cargarlo como referencia.</div>`}
    <div class="notice">Regla prudente: el simulador separa bases al 10%, partidas al 21%, licencia/ICIO, AJD, obra nueva y contingencia. Las partidas comparativas pueden ponerse a cero cuando un proveedor las incluya por escrito.</div>
  `;
  $("#simParcelSelect").addEventListener("change", (event) => {
    localStorage.setItem(simStorageKey("parcel"), event.target.value);
    renderSimulador();
    renderInicio();
    renderResumen();
    renderViabilidad();
  });
  $("#simHouseSelect").addEventListener("change", (event) => {
    localStorage.setItem(simStorageKey("house"), event.target.value);
    renderSimulador();
    renderInicio();
    renderResumen();
    renderViabilidad();
  });
}

function renderViabilidad() {
  const { parcel, house, budget } = selectedBudget();
  const reserveGap = budget ? DATA.project.budgetLimit - DATA.project.reserveProtected - budget.total : null;
  $("#viabilidad").innerHTML = `
    ${header("Viabilidad", "Presupuesto real por capítulos", "Lectura económica de la combinación activa del simulador. Separa impuestos y partidas para no comparar precios de catálogo con costes completos.")}
    ${budget ? `
      <div class="grid cols-4">
        ${stat("Combinación", esc(parcel.name), `${esc(house.provider)} · ${esc(house.model)}`)}
        ${stat("Total estimado", money.format(budget.total), budget.scenario)}
        ${stat("Contra 300.000 EUR", money.format(Math.abs(budget.delta)), budget.delta < 0 ? "exceso" : "margen")}
        ${stat("Reserva protegida", reserveGap == null ? "—" : money.format(Math.abs(reserveGap)), reserveGap < 0 ? "se compromete" : "queda margen")}
      </div>
      <div class="grid cols-2">
        <div class="card dark"><h3>Dictamen rápido</h3><div class="metric">${budget.delta < 0 ? "No viable sin ajuste" : "Viable en criba"}<small>${budget.delta < 0 ? "reducir alcance, negociar o cambiar combinación" : "pendiente de presupuestos y documentación"}</small></div></div>
        <div class="card"><h3>Condición de avance</h3><p class="sub">No pasar a señal, anteproyecto de pago o contrato hasta tener presupuesto cerrado por capítulos, nota simple, urbanismo, geotécnico/topográfico y reserva personal de ${money.format(DATA.project.reserveProtected)} intacta.</p></div>
      </div>
      <div class="grid cols-2">
        <div class="card"><h3>Construcción y trámites</h3>${rows(budgetRows(budget).slice(1))}</div>
        <div class="card"><h3>Costes ocultos a vigilar</h3><ul class="list">${DATA.hiddenCosts.map((item) => `<li><strong>${esc(item.label)}:</strong> ${esc(item.amount)} · ${esc(item.note)}</li>`).join("")}</ul></div>
      </div>
      <div class="card">
        <h3>Capítulos editables en la plantilla</h3>
        <div class="table-wrap"><table class="data-table budget-table"><thead><tr><th>Capítulo</th><th>Tratamiento fiscal</th><th class="num">Importe</th></tr></thead><tbody>
          ${budget.chapters.map((chapter) => `<tr><td><strong>${esc(chapter.label)}</strong>${chapter.amount === 0 ? `<br><span class="source">Tratada como cubierta por ${esc(house.provider)}</span>` : ""}</td><td>${chapter.tax === "house" ? "IVA 10%" : chapter.tax === "extras" ? "IVA 21%" : "Sin IVA directo"}</td><td class="num">${money.format(chapter.amount)}</td></tr>`).join("")}
        </tbody></table></div>
      </div>
    ` : `<div class="notice">Selecciona una vivienda con precio publicado en Simulador para calcular viabilidad.</div>`}
  `;
}

function renderEntrevistas() {
  $("#entrevistas").innerHTML = `
    ${header("Entrevistas", "Comerciales y tareas de contraste", "Checklist operativo para hablar con empresas sin olvidar exclusiones, impuestos, plazos ni pagos.")}
    <div class="grid cols-2">
      <div class="card dark"><h3>Regla de entrevista</h3><p>No aceptar un precio sin desglose. Cada respuesta debe aclarar si está incluida, excluida, estimada o condicionada a parcela/proyecto.</p></div>
      <div class="card"><h3>Otras gestiones</h3><ul class="list">${DATA.management.otherTasks.map((item) => `<li>${esc(item)}</li>`).join("")}</ul></div>
    </div>
    <div class="management-grid">
      ${DATA.management.commercialQuestions.map((group) => `
        <div class="card">
          <h3>${esc(group.group)}</h3>
          <div class="check-list">${group.items.map((item) => {
            const key = `villa-layos-gestion:${group.group}:${item}`;
            const checked = localStorage.getItem(key) === "1";
            return `<label class="check-item ${checked ? "done" : ""}"><input type="checkbox" data-key="${esc(key)}" ${checked ? "checked" : ""}><strong>${esc(item)}</strong></label>`;
          }).join("")}</div>
        </div>
      `).join("")}
    </div>
  `;
  $$("#entrevistas .check-item input").forEach((box) => box.addEventListener("change", () => {
    localStorage.setItem(box.dataset.key, box.checked ? "1" : "0");
    renderEntrevistas();
  }));
}

function renderDocumentacion() {
  const selectedId = $("#docParcelSelect")?.value || DATA.parcels[0].id;
  const selected = DATA.parcels.find((p) => p.id === selectedId) || DATA.parcels[0];
  const docs = selected.documentation || DATA.documents;
  const done = docs.filter((d) => d.status === "disponible" || localStorage.getItem(docStorageKey(selected.id, d.name)) === "1").length;
  const progress = docs.length ? done / docs.length * 100 : 0;
  $("#docProgress").textContent = pct(progress);
  $("#docProgressBar").style.width = pct(progress);
  $("#documentacion").innerHTML = `
    ${header("Checklist", "Documentación por parcela", "Selecciona una parcela y marca lo que ya esté conseguido. Los checks se guardan localmente en este navegador.")}
    <div class="toolbar"><div class="selector-card"><label for="docParcelSelect">Parcela</label><select id="docParcelSelect">${DATA.parcels.map((p) => `<option value="${p.id}" ${p.id === selected.id ? "selected" : ""}>${esc(p.name)}</option>`).join("")}</select></div></div>
    <div class="card"><h3>Parcela seleccionada</h3><div class="metric">${esc(selected.name)}<small>${done}/${docs.length} documentos marcados como conseguidos</small></div></div>
    <div class="table-wrap"><table class="data-table doc-table"><colgroup><col><col><col></colgroup><thead><tr><th>Documento</th><th>Estado</th><th>Acción</th></tr></thead><tbody>${docs.map((d) => {
      const checked = d.status === "disponible" || localStorage.getItem(docStorageKey(selected.id, d.name)) === "1";
      const cls = checked ? "ok" : "warn";
      const label = checked ? "conseguida" : "pendiente";
      return `<tr><td><label class="doc-label"><input class="doc-check" type="checkbox" data-doc="${esc(d.name)}" ${checked ? "checked" : ""}><strong>${esc(d.name)}</strong></label></td><td><span class="badge ${cls}">${label}</span></td><td>${esc(d.action)}</td></tr>`;
    }).join("")}</tbody></table></div>
  `;
  $("#docParcelSelect").addEventListener("change", renderDocumentacion);
  $$(".doc-check").forEach((box) => box.addEventListener("change", () => {
    localStorage.setItem(docStorageKey(selected.id, box.dataset.doc), box.checked ? "1" : "0");
    renderDocumentacion();
  }));
}

function renderPlan() {
  const progress = planProgress();
  updatePlanProgress();
  $("#plan").innerHTML = `
    ${header("Fases", "Timeline del proyecto", "Marca cada hito completado. El avance se guarda en este navegador y alimenta la barra lateral del proyecto.")}
    <div class="progress-fixed"><div class="card"><h3>Avance del timeline</h3><div class="bar"><i style="width:${progress}%"></i></div><p class="source">${pct(progress)} completado</p></div></div>
    <div class="scroll-body"><div class="timeline timeline-scroll">${DATA.plan.map((phase, index) => {
      const done = phase.items.filter((item) => localStorage.getItem(planStorageKey(phase.phase, item)) === "1").length;
      const state = done === phase.items.length ? "ok" : phase.state === "en curso" ? "info" : "warn";
      return `
        <section class="timeline-phase">
          <span class="timeline-num">${index + 1}</span>
          <div class="card timeline-card">
            <h3>${esc(phase.phase)}</h3>
            <span class="badge ${state}">${done}/${phase.items.length}</span>
            <div class="check-list">${phase.items.map((item) => {
              const checked = localStorage.getItem(planStorageKey(phase.phase, item)) === "1";
              return `<label class="check-item ${checked ? "done" : ""}"><input type="checkbox" data-phase="${esc(phase.phase)}" data-item="${esc(item)}" ${checked ? "checked" : ""}><strong>${esc(item)}</strong></label>`;
            }).join("")}</div>
          </div>
        </section>`;
    }).join("")}</div></div>
  `;
  $$(".check-item input").forEach((box) => box.addEventListener("change", () => {
    localStorage.setItem(planStorageKey(box.dataset.phase, box.dataset.item), box.checked ? "1" : "0");
    renderPlan();
  }));
}

function renderAyuda() {
  $("#ayuda").innerHTML = `
    ${header("Manual", "Ayuda de la app", "Guía rápida para usar el panel sin perder el criterio económico, documental y técnico.")}
    <div class="grid cols-2">
      <div class="card"><h3>Lectura general</h3><ul class="list"><li>Resumen da la foto ejecutiva: mejor parcela, coste desfavorable, informes QGIS y reserva protegida.</li><li>Parcelas permite filtrar por estado, topografía y texto libre.</li><li>Ficha de parcela concentra enlace, costes, documentación y topografía de una parcela.</li></ul></div>
      <div class="card"><h3>Decisión económica</h3><ul class="list"><li>Costes separa adquisición de parcela del resto del proyecto.</li><li>Comparativa permite ajustar pesos: coste, pendiente, vistas, acción de golf y venta directa.</li><li>Simulador cruza una parcela con una vivienda y añade colchones prudentes de obra, licencia, acometidas y contingencia.</li><li>El ranking es una criba, no una decisión de compra.</li></ul></div>
      <div class="card"><h3>Documentación</h3><ul class="list"><li>Selecciona parcela y marca lo conseguido.</li><li>Los checks se guardan localmente en este navegador.</li><li>La barra lateral refleja el avance documental de la parcela activa.</li></ul></div>
      <div class="card"><h3>Proyecto</h3><ul class="list"><li>Plan del proyecto es un timeline ticable.</li><li>El avance se guarda localmente y actualiza la barra lateral.</li><li>No adelantar pagos sin nota simple, cargas, urbanismo y visitas críticas.</li></ul></div>
    </div>
  `;
}

function renderAbout() {
  $("#about").innerHTML = `
    ${header("About", "Villa Layos", "Panel privado de análisis de parcela, topografía, documentación, costes y planificación.")}
    <div class="grid cols-2">
      <div class="card dark"><h3>Créditos</h3><div class="metric">Diseñado por Yakoba Moreno<small>en Codex</small></div></div>
      <div class="card"><h3>Build</h3><div class="metric">${BUILD}<small>GitHub Pages</small></div></div>
    </div>
    <div class="card"><h3>Uso previsto</h3><p class="sub">Herramienta de criba y seguimiento. Los informes MDT02/QGIS son preliminares y no sustituyen levantamiento topográfico profesional, geotecnia, nota simple, urbanismo ni proyecto técnico.</p></div>
  `;
}

async function init() {
  const response = await fetch(`data/project-data.json?v=${BUILD}`, { cache: "no-store" });
  DATA = await response.json();
  renderNav();
  renderInicio();
  renderResumen();
  renderParcelas();
  renderFicha();
  renderComparativa();
  renderCostes();
  renderTopografia();
  renderVivienda();
  renderModelos();
  renderSimulador();
  renderViabilidad();
  renderEntrevistas();
  renderDocumentacion();
  renderPlan();
  renderAyuda();
  renderAbout();
  updatePlanProgress();
  const hash = location.hash.replace("#", "") === "gestiones" ? "entrevistas" : location.hash.replace("#", "");
  if (views.some(([id]) => id === hash)) openView(hash);
  else history.replaceState(null, "", "#inicio");
  $("#menuButton").addEventListener("click", () => {
    const isOpen = $("#sidebar").classList.toggle("open");
    $("#menuButton").classList.toggle("open", isOpen);
    $("#overlay").classList.toggle("show", isOpen);
  });
  $("#overlay").addEventListener("click", () => {
    $("#sidebar").classList.remove("open");
    $("#menuButton").classList.remove("open");
    $("#overlay").classList.remove("show");
  });
  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    navigator.serviceWorker.register("service-worker.js").catch(() => {});
  }
}

init().catch((error) => {
  document.body.innerHTML = `<main class="content"><div class="notice">No se pudo cargar la aplicación: ${esc(error.message)}</div></main>`;
});
