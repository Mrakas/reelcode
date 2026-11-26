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

> The renderer, solver and evaluation scripts are being added to this repository. This section will be filled in with them.

```bash
# 1. Get the data
huggingface-cli download marcuskwan/ReelCodeBench --repo-type dataset --local-dir data/

# 2. Reconstruct and edit with your model   (coming soon)
# 3. Render and judge                        (coming soon)
```

## Repository layout

```
docs/        project homepage (served by GitHub Pages at mrakas.github.io/reelcode)
# coming soon: renderer, solvers, judges and evaluation scripts
```

## Prompts

The reconstruction, editing and judge prompts are listed in the paper appendix. Plain-text copies will be added to this repository together with the code.

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
