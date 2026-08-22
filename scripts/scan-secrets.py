#!/usr/bin/env python3
"""Deterministic, dependency-free CI scan for high-confidence credential formats."""

from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

PATTERNS = {
    "AWS access key": re.compile(r"\b(?:AKIA|ASIA)[A-Z0-9]{16}\b"),
    "OpenAI-style key": re.compile(r"\bsk-[A-Za-z0-9_-]{20,}\b"),
    "GitHub token": re.compile(r"\bgh[opsu]_[A-Za-z0-9]{30,}\b"),
    "Private key": re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
}

ALLOWLIST = {
    "BUILD_SPEC.md",
    "docs/reference/MASTER_AUTONOMOUS_BUILD_PROMPT.md",
    "docs/reference/deep-research-architecture.md",
    "reference/MASTER_AUTONOMOUS_BUILD_PROMPT.md",
    "reference/deep-research-architecture.md",
    "scripts/scan-secrets.py",
}


def tracked_files() -> list[Path]:
    output = subprocess.check_output(["git", "ls-files", "-z"])
    return [Path(item.decode()) for item in output.split(b"\0") if item]


def main() -> int:
    findings: list[str] = []
    for path in tracked_files():
        if path.as_posix() in ALLOWLIST or not path.is_file():
            continue
        try:
            content = path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        for line_number, line in enumerate(content.splitlines(), 1):
            for name, pattern in PATTERNS.items():
                if pattern.search(line):
                    findings.append(f"{path}:{line_number}: {name}")
    if findings:
        print("Potential committed credentials detected:", file=sys.stderr)
        print("\n".join(findings), file=sys.stderr)
        return 1
    print(f"Secret scan passed ({len(PATTERNS)} high-confidence rules).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
