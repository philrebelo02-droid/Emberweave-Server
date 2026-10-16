"""Shared helpers for the art-integration pipeline (tools/integrate_hero.py, tools/integrate_fx.py).

Paths, the hero config, frame specs, sha256, JSON in/out, CRLF-safe page edits and the run log.
Every number a stage measures goes into <work>/run.json so the next stage (and the proof) reads it back.
"""
import hashlib
import json
import math
import os
import re
import subprocess
import sys
import time

ARCHIVE = os.environ.get('EW_ARCHIVE', r'C:\Users\Home\OneDrive\Desktop\Emberweave Archive')
PIPELINE_TOOLS = os.path.join(ARCHIVE, 'Pipeline tools')          # cs10.py lives here (the shared keyer)
GAME_ART = os.path.join(ARCHIVE, 'Game Art')
REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
GPU_LOCK = os.environ.get('EW_GPU_LOCK', 'C:/Emberweave/tools/gpu_lock.sh')
NODE_PATH = os.environ.get('EW_NODE_PATH', r'C:\Users\Home\Downloads\Emberweave-Server\node_modules')

LIMIT = 2048            # v1140 phone budget: a sheet is never wider or taller than this
FILE_MAX = 4_000_000    # v1140: a sheet file is never over 4 MB
CLK = 0.6724            # fight seconds per real second at x1 (FX_RT); the engine's clock, used for contact cells

# the slot names ChatGPT / Grok write in clean-source-manifest.json -> BATTLE_ANIM state names
SLOT_STATES = [
    (r'\b0?3b\b|attack ?b\b|opposite', 'attackB'),
    (r'\bidle\b', 'idle'), (r'\bwalk\b', 'walk'), (r'\bcrit', 'crit'), (r'\battack\b', 'attack'), (r'\bhit\b', 'hit'),
    (r'\bgreen\b', 'green'), (r'\bblue\b', 'blue'), (r'\bult(imate)?\b', 'ult'), (r'\bpassive\b', 'passive'),
]


def slot_state(slot):
    s = slot.lower()
    for pat, st in SLOT_STATES:
        if re.search(pat, s):
            return st
    return None


def sha256(path, chunk=1 << 20):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        while True:
            b = f.read(chunk)
            if not b:
                break
            h.update(b)
    return h.hexdigest()


def load_json(p, default=None):
    if not os.path.exists(p):
        return default
    with open(p, encoding='utf-8') as f:
        return json.load(f)


def save_json(p, obj):
    os.makedirs(os.path.dirname(p) or '.', exist_ok=True)
    tmp = p + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump(obj, f, indent=1)
    os.replace(tmp, p)


def parse_spec(spec):
    """'0:50:2,51,52x3' -> frame list (comma list; a:b[:step] ranges; xN repeats) - the cut tools' own spec."""
    if isinstance(spec, list):
        return [int(v) for v in spec]
    frames = []
    for part in str(spec).split(','):
        rep_n = 1
        if 'x' in part:
            part, rep_n = part.split('x')
            rep_n = int(rep_n)
        if ':' in part:
            a, b, c = (part.split(':') + ['1'])[:3]
            frames += list(range(int(a), int(b), int(c))) * rep_n
        else:
            frames += [int(part)] * rep_n
    return frames


def lin(a, b, k):
    """k source frames spread evenly from a to b inclusive (the r() of every specs_*.py)."""
    return [round(a + (b - a) * i / (k - 1)) for i in range(k)] if k > 1 else [a]


def num(v):
    """A BATTLE_ANIM number as the page writes it: an integer bare, else repr rounded to 6 places."""
    return ('%d' % v) if float(v) == int(v) else repr(round(float(v), 6))


class Config:
    """The hero config (tools/integrate/heroes/<hero>_<ver>.json). Only `hero`, `version` and the review folder are required;
    everything else has the default the last week's releases used."""

    def __init__(self, path):
        self.path = os.path.abspath(path)
        self.d = load_json(path)
        d = self.d
        self.hero = d['hero']
        self.name = d.get('name', self.hero.capitalize())
        self.archive_dir = d.get('archiveDir', self.name)
        self.version = str(d['version'])
        self.review = d.get('review')
        self.hero_dir = os.path.join(GAME_ART, 'Heroes', self.archive_dir)
        self.review_dir = d.get('reviewDir') or os.path.join(self.hero_dir, 'clips', self.review)
        self.work = os.path.abspath(d.get('work') or os.path.join(os.environ.get('EW_INTEGRATE_WORK', r'C:\Users\Home\Downloads\ew-sweep\integrate'), '%s-%s' % (self.hero, self.version)))
        self.states = d.get('states', {})
        self.key = d.get('key', {})
        self.order = d.get('order')

    def st(self, s):
        return self.states.get(s, {})

    def run_path(self):
        return os.path.join(self.work, 'run.json')

    def run(self):
        return load_json(self.run_path(), {})

    def save_run(self, r):
        save_json(self.run_path(), r)


def log(work, msg):
    line = time.strftime('%H:%M:%S ') + msg
    print(line, flush=True)
    os.makedirs(work, exist_ok=True)
    with open(os.path.join(work, 'pipeline.log'), 'a', encoding='utf-8') as f:
        f.write(line + '\n')


def node(args, cwd=REPO, timeout=1800):
    env = dict(os.environ)
    env.setdefault('NODE_PATH', NODE_PATH)
    return subprocess.run(['node'] + args, cwd=cwd, env=env, capture_output=True, text=True, encoding='utf-8', timeout=timeout)


def read_page(tree):
    with open(os.path.join(tree, 'emberweave-heroes.html'), encoding='utf-8', newline='') as f:
        return f.read()


def write_page(tree, s):
    with open(os.path.join(tree, 'emberweave-heroes.html'), 'w', encoding='utf-8', newline='') as f:
        f.write(s)


def replace_once(s, old, new, crlf=True):
    """Exact one-place edit; the page is CRLF, so '\\n' in old/new means CRLF (patch_hk.py's rep())."""
    if crlf:
        old = old.replace('\r\n', '\n').replace('\n', '\r\n')
        new = new.replace('\r\n', '\n').replace('\n', '\r\n')
    n = s.count(old)
    if n != 1:
        raise SystemExit('replace_once: %d matches for %r' % (n, old[:120]))
    return s.replace(old, new)


def isclose(a, b, tol=1e-9):
    return math.isclose(a, b, abs_tol=tol)


def die(msg):
    print('STOP: ' + msg, file=sys.stderr, flush=True)
    raise SystemExit(2)
