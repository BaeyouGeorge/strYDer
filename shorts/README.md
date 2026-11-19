# STRYDER vertical 4K short

Gameplay clip in a branded 9:16 layout (2160x3840): glowing blurred logo background,
framed gameplay strip with a soft reflection, and the STRYDER banner at the bottom.

1. `python3 tools/make_layers.py layers/banner.png layers`: builds `bg.png`, `fg.png`, `refl_mask.png`
2. `python3 tools/esrgan_onnx.py realesr-general-x4v3.pth x4v3.onnx`: converts the Real-ESRGAN
   weights (github.com/xinntao/Real-ESRGAN releases) to ONNX, no PyTorch needed
3. `python3 tools/upscale_strip.py clip.mov x4v3.onnx strip_4k.mp4`: crops the gameplay strip
   (720x330 at y=475 in the phone edit), HDR->SDR, AI upscale to 2160x990
4. `./compose.sh strip_4k.mp4 clip.mov out_4k.mp4`: final 4K composite with the clip's audio

Needs: ffmpeg (with zscale), Python with numpy, Pillow, onnx, onnxruntime.
