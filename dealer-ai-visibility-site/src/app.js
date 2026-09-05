(() => {
  const form = document.querySelector("#scan-form");
  if (!form) return;

  const status = document.querySelector("#form-status");
  const overlay = document.querySelector("#scan-overlay");
  const target = document.querySelector("#scan-target");
  const steps = [...document.querySelectorAll(".scan-steps li")];
  const submit = form.querySelector("button[type=submit]");
  let timers = [];

  const normalizeUrl = (value) => {
    const raw = value.trim();
    if (!raw) return "";
    return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  };

  const validUrl = (value) => {
    try {
      const parsed = new URL(value);
      return ["http:", "https:"].includes(parsed.protocol) && parsed.hostname.includes(".");
    } catch {
      return false;
    }
  };

  const params = new URLSearchParams(location.search);
  if (params.get("name")) form.elements.dealership_name.value = params.get("name");
  if (params.get("website")) form.elements.website_url.value = params.get("website");
  if (params.get("city")) form.elements.city.value = params.get("city");

  function setProgress(index) {
    steps.forEach((step, stepIndex) => {
      step.classList.toggle("active", stepIndex === index);
      step.classList.toggle("done", stepIndex < index);
      step.querySelector("b").textContent = stepIndex < index ? "DONE" : stepIndex === index ? "RUNNING" : "QUEUED";
    });
  }

  function startProgress(domain) {
    target.textContent = domain;
    overlay.hidden = false;
    document.body.style.overflow = "hidden";
    setProgress(0);
    timers = [
      setTimeout(() => setProgress(1), 4800),
      setTimeout(() => setProgress(2), 10300),
      setTimeout(() => setProgress(3), 17200),
    ];
  }

  function stopProgress() {
    timers.forEach(clearTimeout);
    timers = [];
    overlay.hidden = true;
    document.body.style.overflow = "";
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    status.textContent = "";

    const dealershipName = form.elements.dealership_name.value.trim();
    const homepageUrl = normalizeUrl(form.elements.website_url.value);
    const city = form.elements.city.value.trim();
    const competitorRaw = form.elements.competitor_url.value.trim();
    const competitorUrl = competitorRaw ? normalizeUrl(competitorRaw) : null;
    const honeypot = form.elements.website_company.value.trim();

    if (!dealershipName) {
      status.textContent = "Enter the dealership name.";
      form.elements.dealership_name.focus();
      return;
    }
    if (!validUrl(homepageUrl)) {
      status.textContent = "Enter a valid dealership website.";
      form.elements.website_url.focus();
      return;
    }
    if (!city) {
      status.textContent = "Enter the dealership city and state.";
      form.elements.city.focus();
      return;
    }
    if (competitorUrl && !validUrl(competitorUrl)) {
      status.textContent = "Enter a valid competitor website or leave it blank.";
      form.elements.competitor_url.focus();
      return;
    }

    startProgress(new URL(homepageUrl).hostname.replace(/^www\./, ""));
    submit.disabled = true;

    try {
      const response = await fetch("/api/scan", {
        method: "POST",
        headers: { "content-type": "application/json", "accept": "application/json" },
        body: JSON.stringify({ dealershipName, city, homepageUrl, competitorUrl, website_company: honeypot }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.shortId) throw new Error(result.message || "The scan could not be completed.");
      setProgress(3);
      steps[3].querySelector("b").textContent = "DONE";
      window.setTimeout(() => location.assign(`/report/${encodeURIComponent(result.shortId)}`), 450);
    } catch (error) {
      stopProgress();
      status.textContent = error instanceof Error ? error.message : "The scan could not be completed. Please try again.";
      submit.disabled = false;
    }
  });
})();
