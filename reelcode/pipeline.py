"""The four benchmark stages. Every stage writes one JSON per item and skips items that are already done, so runs can be resumed.

runs/<solver>/recon/<clip_id>/      index.html, raw.txt, out.mp4, gen.json, frames/ (at the judge times)
runs/<solver>/edit/<task_id>/       before/ (own reconstruction), index.html, raw.txt, after.mp4, after/, record.json
runs/<solver>/judge/<judge>/recon/<clip_id>.json
runs/<solver>/judge/<judge>/edit/<task_id>.json
"""
from __future__ import annotations

import json
import shutil
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image

from . import data as D
from .llm import LLM, ask_json, extract_html
from .render import extract_frames, render

OK = "ok"


def _load(p):
    try:
        return json.loads(Path(p).read_text())
    except (OSError, ValueError):
        return None


def _dump(p, o):
    p = Path(p); p.parent.mkdir(parents=True, exist_ok=True)
    tmp = p.with_suffix(p.suffix + ".tmp"); tmp.write_text(json.dumps(o, ensure_ascii=False, indent=1)); tmp.replace(p)


# ---------------------------------------------------------------- reconstruction
def recon(llm: LLM, clip: dict, out: Path, local=None) -> dict:
    d = out / "recon" / clip["clip_id"]
    if (g := _load(d / "gen.json")):
        return g
    d.mkdir(parents=True, exist_ok=True)
    fr = D.ref_frames(clip, local)
    p = D.prompt("recon", n_frames=len(fr), duration=clip["duration_s"], width=clip["width"], height=clip["height"], fps=clip["fps"],
                 frame_list=D.frame_list(fr), RECORDER_CONTRACT=D.prompt("recorder_contract"), vendor_list=D.prompt("vendor_list"),
                 canvas_w=clip["width"], canvas_h=clip["height"])
    g = dict(clip_id=clip["clip_id"], model=llm.model)
    try:
        r = llm(p, [f for _, f in fr])
    except Exception as e:
        g.update(status="llm_fail", error=str(e)[:300]); _dump(d / "gen.json", g); return g
    (d / "raw.txt").write_text(r["text"])
    g.update(tok_in=r["tok_in"], tok_out=r["tok_out"], llm_secs=r["secs"], finish_reason=r["finish_reason"])
    html = extract_html(r["text"])
    if not html:
        g.update(status="extract_fail")
    else:
        (d / "index.html").write_text(html)
        rr = render(d, d / "out.mp4", clip["width"], clip["height"], clip["duration_s"])
        g.update(status=rr["status"], render_error=rr["error"], render_secs=rr["secs"], dur=rr["dur"], code_chars=len(html))
    _dump(d / "gen.json", g)
    return g


# ---------------------------------------------------------------- edit
def edit_times(task: dict, duration: float) -> list[float]:
    """8 evenly spaced times plus 6 inside each change window (padded by 0.5 s)"""
    ts = {round(duration * (i + .5) / 8, 1) for i in range(8)}
    for c in task["changes"]:
        s, e = c["window"]; s = max(0, s - .5); e = min(duration - .05, e + .5)
        ts |= {round(s + (e - s) * i / 5, 1) for i in range(6)}
    return sorted(x for x in ts if 0 <= x < duration)


def _tname(t):
    return f"t{t:06.1f}.jpg"


def edit(llm: LLM, task: dict, clip: dict, out: Path, local=None) -> dict:
    """edit the solver's OWN reconstruction (end-to-end setting)"""
    d = out / "edit" / task["task_id"]
    if (rec := _load(d / "record.json")):
        return rec
    rd = out / "recon" / clip["clip_id"]; g = _load(rd / "gen.json") or {}
    rec = dict(task_id=task["task_id"], clip_id=clip["clip_id"], model=llm.model)
    if g.get("status") != OK:
        rec.update(status="no_before", recon_status=g.get("status")); _dump(d / "record.json", rec); return rec
    d.mkdir(parents=True, exist_ok=True)
    ts = edit_times(task, clip["duration_s"])
    before = extract_frames(rd / "out.mp4", d / "before", ts, [_tname(t) for t in ts])
    rec["dur_before"] = g.get("dur")
    bf = before[::max(1, -(-len(before) // 16))]
    ref = D.ref_frames(clip, local); ref = ref[::max(1, -(-len(ref) // 16))]
    code = (rd / "index.html").read_text()
    p = D.prompt("edit", instr=task["instruction"]) + D.prompt("edit_inline_suffix", code=code)
    try:
        r = llm(p, [f for _, f in bf] + [f for _, f in ref])
    except Exception as e:
        rec.update(status="llm_fail", error=str(e)[:300]); _dump(d / "record.json", rec); return rec
    (d / "raw.txt").write_text(r["text"])
    rec.update(tok_in=r["tok_in"], tok_out=r["tok_out"], llm_secs=r["secs"])
    html = extract_html(r["text"])
    if not html:
        rec.update(status="llm_fail", error="extract_fail")
    elif html.strip() == code.strip():
        rec.update(status="no_change")
    else:
        work = Path(tempfile.mkdtemp(prefix="reelcode_edit_"))
        try:
            (work / "index.html").write_text(html)
            rr = render(work, d / "after.mp4", clip["width"], clip["height"], clip["duration_s"])
        finally:
            shutil.rmtree(work, ignore_errors=True)
        (d / "index.html").write_text(html)
        rec.update(render_status=rr["status"], render_error=rr["error"], dur_after=rr["dur"])
        if rr["status"] == OK:
            extract_frames(d / "after.mp4", d / "after", ts, [_tname(t) for t in ts])
            rec["status"] = OK
        else:
            rec["status"] = "render_fail"
    _dump(d / "record.json", rec)
    return rec


# ---------------------------------------------------------------- judges
def judge_recon(judge: LLM, clip: dict, out: Path, name: str, local=None) -> dict:
    p_out = out / "judge" / name / "recon" / f"{clip['clip_id']}.json"
    if (j := _load(p_out)):
        return j
    rd = out / "recon" / clip["clip_id"]; g = _load(rd / "gen.json") or {}
    if g.get("status") != OK:
        j = dict(failed=True, status=g.get("status")); _dump(p_out, j); return j
    fr = D.judge_frames(clip, local)
    cf = extract_frames(rd / "out.mp4", rd / "frames", [t for t, _ in fr], [f"f{i:02d}_t{t:05.2f}.jpg" for i, (t, _) in enumerate(fr)])
    rubric = {"items": clip["rubric"]}
    p = D.prompt("judge_recon", ref_frames=D.frame_list(fr), cand_frames=D.frame_list(cf, len(fr)), rubric_json=json.dumps(rubric))
    try:
        j = ask_json(judge, p, [f for _, f in fr] + [f for _, f in cf], check=lambda x: "items" in x and "holistic" in x)
    except Exception as e:
        j = dict(judge_fail=str(e)[:300])
    j["judge"] = judge.model
    _dump(p_out, j)
    return j


def _nearest_ref(clip, t, local=None):
    return min(D.ref_frames(clip, local), key=lambda x: abs(x[0] - t))[1]


def _diff_stats(bd: Path, ad: Path, win):
    """pixel change between the unedited and the edited render inside one change window"""
    a = []
    for f in sorted(bd.glob("t*.jpg")):
        t = float(f.stem[1:])
        if win[0] - .5 <= t <= win[1] + .5 and (ad / f.name).exists():
            x = np.asarray(Image.open(f).convert("L").resize((192, 108)), dtype=float)
            y = np.asarray(Image.open(ad / f.name).convert("L").resize((192, 108)), dtype=float)
            a.append((np.abs(x - y).mean(), (np.abs(x - y) > 12).mean()))
    return dict(mean_abs=round(float(np.mean([x for x, _ in a])), 3), frac=round(float(np.max([y for _, y in a])), 4)) if a else dict(mean_abs=0, frac=0)


def judge_edit(judge: LLM, task: dict, clip: dict, out: Path, name: str, local=None) -> dict:
    """REF+AFTER judge: frames of the ORIGINAL video next to the edited render"""
    p_out = out / "judge" / name / "edit" / f"{task['task_id']}.json"
    if (j := _load(p_out)):
        return j
    d = out / "edit" / task["task_id"]; rec = _load(d / "record.json") or {}
    if rec.get("status") != OK:
        j = dict(failed=True, status=rec.get("status")); _dump(p_out, j); return j
    bd, ad = d / "before", d / "after"
    src = bd if any(bd.glob("t*.jpg")) else ad
    imgs, listing, chs = [], [], []
    for i, c in enumerate(task["changes"]):
        s, e = c["window"]
        sel = [f for f in sorted(src.glob("t*.jpg")) if s - .5 <= float(f.stem[1:]) <= e + .5 and (ad / f.name).exists()]
        for f in sel[::max(1, -(-len(sel) // 5))]:
            imgs += [_nearest_ref(clip, float(f.stem[1:]), local), ad / f.name]; listing.append(f"change {i + 1} t={float(f.stem[1:]):.1f}s: REF then AFTER")
        chs.append(f"change {i + 1}: {c['desc']} (window {s:.1f}-{e:.1f} s)\n" + "\n".join(f"  - check: {q}" for q in c["checks"]))
    gl = [f for f in sorted(src.glob("t*.jpg")) if (ad / f.name).exists()]
    for f in gl[::max(1, len(gl) // 6)][:6]:
        imgs += [_nearest_ref(clip, float(f.stem[1:]), local), ad / f.name]; listing.append(f"global t={float(f.stem[1:]):.1f}s: REF then AFTER")
    p = D.prompt("judge_edit", instr=task["instruction"], listing="; ".join(listing), changes="\n".join(chs),
                 must="; ".join(m["item"] for m in task["must_stay"]))
    try:
        j = ask_json(judge, p, imgs[:60], check=lambda x: "changes" in x)
    except Exception as e:
        j = dict(judge_fail=str(e)[:300])
    j.update(judge=judge.model, pix=[_diff_stats(bd, ad, c["window"]) for c in task["changes"]])
    _dump(p_out, j)
    return j
