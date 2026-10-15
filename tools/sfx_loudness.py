"""Loudness + peak measurement for the combat sound build (v1138).

Metric (one method for every file): MAX MOMENTARY LOUDNESS, ITU-R BS.1770 K-weighting,
400 ms window, 10 ms hop, channels summed (LUFS). A file shorter than 400 ms is measured
padded with silence to 400 ms, so a short hit and a long bed are compared on the same window.
True peak = 4x oversampled sample peak (dBTP).
Impact peak = time of the maximum of a 10 ms RMS envelope (the loudest moment of the file).
"""
import json, subprocess, sys
import numpy as np
from scipy.signal import lfilter, resample_poly

SR = 48000
K1_B = [1.53512485958697, -2.69169618940638, 1.19839281085285]
K1_A = [1.0, -1.69065929318241, 0.73248077421585]
K2_B = [1.0, -2.0, 1.0]
K2_A = [1.0, -1.99004745483398, 0.99007225036621]


def decode(path, channels=None):
    """Decode any audio file to float32 [ch, n] at 48 kHz with ffmpeg."""
    probe = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'a:0', '-show_entries', 'stream=channels',
                            '-of', 'json', path], capture_output=True, text=True, check=True)
    ch = channels or int(json.loads(probe.stdout)['streams'][0]['channels'])
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-f', 'f32le', '-ac', str(ch), '-ar', str(SR), '-'],
                         capture_output=True, check=True).stdout
    x = np.frombuffer(raw, dtype='<f4').astype(np.float64)
    return x.reshape(-1, ch).T.copy()


def kweight(x):
    return np.stack([lfilter(K2_B, K2_A, lfilter(K1_B, K1_A, c)) for c in x])


def max_momentary(x):
    w = int(0.4 * SR); hop = int(0.01 * SR)
    y = kweight(x)
    if y.shape[1] < w:
        y = np.pad(y, ((0, 0), (0, w - y.shape[1])))
    p = (y ** 2).sum(axis=0)
    c = np.concatenate([[0.0], np.cumsum(p)])
    starts = np.arange(0, len(p) - w + 1, hop)
    ms = (c[starts + w] - c[starts]) / w
    m = ms.max()
    return -70.0 if m <= 0 else -0.691 + 10 * np.log10(m)


def true_peak_db(x):
    up = resample_poly(x, 4, 1, axis=1)
    pk = np.abs(up).max()
    return -120.0 if pk <= 0 else 20 * np.log10(pk)


def envelope(x, win_s=0.010):
    m = (x ** 2).mean(axis=0)
    w = max(1, int(win_s * SR))
    c = np.concatenate([[0.0], np.cumsum(m)])
    e = np.sqrt(np.maximum(0, (c[w:] - c[:-w]) / w))   # e[i] = RMS of samples i..i+w
    return e


def impact_peak(x):
    """Seconds from file start to the loudest 10 ms moment (centre of the window)."""
    e = envelope(x)
    return (int(np.argmax(e)) + 0.005 * SR) / SR


def peaks(x, rel_db=-9.0, min_gap_s=0.12):
    """All distinct loud moments (local maxima of a 20 ms envelope within rel_db of the max, min_gap_s apart)."""
    e = envelope(x, 0.020)
    if not len(e):
        return []
    thr = e.max() * 10 ** (rel_db / 20)
    gap = int(min_gap_s * SR)
    order = np.argsort(-e)
    picked = []
    for i in order:
        if e[i] < thr:
            break
        if all(abs(i - j) >= gap for j in picked):
            picked.append(int(i))
    return sorted((p + 0.010 * SR) / SR for p in picked)


def measure(path):
    x = decode(path)
    return {'lufs_m': round(max_momentary(x), 2), 'tp_db': round(true_peak_db(x), 2),
            'peak': round(impact_peak(x), 4), 'dur': round(x.shape[1] / SR, 4), 'channels': int(x.shape[0])}


if __name__ == '__main__':
    for p in sys.argv[1:]:
        print(json.dumps(dict(file=p, **measure(p))))
