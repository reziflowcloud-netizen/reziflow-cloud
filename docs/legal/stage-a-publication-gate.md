# Stage A publication approval gate

## Cloudflare decision

**Accountless Quick Tunnel DPA/SCC coverage: NOT CONFIRMED.** Cloudflare's Self-Serve agreement defines covered account/subscription services (§1) and incorporates a DPA for covered personal-data processing (§6.1). Its DPA depends on a Main Agreement. Quick Tunnels need no account. These public documents do not prove that the specific earlier accountless relay had the claimed contractual coverage.

The blanket current-use assertion is removed from QA Privacy. It states the actual status: the earlier relay is stopped; the next relay is only planned; contractual and transfer conditions must be verified before activation. No working relay, DPA execution or SCC coverage is represented as completed.

### Proposed no-paid-service solution

Use an **account-managed Cloudflare Tunnel** for one QA hostname pointing only to the existing loopback webhook gate, under an identified LegalHub account and the applicable Self-Serve agreement/DPA. Cloudflare documents a free proof-of-concept plan; this is not proof that a particular account has no charges enabled.

Before separately authorised setup, check the actual account plan is free, contracting entity and applicable terms/DPA, relevant transfer safeguards, existing controlled domain/hostname and route scope. Save non-secret evidence of applicable versions and configuration. Do not add billing, buy a domain or upgrade. If a free eligible account/domain is unavailable, stop and propose an alternative; do not migrate Production domain/nameservers.

A named tunnel needs an account and a domain on Cloudflare for public applications. No suitable existing account/domain association has been established here. This is a proposed managed option, **not provisioned infrastructure**. No DNS, account, tunnel, credentials, Meta callback or subscription was created or changed.

The accountless option may be reconsidered only with service-specific written provider confirmation and an appropriate transfer basis. No support message is sent. Owner attestation that “a DPA must apply” is not a substitute for evidence.

**Publication and activation are separate:** truthful notices describing a disabled, planned pilot may be published after owner facts and review pass; that does not authorise relay setup, personal metadata transfer, Basic Settings or Live. Before later activation, verify the deployed notice matches the selected service.

## Only facts requiring the owner

1. Confirm the existing public operator identity, Warsaw address and office@legalhubcrm.com are current and the mailbox accessible.
2. Confirm the physical country of the QA computer and all operator-held copies. Poland is a proposed draft fact, not inferred from the timezone.
3. Declare cloud-synchronised, backup, export and other chat/system copies or confirm none after checking; identify locations without contents or credentials.
4. Accept the manual 24-hour / 7-day / 30-day maximums and name the responsible cleanup person and verifier.

Do not ask the owner to certify Cloudflare legal coverage, Advanced Access, deletion completeness or unseen provider configuration. Those are separate evidence/verification tasks.

## Review checklist

Review the exact final PR head:

- public Privacy does not assert DPA/SCC coverage for the accountless relay;
- proposed managed service is not described as already set up or guaranteed free in the actual account;
- no paid service, DNS migration, Meta mutation or deletion occurred;
- runbook accounts for the actual private PostgreSQL cluster/auth material, old evidence, generated caches, local/cloud trash and version history;
- deadline origins are explicit; prior artifacts and delayed/cancelled tests do not avoid cleanup;
- identifying inventory is removed by 7 days; the 30-day summary is non-identifying;
- public documents/runbook use the same deadlines and provider status;
- only four owner fact/responsibility items remain; Stage B contracts are not introduced;
- general /privacy and /data-deletion match main; no API/middleware/database/migration changes;
- local static checks and read-only inventory pass; no secret values are read/output;
- independent reviewer reports findings against this exact version and identifies unresolved issues.

Independent assistant review is preparation evidence, not a GitHub human APPROVED review or a substitute for any repository branch rule.

## Publication permission request prepared for use after gates pass

**Do not present this as an active publication request until owner facts are confirmed and review has no unresolved blocking findings.**

“Разрешаете опубликовать три утверждённые статические страницы QA Privacy, QA Data Deletion и QA Terms из проверенного commit PR #14 по адресам /assets/legalhub/qa/privacy.html, /assets/legalhub/qa/data-deletion.html и /assets/legalhub/qa/terms.html? Публикация включает отдельно согласованный merge этого PR и deployment сайта с main на зафиксированном проверенном коммите; кроме трёх страниц, PR сохраняет документацию, read-only инструмент инвентаризации и существующий запрет автоматического deployment его ветки. Общие /privacy и /data-deletion остаются без изменений. Production DB, Meta Basic Settings, туннель, callbacks/subscriptions, Live Mode, RAM и SL не затрагиваются. Перед выпуском повторно проверяется точный состав main и публикации; если main изменился или deployment затрагивает новые непроверенные изменения, потребуется новый запрос.”

Bind that request to the exact reviewed PR head, current main, deployment revision and owner confirmation date when actually presented. A broad approval to publish legal text does not silently authorise unrelated main changes or the Meta test. No merge/deployment is requested or executed now.

## Sources checked 9 November 2026

- [Cloudflare Self-Serve agreement](https://www.cloudflare.com/terms/) scope and §6.1.
- [Customer DPA](https://www.cloudflare.com/cloudflare-customer-dpa/) Main Agreement scope and transfer clauses.
- [Quick Tunnels](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/) accountless relay.
- [Managed tunnel setup](https://developers.cloudflare.com/tunnel/get-started/) account/domain prerequisites.
- [Cloudflare plan page](https://www.cloudflare.com/plans/zero-trust-services/) free proof-of-concept offer; no actual account-plan assertion.

