const form = document.querySelector("#pilot-form");
const submitButton = document.querySelector("#pilot-submit");
const successPanel = document.querySelector("#pilot-success");
const errorPanel = document.querySelector("#pilot-error");
const startedAt = document.querySelector("#form-started-at");

if (startedAt) startedAt.value = String(Date.now());

const params = new URLSearchParams(window.location.search);
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
