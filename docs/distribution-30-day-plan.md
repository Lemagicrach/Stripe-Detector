# Corvidet 30-Day Distribution Plan

## Positioning

- ICP: Stripe-native B2B SaaS teams with recurring revenue, roughly `$10k-$100k MRR`, and no dedicated RevOps owner.
- Core promise: find lost MRR from failed renewals, broken subscription states, and weak billing recovery before spending on broad marketing.
- Primary CTA: `Request free audit`

## Funnel Components

- Landing page: `/`
- Audit request page: `/audit`
- Thank-you page: `/audit/thanks`
- Demo: `/demo`
- Connect Stripe: `/dashboard/connect`
- Leak scan: `/dashboard/leaks`
- Reports: `/dashboard/reports`
- Attribution view: `/dashboard/growth`

## North-Star Metrics

- Visitor -> audit request: `3-5%`
- Audit request -> qualified reply: `30%+`
- Qualified reply -> Stripe connect: `40%+`
- Connect -> first leak found: `60%+`
- First leak found -> paid pilot: `20%+`

## Week 1

- Finalize audit offer and founder outreach copy.
- Set `AUDIT_ADMIN_EMAILS`, `AUDIT_INBOX_EMAIL`, and `AUDIT_CALENDAR_URL`.
- Apply migration `004_audit_requests.sql`.
- Publish the public funnel and verify attribution is writing into `/dashboard/growth`.
- Build a target list of 100 accounts that match the ICP.

## Week 2

- Send 20-25 founder-led outbound messages per weekday.
- Channels: email, LinkedIn, and warm intros from operators or investors.
- Review every incoming request the same day.
- Turn qualified replies into a short audit review call or direct Stripe connect flow.
- Capture objections and update the landing page FAQ/copy twice during the week.

## Week 3

- Publish 2 first-hand content pieces from real audit patterns.
- Suggested topics:
- `Why Stripe failed renewals keep turning into silent churn`
- `How broken subscription states hide lost MRR`
- Repurpose each post into LinkedIn threads, email follow-up assets, and partner collateral.
- Begin outreach to fractional CFOs, RevOps consultants, and Stripe implementers with a co-branded audit offer.

## Week 4

- Double down on the best-performing source from `/dashboard/growth`.
- Launch small retargeting only if the audit request rate and follow-up rate are healthy.
- Turn the first successful audits into:
- one anonymized case study
- one screenshot-based proof asset
- one partner referral ask
- Cut channels that produce low-fit traffic or no audit requests.

## Weekly Operating Cadence

- Monday: review attribution, recent requests, and active pipeline.
- Tuesday to Thursday: outbound, follow-up, and audit calls.
- Friday: update messaging, publish one proof asset, and review conversion gaps.

## What Good Looks Like

- You know which `utm_source`, `utm_campaign`, and `landing_variant` are driving requests.
- Every lead has a same-day owner and next action.
- The product itself produces proof through leak scans and monthly reports.
- Distribution stays anchored on one painful promise instead of broad analytics messaging.
