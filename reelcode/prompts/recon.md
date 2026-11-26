You are given a short reference video as {n_frames} frames sampled at 2 fps (timestamps in the file names / list below).
Video facts: duration {duration} s, size {width}x{height}, source fps {fps}.
Frames: {frame_list}

Task: write code that reproduces this video as faithfully as possible: the same elements, appearance, layout, text, motion paths, event order and timing, and final state. You never see any original code; infer everything from the frames.

Output contract (must follow exactly, the video is recorded automatically):
{RECORDER_CONTRACT}
- ONE self-contained file index.html. Canvas size exactly {canvas_w}x{canvas_h}. Total duration exactly {duration} s.
- You may use HTML, CSS, SVG, Canvas 2D, WebGL, or three.js. Local libraries available (no network): {vendor_list}
- No external images, fonts or media. Approximate photos or footage with shapes, gradients and text.
- Animation must be a deterministic function of time (no Math.random without a fixed seed, no real-time clock).

Return only the complete index.html inside one ```html code block.
