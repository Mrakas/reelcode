# ReelCodeBench

**Can Frontier LLMs Edit What They Rebuild?**

[Homepage](https://mrakas.github.io/reelcode) · Paper (arXiv, coming soon) · [Dataset on Hugging Face](https://huggingface.co/datasets/marcuskwan/ReelCodeBench) · [Leaderboard](https://mrakas.github.io/reelcode/#leaderboard)

ReelCodeBench tests whether a model can rebuild a motion-graphics video as code from pixels alone, and then edit its own program on request.

- **Reconstruction.** The model sees only a reference video and writes a program (HTML, SVG, Canvas or Three.js) that renders the same video.
- **Editing.** The model receives a natural-language instruction and edits its own program. Each instruction holds one to three changes, labelled *Where* (spatial), *When* (temporal) or *How* (appearance).
- **Judging.** Vision-language judges score rendered frames against fixed checklists. Reconstruction uses rubric items plus holistic ratings (S<sub>recon</sub>). Editing uses completion, keep rate and quality (S<sub>edit</sub>).

The benchmark has 420 videos, from few-second clips to three-minute explainers, and 844 edit requirements.

## News

- **2026-11** Leaderboard updated with GPT-6.2 Sol, Qwen4 Max, HY4 and MiMo-V2.6-Pro (homepage only).
- **2026-11** Homepage and dataset released.

## Quick start

Requirements: Python 3.10+, `ffmpeg`, and Chromium for Playwright.

```bash
pip install -r requirements.txt
playwright install chromium        # or set REELCODE_CHROMIUM=/path/to/chrome; a local Google Chrome is used as a fallback
export OPENAI_API_KEY=sk-...       # any OpenAI-compatible endpoint works; set OPENAI_BASE_URL for others

# try 5 clips: reconstruct, edit, judge, score
python -m reelcode run --solver gpt-5 --judges gpt-5 --limit 5

# the full benchmark (420 clips, 420 edit tasks)
python -m reelcode run --solver gpt-5 --judges gpt-5 --workers 16
```

The dataset is downloaded from Hugging Face on first use (pass `--data <dir>` to use a local copy). Runs resume: every stage writes one JSON per item under `runs/<solver>/` and skips items that are already done. Scores are printed at the end and saved to `runs/<solver>/scores.json`; `python -m reelcode score --solver ... --judges ...` recomputes them.

Judges can use another endpoint: `--judges "sonnet=claude-sonnet-4-5@https://api.anthropic.com/v1/"` reads the key from `SONNET_API_KEY`. Several judges are separated by commas, and their scores are averaged. The paper used Sol 6.1 and Sonnet 5.5 as the two judges.

### What one run does

1. **Reconstruction.** The solver gets all reference frames (2 fps) and `prompts/recon.md`, and returns one `index.html`.
2. **Rendering.** `reelcode/render.py` records the page in headless Chromium by stepping a virtual clock at 10 fps, with the canvas size and duration of the clip, a seeded `Math.random`, and no network.
3. **Editing.** The solver gets its own `index.html`, frames of its own render and of the original video, and the edit instruction (`prompts/edit.md`). The edited page is rendered again.
4. **Judging.** The reconstruction judge compares candidate and reference frames against the clip's rubric (`prompts/judge_recon.md`). The edit judge sees original-video frames next to edited frames for each change window (`prompts/judge_edit.md`).
5. **Scoring** (`reelcode/scoring.py`): `S_recon = 0.5·DA + 0.5·H` and `S_edit = 100·sqrt(C·(0.5K + 0.5Q))`. Failed items count 0, and the denominators are always the number of items.

## Repository layout

```
reelcode/
  cli.py          python -m reelcode run / score
  pipeline.py     reconstruction, edit, and the two judges (one JSON per item, resumable)
  render.py       deterministic headless-Chromium recorder and frame extraction
  llm.py          OpenAI-compatible model calls
  data.py         dataset loading from Hugging Face, prompt filling
  scoring.py      S_recon, S_edit and leaderboard aggregation
  prompts/        the exact prompts used in the paper
  vendor/         three.js r170, served to pages at /vendor/three.module.js
docs/             project homepage (GitHub Pages)
```

## Prompts

All prompts are plain text in [`reelcode/prompts/`](reelcode/prompts): `recon.md` and `recorder_contract.md` for reconstruction, `edit.md` for editing, `judge_recon.md` and `judge_edit.md` for the judges, `rubric.md` for writing the reconstruction rubrics, and `edit_task_gen.md` for generating the edit tasks. The rubrics and edit tasks themselves are already in the dataset.

## Leaderboard

The live leaderboard is on the [homepage](https://mrakas.github.io/reelcode/#leaderboard). Scores follow the paper protocol: two judges (Sol 6.1 and Sonnet 5.5) averaged over 420 clips and 420 edit tasks, with failures counted as 0.

## Citation

```bibtex
@article{kwan2026reelcodebench,
  title   = {ReelCodeBench: Can Frontier LLMs Edit What They Rebuild?},
  author  = {Kwan, Hohin and Li, Hongyu and Yu, Hao and Tsai, Chi Hsu and
             Yang, Pei and Chen, Houyuan and Liu, Si and Rao, Anyi},
  journal = {arXiv preprint arXiv:XXXX.XXXXX},
  year    = {2026}
}
```
