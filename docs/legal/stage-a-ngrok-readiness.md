# Stage A ngrok Free readiness

Prepared 9 November 2026. Approval draft; no tunnel activation, database restoration, merge or deployment is authorised by this document.

## Verified account evidence

The owner completed the ngrok browser sign-in/registration handoff and explicitly confirmed that this account is used on behalf of LegalHub CRM JDG Valentyn Verbelchuk and that the Terms were accepted. That owner confirmation, together with the authenticated account, is the evidence of acceptance; no separate signed-DPA record or acceptance timestamp was exposed in the dashboard. Do not describe this as an independently downloaded signature certificate.

- Billing: **Free, $0/month + limits**; Payment details: **Card number None**.
- The displayed $5 is an unused one-time usage credit, not a paid subscription; no charge or upgrade was made.
- One assigned dev-domain was visible; no domain was registered, purchased or added by the assistant. Keep the exact account identifiers and hostname in the operator's local setup record, not this public runbook.
- Usage: 0 active endpoints, 0 B of 1 GB outbound monthly allocation; account limits show 3 online endpoints, 3 agents and 4,000 HTTP/S connections/minute.
- Published Free limits additionally list 20,000 HTTP requests/month. Distinguish published limits from account-screen observations.
- Settings > Data Retention: **Full capture Disabled**; Traffic Inspector retention window **24 hours**. No switch was changed. This is not the retention period for all account/security/Event Store records.
- Compliance showed HIPAA upsell and Trust Center links, not an additional DPA acceptance screen. No add-on, NDA, review or verification was submitted.
- No authtoken/API-key/secret page was opened, no agent was installed or started, and no public endpoint request was sent.

## Agreement and transfer basis

The current [Terms](https://ngrok.com/tos) (2 March 2026) cover the account and incorporate the [DPA](https://ngrok.com/dpa). The owner's confirmation supplies the account-specific acceptance evidence.

The [full DPA with schedules](https://ngrok.com/docs/static/other/ngrok-dpa.pdf) covers processing under the agreement; section 9 and Exhibit 4 provide applicable SCCs, selecting Module Two for controller-to-processor transfers. The operator and ngrok, Inc. are the parties for this internal QA flow. This establishes the contractual basis, not EEA-only residency or a complete assurance about all international-access risks.

Only synthetic contact fields are allowed. Administrator/network metadata can be personal data. HTTPS terminates at ngrok; the provider can process traffic. Its US control plane/global data plane and Free IP-exposure provision must remain disclosed. The 24-hour Inspector window does not govern every provider record. No unsupported EEA pinning, no-capture-equals-no-processing assertion, or fixed provider-wide deletion deadline is adopted.

## Prepared local configuration — not activated

Flow: exact QA App -> assigned HTTPS hostname -> loopback HMAC gateway -> loopback QA CRM -> new isolated synthetic PostgreSQL.

- App: 1160353550276176; Page: 1449474971582722; Form: 2046130655900851.
- Public URL path: `/api/webhooks/meta/lead-ads`.
- Proposed gateway `127.0.0.1:43127`; CRM upstream `http://127.0.0.1:43126/api/webhooks/meta/lead-ads`. Verify both ports are free before use.
- Tunnel forwards only to the gateway, never CRM admin, PostgreSQL, the agent's management UI or another local service.
- Retain the existing raw-byte HMAC, challenge-token, exact Page/Form and first-Lead-ID gate. Unknown IDs remain closed; only an authorised synthetic ID may be released.
- Other paths/methods are rejected. No Basic Auth, browser OAuth or warning-bypass header is required from Meta.
- Store a fresh QA-only agent credential later in a private ACL-protected configuration outside Git/synced exports. Do not use a default global credential file or put the token on the command line.
- Disable local inspection database, local web UI, agent console/request logs and remote agent management. Keep cloud Full Capture disabled. Collect only allowlisted HTTP status/timing diagnostics in the local gateway, with no body, credential or query values in public reports.

Example v3 agent configuration (no credentials; validate with the official agent offline before activation):

```yaml
version: "3"
agent:
  # Add the authorised QA-only authtoken privately; never commit its value.
  console_ui: false
  inspect_db_size: -1
  web_addr: false
  log: false
  remote_management: false
```

Future invocation only, after permission, private credential setup and offline validation:

```text
ngrok http http://127.0.0.1:43127 --url https://<assigned-dev-domain> --inspect=false --config <private-QA-config>
```

No credential/config file containing a real token has been created. Agent-specific parsing of the template has not been run because the agent is not installed on PATH.

## Verification and activation gates

1. Approve and separately publish the three QA legal-page amendments. General Production privacy/deletion documents remain unchanged.
2. Separately authorise official agent setup, a new disposable synthetic QA environment and narrowly scoped public ingress. Confirm loopback DB binding and clean environment before any local QA migrations; never use Production credentials, DB, Vercel environment pull or backups.
3. Before exposure, verify the existing gateway's rejection paths and HMAC, strict forwarding target, private logging, disabled cloud/local capture and a local one-action stop.
4. The stop control must immediately stop the owned tunnel process and close the QA gate/intake/worker. Do not install a persistent service or startup task. Verify this control before connecting Meta; do not claim it is already implemented.
5. ngrok documents that the Free HTML browser warning does not affect programmatic API requests. **Actual Meta GET verification and POST leadgen compatibility remain NEEDS TEST.** Do not add a skip-warning header that Meta does not send or claim a browser click proves compatibility.
6. Meta callback, QA Page leadgen subscription, Live Mode and one synthetic test lead each remain outside this preparation. Live is not a proven fix for Pending. Future evidence must distinguish challenge, dashboard POST, Graph retrieval and an original automatic Meta -> CRM event.

GET challenge tokens pass through the provider and may appear in request metadata even without Full Capture. Use a temporary QA verification token; do not send App Secret or Graph/Page tokens through this public gateway. Do not export Traffic Inspector events or use replay. Document any unavoidable provider metadata before the test; no unverified no-query-storage claim is made.

## Cleanup and limits

Keep the approved manual [cleanup procedure](stage-a-qa-cleanup.md): transient local QA credentials/configuration within 24 hours of closure/cancellation; remaining operator-held QA data/copies within 7 days; a genuinely non-identifying result summary within 30 days. Include any new agent configuration/logs and all operator-held copies. Retain source, Git and the preserved combined candidate.

Stop the agent at closure. Review and, where needed, revoke its QA-only authorisation separately; removing a local config does not revoke a provider credential. The assigned hostname may stay reserved offline. Independent ngrok records follow its agreement and request procedures; no local cleanup result certifies provider-wide erasure. Do not delete unrelated account resources or data.

No paid plan, card, paid add-on, new domain or Production DNS change is permitted. If limits or setup require payment, stop.

## Review and release scope

Only the three `public/assets/legalhub/qa/*.html` notices, this readiness document and a branch-specific `vercel.json` deployment-disable entry are included. That entry prevents automatic Vercel deployment of this draft branch and preserves existing settings. No executable CRM code, migration, Meta binding or Production legal page changes are included.

Local verification on 9 November 2026: HTML parsing, three-page navigation, retention wording, exact five-file scope and preservation of existing Vercel settings passed. The preserved first-event gateway unit test passed 1/1 using only loopback synthetic requests and a mock upstream, without PostgreSQL, ngrok or Meta. YAML syntax and disabled inspection/UI settings parsed successfully with a generic YAML parser; the ngrok agent parser was not run. No earlier 77/77 claim is reused as new verification.

## Sources checked

- [Free limits and warning behaviour](https://ngrok.com/docs/pricing-limits/free-plan-limits)
- [Traffic Inspector retention](https://ngrok.com/docs/obs/traffic-inspection)
- [Agent v3 configuration](https://ngrok.com/docs/gateway/agent/config/v3)
- [Security and data handling](https://ngrok.com/security)
- [Terms](https://ngrok.com/tos), [DPA](https://ngrok.com/dpa) and [full schedules/SCC](https://ngrok.com/docs/static/other/ngrok-dpa.pdf)
