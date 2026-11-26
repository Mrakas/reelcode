"""Deterministic recorder: renders a single-file index.html to MP4 in headless Chromium by stepping a virtual clock.

Same settings as the paper: 10 fps, viewport = canvas size, seeded Math.random, network blocked except the local
server, three.js served at /vendor/three.module.js, Web Animations seeked to the frame time.
"""
from __future__ import annotations

import functools
import http.server
import os
import shutil
import socketserver
import subprocess
import tempfile
import threading
import time
from pathlib import Path

import numpy as np

VENDOR = Path(__file__).parent / "vendor"
SEEDED_RANDOM = ("(function(){var a=12345;Math.random=function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);"
                 "t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}})();")
FPS = 10


def ffprobe_dur(p) -> float:
    o = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(p)],
                       capture_output=True, text=True).stdout.strip()
    try:
        return float(o)
    except ValueError:
        return 0.0


def _thumbs(video, fps=5, size=(48, 27)):
    pr = subprocess.run(["ffmpeg", "-v", "error", "-i", str(video), "-vf", f"fps={fps},scale={size[0]}:{size[1]}",
                         "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True)
    a = np.frombuffer(pr.stdout, np.uint8)
    n = len(a) // (size[0] * size[1] * 3)
    return a[: n * size[0] * size[1] * 3].reshape(n, size[1], size[0], 3).astype(np.float32) / 255.0


def _launch(p):
    exe = os.environ.get("REELCODE_CHROMIUM")
    args = ["--no-sandbox", "--disable-dev-shm-usage", "--use-angle=swiftshader"]
    if exe:
        return p.chromium.launch(executable_path=exe, headless=True, args=args)
    try:
        return p.chromium.launch(headless=True, args=args)
    except Exception:  # no Playwright Chromium installed: fall back to a local Chrome
        return p.chromium.launch(channel="chrome", headless=True, args=args)


def render(page_dir, out_mp4, width: int, height: int, duration: float, fps: int = FPS, timeout: float | None = None) -> dict:
    """Render page_dir/index.html. Returns {status, error, secs, dur}; status is ok, blank_video, no_video,
    runtime_error or timeout. static_flag marks a video that barely moves (still counted as ok)."""
    from playwright.sync_api import sync_playwright

    timeout = timeout or (1200 if duration <= 70 else 1680)
    page_dir, out_mp4 = Path(page_dir).resolve(), Path(out_mp4).resolve()
    www = Path(tempfile.mkdtemp(prefix="reelcode_www_"))
    shutil.copytree(page_dir, www / "page", ignore=shutil.ignore_patterns("*.mp4", "frames*", "after", "before"))
    shutil.copytree(VENDOR, www / "vendor")
    handler = functools.partial(type("Q", (http.server.SimpleHTTPRequestHandler,), {"log_message": lambda *a: None}), directory=str(www))
    srv = socketserver.ThreadingTCPServer(("127.0.0.1", 0), handler)
    srv.daemon_threads = True
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    port = srv.server_address[1]
    base = f"http://127.0.0.1:{port}"
    t0, errs = time.time(), []
    try:
        with sync_playwright() as p:
            b = _launch(p)
            try:
                pg = b.new_page(viewport={"width": int(width), "height": int(height)})
                pg.set_default_timeout(60000)
                pg.on("pageerror", lambda e: errs.append(str(e)[:200]))
                pg.on("console", lambda m: errs.append(m.text[:200]) if m.type == "error" else None)
                pg.route("**/*", lambda r: r.continue_() if r.request.url.startswith((base, "data:", "blob:")) else r.abort())
                pg.add_init_script(SEEDED_RANDOM)
                pg.clock.install(time=0)
                pg.clock.pause_at(10)
                pg.goto(f"{base}/page/index.html", wait_until="load", timeout=30000)
                pg.clock.run_for(1)
                n = int(round(duration * fps))
                ff = subprocess.Popen(["ffmpeg", "-y", "-v", "error", "-f", "image2pipe", "-framerate", str(fps), "-vcodec", "mjpeg", "-i", "-",
                                       "-vf", "pad=ceil(iw/2)*2:ceil(ih/2)*2", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "fast",
                                       "-crf", "20", str(out_mp4)], stdin=subprocess.PIPE)
                for i in range(n):
                    if time.time() - t0 > timeout:
                        ff.stdin.close(); ff.kill()
                        return dict(status="timeout", error=f"render exceeded {timeout:.0f} s", secs=round(time.time() - t0, 1), dur=0)
                    pg.clock.run_for(int(round(1000.0 / fps)))
                    pg.evaluate("t=>document.getAnimations().forEach(a=>{try{a.pause();a.currentTime=t}catch(e){}})", (i + 1) * 1000.0 / fps)
                    ff.stdin.write(pg.screenshot(type="jpeg", quality=88, timeout=60000))
                ff.stdin.close(); ff.wait()
            except Exception as e:
                errs.append("EXC " + str(e)[:200])
                return dict(status="runtime_error", error="; ".join(errs)[:500], secs=round(time.time() - t0, 1), dur=0)
            finally:
                b.close()
    finally:
        srv.shutdown()
        shutil.rmtree(www, ignore_errors=True)
    if not out_mp4.exists() or out_mp4.stat().st_size < 1000:
        return dict(status="no_video", error="; ".join(errs)[:500], secs=round(time.time() - t0, 1), dur=0)
    th = _thumbs(out_mp4)
    status, static = "ok", False
    if len(th) < 2:
        status = "no_video"
    elif (th.reshape(len(th), -1).std(1) < 0.01).mean() > 0.95:
        status = "blank_video"
    elif (np.abs(np.diff(th, axis=0)).mean((1, 2, 3)) < 0.002).mean() > 0.95:
        static = True
    return dict(status=status, static_flag=static, error="; ".join(errs)[:500], secs=round(time.time() - t0, 1), dur=ffprobe_dur(out_mp4))


def extract_frames(video, outdir, times, names, long_side: int = 768) -> list[tuple[float, Path]]:
    """JPEG frames of video at the given times, saved under the given file names; returns [(t, path)] for frames that exist.
    A time past the end of the video takes the last frame."""
    outdir = Path(outdir); outdir.mkdir(parents=True, exist_ok=True)
    dur = ffprobe_dur(video)
    res = []
    for t, name in zip(times, names):
        p = outdir / name
        if not p.exists():
            tt = min(t, max(dur - 0.04, 0))
            subprocess.run(["ffmpeg", "-y", "-v", "error", "-ss", f"{tt:.3f}", "-i", str(video), "-frames:v", "1",
                            "-vf", f"scale='if(gt(iw,ih),{long_side},-2)':'if(gt(iw,ih),-2,{long_side})'", "-q:v", "3", str(p)])
        if p.exists():
            res.append((t, p))
    return res
