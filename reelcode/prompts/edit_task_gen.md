You are writing ONE edit request for a benchmark on code-based video editing. A model will see the BEFORE video (it never sees any source code) and must edit its own reconstruction. The request will be judged by looking at BEFORE vs AFTER videos.

Video: {dur} s. {SOURCE}
Frames (sampled): {FRAMES}

Slot (follow it; if impossible for this video, choose the closest feasible alternative and say so in "deviation"):
- {COMPOUND} distinct change(s) in ONE natural request.
- changes: {CHANGES}. Domains and sections: WHERE = position, size, anchor, crop, padding, clip, stacking, layout; WHEN = time placement, cycling, trim, entrance, sustained motion, exit, transitions, fades; HOW = text, typography, fill/stroke, image adjust, shadow, effect.
- reach: {REACH} (single = one parameter on one element; shared = a change that must propagate consistently to several elements; code = structural change such as adding, removing, reordering elements or animation).
- instruction_form {FORM}; grounding {GROUNDING}; intent {INTENT}.
- TIME REGIONS: each change must happen inside its assigned region of the video: {REGIONS}. Its window (2-8 s) lies inside that region, so the tasks cover the whole clip and not just the opening.

Hard quality rules (the previous batch broke these):
1. Realistic and colloquial: write what a real editor or client would say, in one or two short sentences, like "make the title bigger and let it come in half a second earlier". No spec-sheet wording, no pixel-exact numbers unless the request is naturally numeric (e.g. "twice as big", "move it 2 seconds earlier").
2. Natural tasks only. Never ask for unnatural things such as adding black padding around a full-screen scene, rotating or mirroring the whole video, adding a frame or watermark, or changes nobody would request.
3. Only salient elements that are clearly visible for at least 2 seconds and large enough to see; never depend on tiny or fine text.
4. Use ONLY terms a viewer can see (colours, positions, shapes, words on screen, times in seconds). NEVER use variable, layer, function, file, class or property names, or layer indexes.
5. The edit must be clearly visible in AFTER, and feasible by editing the code.

For each change give its own time window and 1-3 yes/no check questions answerable from the AFTER video. Add a must_stay list (2-4 items, each with a dimension 文字|布局位置|style|motion|时序|美学).
Return ONLY JSON: {"instruction_en": "...", "instruction_zh": "natural Chinese", "changes": [{"desc": "...", "domain": "where|when|how", "section": "...", "operation": "...", "window": [s, e], "checks": ["..."]}], "tags": {"reach": "...", "instruction_form": "...", "grounding": "...", "intent": "...", "compound_count": N}, "must_stay": [{"item": "...", "dim": "..."}], "feasibility": "one sentence (internal)", "deviation": "none or what changed"}
