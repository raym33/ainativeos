import argparse
import json
import sys
import types
from typing import Any

import pytest

from scripts import r_bridge


def _call(capsys: pytest.CaptureFixture[str], **kwargs: Any) -> dict[str, Any]:
    r_bridge.cmd_call(argparse.Namespace(**kwargs))
    out = capsys.readouterr().out
    return json.loads(out)


def _install_fake_runner(monkeypatch: pytest.MonkeyPatch) -> list[dict[str, Any]]:
    calls: list[dict[str, Any]] = []
    package = types.ModuleType("r_cli")
    runner = types.ModuleType("r_cli.tool_runner")

    def execute_tool(
        skill: str,
        tool: str,
        params: dict[str, Any],
        *,
        auto_approve: bool,
        source: str,
    ) -> dict[str, Any]:
        call = {
            "skill": skill,
            "tool": tool,
            "params": params,
            "auto_approve": auto_approve,
            "source": source,
        }
        calls.append(call)
        return {"ok": True, "call": call}

    def normalize_result(result: Any) -> Any:
        return result

    runner.execute_tool = execute_tool
    runner.normalize_result = normalize_result
    monkeypatch.setitem(sys.modules, "r_cli", package)
    monkeypatch.setitem(sys.modules, "r_cli.tool_runner", runner)
    return calls


def test_guarded_tool_without_confirm_returns_preview_and_does_not_execute(
    capsys: pytest.CaptureFixture[str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls = _install_fake_runner(monkeypatch)

    payload = _call(
        capsys,
        skill="email",
        tool="send_email",
        params=json.dumps({"to": "client@example.com", "subject": "Invoice"}),
        confirm=False,
    )

    assert payload["ok"] is True
    assert payload["confirmationRequired"] is True
    assert payload["skill"] == "email"
    assert payload["tool"] == "send_email"
    assert "client@example.com" in payload["summary"]
    assert calls == []


def test_guarded_tool_with_confirm_executes(
    capsys: pytest.CaptureFixture[str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls = _install_fake_runner(monkeypatch)

    payload = _call(
        capsys,
        skill="email",
        tool="send_email",
        params=json.dumps({"to": "client@example.com", "subject": "Invoice"}),
        confirm=True,
    )

    assert len(calls) == 1
    assert calls[0]["skill"] == "email"
    assert calls[0]["tool"] == "send_email"
    assert calls[0]["auto_approve"] is True
    assert payload["confirmed"] is True
    assert "confirmationRequired" not in payload


def test_non_guarded_tool_without_confirm_executes(
    capsys: pytest.CaptureFixture[str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls = _install_fake_runner(monkeypatch)

    payload = _call(
        capsys,
        skill="math",
        tool="add",
        params=json.dumps({"a": 2, "b": 3}),
        confirm=False,
    )

    assert len(calls) == 1
    assert calls[0]["skill"] == "math"
    assert calls[0]["tool"] == "add"
    assert payload["confirmed"] is False
    assert "confirmationRequired" not in payload


def test_guarded_tools_env_is_additive_and_cannot_weaken_defaults(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    assert r_bridge._is_guarded("email", "send_email") is True

    # The env var only ADDS tools to confirm; defaults always stay guarded.
    monkeypatch.setenv("R_BRIDGE_GUARDED_TOOLS", "math.add, custom.run")
    assert r_bridge._is_guarded("math", "add") is True
    assert r_bridge._is_guarded("custom", "run") is True
    assert r_bridge._is_guarded("email", "send_email") is True

    # An empty value must not disable the gate.
    monkeypatch.setenv("R_BRIDGE_GUARDED_TOOLS", "")
    assert r_bridge._is_guarded("email", "send_email") is True
