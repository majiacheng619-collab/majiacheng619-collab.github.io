"""Native-rate narration assembly and restrained stereo mastering for the film.

The input is the newly synthesized, authorized dry narration. Each source range
is copied at its original speed. No words are rebuilt from the former film mix.
"""
from __future__ import annotations

from pathlib import Path
import json
import math
import re
import subprocess as sp
import tempfile

import numpy as np

SAMPLE_RATE = 48000


def _run(args):
    return sp.run(['ffmpeg', '-hide_banner', '-nostdin', '-y', *map(str, args)],
                  capture_output=True, check=True)


def _decode(path, channels):
    result = _run(['-v', 'error', '-i', path, '-ar', SAMPLE_RATE,
                   '-ac', channels, '-f', 'f32le', '-'])
    return np.frombuffer(result.stdout, dtype='<f4').reshape(-1, channels).copy()


def _measure(path):
    result = _run(['-nostats', '-i', path, '-af',
                   'loudnorm=I=-16:TP=-1.7:LRA=9:print_format=json',
                   '-f', 'null', '-'])
    matches = re.findall(r'\{\s*"input_i".*?\}', result.stderr.decode(), re.S)
    if not matches:
        raise RuntimeError('FFmpeg did not return an audio loudness measurement')
    data = json.loads(matches[-1])
    for key in ('input_i', 'input_tp', 'input_lra', 'input_thresh'):
        if not math.isfinite(float(data[key])):
            raise RuntimeError(f'Audio measurement is not finite: {key}')
    return data


def _duration(path):
    result = sp.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration',
                     '-of', 'default=noprint_wrappers=1:nokey=1', str(path)],
                    capture_output=True, text=True, check=True)
    return float(result.stdout.strip())


def _time(segment, kind):
    key = 'voice_' + kind
    return float(segment[key] if key in segment else segment[kind])


def mix_audio(source_path, segments, ambient_path, out_path, duration=60.0):
    """Write AAC audio and return its measured mastering report.

    segments is a sequence of mappings containing source_start/source_end in
    seconds and either start/end or voice_start/voice_end on the film timeline.
    Additional fields such as id are preserved only in the mastering report.
    The output is M4A/AAC at 48 kHz, 256 kbit/s. A JSON report is written beside
    it at ``out_path.with_suffix('.json')``. An invalid master raises an error.
    """
    source_path, ambient_path, out_path = map(Path, (source_path, ambient_path, out_path))
    if not source_path.is_file() or not ambient_path.is_file():
        raise FileNotFoundError('Narration or ambient source is missing')
    segments = list(segments)
    if not segments:
        raise ValueError('The narration schedule is empty')
    if duration <= 0:
        raise ValueError('Audio duration must be positive')
    sr = SAMPLE_RATE
    length = round(duration * sr)
    dry = _decode(source_path, 1)[:, 0]
    if not np.isfinite(dry).all():
        raise ValueError('Narration contains non-finite samples')
    voice = np.zeros(length, np.float32)
    active = np.zeros(length, np.float32)
    gains = []
    previous_end = 0.0
    for i, seg in enumerate(segments):
        a, b = float(seg['source_start']), float(seg['source_end'])
        start, end = _time(seg, 'start'), _time(seg, 'end')
        if a < 0 or b <= a or start < 0 or end > duration + .001:
            raise ValueError(f'Invalid source or timeline range in segment {i}')
        if start < previous_end - 1 / sr:
            raise ValueError(f'Narration overlaps in segment {i}')
        if abs((end - start) - (b - a)) > .003:
            raise ValueError(f'Segment {i} would require a voice rate change')
        first, last = round(a * sr), round(b * sr)
        if last > len(dry) + 1:
            raise ValueError(f'Narration source is too short for segment {i}')
        samples = dry[first:min(last, len(dry))].copy()
        if not len(samples):
            raise ValueError(f'Empty source range in segment {i}')
        rms = float(np.sqrt(np.mean(samples.astype(np.float64) ** 2)))
        peak = float(np.max(np.abs(samples)))
        if rms < 1e-6:
            raise ValueError(f'Silent narration segment {i}')
        gain = min(10 ** (-21 / 20) / rms, .72 / max(peak, 1e-8))
        samples *= gain
        fade = min(round(.010 * sr), len(samples) // 2)
        if fade:
            samples[:fade] *= np.linspace(0, 1, fade, dtype=np.float32)
            samples[-fade:] *= np.linspace(1, 0, fade, dtype=np.float32)
        offset = round(start * sr)
        if offset + len(samples) > length:
            raise ValueError(f'Narration extends beyond the film in segment {i}')
        voice[offset:offset + len(samples)] += samples
        # The bed falls before a phrase begins and returns after it finishes.
        left, right = max(0, offset - round(.18 * sr)), min(length, round(end * sr) + round(.25 * sr))
        envelope = np.ones(right - left, np.float32)
        pre, post = offset - left, right - round(end * sr)
        if pre:
            x = np.linspace(0, 1, pre, dtype=np.float32)
            envelope[:pre] = x * x * (3 - 2 * x)
        if post:
            x = np.linspace(1, 0, post, dtype=np.float32)
            envelope[-post:] = x * x * (3 - 2 * x)
        active[left:right] = np.maximum(active[left:right], envelope)
        gains.append({'id': seg.get('id', str(i)), 'source_start': a,
                      'source_end': b, 'start': start, 'end': end,
                      'gain_db': round(20 * math.log10(gain), 4),
                      'source_rms_dbfs': round(20 * math.log10(rms), 4)})
        previous_end = end

    bed = _decode(ambient_path, 2)
    if not np.isfinite(bed).all():
        raise ValueError('Ambient source contains non-finite samples')
    if len(bed) < length:
        bed = np.pad(bed, ((0, length - len(bed)), (0, 0)))
    bed = bed[:length].copy()
    bed_rms = float(np.sqrt(np.mean(bed.astype(np.float64) ** 2)))
    # Normalize only downward; the bed is a subtle spatial floor, not a lead.
    bed_ceiling = min(1.0, 10 ** (-34 / 20) / max(1e-9, bed_rms))
    clock = np.arange(length, dtype=np.float32) / sr
    fade = np.clip(clock / .8, 0, 1) * np.clip((duration - clock) / 2.2, 0, 1)
    bed_gain = (1.5 - .85 * active) * fade * bed_ceiling
    mixed = voice[:, None] + bed * bed_gain[:, None]
    notes = []
    # Sparse, barely audible tonal punctuation lives entirely between phrases.
    for i in (1, 3, 4, 6):
        if i + 1 >= len(segments):
            continue
        gap_a, gap_b = _time(segments[i], 'end'), _time(segments[i + 1], 'start')
        if gap_b - gap_a < .48:
            continue
        note_dur = .32
        note_start = (gap_a + gap_b - note_dur) / 2
        n = round(note_dur * sr)
        t = np.arange(n, dtype=np.float32) / sr
        envelope = np.sin(np.pi * np.arange(n, dtype=np.float32) / (n - 1)) ** 3
        note = (np.sin(2 * np.pi * 440 * t) + .25 * np.sin(2 * np.pi * 880 * t)) * envelope * .003
        at = round(note_start * sr)
        mixed[at:at+n] += note[:, None]
        notes.append({'start': round(note_start, 6), 'duration': note_dur,
                      'amplitude': .003})
    if float(np.max(np.abs(mixed))) >= .98:
        raise RuntimeError('Premaster unexpectedly approaches clipping')
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='film-master-', dir=out_path.parent) as tmp:
        tmp = Path(tmp)
        raw, premaster = tmp / 'assembled.f32', tmp / 'premaster.wav'
        mixed.astype('<f4').tofile(raw)
        _run(['-v', 'error', '-f', 'f32le', '-ar', sr, '-ac', 2, '-i', raw,
              '-af', 'highpass=f=65,lowpass=f=11200,'
              'equalizer=f=260:t=q:w=0.9:g=-0.65,'
              'equalizer=f=5600:t=q:w=0.8:g=-0.65',
              '-ar', sr, '-c:a', 'pcm_s24le', premaster])
        measured = _measure(premaster)
        normalize = ('loudnorm=I=-16:TP=-1.7:LRA=9:linear=true:'
                     f'measured_I={measured["input_i"]}:'
                     f'measured_TP={measured["input_tp"]}:'
                     f'measured_LRA={measured["input_lra"]}:'
                     f'measured_thresh={measured["input_thresh"]}:'
                     f'offset={measured["target_offset"]}:print_format=json')
        encoded = _run(['-i', premaster, '-af', normalize, '-ar', sr,
                        '-t', duration, '-ac', 2, '-c:a', 'aac', '-b:a', '256k',
                        '-movflags', '+faststart', out_path])
        norm_matches = re.findall(r'\{\s*"input_i".*?\}', encoded.stderr.decode(), re.S)
        norm_data = json.loads(norm_matches[-1]) if norm_matches else {}
    final = _measure(out_path)
    actual_duration = _duration(out_path)
    probe = sp.run(['ffprobe', '-v', 'error', '-select_streams', 'a:0',
                    '-show_entries', 'stream=codec_name,sample_rate,channels',
                    '-of', 'json', str(out_path)], capture_output=True, text=True, check=True)
    streams = json.loads(probe.stdout).get('streams', [])
    if (len(streams) != 1 or streams[0].get('codec_name') != 'aac'
            or int(streams[0].get('sample_rate', 0)) != sr
            or streams[0].get('channels') != 2):
        raise RuntimeError('Encoded audio is not 48 kHz stereo AAC')
    report = {'version': 3, 'sample_rate': sr, 'channels': 2,
              'new_dry_voice': True, 'voice_rate_changed': False,
              'voice_source': source_path.name,
              'duration_seconds': actual_duration,
              'last_sentence_end': _time(segments[-1], 'end'),
              'tail_seconds': duration - _time(segments[-1], 'end'),
              'segment_gains': gains, 'bed_gain_during_voice': .65,
              'bed_gain_between_phrases': 1.5,
              'bed_ceiling_gain': bed_ceiling, 'transition_notes': notes,
              'premaster': measured, 'normalization': norm_data,
              'encoded_final': final, 'encoded_stream': streams[0]}
    out_path.with_suffix('.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    if (abs(actual_duration - duration) > .025
            or abs(float(final['input_i']) + 16) > .7
            or float(final['input_tp']) > -1.1):
        raise RuntimeError('Encoded master failed duration, loudness or true-peak validation')
    print(f'Audio mastered: {final["input_i"]} LUFS, {final["input_tp"]} dBTP, '
          f'{actual_duration:.3f}s; native voice rate.', flush=True)
    return report
