"""Inventory pinned source without importing the application or loading credentials.

This is build tooling, not part of the Rust desktop runtime. Decorator discovery
does not prove runtime registration, schema parity, or implemented behavior.
"""
from __future__ import annotations

import argparse
import ast
import json
import subprocess
from pathlib import Path

METHODS = {"get", "post", "put", "patch", "delete", "head", "options", "websocket", "api_route", "route"}


def git(root: Path, *args: str, data: bytes | None = None) -> bytes:
    return subprocess.run(["git", "-C", str(root), *args], input=data, check=True, capture_output=True).stdout


def pinned_sources(root: Path, commit: str) -> tuple[dict[str, str], list[dict[str, str]]]:
    entries = []
    for entry in git(root, "ls-tree", "-rz", commit).split(b"\0"):
        if not entry:
            continue
        metadata, path = entry.split(b"\t", 1)
        _, kind, oid = metadata.decode().split()
        if kind == "blob":
            entries.append({"path": path.decode(), "object": oid})
    selected = [entry for entry in entries if entry["path"].startswith("app/") and entry["path"].endswith(".py")]
    output = git(root, "cat-file", "--batch", data="".join(f'{entry["object"]}\n' for entry in selected).encode())
    offset = 0
    sources = {}
    for entry in selected:
        end = output.index(b"\n", offset)
        object_id, kind, size = output[offset:end].decode().split()
        if kind != "blob" or object_id != entry["object"]:
            raise ValueError("Unexpected Git object in pinned inventory")
        offset = end + 1
        sources[entry["path"]] = output[offset:offset + int(size)].decode()
        offset += int(size) + 1
    if offset != len(output):
        raise ValueError("Unconsumed Git object data")
    return sources, entries


class SourceIndex:
    def __init__(self, sources: dict[str, str]):
        self.trees = {path: ast.parse(text, filename=path) for path, text in sources.items()}
        self.bindings: dict[str, dict[str, ast.expr]] = {}
        self.imports: dict[str, dict[str, str]] = {}
        for path, tree in self.trees.items():
            module = path.removesuffix(".py").replace("/", ".").removesuffix(".__init__")
            bindings = self.bindings.setdefault(module, {})
            imports = self.imports.setdefault(module, {})
            for node in ast.walk(tree):
                if isinstance(node, ast.ImportFrom) and node.level == 0 and node.module:
                    for alias in node.names:
                        imports[alias.asname or alias.name] = f"{node.module}.{alias.name}"
                elif isinstance(node, ast.Import):
                    for alias in node.names:
                        imports[alias.asname or alias.name.split(".")[0]] = alias.name if alias.asname else alias.name.split(".")[0]
            # Bind module constants only. Function-local values are not global facts.
            for node in tree.body:
                if isinstance(node, ast.Assign):
                    for target in node.targets:
                        if isinstance(target, ast.Name):
                            bindings[target.id] = node.value
                elif isinstance(node, ast.AnnAssign) and isinstance(node.target, ast.Name) and node.value:
                    bindings[node.target.id] = node.value

    def resolve(self, module: str, value: ast.expr, seen: frozenset[str] = frozenset()) -> tuple[str, ast.expr] | None:
        if isinstance(value, ast.Constant):
            return module, value
        name = ast.unparse(value)
        identity = f"{module}:{name}"
        if identity in seen:
            return None
        seen = seen | {identity}
        if isinstance(value, ast.Name) and value.id in self.bindings.get(module, {}):
            bound = self.bindings[module][value.id]
            if isinstance(bound, ast.Call):
                return module, bound
            return self.resolve(module, bound, seen)
        first, _, suffix = name.partition(".")
        imported = self.imports.get(module, {}).get(first)
        if imported:
            target = imported + (f".{suffix}" if suffix else "")
            owner, _, symbol = target.rpartition(".")
            return self.resolve(owner, ast.Name(id=symbol), seen)
        return None

    def string(self, module: str, value: ast.expr | None) -> str | None:
        if value is None:
            return None
        resolved = self.resolve(module, value)
        return resolved[1].value if resolved and isinstance(resolved[1], ast.Constant) and isinstance(resolved[1].value, str) else None

    def collect(self) -> dict:
        routes = []
        registrations = []
        settings = []
        for path, tree in sorted(self.trees.items()):
            module = path.removesuffix(".py").replace("/", ".")
            # FastAPI() can be local to create_app; identify constructors without
            # treating arbitrary names such as `app` as known routers.
            app_names = {
                target.id
                for node in ast.walk(tree) if isinstance(node, ast.Assign) and isinstance(node.value, ast.Call)
                and ast.unparse(node.value.func) in {"FastAPI", "fastapi.FastAPI"}
                for target in node.targets if isinstance(target, ast.Name)
            }
            for node in ast.walk(tree):
                if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute) and node.func.attr in {"include_router", "mount", "add_api_route", "add_websocket_route"}:
                    registrations.append({"source": path, "line": node.lineno, "expression": ast.unparse(node)})
                if isinstance(node, ast.ClassDef) and node.name == "Settings" and path == "app/core/config/settings.py":
                    settings.extend({"name": field.target.id, "type": ast.unparse(field.annotation), "source": path, "line": field.lineno} for field in node.body if isinstance(field, ast.AnnAssign) and isinstance(field.target, ast.Name))
                if not isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                    continue
                for decorator in node.decorator_list:
                    if not isinstance(decorator, ast.Call) or not isinstance(decorator.func, ast.Attribute) or decorator.func.attr not in METHODS:
                        continue
                    kwargs = {kw.arg: kw.value for kw in decorator.keywords if kw.arg}
                    path_expr = decorator.args[0] if decorator.args else kwargs.get("path")
                    declared_path = self.string(module, path_expr)
                    receiver = decorator.func.value
                    resolved = self.resolve(module, receiver)
                    prefix = None
                    router_contract = None
                    if isinstance(receiver, ast.Name) and receiver.id in app_names:
                        prefix = ""
                    elif resolved and isinstance(resolved[1], ast.Call) and ast.unparse(resolved[1].func) in {"APIRouter", "fastapi.APIRouter"}:
                        owner, call = resolved
                        router_kwargs = {kw.arg: kw.value for kw in call.keywords if kw.arg}
                        prefix = self.string(owner, router_kwargs["prefix"]) if "prefix" in router_kwargs else ""
                        router_contract = ast.unparse(call)
                    method = decorator.func.attr
                    routes.append({
                        "source": path, "line": decorator.lineno, "handler": node.name,
                        "method": method.upper(), "router": ast.unparse(receiver),
                        "router_contract": router_contract, "prefix": prefix,
                        "declared_path": declared_path,
                        "path": prefix + declared_path if prefix is not None and declared_path is not None else None,
                        "declaration": ast.unparse(decorator),
                        "signature": ast.unparse(node.args),
                        "return_annotation": ast.unparse(node.returns) if node.returns else None,
                        "verification": "not-verified",
                    })
        return {"route_declarations": routes, "registrations": registrations, "settings": settings}


def build(root: Path) -> dict:
    baseline = json.loads((root / "desktop/upstream.json").read_text())
    commit = baseline["commit"]
    if len(commit) != 40 or any(char not in "0123456789abcdef" for char in commit):
        raise ValueError("Baseline requires a full Git commit SHA")
    sources, entries = pinned_sources(root, commit)
    inventory = SourceIndex(sources).collect()
    specs = [entry for entry in entries if entry["path"].startswith("openspec/specs/") and entry["path"].endswith("/spec.md")]
    migrations = [entry for entry in entries if entry["path"].startswith("app/db/alembic/versions/") and entry["path"].endswith(".py")]
    tests = [entry for entry in entries if entry["path"].startswith("tests/") and Path(entry["path"]).name.startswith("test_") and entry["path"].endswith(".py")]
    frontend = [entry for entry in entries if entry["path"].startswith("frontend/src/")]
    return {
        "format_version": 1, "upstream": baseline,
        "coverage": "static-source-only; registrations, middleware, generated schemas and behavior require runtime verification",
        "summary": {"route_declarations": len(inventory["route_declarations"]), "unresolved_route_paths": sum(route["path"] is None for route in inventory["route_declarations"]), "specifications": len(specs), "migration_files": len(migrations), "python_test_files": len(tests), "frontend_source_files": len(frontend), "settings_fields": len(inventory["settings"])},
        **inventory, "specifications": specs, "migrations": migrations,
        "python_tests": tests, "frontend_sources": frontend,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[2]
    inventory = build(root)
    rendered = json.dumps(inventory, ensure_ascii=False, indent=2) + "\n"
    output = root / "desktop/compatibility/source-inventory.json"
    if args.check:
        if not output.exists() or output.read_text() != rendered:
            parser.exit(1, "Source inventory is missing or stale; run this script without --check.\n")
    else:
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(rendered)
    print(json.dumps(inventory["summary"], sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
