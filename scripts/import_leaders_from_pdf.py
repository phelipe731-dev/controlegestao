#!/usr/bin/env python
"""Import campaign leaders from a simple PDF list.

The PDF is expected to contain region headings and bullet lines with names.
Run without --execute first to validate the extracted records.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import unicodedata
import urllib.error
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Any

try:
    from pypdf import PdfReader
except ImportError as exc:  # pragma: no cover - operator guidance
    raise SystemExit("Missing dependency: install pypdf or run with the Codex bundled Python.") from exc


@dataclass(frozen=True)
class LeaderRecord:
    name: str
    region: str
    source_index: int


def strip_accents(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value)
    return "".join(char for char in normalized if not unicodedata.combining(char))


def normalize_key(value: str) -> str:
    value = strip_accents(value).casefold()
    value = re.sub(r"[^a-z0-9]+", " ", value)
    return re.sub(r"\s+", " ", value).strip()


def slugify(value: str) -> str:
    value = normalize_key(value)
    value = re.sub(r"[^a-z0-9]+", "-", value)
    return value.strip("-") or "lider"


def read_pdf_text(pdf_path: Path) -> str:
    reader = PdfReader(str(pdf_path))
    return "\n".join(page.extract_text() or "" for page in reader.pages)


def is_count_or_total_line(line: str) -> bool:
    key = strip_accents(line).upper().strip()
    if "AO TOTAL" in key:
        return True
    if re.match(r"^\d+\s+(LIDERANCA|LIDERANCAS|INSULAR|CONTINENTAL)\b", key):
        return True
    return False


def parse_leaders(text: str, *, keep_duplicates: bool = False) -> list[LeaderRecord]:
    current_region: str | None = None
    records: list[LeaderRecord] = []
    seen_same_region: set[str] = set()

    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line:
            continue

        key = strip_accents(line).upper().strip()
        if key.startswith("AREA "):
            continue
        if is_count_or_total_line(line):
            continue

        if line.startswith("-"):
            name = line[1:].strip()
            if not name or not current_region:
                continue

            unique_key = f"{normalize_key(current_region)}|{normalize_key(name)}"
            if not keep_duplicates and unique_key in seen_same_region:
                continue

            seen_same_region.add(unique_key)
            records.append(LeaderRecord(name=name, region=current_region, source_index=len(records) + 1))
            continue

        current_region = line

    return records


class ApiClient:
    def __init__(self, api_url: str, timeout: int = 25) -> None:
        self.api_url = api_url.rstrip("/")
        self.timeout = timeout
        self.token: str | None = None

    def request(self, method: str, path: str, payload: dict[str, Any] | None = None) -> Any:
        body = None if payload is None else json.dumps(payload, ensure_ascii=False).encode("utf-8")
        headers = {"Content-Type": "application/json"}
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"

        request = urllib.request.Request(
            f"{self.api_url}{path}",
            data=body,
            method=method,
            headers=headers,
        )

        try:
            with urllib.request.urlopen(request, timeout=self.timeout) as response:
                raw = response.read().decode("utf-8")
                return json.loads(raw) if raw else None
        except urllib.error.HTTPError as error:
            raw = error.read().decode("utf-8", errors="replace")
            try:
                details = json.loads(raw)
            except json.JSONDecodeError:
                details = raw
            raise RuntimeError(f"HTTP {error.code} on {method} {path}: {details}") from error

    def login(self, email: str, password: str) -> None:
        response = self.request("POST", "/auth/login", {"email": email, "password": password})
        token = response.get("token") if isinstance(response, dict) else None
        if not token:
            raise RuntimeError("Login succeeded without token in response.")
        self.token = token


def make_cpf(prefix: str, index: int) -> str:
    digits = re.sub(r"\D", "", prefix)
    if not 1 <= len(digits) < 11:
        raise ValueError("--cpf-prefix must contain between 1 and 10 digits.")
    return f"{digits}{index:0{11 - len(digits)}d}"


def make_email(record: LeaderRecord, index: int, domain: str) -> str:
    name_slug = slugify(record.name)[:42]
    region_slug = slugify(record.region)[:28]
    return f"{name_slug}-{region_slug}-{index:03d}@{domain}"


def build_payload(
    record: LeaderRecord,
    index: int,
    *,
    city: str,
    cpf_prefix: str,
    email_domain: str,
    leader_password: str,
    supervisor_id: str | None,
) -> dict[str, Any]:
    return {
        "name": record.name,
        "cpf": make_cpf(cpf_prefix, index),
        "phone": None,
        "email": make_email(record, index, email_domain),
        "fullAddress": f"Nao informado - {record.region}",
        "city": city,
        "neighborhood": record.region,
        "supervisorId": supervisor_id,
        "status": "ACTIVE",
        "password": leader_password,
    }


def preview(records: list[LeaderRecord], args: argparse.Namespace) -> None:
    print(f"PDF: {args.pdf_path}")
    print(f"Registros extraidos: {len(records)}")
    print(f"Cidade padrao: {args.city}")
    print(f"Dominio de e-mail interno: {args.email_domain}")
    print(f"Modo: {'EXECUTE' if args.execute else 'DRY-RUN'}")
    print("")
    for index, record in enumerate(records[:12], start=1):
        payload = build_payload(
            record,
            index,
            city=args.city,
            cpf_prefix=args.cpf_prefix,
            email_domain=args.email_domain,
            leader_password=args.leader_password,
            supervisor_id=None,
        )
        print(f"{index:03d}. {payload['name']} | {payload['neighborhood']} | {payload['email']} | CPF tecnico {payload['cpf']}")
    if len(records) > 12:
        print(f"... mais {len(records) - 12} registros")


def find_supervisor_id(client: ApiClient, supervisor_email: str | None) -> str | None:
    if not supervisor_email:
        return None

    response = client.request("GET", "/supervisors")
    supervisors = response.get("supervisors", []) if isinstance(response, dict) else []
    for supervisor in supervisors:
        if supervisor.get("email", "").casefold() == supervisor_email.casefold():
            return supervisor.get("id")

    raise RuntimeError(f"Supervisor not found by email: {supervisor_email}")


def existing_leader_keys(client: ApiClient) -> set[str]:
    response = client.request("GET", "/leaders")
    leaders = response.get("leaders", []) if isinstance(response, dict) else []
    keys: set[str] = set()
    for leader in leaders:
        keys.add(f"email:{leader.get('email', '').casefold()}")
        keys.add(f"cpf:{re.sub(r'\\D', '', leader.get('cpf', ''))}")
        keys.add(f"name-region:{normalize_key(leader.get('name', ''))}|{normalize_key(leader.get('neighborhood', ''))}")
    return keys


def import_records(records: list[LeaderRecord], args: argparse.Namespace) -> None:
    admin_email = args.admin_email or os.environ.get("ADMIN_EMAIL")
    admin_password = args.admin_password or os.environ.get("ADMIN_PASSWORD")
    if not admin_email or not admin_password:
        raise SystemExit("Informe --admin-email e --admin-password, ou defina ADMIN_EMAIL e ADMIN_PASSWORD.")

    client = ApiClient(args.api_url)
    client.login(admin_email, admin_password)
    supervisor_id = find_supervisor_id(client, args.supervisor_email)
    existing = existing_leader_keys(client)

    created = 0
    skipped = 0
    failed = 0

    for index, record in enumerate(records[: args.limit or None], start=1):
        payload = build_payload(
            record,
            index,
            city=args.city,
            cpf_prefix=args.cpf_prefix,
            email_domain=args.email_domain,
            leader_password=args.leader_password,
            supervisor_id=supervisor_id,
        )
        identity_keys = {
            f"email:{payload['email'].casefold()}",
            f"cpf:{payload['cpf']}",
            f"name-region:{normalize_key(payload['name'])}|{normalize_key(payload['neighborhood'])}",
        }
        if existing.intersection(identity_keys):
            skipped += 1
            print(f"SKIP {index:03d} {payload['name']} ({payload['neighborhood']})")
            continue

        try:
            client.request("POST", "/leaders", payload)
            existing.update(identity_keys)
            created += 1
            print(f"OK   {index:03d} {payload['name']} ({payload['neighborhood']})")
        except RuntimeError as error:
            failed += 1
            print(f"FAIL {index:03d} {payload['name']}: {error}", file=sys.stderr)

    print("")
    print(f"Criados: {created}")
    print(f"Ignorados: {skipped}")
    print(f"Falhas: {failed}")
    if failed:
        raise SystemExit(1)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Importa liderancas de um PDF para a API CampanhaHub.")
    parser.add_argument("pdf_path", type=Path)
    parser.add_argument("--api-url", default="https://gestaocontrole.duckdns.org/api")
    parser.add_argument("--admin-email")
    parser.add_argument("--admin-password")
    parser.add_argument("--leader-password", default="Lider@123")
    parser.add_argument("--city", default="Sao Vicente")
    parser.add_argument("--email-domain", default="liderancas.local")
    parser.add_argument("--cpf-prefix", default="98")
    parser.add_argument("--supervisor-email")
    parser.add_argument("--keep-duplicates", action="store_true")
    parser.add_argument("--limit", type=int)
    parser.add_argument("--execute", action="store_true")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if not args.pdf_path.exists():
        raise SystemExit(f"PDF not found: {args.pdf_path}")

    text = read_pdf_text(args.pdf_path)
    records = parse_leaders(text, keep_duplicates=args.keep_duplicates)
    if args.limit:
        records = records[: args.limit]

    preview(records, args)
    if not args.execute:
        print("")
        print("Dry-run concluido. Rode novamente com --execute para gravar na API.")
        return

    print("")
    import_records(records, args)


if __name__ == "__main__":
    main()
