# ADR-009: Use the registry-available Next.js baseline

- Status: Accepted
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

Pin Next.js and `eslint-config-next` to 15.5.7 and React/React DOM to 19.1.1. Retain Node.js
22.19.0, strict TypeScript, ESLint 9, App Router and the existing application contract. Use the
matching legacy-to-flat ESLint compatibility adapter supplied for this Next.js line.

## Consequences

The frontend remains reproducible and maintains all required product functionality. A future
upgrade to Next.js 16 must be a separately tested dependency change with a generated lockfile.
This evidence-based deviation takes precedence over the unverified proposed baseline and avoids
floating or unavailable packages.
