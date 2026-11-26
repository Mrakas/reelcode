You judge how well a CANDIDATE video reproduces a REFERENCE video. Both are given as frames at the same timestamps (2 fps).
Reference frames: {ref_frames}
Candidate frames: {cand_frames}
Rubric (questions are about the CANDIDATE, decided by comparing with the reference): {rubric_json}
1. For every rubric item, answer pass (1) or fail (0) with a one-line reason.
   - Be strict: partial = fail.
   - Allow small timing offsets (±0.5 s) and small color or size differences that a viewer would not notice.
2. Give holistic scores from 1 to 5:
   - appearance: elements, colors, layout, text;
   - motion: paths, timing, order;
   - overall: would a viewer say it is the same video?;
   - quality: artifacts, clipping, flicker or broken rendering in the candidate itself.
Return only JSON: {"items": [{"id": "r1", "pass": 1, "reason": "..."}], "holistic": {"appearance": 4, "motion": 3, "overall": 3, "quality": 5}, "summary": "one sentence"}
