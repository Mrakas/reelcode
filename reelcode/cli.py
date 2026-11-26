"""Command line.

  python -m reelcode run   --solver gpt-5 --judges gpt-5 [--limit 5] [--clips a,b] [--workers 8]
  python -m reelcode score --solver gpt-5 --judges gpt-5

Model names are passed to an OpenAI-compatible API (OPENAI_API_KEY / OPENAI_BASE_URL). A judge can use its own endpoint:
  --judges "sonnet=claude-sonnet-4-5@https://api.anthropic.com/v1/"   (name=model@base_url; key from <NAME>_API_KEY)
"""
from __future__ import annotations

import argparse
import json
import os
import re
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from . import data as D
from . import pipeline as P
from . import scoring as S
from .llm import LLM


def _slug(s):
    return re.sub(r"[^A-Za-z0-9._-]+", "_", s)


def _judges(spec: str, max_tokens):
    out = {}
    for part in [x for x in spec.split(",") if x]:
        name, _, rest = part.rpartition("=") if "=" in part else (None, None, part)
        model, _, base = rest.partition("@")
        name = name or _slug(model)
        key = os.environ.get(f"{name.upper()}_API_KEY") if base else None
        out[name] = LLM(model, base_url=base or None, api_key=key, max_tokens=max_tokens)
    return out


def _pmap(label, fn, items, workers):
    with ThreadPoolExecutor(workers) as ex:
        for i, _ in enumerate(ex.map(fn, items), 1):
            if i % 10 == 0 or i == len(items):
                print(f"  {label} {i}/{len(items)}", flush=True)


def main(argv=None):
    ap = argparse.ArgumentParser(prog="reelcode")
    ap.add_argument("cmd", choices=["run", "score"])
    ap.add_argument("--solver", required=True, help="model name for the solver")
    ap.add_argument("--judges", default="", help="comma-separated judge models (see module doc)")
    ap.add_argument("--solver-base-url"); ap.add_argument("--max-tokens", type=int)
    ap.add_argument("--out", default="runs"); ap.add_argument("--data", help="local copy of the HF dataset (default: download)")
    ap.add_argument("--clips", help="comma-separated clip ids"); ap.add_argument("--limit", type=int)
    ap.add_argument("--stages", default="recon,edit,judge"); ap.add_argument("--workers", type=int, default=8)
    a = ap.parse_args(argv)

    clips, tasks = D.clips(a.data), D.tasks(a.data)
    ids = a.clips.split(",") if a.clips else sorted(clips)
    ids = ids[: a.limit] if a.limit else ids
    tids = [t for t, x in sorted(tasks.items()) if x["clip_id"] in set(ids)]
    out = Path(a.out) / _slug(a.solver)
    judges = _judges(a.judges, a.max_tokens)

    if a.cmd == "run":
        solver = LLM(a.solver, base_url=a.solver_base_url, max_tokens=a.max_tokens)
        st = a.stages.split(",")
        if "recon" in st:
            _pmap("reconstruction", lambda c: P.recon(solver, clips[c], out, a.data), ids, a.workers)
        if "edit" in st:
            _pmap("edit", lambda t: P.edit(solver, tasks[t], clips[tasks[t]["clip_id"]], out, a.data), tids, a.workers)
        if "judge" in st:
            for name, j in judges.items():
                _pmap(f"judge {name} recon", lambda c: P.judge_recon(j, clips[c], out, name, a.data), ids, a.workers)
                _pmap(f"judge {name} edit", lambda t: P.judge_edit(j, tasks[t], clips[tasks[t]["clip_id"]], out, name, a.data), tids, a.workers)

    # ---- score (always printed at the end of a run)
    names = list(judges) or sorted(p.name for p in (out / "judge").glob("*"))
    R, E = {}, {}
    for c in ids:
        g = P._load(out / "recon" / c / "gen.json") or {}
        if g.get("status") != P.OK:
            R[c] = None; continue
        R[c] = {}
        for n in names:
            j = P._load(out / "judge" / n / "recon" / f"{c}.json")
            R[c][n] = S.recon_score(j, {"items": clips[c]["rubric"]}) if j and "items" in j and not j.get("judge_fail") else None
    for t in tids:
        rec = P._load(out / "edit" / t / "record.json") or {}
        if rec.get("status") != P.OK:
            E[t] = None; continue
        E[t] = {}
        for n in names:
            j = P._load(out / "judge" / n / "edit" / f"{t}.json")
            E[t][n] = S.edit_score(rec, j, tasks[t]) if j and "changes" in j and not j.get("judge_fail") else None
    res = dict(solver=a.solver, judges=names, n_clips=len(ids), n_tasks=len(tids),
               recon=S.leaderboard_row(R, names, len(ids)), edit=S.leaderboard_row(E, names, len(tids)))
    (out / "scores.json").write_text(json.dumps(res, indent=1))
    print(json.dumps(res, indent=1))


if __name__ == "__main__":
    main()
