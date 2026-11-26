You are an expert evaluator of code-rendered animations. Below are frames of a REFERENCE video ({duration} s, 2 fps): {frame_list}
Write a binary rubric to check whether another video reproduces this reference. Use 10–14 items.
Each item checks ONE visible fact:
- elements present and their appearance;
- layout and spatial relations;
- text strings;
- motion paths and easing;
- event order, with an approximate time window ("between ~2 s and ~3 s");
- camera;
- final state.
At least 3 items must be about motion or timing. Name elements concretely. No vague words (nice, smooth, similar).
Weights:
- 0.8–1.0: critical (without it a viewer would call it a different video);
- 0.4–0.7: important;
- 0.1–0.3: minor.
Dim meaning: text = text strings, fonts, typographic content; layout = which elements exist and where they are (position, size, spatial relation, camera framing); style = colors, shapes, texture, visual appearance; motion = movement paths, easing, transitions, camera moves; timing = event order, durations, time windows, final state at the end.
Return only JSON: {"items": [{"id": "r1", "question": "...", "weight": 0.9, "dim": "text|layout|style|motion|timing", "time": "2-3 s" or null}]}
