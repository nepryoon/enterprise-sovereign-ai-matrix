# Security policy

Report vulnerabilities privately through GitHub Security Advisories; do not open a public issue. Include affected revision, reproduction and impact. Maintainers will acknowledge within five business days. Only the latest main-branch release is supported.

Never commit `.env`, tokens, prompts containing personal data, model weights or database dumps. Rotate a secret immediately if exposed. See `docs/security/THREAT_MODEL.md` for boundaries and residual risks. This PoC is not a substitute for a regulated production security assessment.
