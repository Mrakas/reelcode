"""Dataset access. The data lives on Hugging Face (marcuskwan/ReelCodeBench); it is downloaded once into the HF cache."""
from __future__ import annotations

import json
import re
from functools import lru_cache
from pathlib import Path

HF_REPO = "marcuskwan/ReelCodeBench"
PROMPTS = Path(__file__).parent / "prompts"


@lru_cache(None)
def root(local: str | None = None) -> Path:
    if local:
        return Path(local)
    from huggingface_hub import snapshot_download
    return Path(snapshot_download(HF_REPO, repo_type="dataset"))


def _jsonl(p):
    return [json.loads(l) for l in open(p, encoding="utf-8") if l.strip()]


def clips(local: str | None = None) -> dict:
    return {x["clip_id"]: x for x in _jsonl(root(local) / "data/reconstruction.jsonl")}


def tasks(local: str | None = None) -> dict:
    return {x["task_id"]: x for x in _jsonl(root(local) / "data/edit.jsonl")}


def ref_frames(clip: dict, local: str | None = None) -> list[tuple[float, Path]]:
    """all reference frames (2 fps): what the solver sees"""
    return [(f["t"], root(local) / f["file"]) for f in clip["frames"]]


def judge_frames(clip: dict, local: str | None = None) -> list[tuple[float, Path]]:
    """reference frames shown to the reconstruction judge (at most 60)"""
    fr = ref_frames(clip, local)
    return [fr[i] for i in clip["judge_frame_indices"]]


def prompt(name: str, **kw) -> str:
    """fill {name} placeholders of prompts/<name>.md; other braces are left alone"""
    t = (PROMPTS / f"{name}.md").read_text(encoding="utf-8").rstrip("\n")
    return re.sub(r"\{(\w+)\}", lambda m: str(kw[m.group(1)]) if m.group(1) in kw else m.group(0), t)


def frame_list(frames, offset: int = 0) -> str:
    return "; ".join(f"image {offset + i + 1} = t {t:.2f}s" for i, (t, _) in enumerate(frames))
