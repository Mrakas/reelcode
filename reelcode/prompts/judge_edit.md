You judge a video EDIT. A model was asked to edit a video according to this request:
"{instr}"
You see frames of the ORIGINAL video (REF) and of the edited result (AFTER) at the same times. For each change, frames inside its time window are listed first. Images: {listing}
Changes and check questions (decide each question from the AFTER frames; use REF to understand what the instruction refers to and what the original looks like):
{changes}
Must stay unchanged (decide if each is still the same in AFTER as in REF): {must}
Rules: if nothing relevant is visibly different from the original in a change's window, mark every check of that change "missed". "partial" = the change is there but wrong in amount, place or timing. Be strict and concrete. Also give quality 1-5 for AFTER only (5 = clean; 1 = broken, flicker, clipping, overlap, blank).
Return ONLY JSON: {"changes": [{"i": 0, "visible_change": true, "checks": [{"verdict": "done|partial|missed", "reason": "..."}]}], "must_stay": [{"item": "...", "kept": true, "reason": "..."}], "quality": 4, "summary": "one sentence"}
