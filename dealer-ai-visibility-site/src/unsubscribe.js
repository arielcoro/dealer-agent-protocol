(() => {
  const token = new URLSearchParams(location.search).get("token");
  const status = document.querySelector("#unsubscribe-status");
  const button = document.querySelector("#unsubscribe-button");
  if (!token) { status.textContent = "This unsubscribe link is invalid or incomplete."; return; }

  async function check() {
    try {
      const response = await fetch(`/api/unsubscribe?token=${encodeURIComponent(token)}`);
      const result = await response.json();
      if (result.valid) { status.textContent = "Confirm below to stop Dealer AI Visibility emails."; button.hidden = false; }
      else if (result.reason === "already_unsubscribed") status.textContent = "This address is already unsubscribed.";
      else status.textContent = "This unsubscribe link is invalid or expired.";
    } catch { status.textContent = "We could not verify the link. Please try again later."; }
  }

  button.addEventListener("click", async () => {
    button.disabled = true; status.textContent = "Processing…";
    try {
      const response = await fetch("/api/unsubscribe", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token }) });
      const result = await response.json();
      if (!response.ok || (!result.success && result.reason !== "already_unsubscribed")) throw new Error();
      status.textContent = "You are unsubscribed. We will not send additional marketing email.";
      button.hidden = true;
    } catch { status.textContent = "We could not process the request. Please try again later."; button.disabled = false; }
  });
  check();
})();
