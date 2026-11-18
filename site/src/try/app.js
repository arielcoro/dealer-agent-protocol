const HEALTH = "https://demo.dealeragentprotocol.com/health";
const status = document.querySelector("#gateway-status");
const copyButton = document.querySelector("#copy-endpoint");
const endpointValue = document.querySelector("#endpoint-value");
const copyFeedback = document.querySelector("#copy-feedback");

async function checkGateway() {
  if (!status) return;
  try {
    const response = await fetch(HEALTH, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(4000) });
    if (!response.ok) throw new Error("unavailable");
    const body = await response.json();
    status.dataset.state = "operational";
    status.textContent = `Gateway online · ${body.vehicles_published} synthetic vehicles`;
  } catch {
    status.dataset.state = "offline";
    status.textContent = "Gateway status unavailable from this browser";
  }
}

copyButton?.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(endpointValue.textContent.trim());
    copyFeedback.textContent = "Endpoint copied. Paste it into your client.";
    copyButton.textContent = "Copied";
  } catch {
    copyFeedback.textContent = "Select the endpoint above to copy it.";
  }
});

checkGateway();
