const views = [
  ["resumen", "⌂", "Resumen"],
  ["parcelas", "▤", "Parcelas"],
  ["ficha", "◫", "Ficha de parcela"],
  ["comparativa", "◎", "Comparativa"],
  ["costes", "€", "Costes"],
  ["topografia", "▱", "Topografía"],
  ["vivienda", "⌁", "Vivienda"],
  ["simulador", "◈", "Simulador"],
  ["documentacion", "✓", "Documentación"],
  ["plan", "↗", "Plan del proyecto"],
  ["ayuda", "?", "Ayuda"],
  ["about", "i", "About"]
];

const BUILD = "20260921-1";
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
  if (house.vatIncluded === false) return Math.round(house.price * (1 + DATA.house.simulatorAssumptions.vat));
  return Math.round(house.price);
};
const simulationTotals = (parcel, house) => {
  const a = DATA.house.simulatorAssumptions;
  const parcelReady = acquisitionCost(parcel);
  const houseReady = housePriceWithVat(house);
  if (houseReady == null) return null;
  const permit = Math.round(houseReady * a.licenseIcioRate);
  const beforeContingency = parcelReady + houseReady + permit + a.civilWorks + a.utilityConnections + a.externalWorks + a.technicalExtras;
  const contingency = Math.round(beforeContingency * a.contingencyRate);
  return {
    parcelReady,
    houseReady,
    permit,
    civilWorks: a.civilWorks,
    utilityConnections: a.utilityConnections,
    externalWorks: a.externalWorks,
    technicalExtras: a.technicalExtras,
    contingency,
    total: beforeContingency + contingency
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

function header(kicker, title, sub) {
  return `<div class="header"><div class="eyebrow">${kicker}</div><h2>${title}</h2><p class="sub">${sub}</p></div>`;
}

function stat(label, value, hint = "") {
  return `<div class="card solid"><div class="metric">${value}<small>${label}${hint ? ` · ${hint}` : ""}</small></div></div>`;
}

function rows(items) {
  return items.map(([label, value]) => `<div class="row"><span>${label}</span><strong>${value}</strong></div>`).join("");
}

function renderNav() {
  $("#nav").innerHTML = views.map(([id, icon, label]) => `<button data-view="${id}" class="${id === "resumen" ? "active" : ""}"><span class="icon">${icon}</span>${label}</button>`).join("");
  $$("#nav button").forEach((button) => button.addEventListener("click", () => openView(button.dataset.view)));
}

function openView(id) {
  $$(".view").forEach((view) => view.classList.toggle("active", view.id === id));
  $$("#nav button").forEach((button) => button.classList.toggle("active", button.dataset.view === id));
  $("#sidebar").classList.remove("open");
  $("#overlay").classList.remove("show");
  location.hash = id;
  updatePlanProgress();
}

function renderResumen() {
  const ranked = scoreParcels();
  const best = ranked[0].parcel;
  const qgisCount = reportCount();
  $("#resumen").innerHTML = `
    ${header("Control general", "Decidir parcela sin romper la viabilidad", "Panel estático con datos trazables de parcelas, costes, topografía preliminar, documentación pendiente y estrategia de vivienda.")}
    <div class="grid cols-4">
      ${stat("Parcela mejor posicionada", esc(best.name), `${pct(ranked[0].score)}`)}
      ${stat("Coste desfavorable", money.format(acquisitionCost(best)), `${money.format(perM2(best))}/m²`)}
      ${stat("Informes QGIS localizados", `${qgisCount}/${DATA.parcels.length}`, "MDT02 preliminar")}
      ${stat("Reserva intocable", money.format(DATA.project.reserveProtected), "fuera del cálculo")}
    </div>
    <div class="grid cols-2">
      <div class="card dark">
        <h3>Regla de decisión</h3>
        <p>${esc(DATA.project.decisionRule)}</p>
        <div class="row"><span>Estado</span><strong>${esc(DATA.project.state)}</strong></div>
        <div class="row"><span>Presupuesto vivienda</span><strong>${money.format(DATA.project.budgetLimit)}</strong></div>
      </div>
      <div class="card">
        <h3>Próximos pasos críticos</h3>
        <ul class="list">
          <li>Reducir a 2-3 finalistas con coste desfavorable y topografía real.</li>
          <li>Pedir nota simple, cargas, cuotas, valor de referencia y urbanismo por escrito.</li>
          <li>Visita técnica antes de señal o arras.</li>
          <li>No usar el fondo personal de 20.000 EUR como colchón del proyecto.</li>
        </ul>
      </div>
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
    <div class="sticky-head">
      ${header("Inventario", "Parcelas comparables", "Tabla filtrable con coste desfavorable, topografía QGIS, atributos de golf y estado documental.")}
      <div class="toolbar">
        <input id="parcelSearch" placeholder="Buscar parcela, vendedor, contacto o nota">
        <select id="parcelStatus"><option value="">Todos los estados</option>${[...new Set(DATA.parcels.map((p) => p.status))].map((s) => `<option>${esc(s)}</option>`).join("")}</select>
        <select id="parcelTopo"><option value="">Toda la topografía</option><option value="qgis">Con informe QGIS</option><option value="manual">Solo manual</option></select>
      </div>
    </div>
    <div class="table-wrap"><table class="data-table parcel-table"><colgroup><col><col><col><col><col><col><col><col></colgroup><thead><tr>
      <th>Parcela</th><th class="num">Precio</th><th class="num">Total desf.</th><th class="num">€/m²</th><th>Pendiente</th><th>Golf</th><th>Vendedor</th><th>Estado</th>
    </tr></thead><tbody id="parcelRows"></tbody></table></div>
  `;
  ["parcelSearch", "parcelStatus", "parcelTopo"].forEach((id) => $(`#${id}`).addEventListener("input", drawParcelRows));
  drawParcelRows();
}

function drawParcelRows() {
  const text = ($("#parcelSearch").value || "").toLowerCase();
  const status = $("#parcelStatus").value;
  const topo = $("#parcelTopo").value;
  const filtered = DATA.parcels.filter((p) => {
    const hay = [p.name, p.seller, p.contact, p.note].join(" ").toLowerCase();
    return (!text || hay.includes(text)) && (!status || p.status === status) && (!topo || (topo === "qgis" ? p.topography.hasReport : !p.topography.hasReport));
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
    <div class="sticky-head">
      ${header("Modelo multicriterio", "Ranking configurable", "Puntuación transparente y prudente. Sirve para criba, no para decidir una compra sin documentación técnica y jurídica.")}
      <div class="weight-grid">${Object.entries({ cost: "Coste", slope: "Pendiente", views: "Vistas", share: "Acción golf", direct: "Venta directa" }).map(([key, label]) => `
        <div class="weight"><label><span>${label}</span><strong id="w-${key}">${weights[key]}</strong></label><input type="range" min="0" max="60" value="${weights[key]}" data-weight="${key}"></div>
      `).join("")}</div>
    </div>
    <div class="table-wrap"><table class="data-table"><thead><tr><th>#</th><th>Parcela</th><th class="num">Puntos</th><th class="num">Coste</th><th class="num">Pendiente</th><th>Lectura</th></tr></thead><tbody id="rankingRows"></tbody></table></div>
    <p class="source">La pendiente usa métrica QGIS cuando existe. Si no existe, se usa una aproximación manual con menor confianza.</p>
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
    <div class="card"><h3>Comparativa de coste total</h3><div class="bars">${DATA.parcels.slice().sort((a,b)=>acquisitionCost(a)-acquisitionCost(b)).map((p) => `<div class="barline"><span>${esc(p.name)}</span><div class="bar"><i style="width:${Math.min(100, acquisitionCost(p) / 110000 * 100)}%"></i></div><strong>${money.format(acquisitionCost(p))}</strong></div>`).join("")}</div></div>
  `;
  $("#costParcelSelect").addEventListener("change", renderCostes);
}

function renderTopografia() {
  const withTopo = DATA.parcels.filter((p) => p.topography.hasReport).sort((a, b) => a.topography.slope - b.topography.slope);
  $("#topografia").innerHTML = `
    ${header("QGIS / MDT02", "Topografía real disponible", "Resumen de informes preliminares localizados. Las categorías se calculan desde pendiente, desnivel y cotas, no desde etiquetas manuales.")}
    <div class="notice notice-spaced">${esc(DATA.project.topographyDisclaimer)}</div>
    <div class="card topo-summary"><h3>Informes incorporados</h3><div class="metric">${withTopo.length}/${DATA.parcels.length}<small>PDF QGIS/MDT02 disponibles en esta versión</small></div></div>
    <div class="grid cols-3 topo-grid">
      ${withTopo.map((p) => stat(p.name, `${num.format(p.topography.slope)}%`, `${slopeClass(p.topography.slope)} · ${num.format(p.topography.relief)} m desnivel`)).join("")}
    </div>
    <div class="table-wrap"><table class="data-table"><thead><tr><th>Parcela</th><th class="num">Pendiente</th><th class="num">Desnivel</th><th class="num">Cotas</th><th class="num">RMSE</th><th>Informe</th></tr></thead><tbody>
      ${withTopo.map((p) => `<tr><td><strong>${esc(p.name)}</strong><br><span class="source">${esc(p.topography.reference)}</span></td><td class="num">${num.format(p.topography.slope)}%</td><td class="num">${num.format(p.topography.relief)} m</td><td class="num">${num.format(p.topography.zMin)}-${num.format(p.topography.zMax)} m</td><td class="num">${num.format(p.topography.rmse)} m</td><td>${pdfButton(p.topography.report, "PDF")}</td></tr>`).join("")}
    </tbody></table></div>
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
      <div class="section-heading">
        <div class="eyebrow">Catálogo y precios</div>
        <h3>Modelos con precio localizados</h3>
        <p>${priced.length} referencias con precio y ${noPrice} referencias pendientes de presupuesto. Los precios no son equivalentes entre empresas: cada una incluye y excluye capítulos distintos.</p>
      </div>
      <div class="table-wrap"><table class="data-table house-table"><thead><tr><th>Empresa / modelo</th><th class="num">Sup.</th><th class="num">Precio web</th><th>Incluye</th><th>Riesgo</th><th>Web</th></tr></thead><tbody>
        ${catalog.map((item) => `<tr><td><strong>${esc(item.provider)}</strong><br><span class="source">${esc(item.model)} · ${esc(item.fit)} · confianza ${esc(item.confidence)}</span></td><td class="num nowrap">${item.area ? `${num.format(item.area)} m²` : "—"}</td><td class="num nowrap">${esc(item.priceLabel)}</td><td>${esc(item.included)}</td><td>${esc(item.excluded)}</td><td>${pdfButton(item.url, "Web")}</td></tr>`).join("")}
      </tbody></table></div>
    </section>
  `;
}

function renderSimulador() {
  const catalog = houseCatalog();
  const priced = catalog.filter((item) => item.price != null);
  const defaultParcel = scoreParcels()[0]?.parcel || DATA.parcels[0];
  const selectedParcelId = $("#simParcelSelect")?.value || defaultParcel.id;
  const selectedHouseId = $("#simHouseSelect")?.value || (priced.find((item) => item.fit === "objetivo") || priced[0])?.id;
  const parcel = DATA.parcels.find((p) => p.id === selectedParcelId) || defaultParcel;
  const house = catalog.find((item) => item.id === selectedHouseId) || priced[0];
  const totals = simulationTotals(parcel, house);
  const overBudget = totals ? totals.total - DATA.house.simulatorAssumptions.budgetReference : 0;
  $("#simulador").innerHTML = `
    ${header("Escenarios", "Simulador parcela + vivienda", "Cruza una parcela con un modelo de vivienda prefabricada para estimar el coste completo antes de decidir. Es una criba económica, no un presupuesto cerrado.")}
    <div class="toolbar">
      <div class="selector-card"><label for="simParcelSelect">Parcela</label><select id="simParcelSelect">${DATA.parcels.map((p) => `<option value="${p.id}" ${p.id === parcel.id ? "selected" : ""}>${esc(p.name)} · ${money.format(acquisitionCost(p))}</option>`).join("")}</select></div>
      <div class="selector-card"><label for="simHouseSelect">Vivienda</label><select id="simHouseSelect">${catalog.map((item) => `<option value="${item.id}" ${item.id === house.id ? "selected" : ""} ${item.price == null ? "disabled" : ""}>${esc(item.provider)} · ${esc(item.model)} · ${esc(item.priceLabel)}</option>`).join("")}</select></div>
    </div>
    ${totals ? `
      <div class="grid cols-4">
        ${stat("Parcela lista", money.format(totals.parcelReady), parcel.name)}
        ${stat("Vivienda ajustada", money.format(totals.houseReady), house.vatIncluded === false ? "IVA 10% añadido" : "según precio web")}
        ${stat("Estimación completa", money.format(totals.total), overBudget > 0 ? `+${money.format(overBudget)} sobre ref.` : `${money.format(Math.abs(overBudget))} bajo ref.`)}
        ${stat("Referencia presupuesto", money.format(DATA.house.simulatorAssumptions.budgetReference), "vivienda")}
      </div>
      <div class="grid cols-2">
        <div class="card dark"><h3>Combinación activa</h3><div class="metric">${esc(parcel.name)}<small>${esc(house.provider)} · ${esc(house.model)} · ${num.format(house.area)} m²</small></div></div>
        <div class="card"><h3>Lectura</h3><p class="sub">${overBudget > 0 ? "Escenario tensionado: pide precio cerrado antes de avanzar y busca reducir alcance, parcela o capítulos exteriores." : "Escenario dentro de referencia preliminar, pendiente de presupuesto real, normativa y capítulos excluidos."}</p></div>
      </div>
      <div class="grid cols-2">
        <div class="card"><h3>Desglose estimado</h3>${rows([
          ["Parcela lista para proyecto", money.format(totals.parcelReady)],
          ["Vivienda / fabricación ajustada", money.format(totals.houseReady)],
          ["Licencia + ICIO aproximado", money.format(totals.permit)],
          ["Cimentación / obra civil", money.format(totals.civilWorks)],
          ["Acometidas y suministros", money.format(totals.utilityConnections)],
          ["Exteriores mínimos", money.format(totals.externalWorks)],
          ["Técnicos y estudios extra", money.format(totals.technicalExtras)],
          ["Contingencia 10%", money.format(totals.contingency)],
          ["Total orientativo", money.format(totals.total)]
        ])}</div>
        <div class="card"><h3>Incluido / pendiente</h3><p><strong>${esc(house.priceLabel)}</strong></p><p class="sub">${esc(house.included)}</p><p class="source">${esc(house.excluded)}</p><p>${pdfButton(house.url, "Abrir web")}</p></div>
      </div>
    ` : `<div class="notice">Esta vivienda no tiene precio publicado suficiente para simular. Pide presupuesto cerrado y vuelve a cargarlo como referencia.</div>`}
    <div class="notice">Regla prudente: el simulador suma colchones de licencia/ICIO, cimentación, acometidas, exteriores, técnicos y contingencia. No sustituye presupuesto de empresa, arquitecto, geotécnico ni urbanismo.</div>
  `;
  $("#simParcelSelect").addEventListener("change", renderSimulador);
  $("#simHouseSelect").addEventListener("change", renderSimulador);
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
    <div class="progress-sticky"><div class="card"><h3>Avance del timeline</h3><div class="bar"><i style="width:${progress}%"></i></div><p class="source">${pct(progress)} completado</p></div></div>
    <div class="timeline timeline-scroll">${DATA.plan.map((phase, index) => {
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
    }).join("")}</div>
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
  renderResumen();
  renderParcelas();
  renderFicha();
  renderComparativa();
  renderCostes();
  renderTopografia();
  renderVivienda();
  renderSimulador();
  renderDocumentacion();
  renderPlan();
  renderAyuda();
  renderAbout();
  updatePlanProgress();
  const hash = location.hash.replace("#", "");
  if (views.some(([id]) => id === hash)) openView(hash);
  $("#menuButton").addEventListener("click", () => {
    $("#sidebar").classList.add("open");
    $("#overlay").classList.add("show");
  });
  $("#overlay").addEventListener("click", () => {
    $("#sidebar").classList.remove("open");
    $("#overlay").classList.remove("show");
  });
  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    navigator.serviceWorker.register("service-worker.js").catch(() => {});
  }
}

init().catch((error) => {
  document.body.innerHTML = `<main class="content"><div class="notice">No se pudo cargar la aplicación: ${esc(error.message)}</div></main>`;
});
