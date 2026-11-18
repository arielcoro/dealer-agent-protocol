const form = document.querySelector("#pilot-form");
const submitButton = document.querySelector("#pilot-submit");
const successPanel = document.querySelector("#pilot-success");
const errorPanel = document.querySelector("#pilot-error");
const startedAt = document.querySelector("#form-started-at");

if (startedAt) startedAt.value = String(Date.now());

const params = new URLSearchParams(window.location.search);
const sourcePath = form?.elements.namedItem("source_path");
if (sourcePath && params.get("source") === "dealeragentgateway.com") {
  sourcePath.value = "/pilot/?source=dealeragentgateway.com";
}
if (params.get("submitted") === "1") {
  successPanel.hidden = false;
  form.hidden = true;
  successPanel.focus?.();
} else if (params.get("error") === "1") {
  errorPanel.hidden = false;
}

function clearErrors() {
  errorPanel.hidden = true;
  document.querySelectorAll(".field-error").forEach((node) => { node.textContent = ""; });
  form.querySelectorAll("[aria-invalid='true']").forEach((node) => node.removeAttribute("aria-invalid"));
}

function showErrors(fields = {}) {
  errorPanel.hidden = false;
  for (const [name, message] of Object.entries(fields)) {
    const input = form.elements.namedItem(name);
    const output = document.querySelector(`[data-error-for="${name}"]`);
    if (input) input.setAttribute("aria-invalid", "true");
    if (output) output.textContent = message;
  }
  const firstInvalid = form.querySelector("[aria-invalid='true']");
  (firstInvalid || errorPanel).focus?.();
}

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearErrors();

  if (!form.reportValidity()) return;

  submitButton.disabled = true;
  submitButton.textContent = "Sending application…";

  const body = Object.fromEntries(new FormData(form).entries());
  try {
    const response = await fetch(form.action, {
      method: "POST",
      headers: { "Accept": "application/json", "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = await response.json();

    if (!response.ok) {
      showErrors(result.fields || {});
      return;
    }

    form.reset();
    form.hidden = true;
    successPanel.hidden = false;
    history.replaceState({}, "", "/pilot/?submitted=1");
    successPanel.scrollIntoView({ behavior: "smooth", block: "center" });
  } catch {
    showErrors();
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Apply for the founding pilot →";
  }
});

async function setupTurnstile() {
  const slot = document.querySelector("#turnstile-widget");
  if (!slot) return;
  try {
    const response = await fetch("/api/turnstile-config", { headers: { Accept: "application/json" } });
    if (!response.ok) return;
    const config = await response.json();
    if (!config.configured || !config.site_key) return;
    slot.className = "cf-turnstile";
    slot.dataset.sitekey = config.site_key;
    if (!document.querySelector("script[data-turnstile]")) {
      const script = document.createElement("script");
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
      script.async = true;
      script.defer = true;
      script.dataset.turnstile = "true";
      document.head.appendChild(script);
    }
  } catch {
    // The server fails closed without Turnstile; the widget is best-effort on the page.
  }
}

setupTurnstile();

