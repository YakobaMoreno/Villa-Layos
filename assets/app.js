const views = [
  ["resumen", "⌂", "Resumen"],
  ["parcelas", "▤", "Parcelas"],
  ["ficha", "◫", "Ficha de parcela"],
  ["comparativa", "◎", "Comparativa"],
  ["costes", "€", "Costes"],
  ["topografia", "▱", "Topografía"],
  ["vivienda", "⌁", "Vivienda"],
  ["documentacion", "✓", "Documentación"],
  ["plan", "↗", "Plan del proyecto"]
];

const money = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const num = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1 });
let DATA;
let weights = { cost: 35, slope: 35, views: 15, share: 10, direct: 5 };

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[ch]));
const pct = (value) => `${Math.round(value)}%`;
const slopeClass = (slope) => slope == null ? "Pendiente sin informe" : slope < 6 ? "Suave" : slope < 10 ? "Moderada" : "Alta";
const slopeBadge = (parcel) => {
  if (!parcel.topography?.hasReport) return `<span class="badge warn">Manual</span>`;
  const cls = parcel.topography.slope < 6 ? "ok" : parcel.topography.slope < 10 ? "warn" : "bad";
  return `<span class="badge ${cls}">QGIS ${num.format(parcel.topography.slope)}%</span>`;
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
}

function renderResumen() {
  const ranked = scoreParcels();
  const best = ranked[0].parcel;
  const qgisCount = DATA.parcels.filter((p) => p.topography?.hasReport).length;
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
    <div class="notice">${esc(DATA.project.topographyDisclaimer)}</div>
  `;
}

function renderParcelas() {
  $("#parcelas").innerHTML = `
    ${header("Inventario", "Parcelas comparables", "Tabla filtrable con coste desfavorable, topografía QGIS, atributos de golf y estado documental.")}
    <div class="toolbar">
      <input id="parcelSearch" placeholder="Buscar parcela, vendedor, contacto o nota">
      <select id="parcelStatus"><option value="">Todos los estados</option>${[...new Set(DATA.parcels.map((p) => p.status))].map((s) => `<option>${esc(s)}</option>`).join("")}</select>
      <select id="parcelTopo"><option value="">Toda la topografía</option><option value="qgis">Con informe QGIS</option><option value="manual">Solo manual</option></select>
    </div>
    <div class="table-wrap"><table><thead><tr>
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
      <td><strong>${esc(p.name)}</strong><br><span class="source">${esc(p.note)}</span></td>
      <td class="num">${money.format(p.price)}</td>
      <td class="num">${money.format(acquisitionCost(p))}</td>
      <td class="num">${money.format(perM2(p))}</td>
      <td>${slopeBadge(p)}<br><span class="source">${p.topography.hasReport ? `${esc(slopeClass(p.topography.slope))}, desnivel ${num.format(p.topography.relief)} m` : esc(p.manualSlope)}</span></td>
      <td>Vistas: ${esc(p.golfViews)}<br><span class="source">Acción: ${esc(p.golfShare || "No")}</span></td>
      <td>${esc(p.seller)}<br><span class="source">${esc(p.contact || "Sin contacto")}</span></td>
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
    <div class="toolbar"><select id="parcelSelect">${DATA.parcels.map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join("")}</select></div>
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
        ["Enlace", p.link ? `<a href="${esc(p.link)}" target="_blank" rel="noreferrer">idealista</a>` : "Sin enlace en calculadora"]
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
          ["Informe", `<a href="${encodeURI(t.report)}" target="_blank">PDF preliminar</a>`]
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
    ${header("Modelo multicriterio", "Ranking configurable", "Puntuación transparente y prudente. Sirve para criba, no para decidir una compra sin documentación técnica y jurídica.")}
    <div class="weight-grid">${Object.entries({ cost: "Coste", slope: "Pendiente", views: "Vistas", share: "Acción golf", direct: "Venta directa" }).map(([key, label]) => `
      <div class="weight"><label><span>${label}</span><strong id="w-${key}">${weights[key]}</strong></label><input type="range" min="0" max="60" value="${weights[key]}" data-weight="${key}"></div>
    `).join("")}</div>
    <div class="table-wrap"><table><thead><tr><th>#</th><th>Parcela</th><th class="num">Puntos</th><th class="num">Coste</th><th class="num">Pendiente</th><th>Lectura</th></tr></thead><tbody id="rankingRows"></tbody></table></div>
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
  const selected = scoreParcels()[0].parcel;
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
}

function renderTopografia() {
  const withTopo = DATA.parcels.filter((p) => p.topography.hasReport).sort((a, b) => a.topography.slope - b.topography.slope);
  $("#topografia").innerHTML = `
    ${header("QGIS / MDT02", "Topografía real disponible", "Resumen de informes preliminares localizados. Las categorías se calculan desde pendiente, desnivel y cotas, no desde etiquetas manuales.")}
    <div class="notice">${esc(DATA.project.topographyDisclaimer)}</div>
    <div class="grid cols-3">
      ${withTopo.map((p) => stat(p.name, `${num.format(p.topography.slope)}%`, `${slopeClass(p.topography.slope)} · ${num.format(p.topography.relief)} m desnivel`)).join("")}
    </div>
    <div class="table-wrap"><table><thead><tr><th>Parcela</th><th class="num">Pendiente</th><th class="num">Desnivel</th><th class="num">Cotas</th><th class="num">RMSE</th><th>Informe</th></tr></thead><tbody>
      ${withTopo.map((p) => `<tr><td><strong>${esc(p.name)}</strong><br><span class="source">${esc(p.topography.reference)}</span></td><td class="num">${num.format(p.topography.slope)}%</td><td class="num">${num.format(p.topography.relief)} m</td><td class="num">${num.format(p.topography.zMin)}-${num.format(p.topography.zMax)} m</td><td class="num">${num.format(p.topography.rmse)} m</td><td><a href="${encodeURI(p.topography.report)}" target="_blank">PDF</a></td></tr>`).join("")}
    </tbody></table></div>
  `;
}

function renderVivienda() {
  $("#vivienda").innerHTML = `
    ${header("Programa", "Vivienda industrializada de bajo mantenimiento", "Concepto actual: vivienda de una planta, 100-120 m2, bloque técnico alto y plataforma residencial inferior cuando la parcela lo pida.")}
    <div class="grid cols-2">
      <div class="card dark"><h3>Concepto activo</h3><p>${esc(DATA.house.concept)}</p></div>
      <div class="card"><h3>Programa funcional</h3><ul class="list">${DATA.house.program.map((item) => `<li>${esc(item)}</li>`).join("")}</ul></div>
    </div>
    <div class="card"><h3>Sistemas constructivos</h3><div class="table-wrap"><table><thead><tr><th>Sistema</th><th>Encaje</th><th>Coste</th><th>Huella</th><th>Lectura</th></tr></thead><tbody>${DATA.house.systems.map((s) => `<tr><td><strong>${esc(s.name)}</strong></td><td>${esc(s.fit)}</td><td>${esc(s.cost)}</td><td>${esc(s.carbon)}</td><td>${esc(s.note)}</td></tr>`).join("")}</tbody></table></div></div>
    <div class="grid cols-2">${DATA.house.providers.map((p) => `<div class="card"><h3>${esc(p.name)}</h3><p><strong>${esc(p.reference)}</strong></p><p class="sub">${esc(p.risk)}</p></div>`).join("")}</div>
  `;
}

function renderDocumentacion() {
  const done = DATA.documents.filter((d) => d.status === "verificado").length;
  const progress = DATA.documents.length ? done / DATA.documents.length * 100 : 0;
  $("#docProgress").textContent = pct(progress);
  $("#docProgressBar").style.width = pct(progress);
  $("#documentacion").innerHTML = `
    ${header("Checklist", "Documentación antes de comprometer dinero", "Estado de comprobaciones mínimas antes de señal, arras, compra o anteproyecto de pago.")}
    <div class="table-wrap"><table><thead><tr><th>Documento</th><th>Estado</th><th>Acción</th></tr></thead><tbody>${DATA.documents.map((d) => `<tr><td><strong>${esc(d.name)}</strong></td><td><span class="badge warn">${esc(d.status)}</span></td><td>${esc(d.action)}</td></tr>`).join("")}</tbody></table></div>
  `;
}

function renderPlan() {
  $("#plan").innerHTML = `
    ${header("Fases", "De criba a entrega de llaves", "Plan operativo con dependencias explícitas para no adelantar pagos sin evidencia suficiente.")}
    <div class="grid cols-2">${DATA.plan.map((phase) => `
      <div class="card"><h3>${esc(phase.phase)}</h3><span class="badge ${phase.state === "en curso" ? "info" : "warn"}">${esc(phase.state)}</span><ul class="list">${phase.items.map((item) => `<li>${esc(item)}</li>`).join("")}</ul></div>
    `).join("")}</div>
  `;
}

async function init() {
  const response = await fetch("data/project-data.json");
  DATA = await response.json();
  renderNav();
  renderResumen();
  renderParcelas();
  renderFicha();
  renderComparativa();
  renderCostes();
  renderTopografia();
  renderVivienda();
  renderDocumentacion();
  renderPlan();
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
