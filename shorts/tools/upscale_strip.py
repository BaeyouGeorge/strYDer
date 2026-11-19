"""Crop the gameplay strip out of the phone edit, convert HDR (HLG) -> SDR, AI-upscale x4
(Real-ESRGAN general x4v3 via ONNX Runtime), resize to 2160 wide, and encode.

Usage: python3 upscale_strip.py input.mov model.onnx out.mp4 [--frames N]
"""
import subprocess
import sys
import time

import numpy as np
import onnxruntime as ort
from PIL import Image

SRC, MODEL, OUT = sys.argv[1:4]
LIMIT = int(sys.argv[sys.argv.index('--frames') + 1]) if '--frames' in sys.argv else None
CW, CH, CY = 720, 330, 475            # gameplay strip inside the 720x1280 phone edit
OW, OH = 2160, 990                    # 3x
FILTER = (f"crop={CW}:{CH}:0:{CY},"
          "zscale=t=linear:npl=203,format=gbrpf32le,zscale=p=bt709,tonemap=hable:desat=0,"
          "zscale=t=bt709:m=bt709:r=tv,format=yuv420p,eq=saturation=1.12:contrast=1.04,format=rgb24")

dec = subprocess.Popen(['ffmpeg', '-v', 'error', '-i', SRC, '-vf', FILTER, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'],
                       stdout=subprocess.PIPE)
enc = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{OW}x{OH}', '-r', '30',
                        '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', '11', '-pix_fmt', 'yuv420p',
                        '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', OUT], stdin=subprocess.PIPE)
so = ort.SessionOptions()
so.intra_op_num_threads = 4
sess = ort.InferenceSession(MODEL, so, providers=['CPUExecutionProvider'])

n, t0 = 0, time.time()
while True:
    buf = dec.stdout.read(CW * CH * 3)
    if len(buf) < CW * CH * 3 or (LIMIT and n >= LIMIT):
        break
    x = np.frombuffer(buf, np.uint8).reshape(CH, CW, 3).astype(np.float32) / 255
    y = sess.run(None, {'input': x.transpose(2, 0, 1)[None]})[0][0]
    up = Image.fromarray((np.clip(y.transpose(1, 2, 0), 0, 1) * 255 + 0.5).astype(np.uint8))
    enc.stdin.write(up.resize((OW, OH), Image.LANCZOS).tobytes())
    n += 1
    if n % 30 == 0:
        el = time.time() - t0
        print(f'frame {n}  {el / n:.2f}s/frame  elapsed {el / 60:.1f}min', flush=True)
enc.stdin.close()
enc.wait()
dec.kill()
print('done', n, 'frames', flush=True)
