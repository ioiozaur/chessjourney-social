"""Turn a rendered carousel into a vertical Reel / TikTok video.

    python3 tools/reel.py posts/2026-11-12-three-traps

Writes posts/<id>/reel.mp4: 1080 × 1920, 30 fps, H.264, a silent audio track
and an original generated soundtrack (ambient chord and a soft clock tick, nothing to license),
each slide held with a slow push-in.
"""
import subprocess, sys
from pathlib import Path

HOLD = 3.0        # seconds per slide; tip slides are dense
FIRST = 2.2       # the hook slide is read fast; keep it moving
LAST = 3.4        # give the closing poster time
PAPER = "0xF3F4F1"


def build(folder):
    folder = Path(folder)
    slides = sorted(folder.glob("[0-9][0-9].jpg"))
    if not slides:
        raise SystemExit(f"No slides in {folder}")
    inputs, chains = [], []
    for k, s in enumerate(slides):
        dur = FIRST if k == 0 else LAST if k == len(slides) - 1 else HOLD
        frames = round(dur * 30)
        inputs += ["-loop", "1", "-framerate", "30", "-t", f"{dur}", "-i", str(s)]
        # Slow push-in to 4% over the hold, then sit the 4:5 slide on a 9:16 paper background
        chains.append(
            f"[{k}:v]scale=2160:2700,zoompan=z='1+0.04*on/{frames}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'"
            f":d=1:s=1080x1350:fps=30,pad=1080:1920:0:220:color={PAPER},setsar=1,format=yuv420p[v{k}]")
    concat = "".join(f"[v{k}]" for k in range(len(slides))) + f"concat=n={len(slides)}:v=1:a=0[v]"
    total = FIRST + LAST + HOLD * (len(slides) - 2)
    tmp = folder / "reel.tmp.mp4"
    # Original soundtrack, generated here so there is nothing to license: a quiet A-minor pad that
    # breathes slowly, with a soft chess-clock tick once a second. Fades in and out.
    pad = ("0.06*sin(2*PI*110*t)+0.05*sin(2*PI*164.81*t)+0.045*sin(2*PI*220*t)+0.035*sin(2*PI*261.63*t)+0.03*sin(2*PI*329.63*t)")
    breath = "(0.75+0.25*sin(2*PI*t/6))"
    tick = "0.22*sin(2*PI*1800*t)*exp(-90*mod(t,1))*lt(mod(t,1),0.06)"
    audio = (f"aevalsrc='({pad})*{breath}+{tick}|({pad})*{breath}+{tick}':s=44100:d={total},"
             f"lowpass=f=3500,afade=t=in:d=1.2,afade=t=out:st={total - 1.5}:d=1.5,volume=1.5")
    cmd = ["ffmpeg", "-v", "error", "-y", *inputs, "-f", "lavfi", "-i", audio,
           "-filter_complex", ";".join(chains + [concat]),
           "-map", "[v]", "-map", f"{len(slides)}:a", "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
           "-r", "30", "-g", "30", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k", "-shortest",
           "-movflags", "+faststart", str(tmp)]
    subprocess.run(cmd, check=True)
    tmp.replace(folder / "reel.mp4")
    print(folder / "reel.mp4")


if __name__ == "__main__":
    for f in sys.argv[1:]:
        build(f)
