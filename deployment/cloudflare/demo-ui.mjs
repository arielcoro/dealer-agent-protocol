// MCP Apps views for the Dealer Agent Protocol demo gateway.
//
// Each view is a self-contained HTML document served as an MCP resource with
// mimeType "text/html;profile=mcp-app". The host (Claude, ChatGPT, or any MCP
// Apps host) renders it in a sandboxed iframe and delivers the tool result over
// postMessage. The view never fetches anything: it only renders the structured
// content it is handed, so the restrictive default CSP is enough.

export const UI_BASE = "ui://dealer-agent-protocol";

export const UI_VIEWS = {
  vehicles: { name: "Vehicle search results", description: "Search results with source, authority, and freshness per vehicle." },
  vehicle: { name: "Vehicle detail", description: "One published vehicle with its provenance and availability evidence." },
  pricing: { name: "Pricing disclosure", description: "Advertised price, required charges, conditional offers, and government-charge status." },
  availability: { name: "Availability evidence", description: "Authority class, observation time, and validity window for one vehicle." },
  used: { name: "Used-vehicle evidence", description: "Mileage, dated inventory age, history reports, title, inspection, certification, and conflicts." },
  consent: { name: "Consent binding", description: "The exact disclosure a buyer must approve before any contact detail is shared." },
};

export function uiResourceUri(view) {
  return `${UI_BASE}/${view}.html`;
}

export function uiResources() {
  return Object.entries(UI_VIEWS).map(([view, meta]) => ({
    uri: uiResourceUri(view),
    name: meta.name,
    description: meta.description,
    mimeType: "text/html;profile=mcp-app",
    _meta: { ui: { prefersBorder: true } },
  }));
}

export function uiResourceView(uri) {
  const prefix = `${UI_BASE}/`;
  if (!uri.startsWith(prefix) || !uri.endsWith(".html")) return null;
  const view = uri.slice(prefix.length, -".html".length);
  return UI_VIEWS[view] ? view : null;
}

const STYLES = `
:root{--bg:#f6f3ec;--card:#fffdf7;--ink:#12231d;--muted:#5c675f;--line:#d9d3c4;--green:#163f32;--acid:#d9f36f;--orange:#f05a2b;--amber:#b8860b;--red:#b3261e}
@media (prefers-color-scheme:dark){:root{--bg:#101614;--card:#182019;--ink:#f1efe7;--muted:#a8b0aa;--line:#2b352f;--green:#9bd0b7;--acid:#c9e85a}}
:root[data-theme=dark]{--bg:#101614;--card:#182019;--ink:#f1efe7;--muted:#a8b0aa;--line:#2b352f;--green:#9bd0b7;--acid:#c9e85a}
*{box-sizing:border-box}body{margin:0;padding:12px;background:var(--bg);color:var(--ink);font:14px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif}
h1{margin:0 0 4px;font-size:16px;letter-spacing:-.01em}h2{margin:14px 0 6px;font-size:13px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted)}
.sub{color:var(--muted);font-size:12px;margin:0 0 10px}.grid{display:grid;gap:10px}
.card{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:12px}
.row{display:flex;justify-content:space-between;gap:12px;align-items:baseline}.row+.row{margin-top:4px}
.price{font-size:20px;font-weight:600}.mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px}
.badge{display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:600;letter-spacing:.02em;border:1px solid var(--line);background:transparent}
.b-ok{background:var(--acid);color:#12231d;border-color:transparent}.b-warn{background:#fff1c2;color:#5a4300;border-color:transparent}.b-bad{background:#ffd9d4;color:#6b1a12;border-color:transparent}.b-dim{color:var(--muted)}
table{width:100%;border-collapse:collapse;font-size:13px}td,th{padding:6px 4px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}th{color:var(--muted);font-weight:500;font-size:12px}td.num{text-align:right;white-space:nowrap}
.foot{margin-top:12px;color:var(--muted);font-size:11px}.foot b{color:var(--ink)}.empty{padding:18px;text-align:center;color:var(--muted)}
.disclosure{white-space:pre-wrap;background:var(--bg);border:1px dashed var(--line);border-radius:8px;padding:10px;font-size:13px}
.kv{display:grid;grid-template-columns:minmax(120px,38%) 1fr;gap:4px 12px;font-size:13px}.kv dt{color:var(--muted)}.kv dd{margin:0}
.conflict{border-left:3px solid var(--orange);padding-left:10px}
`;

const RUNTIME = `
(function(){
  var view=document.body.dataset.view;var reqId=0;var initialized=false;
  function post(msg){try{window.parent.postMessage(msg,"*")}catch(e){}}
  function notify(method,params){post({jsonrpc:"2.0",method:method,params:params||{}})}
  function request(method,params){reqId+=1;post({jsonrpc:"2.0",id:reqId,method:method,params:params||{}});return reqId}
  function sizeChanged(){notify("ui/notifications/size-changed",{height:document.documentElement.scrollHeight,width:document.documentElement.scrollWidth})}
  function applyTheme(ctx){if(ctx&&ctx.theme){document.documentElement.dataset.theme=ctx.theme}}
  var initId=request("ui/initialize",{appInfo:{name:"dealer-agent-protocol-demo",version:"0.1.0"},appCapabilities:{availableDisplayModes:["inline"]}});
  window.addEventListener("message",function(event){
    var m=event.data;if(!m||m.jsonrpc!=="2.0")return;
    if(m.id===initId&&m.result){initialized=true;applyTheme(m.result.hostContext||m.result);notify("ui/notifications/initialized",{});return}
    if(m.method==="ui/notifications/tool-result"){render((m.params&&m.params.structuredContent)||null);return}
    if(m.method==="ui/notifications/host-context-changed"){applyTheme(m.params);return}
  });
  // ChatGPT compatibility alias.
  function tryOpenAI(){if(window.openai&&window.openai.toolOutput){render(window.openai.toolOutput);return true}return false}
  window.addEventListener("openai:set_globals",function(){tryOpenAI()});
  if(!tryOpenAI()){setTimeout(tryOpenAI,250)}
  var el=function(tag,attrs,children){var n=document.createElement(tag);if(attrs)for(var k in attrs){if(k==="class")n.className=attrs[k];else if(k==="text")n.textContent=attrs[k];else n.setAttribute(k,attrs[k])}(children||[]).forEach(function(c){if(c==null)return;n.appendChild(typeof c==="string"?document.createTextNode(c):c)});return n};
  function money(m){if(!m||typeof m.amount_minor!=="number")return "—";var v=m.amount_minor/100;return v.toLocaleString("en-US",{style:"currency",currency:m.currency||"USD"})}
  function ago(ts){if(!ts)return "unknown time";var d=(Date.now()-Date.parse(ts))/1000;if(isNaN(d))return ts;if(d<0)return "in "+Math.round(-d/60)+" min";if(d<90)return Math.round(d)+" s ago";if(d<5400)return Math.round(d/60)+" min ago";if(d<172800)return Math.round(d/3600)+" h ago";return Math.round(d/86400)+" days ago"}
  function authorityBadge(status){var cls=status==="authoritative"?"b-ok":status==="asserted"||status==="derived"?"b-warn":"b-bad";return el("span",{class:"badge "+cls,text:(status||"unknown")})}
  function freshBadge(f){if(!f)return el("span",{class:"badge b-bad",text:"freshness unknown"});var cls=f.state==="current"?"b-ok":f.state==="stale"?"b-bad":"b-warn";return el("span",{class:"badge "+cls,text:f.state+" · observed "+ago(f.observed_at)})}
  function availBadge(a){if(!a)return el("span",{class:"badge b-bad",text:"availability unknown"});var cls=a.status==="available"&&a.authority_status==="authoritative"?"b-ok":a.status==="available"?"b-warn":"b-bad";var label=a.status+(a.authority_status?" ("+a.authority_status+")":"");return el("span",{class:"badge "+cls,text:label})}
  function foot(text){return el("p",{class:"foot"},[text])}
  function vehicleTitle(v){return [v.year,v.make,v.model,v.trim].filter(Boolean).join(" ")}
  function vehicleCard(v){
    var p=v.advertised_price||{};var inc=p.includes_required_dealer_charges===true?"includes required dealer charges":p.includes_required_dealer_charges===false?"excludes required dealer charges":"charge inclusion unknown";
    var used=v.used_vehicle&&v.used_vehicle.inventory_tenure;
    return el("div",{class:"card"},[
      el("div",{class:"row"},[el("div",{},[el("strong",{text:vehicleTitle(v)}),el("div",{class:"sub mono",text:(v.condition||"")+" · stock "+(v.stock_number||"—")+" · "+(v.vin||"")})]),el("div",{class:"price",text:money(p.amount)})]),
      el("div",{class:"sub",text:"Advertised price, "+inc+(p.valid_until?" · valid until "+new Date(p.valid_until).toLocaleString():"")}),
      el("div",{},[availBadge(v.availability)," ",freshBadge(v.freshness)," ",v.odometer?el("span",{class:"badge b-dim",text:v.odometer.value.toLocaleString()+" "+v.odometer.unit+(v.odometer.status?" ("+v.odometer.status+")":"")}):null]),
      used?el("div",{class:"sub",text:"In stock "+used.age_days+" days (basis: "+used.age_basis+", as of "+ago(used.age_as_of)+")"}):null,
      v.provenance&&v.provenance.sources&&v.provenance.sources[0]?el("div",{class:"sub mono",text:"source: "+v.provenance.sources[0].source_name+" · "+v.provenance.sources[0].authority}):null
    ]);
  }
  function renderVehicles(d){
    var list=d.vehicles||[];var root=el("div",{},[el("h1",{text:list.length+" vehicle"+(list.length===1?"":"s")+(d.page&&d.page.has_more?" (more available)":"")}),el("p",{class:"sub",text:"Search results are discovery snapshots. Verify availability before presenting a vehicle as available now."})]);
    if(!list.length)root.appendChild(el("div",{class:"card empty",text:"No published vehicles match."}));
    var grid=el("div",{class:"grid"});list.forEach(function(v){grid.appendChild(vehicleCard(v))});root.appendChild(grid);
    root.appendChild(foot("Result authority: "+(d.provenance&&d.provenance.authority_status||"unknown")+" · "+(d.freshness?d.freshness.state+", oldest observation "+ago(d.freshness.observed_at):"")+" · Synthetic demo data from Example Motors Group."));
    return root;
  }
  function renderVehicle(v){var root=el("div",{},[el("h1",{text:vehicleTitle(v)}),vehicleCard(v)]);
    if(v.features&&v.features.length)root.appendChild(el("div",{class:"sub",text:"Features: "+v.features.join(", ")}));
    root.appendChild(foot("Call the pricing disclosure for charges and offers, and verify availability before quoting. Synthetic demo data."));return root}
  function componentRows(items,kind){return (items||[]).map(function(c){
    var meta=[];if(kind==="charge"){meta.push(c.included_in_advertised_price?"included in advertised price":"added to advertised price");if(c.taxable_status)meta.push("tax: "+c.taxable_status)}
    if(kind==="adjust"){meta.push(c.direction==="discount"?"discount":"increase");if(c.criteria&&c.criteria.length)meta.push("requires: "+c.criteria.map(function(x){return x.description||x.criterion}).join("; "));if(c.stacking)meta.push("stacking: "+c.stacking.combinability+(c.stacking.group?" ("+c.stacking.group+")":""))}
    var amt=c.amount_status&&c.amount_status!=="known"?c.amount_status:money(c.amount);
    return el("tr",{},[el("td",{},[el("div",{text:c.name}),el("div",{class:"sub",text:meta.join(" · ")})]),el("td",{class:"num",text:(kind==="adjust"&&c.direction==="discount"&&c.amount?"−":"")+amt})])})}
  function renderPricing(d){
    var p=d.advertised_price||{};var gov=d.government_charges||{};var comp=d.disclosure_completeness||{};
    var root=el("div",{},[el("h1",{text:"Pricing disclosure"}),el("p",{class:"sub mono",text:(d.vehicle_id||"")+" · "+(d.rooftop_id||"")}),
      el("div",{class:"card"},[el("div",{class:"row"},[el("div",{},[el("strong",{text:"Advertised price"}),el("div",{class:"sub",text:(p.availability||"").replace(/_/g," ")+" · "+(p.includes_required_dealer_charges?"includes":"excludes")+" required dealer charges"})]),el("div",{class:"price",text:money(p.amount)})])]),
      el("h2",{text:"Required dealer charges"}),el("table",{},[el("tbody",{},componentRows(d.required_dealer_charges,"charge").length?componentRows(d.required_dealer_charges,"charge"):[el("tr",{},[el("td",{class:"sub",text:"None disclosed"})])])]),
      el("h2",{text:"Conditional adjustments"}),el("table",{},[el("tbody",{},componentRows(d.conditional_adjustments,"adjust").length?componentRows(d.conditional_adjustments,"adjust"):[el("tr",{},[el("td",{class:"sub",text:"None disclosed"})])])]),
      el("h2",{text:"Government charges"}),el("div",{class:"card"},[el("div",{},[el("span",{class:"badge "+(gov.status==="calculated"?"b-ok":gov.status==="unknown"?"b-warn":"b-dim"),text:gov.status||"unknown"})," ",gov.total?el("strong",{text:money(gov.total)}):el("span",{class:"sub",text:"No amount: unknown never means zero."})]),gov.assumptions&&gov.assumptions.length?el("div",{class:"sub",text:gov.assumptions.join(" ")}):null])
    ]);
    if(d.disclosure_text)root.appendChild(el("div",{class:"disclosure",text:d.disclosure_text}));
    root.appendChild(foot("Disclosure completeness "+(comp.score!=null?comp.score+"/100":"n/a")+" · availability band "+(comp.components&&comp.components.availability_band||"n/a")+" · "+(d.freshness?d.freshness.state+", observed "+ago(d.freshness.observed_at):"")+" · Synthetic demo data."));
    return root;
  }
  function renderAvailability(d){var a=d.availability||{};
    var root=el("div",{},[el("h1",{text:"Availability evidence"}),el("p",{class:"sub mono",text:(d.vehicle_id||"")+" · "+(d.rooftop_id||"")}),
      el("div",{class:"card"},[el("div",{},[availBadge(a)," ",a.human_verification_required?el("span",{class:"badge b-warn",text:"human verification required"}):el("span",{class:"badge b-ok",text:"no human verification required"})]),
        el("dl",{class:"kv"},[el("dt",{text:"Authority"}),el("dd",{},[authorityBadge(a.authority_status)]),el("dt",{text:"Observed"}),el("dd",{text:(a.observed_at||"—")+" ("+ago(a.observed_at)+")"}),el("dt",{text:"Valid until"}),el("dd",{text:a.valid_until||"—"}),el("dt",{text:"Source"}),el("dd",{class:"mono",text:d.provenance&&d.provenance.sources&&d.provenance.sources[0]?d.provenance.sources[0].source_name+" · record "+(d.provenance.sources[0].source_record_id||"—"):"—"}),a.reason?el("dt",{text:"Reason"}):null,a.reason?el("dd",{text:a.reason}):null])]),
      foot("An agent may say \\"available now\\" only when the authority is authoritative and the validity window has not passed. Synthetic demo data.")]);return root}
  function renderUsed(d){var o=d.odometer||{};var t=d.inventory_tenure||{};var ti=d.title||{};var cert=d.certification||{};var cr=d.condition_report||{};
    var root=el("div",{},[el("h1",{text:"Used-vehicle evidence"}),el("p",{class:"sub mono",text:(d.vehicle_id||"")+" · "+(d.vin||"")}),
      el("div",{class:"grid"},[
        el("div",{class:"card"},[el("strong",{text:"Odometer"}),el("div",{class:"price",text:o.reading?o.reading.value.toLocaleString()+" "+o.reading.unit:"—"}),el("div",{class:"sub",text:"status: "+(o.status||"unknown")+" · observed "+ago(o.observed_at)})]),
        el("div",{class:"card"},[el("strong",{text:"Inventory age"}),el("div",{class:"price",text:(t.age_days!=null?t.age_days+" days":"—")}),el("div",{class:"sub",text:"clock: "+(t.age_basis||"—")+" · stocked "+(t.stocked_at||"—")+" · as of "+ago(t.age_as_of)})]),
        el("div",{class:"card"},[el("strong",{text:"Title"}),el("div",{},[el("span",{class:"badge "+(ti.status==="clear"?"b-ok":"b-warn"),text:ti.status||"unknown"})," ",el("span",{class:"sub",text:(ti.brands&&ti.brands.length?ti.brands.join(", "):"no brands")+(ti.jurisdiction?" · "+ti.jurisdiction:"")})])]),
        el("div",{class:"card"},[el("strong",{text:"Certification"}),el("div",{},[el("span",{class:"badge "+(cert.type==="manufacturer_cpo"?"b-ok":"b-dim"),text:(cert.type||"unknown").replace(/_/g," ")}),cert.program_name?el("span",{class:"sub",text:" "+cert.program_name}):null])])
      ]),
      el("h2",{text:"History reports"}),el("table",{},[el("thead",{},[el("tr",{},[el("th",{text:"Provider"}),el("th",{text:"Accidents"}),el("th",{text:"Damage"}),el("th",{text:"Owners"}),el("th",{text:"Access"})])]),el("tbody",{},(d.history_reports||[]).map(function(r){var s=r.summary||{};return el("tr",{},[el("td",{},[el("div",{text:r.provider_name||r.provider_id}),el("div",{class:"sub",text:"generated "+(r.report_generated_at?ago(r.report_generated_at):"—")})]),el("td",{text:(s.accident_status||"—").replace(/_/g," ")+(s.accident_event_count!=null?" ("+s.accident_event_count+")":"")}),el("td",{text:(s.damage_status||"—").replace(/_/g," ")}),el("td",{text:s.owner_count!=null?String(s.owner_count):(s.owner_count_status||"—")}),el("td",{text:(r.access||"—").replace(/_/g," ")+(r.summary_sharing_authorized===false?" · summary not licensed":"")})])}))])
    ]);
    if(d.discrepancies&&d.discrepancies.length){root.appendChild(el("h2",{text:"Unresolved conflicts"}));d.discrepancies.forEach(function(x){root.appendChild(el("div",{class:"card conflict"},[el("strong",{class:"mono",text:x.field}),el("div",{text:x.description}),el("div",{class:"sub",text:"sources: "+(x.source_names||[]).join(", ")+" · "+x.status})]))})}
    if(cr.status){root.appendChild(el("h2",{text:"Inspection"}));root.appendChild(el("div",{class:"card"},[el("div",{text:(cr.inspection_authority||"")+" inspection · "+(cr.inspection_point_count||"—")+" points · "+(cr.grade?cr.grade.value:"")}),cr.disclosed_damage&&cr.disclosed_damage.length?el("div",{class:"sub",text:"Disclosed: "+cr.disclosed_damage.join(" ")}):null]))}
    root.appendChild(foot("\\"No events reported\\" is never upgraded to \\"accident-free\\". Conflicting reports stay visible. Synthetic demo data."));return root}
  function renderConsent(d){var g=d.grant||{};
    var root=el("div",{},[el("h1",{text:"Consent binding"}),el("p",{class:"sub",text:"The buyer must approve this exact text before any name, email, or phone number is sent to the dealer."}),
      el("div",{class:"disclosure",text:d.disclosure_text||""}),
      el("dl",{class:"kv"},[el("dt",{text:"Purpose"}),el("dd",{text:(g.purpose||"—").replace(/_/g," ")}),el("dt",{text:"Channels"}),el("dd",{text:(g.channels||[]).join(", ")}),el("dt",{text:"Data shared"}),el("dd",{text:(g.data_categories||[]).join(", ").replace(/_/g," ")}),el("dt",{text:"Expires"}),el("dd",{text:(d.expires_at||"—")+" · single use: "+(d.single_use?"yes":"no")}),el("dt",{text:"Signature"}),el("dd",{text:(d.signature_algorithm||"")+" · issuer "+(d.issuer||"")}),el("dt",{text:"Disclosure digest"}),el("dd",{class:"mono",text:g.disclosure_digest||"—"})]),
      foot("Status: "+(d.status||"")+". Sandbox: a submitted handoff is recorded as ADF and returned to the agent, never forwarded to a dealership.")]);return root}
  function render(data){
    var root=document.getElementById("root");root.textContent="";
    if(!data){root.appendChild(el("div",{class:"card empty",text:"Waiting for the tool result…"}));sizeChanged();return}
    if(data.error_id&&data.code){root.appendChild(el("div",{class:"card"},[el("strong",{text:data.code}),el("div",{text:data.message||""}),data.details&&data.details.current_freshness?el("div",{class:"sub",text:"current freshness: "+data.details.current_freshness.state+", observed "+ago(data.details.current_freshness.observed_at)}):null]));sizeChanged();return}
    try{
      var r={vehicles:renderVehicles,vehicle:renderVehicle,pricing:renderPricing,availability:renderAvailability,used:renderUsed,consent:renderConsent}[view];
      root.appendChild(r?r(data):el("pre",{class:"mono",text:JSON.stringify(data,null,2)}));
    }catch(e){root.appendChild(el("pre",{class:"mono",text:JSON.stringify(data,null,2)}))}
    sizeChanged();
  }
  render(null);
})();
`;

export function uiHtml(view) {
  const meta = UI_VIEWS[view];
  if (!meta) return null;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${meta.name} · Dealer Agent Protocol demo</title>
<style>${STYLES}</style>
</head>
<body data-view="${view}">
<div id="root"></div>
<script>${RUNTIME}</script>
</body>
</html>`;
}
