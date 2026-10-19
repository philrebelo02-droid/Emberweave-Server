"""VERIFY: the clean-source manifest is the only way art enters the game.

Every row must be a Phil PASS, an official Without Watermark export, 124 frames, and its SILENT twin must hash to the manifest's
silentSHA256 (the full-audio file to its sha256 too, when present). Rows that are not PASS, and any file in the review folder that no
PASS row names (the rejected takes), are listed and never used. One PASS row per state; a second needs the config to name its
creation id (`states.<st>.creation`).
"""
import os
import re
import subprocess

from .common import load_json, sha256, slot_state, log, die

def approved_status(status):
    """Accept explicit approval with historical notes, excluding unsettled approval."""
    label = ' '.join(str(status).split()).casefold()
    match = re.fullmatch(r'(?:phil\s+)?pass(?:\s+-\s+(.+)|\s+\d{1,2}[a-z]{3}\d{4})?', label)
    if not match:
        return False
    note = match.group(1) or ''
    return not re.search(r'\b(?:pending|not|revoked|superseded|rejected|unapproved|fail\w*|awaiting|withdrawn|unverified|hold|redo)\b', note)


def _resolve(review_dir, p):
    if not p:
        return None
    if os.path.exists(p):
        return p
    q = os.path.join(review_dir, os.path.basename(p.replace('\\', '/')))
    return q if os.path.exists(q) else None


def video_md5(path):
    """md5 of the video stream alone (stream copy): the silent twin must carry the same pictures as the export."""
    r = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-map', '0:v:0', '-c', 'copy', '-f', 'md5', '-'], capture_output=True, text=True)
    return r.stdout.strip().split('=')[-1] if r.returncode == 0 else None


def verify(cfg, check_streams=True):
    man_p = os.path.join(cfg.review_dir, 'clean-source-manifest.json')
    rows = load_json(man_p)
    if rows is None:
        die('no clean-source-manifest.json in ' + cfg.review_dir)
    if isinstance(rows, dict):
        rows = rows.get('rows') or rows.get('clips') or list(rows.values())
    states, rejected, problems = {}, [], []
    for e in rows:
        slot = e.get('slot', '')
        st = (cfg.d.get('slots') or {}).get(slot) or slot_state(slot)
        cid = str(e.get('creationId') or e.get('creation') or '')
        status = str(e.get('status', ''))
        if not approved_status(status):
            rejected.append(dict(slot=slot, status=status, creation=cid))
            continue
        if st is None:
            problems.append('slot %r maps to no state (add it to config "slots")' % slot)
            continue
        want = cfg.st(st).get('creation')
        if want and str(want) != cid:
            rejected.append(dict(slot=slot, status='PASS but not the config creation ' + str(want), creation=cid))
            continue
        if 'Without Watermark' not in str(e.get('export', '')):
            problems.append('%s: export %r is not the official Without Watermark' % (slot, e.get('export')))
        if e.get('frames') not in (124, None):
            problems.append('%s: %s frames (Hailuo H3 = 124)' % (slot, e.get('frames')))
        sp = _resolve(cfg.review_dir, e.get('silentPath'))
        if not sp:
            problems.append('%s: silent twin missing (%s)' % (slot, e.get('silentPath')))
            continue
        got = sha256(sp)
        if got != e.get('silentSHA256'):
            problems.append('%s: silent sha256 %s != manifest %s' % (slot, got[:12], str(e.get('silentSHA256'))[:12]))
        fp = _resolve(cfg.review_dir, e.get('path'))
        full_ok = None
        if fp and e.get('sha256'):
            full_ok = sha256(fp) == e['sha256']
            if not full_ok:
                problems.append('%s: export sha256 does not match the manifest' % slot)
        same_pictures = None
        if check_streams and fp:
            a, b = video_md5(sp), video_md5(fp)
            same_pictures = bool(a and a == b)
            if not same_pictures:
                problems.append('%s: the silent twin\'s video stream differs from the export\'s' % slot)
        if e.get('edgeContactFrames'):
            problems.append('%s: the figure touches the frame edge on %s' % (slot, e['edgeContactFrames'][:6]))
        if e.get('nonGreenBackgroundFrames'):
            problems.append('%s: non-green background frames %s' % (slot, e['nonGreenBackgroundFrames'][:6]))
        if st in states:
            problems.append('two PASS rows for %s (%s, %s): name one in config states.%s.creation' % (st, states[st]['creation'], cid, st))
            continue
        states[st] = dict(slot=slot, creation=cid, silent=sp, silentSHA256=got, export=fp, exportSHA256ok=full_ok, samePictures=same_pictures,
                          reference=e.get('reference'), status=status, frames=e.get('frames', 124))
    named = {os.path.basename(v['silent']) for v in states.values()} | {os.path.basename(v['export']) for v in states.values() if v['export']}
    unused = sorted(f for f in os.listdir(cfg.review_dir) if f.lower().endswith('.mp4') and f not in named)
    want_states = cfg.d.get('expectStates')
    if want_states and sorted(want_states) != sorted(states):
        problems.append('PASS states %s != config expectStates %s' % (sorted(states), sorted(want_states)))
    res = dict(manifest=man_p, manifestSHA256=sha256(man_p), states=states, rejected=rejected, unusedFiles=unused, problems=problems)
    for st, v in states.items():
        log(cfg.work, 'verify %-8s %s creation %s silent sha ok, export %s, pictures %s, ref %r' % (
            st, v['slot'], v['creation'], {True: 'sha ok', False: 'SHA BAD', None: '-'}[v['exportSHA256ok']],
            {True: 'same', False: 'DIFFER', None: '-'}[v['samePictures']], v['reference']))
    for p in problems:
        log(cfg.work, 'verify PROBLEM ' + p)
    if rejected:
        log(cfg.work, 'verify not used (not PASS / not the named take): ' + ', '.join('%s %s' % (r['slot'], r['creation']) for r in rejected))
    return res
