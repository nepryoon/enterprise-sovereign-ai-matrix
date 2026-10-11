# ADR-009: Use the registry-available Next.js baseline

- Status: Accepted (amended 2026-10-11, see below)
- Date: 2026-08-22

## Context

`BUILD_SPEC.md` proposed Next.js 16.3 as a baseline, subject to verification against the
package registry. Three independent GitHub jobs—frontend validation, the web container build,
and dependency security—failed at their common npm dependency installation boundary. Backend
and integration jobs passed, isolating the failure from application orchestration and Python
packaging. The proposed `next@16.3.0`/`eslint-config-next@16.3.0` pair was therefore not a usable
registry baseline for the connected CI environment.

## Alternatives

1. Keep retrying unavailable 16.3 artifacts, leaving every npm-based quality gate red.
2. Use floating `latest` versions, sacrificing reproducibility.
3. Pin a compatible, registry-available and security-patched Next.js 15 release line.

## Decision

Pin Next.js and `eslint-config-next` to 15.5.7 and React/React DOM to 19.1.1. Pin the verified
Node.js LTS patch 22.18.0 consistently in `.nvmrc` and every Docker build stage. Retain strict
TypeScript, ESLint 9, App Router and the existing application contract. Use the
matching legacy-to-flat ESLint compatibility adapter supplied for this Next.js line.

## Consequences

The frontend remains reproducible and maintains all required product functionality. A future
upgrade to Next.js 16 must be a separately tested dependency change with a generated lockfile.
This evidence-based deviation takes precedence over the unverified proposed baseline and avoids
floating or unavailable packages.

## Amendment 2026-10-11 (T04): Next.js 16.3.8 and blocking dependency audit

The manifest had already moved `next` to 16.3.2 while `eslint-config-next` stayed on 15.5.7 with
ESLint 8, so the decision above no longer described the code. `npm audit` reported 3 critical
(Next.js 16.0.0–16.3.7, including the image-optimisation RCE GHSA-2xp9-vwfh-vxw4 and SSRF
GHSA-cjq9-62q9-8jv4; tinypool ≤2.1.1 via vitest 3.2.7), 9 high and 1 moderate, and the Security
workflow hid them with `|| true`.

Decision:

- Pin `next` and `eslint-config-next` to 16.3.8, the lowest release that clears the Next.js
  advisories; it also brings a patched `sharp` (0.35.5). React stays at 19.1.1.
- Move to ESLint 9.39.5 with a native flat configuration (`eslint.config.mjs`), because
  `eslint-config-next` 16 requires ESLint ≥9. Drop the unused legacy `.eslintrc.json` and
  `@eslint/eslintrc` adapter.
- Pin `vitest` to 4.1.11. Vitest 4 no longer uses tinypool, and 4.1.11 is the lowest 4.x that
  also clears the moderate `@vitest/mocker` advisory.
- Set `images.unoptimized: true`, because the app does not use `next/image`. This disables the
  image-optimisation endpoint.
- Make the audit blocking in `security.yml` and `make security`. A high or critical advisory in
  production dependencies (`npm audit --omit=dev --audit-level=high`) fails the job, and so does
  any critical advisory in the full tree (`npm audit --audit-level=critical`).

Accepted residual risk: braces GHSA-vfj7-8cjw-p6xm (high, all versions ≤3.0.3, no fix
published) is reachable only through the lint toolchain (`eslint-config-next` →
`@next/eslint-plugin-next` → `fast-glob` → `micromatch`). It does not ship in the standalone
server. This is why the full tree is gated at critical rather than high, which deviates from the
plan's acceptance of a full `npm audit --audit-level=high` exit 0. Raise the full-tree gate to
high once a patched braces/micromatch is published.

Consequence absorbed: `eslint-plugin-react-hooks` 7 flags synchronous `setState` in effects. The
approval-dialog reopen logic in `mission-control.tsx` now adjusts state during render, and a
regression test covers it.
