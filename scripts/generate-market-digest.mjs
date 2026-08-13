import fs from "node:fs/promises";

const api = "https://public-api.prozorro.gov.ua/api/2.5";
const site = "https://vovasik07.github.io";
const bot = "ProzzoroUkraineBot";
const feed = await getJson(`${api}/tenders?descending=1&limit=40`);
const tenders = [];

for (const item of feed.data || []) {
  try {
    const tender = (await getJson(`${api}/tenders/${encodeURIComponent(item.id)}`)).data;
    if (!String(tender.status || "").startsWith("active")) continue;
    tenders.push(tender);
    if (tenders.length >= 12) break;
  } catch (error) {
    console.error(`Skipped ${item.id}: ${error.message}`);
  }
}

const total = tenders.reduce((sum, tender) => sum + (tender.value?.currency === "UAH" ? Number(tender.value.amount || 0) : 0), 0);
const now = new Date();
const rows = tenders.map((tender) => `<article><h2>${escapeHtml(tender.title || tender.tenderID || "Закупівля без назви")}</h2><p><b>Замовник:</b> ${escapeHtml(tender.procuringEntity?.name || "не вказаний")}<br><b>Бюджет:</b> ${tender.value?.currency === "UAH" ? money(tender.value.amount) : "не вказаний у UAH"}<br><b>Дедлайн:</b> ${tender.tenderPeriod?.endDate ? date(new Date(tender.tenderPeriod.endDate)) : "не вказаний"}<br><b>Статус:</b> ${escapeHtml(tender.status)}</p><a href="https://prozorro.gov.ua/tender/${encodeURIComponent(tender.tenderID || tender.id)}" rel="nofollow">Відкрити першоджерело →</a></article>`).join("");
const canonical = `${site}/ohliad-zakupivel/`;
const schema = { "@context": "https://schema.org", "@type": "Dataset", name: `Огляд активних закупівель Prozorro за ${date(now)}`, dateModified: now.toISOString(), creator: { "@type": "Organization", name: "ЗакупВарта" }, isBasedOn: "https://public-api.prozorro.gov.ua/", url: canonical };
const html = `<!doctype html><html lang="uk"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Огляд активних закупівель Prozorro за ${date(now)} | ЗакупВарта</title><meta name="description" content="Автоматичний огляд активних закупівель Prozorro: бюджети, дедлайни, замовники та прямі посилання."><link rel="canonical" href="${canonical}"><script type="application/ld+json">${JSON.stringify(schema)}</script><style>${styles()}</style></head><body><main><nav><a href="/">ЗакупВарта</a><span>Автоматичний огляд відкритих даних</span></nav><header><p class="eyebrow">Оновлено ${dateTime(now)}</p><h1>Щоденна варта активних закупівель</h1><p class="lead">У зрізі ${tenders.length} активних процедур із сумарно вказаним бюджетом ${money(total)}. Це інформаційний огляд, а не рекомендація чи повний перелік.</p><a class="cta" href="https://t.me/${bot}?start=campaign_daily_digest">Налаштувати персональний моніторинг</a></header><section class="grid">${rows || "<p>Активних процедур у поточному зрізі не знайдено.</p>"}</section><aside><h2>Навіщо персональний фільтр?</h2><p>ЗакупВарта відбирає процедури та зміни за товарами, CPV, ЄДРПОУ, регіоном і бюджетом.</p><a href="https://t.me/${bot}?start=campaign_daily_digest">Один напрям безкоштовно →</a></aside><footer>Джерело: публічний API Prozorro. Незалежний сервіс. <a href="/terms/">Умови</a> · <a href="/privacy/">Приватність</a></footer></main></body></html>`;

await fs.mkdir("ohliad-zakupivel", { recursive: true });
await fs.writeFile("ohliad-zakupivel/index.html", html, "utf8");
const rssItems = tenders.map((tender) => { const source = `https://prozorro.gov.ua/tender/${encodeURIComponent(tender.tenderID || tender.id)}`; return `<item><title>${escapeXml(tender.title || tender.tenderID)}</title><link>${escapeXml(source)}</link><guid isPermaLink="false">${escapeXml(`${tender.id}:${tender.dateModified || ""}`)}</guid><pubDate>${new Date(tender.dateModified || Date.now()).toUTCString()}</pubDate><description>${escapeXml(`${tender.procuringEntity?.name || "Замовник не вказаний"}; ${tender.value?.amount || 0} ${tender.value?.currency || "UAH"}`)}</description></item>`; }).join("");
await fs.writeFile("rss.xml", `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>ЗакупВарта — активні закупівлі Prozorro</title><link>${site}</link><description>Автоматичний частковий огляд відкритих даних Prozorro</description><language>uk-UA</language><lastBuildDate>${now.toUTCString()}</lastBuildDate>${rssItems}</channel></rss>`, "utf8");
console.log(`Generated ${tenders.length} tenders.`);

async function getJson(url) {
  const response = await fetch(url, { headers: { "User-Agent": "ZakupVarta-Pages/1.0" }, signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}
function money(value) { return new Intl.NumberFormat("uk-UA", { style: "currency", currency: "UAH", maximumFractionDigits: 0 }).format(Number(value || 0)); }
function date(value) { return new Intl.DateTimeFormat("uk-UA", { dateStyle: "long", timeZone: "Europe/Kyiv" }).format(value); }
function dateTime(value) { return new Intl.DateTimeFormat("uk-UA", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/Kyiv" }).format(value); }
function escapeHtml(value) { return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;"); }
function escapeXml(value) { return escapeHtml(value).replaceAll("'", "&apos;"); }
function styles() { return `:root{color-scheme:dark;--ink:#f4f0e6;--muted:#aaa69c;--lime:#c8ff45;--line:#34362f;--bg:#10120f;--card:#181b16}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font-family:Georgia,serif}main{max-width:1120px;margin:auto;padding:24px}nav{display:flex;justify-content:space-between;border-bottom:1px solid var(--line);padding:14px 0;font:15px Arial,sans-serif}nav a{font-size:22px;color:var(--ink);font-weight:800;text-decoration:none}nav span,footer{color:var(--muted)}header{padding:75px 0}.eyebrow{font:700 13px Arial,sans-serif;color:var(--lime);text-transform:uppercase;letter-spacing:.16em}h1{font-size:clamp(48px,8vw,88px);line-height:.95;letter-spacing:-.05em;margin:20px 0}.lead{max-width:800px;font:22px/1.5 Arial,sans-serif;color:#d2cfc6}.cta{display:inline-block;background:var(--lime);color:#111;padding:17px 24px;text-decoration:none;font:700 15px Arial,sans-serif}.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:1px;background:var(--line);border:1px solid var(--line)}article{background:var(--card);padding:28px}article h2{font-size:24px;line-height:1.2}article p,aside p{font:16px/1.6 Arial,sans-serif;color:#cbc8bf}a{color:var(--lime)}aside{margin:70px 0;padding:35px;border-left:4px solid var(--lime);background:var(--card)}footer{border-top:1px solid var(--line);padding:30px 0;font:14px Arial,sans-serif}@media(max-width:720px){.grid{grid-template-columns:1fr}nav span{display:none}}`; }
