import argparse
import json
from pathlib import Path

import pytest

from scripts import r_bridge


def _make_draft(root: Path, name: str, *, sensitive: bool = False, implemented: bool = False) -> Path:
    draft = root / name
    permission_profile = {
        "readsFiles": True,
        "writesFiles": False,
        "networkAccess": False,
        "sensitive": sensitive,
        "defaultState": "blocked" if sensitive else "draft",
        "notes": ["Review before installation."],
    }
    manifest = {
        "name": name,
        "className": "ExampleSkill",
        "status": "draft",
        "createdAt": "2026-06-17T00:00:00+00:00",
        "request": "Create a reviewed test skill.",
        "permissionProfile": permission_profile,
        "files": ["README.md", "manifest.json", "skill.py", "tests/test_skill.py", "APPROVAL.md"],
    }
    draft.mkdir(parents=True)
    (draft / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    (draft / "README.md").write_text(f"# {name}\n", encoding="utf-8")
    (draft / "APPROVAL.md").write_text("# Approval Checklist\n", encoding="utf-8")
    skill_body = 'def run():\n    return "ok"\n' if implemented else 'def run():\n    raise NotImplementedError("draft")\n'
    (draft / "skill.py").write_text(skill_body, encoding="utf-8")
    (draft / "tests").mkdir()
    (draft / "tests" / "test_skill.py").write_text("def test_placeholder():\n    assert True\n", encoding="utf-8")
    return draft


def _call(capsys: pytest.CaptureFixture[str], func, **kwargs):
    func(argparse.Namespace(**kwargs))
    out = capsys.readouterr().out
    return json.loads(out)


def test_list_and_approval_require_implemented_skill(tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    output_dir = tmp_path / "skill-drafts"
    draft = _make_draft(output_dir, "skeleton")

    listed = _call(capsys, r_bridge.cmd_list_drafts, output_dir=str(output_dir))
    assert listed["drafts"][0]["name"] == "skeleton"
    assert listed["drafts"][0]["implemented"] is False
    assert listed["drafts"][0]["approved"] is False

    with pytest.raises(SystemExit, match="not implemented"):
        r_bridge.cmd_approve_draft(
            argparse.Namespace(name="skeleton", approver="Reviewer", output_dir=str(output_dir))
        )

    (draft / "skill.py").write_text('def run():\n    return "ok"\n', encoding="utf-8")
    approved = _call(
        capsys,
        r_bridge.cmd_approve_draft,
        name="skeleton",
        approver="Reviewer",
        output_dir=str(output_dir),
    )
    assert approved["ok"] is True
    assert approved["approval"]["approver"] == "Reviewer"
    assert (draft / ".approval.json").exists()

    inspected = _call(capsys, r_bridge.cmd_inspect_draft, name="skeleton", output_dir=str(output_dir))
    assert inspected["readiness"]["implemented"] is True
    assert inspected["readiness"]["approved"] is True
    assert inspected["readiness"]["installable"] is True


def test_install_refuses_without_approval(tmp_path: Path) -> None:
    output_dir = tmp_path / "skill-drafts"
    _make_draft(output_dir, "unapproved", implemented=True)

    with pytest.raises(SystemExit, match="not approved"):
        r_bridge.cmd_install_draft(
            argparse.Namespace(
                name="unapproved",
                output_dir=str(output_dir),
                allow_sensitive=False,
                force=False,
            )
        )


def test_install_refuses_sensitive_without_explicit_allowance(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    output_dir = tmp_path / "skill-drafts"
    _make_draft(output_dir, "sensitive_skill", sensitive=True, implemented=True)
    _call(
        capsys,
        r_bridge.cmd_approve_draft,
        name="sensitive_skill",
        approver="Reviewer",
        output_dir=str(output_dir),
    )

    with pytest.raises(SystemExit, match="sensitive permissions"):
        r_bridge.cmd_install_draft(
            argparse.Namespace(
                name="sensitive_skill",
                output_dir=str(output_dir),
                allow_sensitive=False,
                force=False,
            )
        )


def test_install_succeeds_copies_files_and_marks_manifest_installed(
    tmp_path: Path, capsys: pytest.CaptureFixture[str], monkeypatch: pytest.MonkeyPatch
) -> None:
    output_dir = tmp_path / "skill-drafts"
    installed_root = tmp_path / "installed-skills"
    monkeypatch.setenv("R_BRIDGE_INSTALLED_SKILLS", str(installed_root))
    draft = _make_draft(output_dir, "reviewed_skill", sensitive=True, implemented=True)
    _call(
        capsys,
        r_bridge.cmd_approve_draft,
        name="reviewed_skill",
        approver="Reviewer",
        output_dir=str(output_dir),
    )

    installed = _call(
        capsys,
        r_bridge.cmd_install_draft,
        name="reviewed_skill",
        output_dir=str(output_dir),
        allow_sensitive=True,
        force=False,
    )

    installed_path = Path(installed["installedPath"])
    assert installed["ok"] is True
    assert installed_path == installed_root / "reviewed_skill"
    assert (installed_path / "skill.py").read_text(encoding="utf-8") == (draft / "skill.py").read_text(
        encoding="utf-8"
    )
    assert (installed_path / "README.md").exists()
    assert (draft / ".installed.json").exists()

    draft_manifest = json.loads((draft / "manifest.json").read_text(encoding="utf-8"))
    installed_manifest = json.loads((installed_path / "manifest.json").read_text(encoding="utf-8"))
    assert draft_manifest["status"] == "installed"
    assert installed_manifest["status"] == "installed"
    assert draft_manifest["installedAt"] == installed_manifest["installedAt"]

    listed = _call(capsys, r_bridge.cmd_list_drafts, output_dir=str(output_dir))
    assert listed["drafts"][0]["installed"] is True
    assert (installed_path / ".installed.json").exists()


@pytest.mark.parametrize("evil_name", ["..", ".", "../escape", "a/b", "Up", "with space", ""])
def test_draft_name_rejects_path_traversal(tmp_path: Path, evil_name: str) -> None:
    output_dir = tmp_path / "skill-drafts"
    output_dir.mkdir()
    with pytest.raises(SystemExit):
        r_bridge.cmd_inspect_draft(
            argparse.Namespace(name=evil_name, output_dir=str(output_dir))
        )


def test_install_uses_approval_snapshot_for_sensitive_gate(
    tmp_path: Path, capsys: pytest.CaptureFixture[str], monkeypatch: pytest.MonkeyPatch
) -> None:
    # A draft approved while sensitive must stay gated even if manifest.json is
    # later edited to claim it is non-sensitive.
    output_dir = tmp_path / "skill-drafts"
    monkeypatch.setenv("R_BRIDGE_INSTALLED_SKILLS", str(tmp_path / "installed-skills"))
    draft = _make_draft(output_dir, "tampered", sensitive=True, implemented=True)
    _call(
        capsys,
        r_bridge.cmd_approve_draft,
        name="tampered",
        approver="Reviewer",
        output_dir=str(output_dir),
    )

    manifest = json.loads((draft / "manifest.json").read_text(encoding="utf-8"))
    manifest["permissionProfile"]["sensitive"] = False
    (draft / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")

    with pytest.raises(SystemExit, match="sensitive permissions"):
        r_bridge.cmd_install_draft(
            argparse.Namespace(
                name="tampered",
                output_dir=str(output_dir),
                allow_sensitive=False,
                force=False,
            )
        )
