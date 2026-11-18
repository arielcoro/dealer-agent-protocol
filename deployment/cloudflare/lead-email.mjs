import { isValidEmail } from "./lead-form-guards.mjs";

export { isValidEmail };

export const INTERNAL_RECIPIENT = "ariel@dealergrowthhackers.com";

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function fieldLines(fields) {
  return fields.map(([label, value]) => `${label}: ${value || "Not provided"}`).join("\n");
}

function fieldRows(fields) {
  return fields.map(([label, value]) => `<tr><th align="left" style="padding:6px 14px 6px 0;vertical-align:top">${escapeHtml(label)}</th><td style="padding:6px 0">${escapeHtml(value || "Not provided")}</td></tr>`).join("");
}

function emailError(error) {
  return error instanceof Error ? { name: error.name, message: error.message, code: error.code || null } : { message: String(error) };
}


function assertSafeAddress(value, label) {
  if (!isValidEmail(value)) {
    throw new Error(`invalid_${label}`);
  }
}

export async function sendLeadEmails(emailBinding, lead) {
  if (!emailBinding) {
    console.error(JSON.stringify({ event: "lead_email_binding_missing", application_id: lead.id, source: lead.source }));
    throw new Error("email_binding_missing");
  }
  assertSafeAddress(INTERNAL_RECIPIENT, "internal_recipient");
  assertSafeAddress(lead.workEmail, "work_email");

  const fields = [
    ["Name", lead.contactName],
    ["Work email", lead.workEmail],
    ["Dealership", lead.dealershipName],
    ["Website", lead.dealershipWebsite],
    ["Role", lead.role],
    ["Rooftops", lead.rooftopCount],
    ...lead.extraFields,
    ["Application ID", lead.id],
    ["Source", lead.source],
  ];

  const messages = [
    {
      kind: "internal",
      message: {
        to: INTERNAL_RECIPIENT,
        from: { email: lead.fromEmail, name: lead.productName },
        replyTo: lead.workEmail,
        subject: `[${lead.productName}] ${lead.internalSubject}: ${lead.dealershipName}`,
        text: `${lead.internalIntro}\n\n${fieldLines(fields)}`,
        html: `<h1 style="font-size:22px">${escapeHtml(lead.internalIntro)}</h1><table role="presentation" style="border-collapse:collapse">${fieldRows(fields)}</table>`,
      },
    },
    {
      kind: "acknowledgment",
      message: {
        to: lead.workEmail,
        from: { email: lead.fromEmail, name: lead.productName },
        replyTo: INTERNAL_RECIPIENT,
        subject: lead.acknowledgmentSubject,
        text: lead.acknowledgmentText,
        html: `<p>${escapeHtml(lead.acknowledgmentGreeting)}</p>${lead.acknowledgmentParagraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("")}<p>— Ariel Coro<br>Dealer Growth Hackers</p>`,
      },
    },
  ];

  const results = await Promise.allSettled(messages.map(({ message }) => emailBinding.send(message)));
  results.forEach((result, index) => {
    const context = { event: "lead_email_delivery", application_id: lead.id, source: lead.source, kind: messages[index].kind };
    if (result.status === "fulfilled") {
      console.log(JSON.stringify({ ...context, status: "accepted", message_id: result.value?.messageId || null }));
    } else {
      console.error(JSON.stringify({ ...context, status: "failed", error: emailError(result.reason) }));
    }
  });
}

export function protocolLeadEmail(application, id) {
  const fromGateway = application.sourcePath === "/pilot/?source=dealeragentgateway.com";
  const productName = fromGateway ? "Dealer Agent Gateway" : "Dealer Agent Protocol";
  const fromEmail = fromGateway ? "notifications@dealeragentgateway.com" : "notifications@dealeragentprotocol.com";
  const purpose = fromGateway ? "Dealer Agent Gateway pilot" : "Dealer Agent Protocol founding dealer pilot";
  const acknowledgmentParagraphs = [
    `We received your ${purpose} application for ${application.dealershipName}.`,
    "We’ll review the dealership, the retail answer you want agents to get right, and your requested timing. Ariel will follow up at this email address.",
    "Please don’t send customer records, credentials, or confidential dealer data by email.",
  ];

  return {
    ...application,
    id,
    productName,
    fromEmail,
    source: fromGateway ? "dealeragentgateway.com" : "dealeragentprotocol.com",
    internalSubject: "New dealer pilot application",
    internalIntro: `A new ${purpose} application was saved.`,
    extraFields: [
      ["Pilot goal", application.pilotGoal],
      ["Timeline", application.timeline],
    ],
    acknowledgmentSubject: `We received your ${productName} application`,
    acknowledgmentGreeting: `Hi ${application.contactName},`,
    acknowledgmentParagraphs,
    acknowledgmentText: `Hi ${application.contactName},\n\n${acknowledgmentParagraphs.join("\n\n")}\n\n— Ariel Coro\nDealer Growth Hackers`,
  };
}

export function dealershipMcpLeadEmail(application, id) {
  const acknowledgmentParagraphs = [
    `We received your AI Answer Audit request for ${application.dealershipName}.`,
    "We’ll review the public dealership website and the answer concern you shared. Ariel will follow up at this email address about scope and next steps.",
    "Please don’t send customer records, credentials, or confidential dealer data by email.",
  ];

  return {
    ...application,
    id,
    productName: "DealershipMCP",
    fromEmail: "notifications@dealershipmcp.com",
    source: "dealershipmcp.com",
    internalSubject: "New AI Answer Audit request",
    internalIntro: "A new DealershipMCP AI Answer Audit request was saved.",
    extraFields: [
      ["Market", application.market],
      ["Audit concern", application.auditGoal],
    ],
    acknowledgmentSubject: "We received your DealershipMCP audit request",
    acknowledgmentGreeting: `Hi ${application.contactName},`,
    acknowledgmentParagraphs,
    acknowledgmentText: `Hi ${application.contactName},\n\n${acknowledgmentParagraphs.join("\n\n")}\n\n— Ariel Coro\nDealer Growth Hackers`,
  };
}
