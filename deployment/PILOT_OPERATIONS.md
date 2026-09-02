# Founding dealer pilot operations

Pilot applications are submitted at `https://dealeragentprotocol.com/pilot/` and stored privately in the Cloudflare D1 database named `dealer-agent-pilot`.

## Deploy the application flow

Apply any pending database migrations before deploying the protocol Worker:

```bash
npx wrangler d1 migrations apply dealer-agent-pilot \
  --config deployment/cloudflare/wrangler.jsonc \
  --remote

npm run build:sites
npm run validate
npm run deploy:protocol
```

## Review applications

```bash
npm run pilot:count
npm run pilot:list
```

The list command returns the latest 50 applications. It contains business contact information and should not be pasted into issues, logs, or public documents.

To inspect one application by its UUID:

```bash
npx wrangler d1 execute dealer-agent-pilot \
  --config deployment/cloudflare/wrangler.jsonc \
  --remote \
  --command "SELECT * FROM pilot_applications WHERE id = 'APPLICATION_UUID'"
```

## Update review status

Allowed states are `new`, `reviewing`, `contacted`, `accepted`, `declined`, and `withdrawn`.

```bash
npx wrangler d1 execute dealer-agent-pilot \
  --config deployment/cloudflare/wrangler.jsonc \
  --remote \
  --command "UPDATE pilot_applications SET status = 'reviewing', updated_at = CURRENT_TIMESTAMP WHERE id = 'APPLICATION_UUID'"
```

## Privacy and retention

- Use application data only to evaluate, contact, select, and plan with applicants.
- Do not request customer information, source credentials, or confidential dealer data through the application form.
- Declined or inactive applications should be deleted or de-identified after approximately 180 days.
- Export application data only when necessary and keep exports out of the repository.

## Notifications

The first release stores submissions but does not send email notifications. Until a transactional email sender and project inbox are configured, check `npm run pilot:count` on a regular cadence.
