"""ReelCodeBench scoring.

Reconstruction (per clip, per judge)
    DA = share of rubric weight in dimensions whose items ALL pass       (0-100)
    H  = mean of the four holistic scores mapped 1..5 -> 0..100          (0-100)
    S_recon = 0.5 * DA + 0.5 * H

Edit (per task, per judge; the judge sees original-video frames and edited frames)
    C = mean over changes of the mean check verdict (done 1, partial 0.5, missed 0);
        a change counts 0 if the judge saw no visible change or the pixel diff in its window is negligible
    K = share of must-stay items kept (1 if the task has none)
    Q = (quality - 1) / 4
    S_edit = 100 * sqrt(C * (0.5 * K + 0.5 * Q))

Leaderboard
    Per judge: mean over all 420 items; failed items (no code, render failure, ...) score 0.
    Per item with two judges: the two judge scores are averaged.
    Main score: mean over the judges (Sol 6.1 and Sonnet 5.5).
"""
from __future__ import annotations

import math
import statistics
from collections import defaultdict

HOLISTIC_KEYS = ("appearance", "motion", "overall", "quality")
VERDICT = {"done": 1.0, "partial": 0.5, "missed": 0.0}
_FAILED_EDIT = {"llm_fail", "no_change", "render_fail", "fail"}


def _passed(x) -> bool:
    return x in (1, True, "1")


# ---------------------------------------------------------------- reconstruction
def recon_parts(judgment: dict, rubric: dict) -> dict:
    """judgment: judge JSON ({"items": [{"id", "pass"}], "holistic": {...}}); rubric: the clip's rubric.json."""
    passed = {i["id"]: _passed(i.get("pass")) for i in judgment["items"]}
    weight, all_pass = defaultdict(float), defaultdict(lambda: True)
    for item in rubric["items"]:
        weight[item["dim"]] += float(item["weight"])
        all_pass[item["dim"]] = all_pass[item["dim"]] and passed.get(item["id"], False)
    total = sum(weight.values())
    da = 100 * sum(w for d, w in weight.items() if all_pass[d]) / total
    h = judgment["holistic"]
    hol = 100 * sum((float(h[k]) - 1) / 4 for k in HOLISTIC_KEYS) / len(HOLISTIC_KEYS)
    return {"DA": da, "H": hol, "dims": {d: 100.0 * all_pass[d] for d in weight}}


def recon_score(judgment: dict, rubric: dict) -> float:
    p = recon_parts(judgment, rubric)
    return 0.5 * p["DA"] + 0.5 * p["H"]


# ---------------------------------------------------------------- edit
def _visible(pix: dict | None) -> bool:
    """pixel-difference gate for one change window (pix computed between the edited and the unedited render)."""
    return pix is None or pix["mean_abs"] > 0.8 or pix["frac"] > 0.002


def edit_ckq(record: dict, judgment: dict, task: dict) -> tuple[float, float, float] | None:
    """record: the edit run record (status, dur_before, dur_after); judgment: judge JSON; task: the edit task.
    Returns (C, K, Q) in 0..1, or None when the edit counts as failed (score 0)."""
    if record.get("status") in _FAILED_EDIT or record.get("error"):
        return None
    db, da = record.get("dur_before") or 0, record.get("dur_after") or 0
    if db and not (0.5 * db <= da <= 2 * db):
        return None
    pix = judgment.get("pix")
    per_change = []
    for i, _ in enumerate(task["changes"]):
        jc = next((x for x in judgment["changes"] if x.get("i") == i), None)
        if jc is None and i < len(judgment["changes"]):
            jc = judgment["changes"][i]
        if jc is None:
            per_change.append(0.0)
            continue
        verdicts = [VERDICT.get(x.get("verdict"), 0.0) for x in jc.get("checks", [])] or [0.0]
        try:
            vis = bool(jc.get("visible_change")) and _visible(pix[i] if pix else None)
        except (IndexError, KeyError, TypeError):
            vis = bool(jc.get("visible_change"))
        per_change.append(statistics.mean(verdicts) if vis else 0.0)
    c = statistics.mean(per_change) if per_change else 0.0
    ms = judgment.get("must_stay") or []
    k = statistics.mean(1.0 if m.get("kept") else 0.0 for m in ms) if ms else 1.0
    q = (float(judgment.get("quality", 1)) - 1) / 4
    return c, k, q


def edit_score_from_ckq(ckq: tuple[float, float, float] | None) -> float:
    if ckq is None:
        return 0.0
    c, k, q = (max(x, 0.0) for x in ckq)
    return 100 * math.sqrt(c * (0.5 * k + 0.5 * q))


def edit_score(record: dict, judgment: dict, task: dict) -> float:
    return edit_score_from_ckq(edit_ckq(record, judgment, task))


# ---------------------------------------------------------------- aggregation
def item_score(per_judge: dict[str, float | None]) -> float | None:
    """average of the judges that produced a score for this item"""
    vals = [v for v in per_judge.values() if v is not None]
    return statistics.mean(vals) if vals else None


def leaderboard_row(items: dict[str, dict[str, float | None] | None], judges=("sol", "sonnet"), n_total: int = 420) -> dict:
    """items: item_id -> {judge: score} for scored items, or None for a failed item (counts 0).
    Items not present count 0 as well, so the denominator is always n_total."""
    per_judge = {}
    for j in judges:
        vals = []
        for v in items.values():
            if v is None:
                vals.append(0.0)
            elif v.get(j) is not None:
                vals.append(v[j])
            else:  # this judge is missing for the item: fall back to the other judge(s)
                other = item_score(v)
                vals.append(other if other is not None else 0.0)
        vals += [0.0] * (n_total - len(items))
        per_judge[j] = sum(vals) / n_total
    return {"main": statistics.mean(per_judge.values()), **per_judge, "fails": sum(1 for v in items.values() if v is None)}
