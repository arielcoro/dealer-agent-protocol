(() => {
  const reportId = location.pathname.split("/").filter(Boolean).pop();
  const loading = document.querySelector("#report-loading");
  const errorBox = document.querySelector("#report-error");
  const content = document.querySelector("#report-content");
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>'"]/g, (char) => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char]));
  const titleCase = (value) => String(value || "").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/\b\w/g, (char) => char.toUpperCase());
  const scoreBand = (score) => score >= 80 ? ["STRONG VISIBILITY", "Your dealership is legible to AI. The opportunity is to widen the lead and connect inventory facts directly.", "You are visible. Now make the answer unmistakable."] : score >= 60 ? ["PARTIALLY VISIBLE", "AI can find the dealership, but missing evidence may keep it from being cited or recommended consistently.", "You are in the conversation—not yet in control of it."] : score >= 40 ? ["WEAK VISIBILITY", "Important signals are incomplete or difficult for AI systems to interpret with confidence.", "Competitors may be winning the answer by default."] : ["LOW VISIBILITY", "AI systems have too little reliable public evidence to understand and recommend this dealership.", "Your dealership is present on the web but absent from the answer."];

  function scoreCards(scores, labels) {
    return Object.entries(labels).map(([key, label]) => {
      const value = Math.max(0, Math.min(100, Number(scores?.[key] ?? 0)));
      return `<article class="score-card" style="--score:${value}%"><div class="score-row"><h3>${escapeHtml(label)}</h3><strong>${value}</strong></div><div class="meter"><i></i></div><small>${value >= 80 ? "strong signal" : value >= 60 ? "visible gap" : value >= 40 ? "needs attention" : "priority weakness"}</small></article>`;
    }).join("");
  }

  function findingCard(finding, index) {
    const severity = String(finding.severity || finding.impact || "medium").toLowerCase();
    const platforms = Array.isArray(finding.platforms) ? finding.platforms.map(titleCase).join(", ") : "Multiple AI systems";
    return `<article class="finding${index === 0 ? " open" : ""}"><div class="finding-head"><span class="severity ${escapeHtml(severity)}">${escapeHtml(severity)}</span><h3>${escapeHtml(finding.title || "Visibility finding")}</h3><button class="finding-toggle" type="button" aria-expanded="${index === 0}">${index === 0 ? "CLOSE −" : "OPEN +"}</button></div><div class="finding-body"><div><b>WHAT WE FOUND</b><p>${escapeHtml(finding.foundSnippet || "The scan found an incomplete public signal.")}</p></div><div><b>WHY IT MATTERS</b><p>${escapeHtml(finding.whyItMatters || `This can affect visibility across ${platforms}.`)}</p></div><div><b>WHAT TO DO</b><p>${escapeHtml(finding.howToFix || "Review and strengthen this signal on the dealership website.")}</p></div></div></article>`;
  }

  async function loadReport() {
    try {
      const response = await fetch(`/api/report/${encodeURIComponent(reportId)}`, { headers: { accept: "application/json" } });
      const payload = await response.json().catch(() => ({}));
      const report = Array.isArray(payload) ? payload[0] : payload;
      if (!response.ok || !report?.short_id) throw new Error(payload.message || "The report link is invalid or expired.");

      const score = Math.max(0, Math.min(100, Number(report.overall_score || 0)));
      const [grade, summary, headline] = scoreBand(score);
      document.querySelector("#dealer-name").textContent = report.dealership_name || report.domain;
      document.querySelector("#dealer-domain").textContent = report.domain || "";
      document.querySelector("#dealer-city").textContent = report.city || "Market not supplied";
      document.querySelector("#scan-date").textContent = `Scanned ${new Date(report.created_at).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}`;
      document.querySelector("#overall-score").textContent = score;
      document.querySelector("#score-dial").style.setProperty("--score", score);
      document.querySelector("#score-grade").textContent = grade;
      document.querySelector("#score-headline").textContent = headline;
      document.querySelector("#score-summary").textContent = summary;
      document.querySelector("#platform-scores").innerHTML = scoreCards(report.platform_scores, { chatgpt: "ChatGPT", aiOverviews: "Google AI Overviews", perplexity: "Perplexity", gemini: "Gemini", claude: "Claude", bingCopilot: "Bing Copilot" });
      document.querySelector("#category-scores").innerHTML = scoreCards(report.category_scores, { crawlerAccess: "Crawler access", structuredData: "Structured meaning", citability: "Citability", technical: "Technical health", authority: "Authority", brandMentions: "Brand connection" });
      const findings = Array.isArray(report.findings) ? report.findings : [];
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      findings.sort((a,b) => (severityOrder[a.severity] ?? 4) - (severityOrder[b.severity] ?? 4));
      document.querySelector("#findings").innerHTML = findings.length ? findings.map(findingCard).join("") : `<article class="finding open"><div class="finding-head"><span class="severity low">clear</span><h3>No priority findings returned</h3></div></article>`;
      document.querySelector("#lead-form").elements.dealership.value = report.dealership_name || "";

      document.querySelectorAll(".finding-toggle").forEach((button) => button.addEventListener("click", () => {
        const card = button.closest(".finding");
        const open = card.classList.toggle("open");
        button.textContent = open ? "CLOSE −" : "OPEN +";
        button.setAttribute("aria-expanded", String(open));
      }));

      document.querySelector("#lead-form").addEventListener("submit", (event) => submitLead(event, report));
      loading.hidden = true;
      content.hidden = false;
    } catch (error) {
      console.error("Report render failed", error);
      loading.hidden = true;
      errorBox.hidden = false;
      document.querySelector("#report-error-message").textContent = String(error?.message || error || "This report could not be loaded.");
    }
  }

  async function submitLead(event, report) {
    event.preventDefault();
    const form = event.currentTarget;
    const status = document.querySelector("#lead-status");
    const button = form.querySelector("button");
    status.textContent = "Sending…";
    button.disabled = true;
    try {
      const response = await fetch("/api/premium", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: form.elements.email.value, dealershipName: form.elements.dealership.value, phone: form.elements.phone.value || null, reportId: report.id, reportShortId: report.short_id, domain: report.domain, city: report.city, overallScore: report.overall_score }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || "Could not send the request.");
      status.textContent = "Received. We’ll review the report and contact you.";
      form.reset();
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : "Could not send the request.";
      button.disabled = false;
    }
  }

  document.querySelector("#share-report").addEventListener("click", async () => {
    const data = { title: document.title, text: "See this dealership’s AI visibility report.", url: location.href };
    try { if (navigator.share) await navigator.share(data); else { await navigator.clipboard.writeText(location.href); document.querySelector("#share-report").textContent = "LINK COPIED ✓"; } } catch { /* user cancelled */ }
  });

  loadReport();
})();
