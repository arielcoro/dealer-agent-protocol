const endpoint = "https://mcp.dealeragentgateway.com";
const status = document.querySelector("#gateway-status");
const statusCopy = status?.querySelector(".status-copy");

async function checkGateway() {
  if (!status || !statusCopy) return;
  try {
    const response = await fetch(`${endpoint}/health`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(3500),
    });
    if (!response.ok) throw new Error("Reference unavailable");
    const body = await response.json();
    status.dataset.state = "operational";
    statusCopy.textContent = body.data_status?.startsWith("synthetic") ? "Reference online · synthetic" : "Reference online";
  } catch {
    status.dataset.state = "offline";
    statusCopy.textContent = "Reference pending";
  }
}

const copyButton = document.querySelector("#copy-endpoint");
const endpointValue = document.querySelector("#endpoint-value");
const copyFeedback = document.querySelector("#copy-feedback");

copyButton?.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(endpointValue.textContent.trim());
    copyFeedback.textContent = "Endpoint copied.";
    copyButton.textContent = "Copied";
  } catch {
    copyFeedback.textContent = "Select the endpoint above to copy it.";
  }
});

checkGateway();
