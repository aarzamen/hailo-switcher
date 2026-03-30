# Network Camera: RPi4 Camera Module 3 → RPi5 Hailo-8

**Date:** 2026-03-29
**Status:** Approved

## Problem

The RPi5's CSI ribbon connector is physically incompatible with the Camera Module 3 ribbon cable. The camera works on an RPi4. We need to stream the RPi4 camera feed over ethernet to the RPi5 for Hailo-8 NPU inference.

## Architecture

```
RPi4 (Camera Module 3)              RPi5 (Hailo-8 NPU)
┌──────────────────────┐            ┌─────────────────────────────┐
│ rpicam-vid            │            │ GStreamer UDP RTP receiver   │
│   → H.264 encode     │──UDP/RTP──→│   → H.264 decode            │
│   → RTP packetize    │   eth      │   → v4l2loopback /dev/video10│
│   → udpsink          │            │                             │
│                      │            │ detect_sources() finds it   │
│ (or MediaMTX RTSP    │            │ → appears in source picker  │
│  at :8554/cam)       │            │                             │
└──────────────────────┘            │ Also: native RTSP support   │
                                    │ via patched get_source_type()│
                                    └─────────────────────────────┘
```

## Components

### 1. RPi5: v4l2loopback kernel module

Install `v4l2loopback-dkms` so a network stream can be presented as `/dev/video10`. This makes it appear as a regular V4L2 camera device — all hailo pipelines work unmodified with `--input /dev/video10`.

**Dependencies:** `linux-headers-6.12.75+rpt-rpi-2712`, `v4l2loopback-dkms`

### 2. RPi5: GStreamer receiver script (`scripts/network-camera.sh`)

A helper script that:
- Loads v4l2loopback module if not loaded
- Starts a GStreamer pipeline: `udpsrc port=5000 ! rtph264depay ! h264parse ! avdec_h264 ! videoconvert ! v4l2sink device=/dev/video10`
- Supports start/stop/status subcommands
- Logs to stdout for debugging

### 3. RPi4: Sender commands (documented, not automated)

Two options documented for the user:

**Option A — rpicam-vid + GStreamer (lowest latency ~150-250ms):**
```
rpicam-vid -t 0 --width 1280 --height 720 --framerate 30 \
  --codec h264 --inline --bitrate 4000000 -o - | \
  gst-launch-1.0 fdsrc ! h264parse ! rtph264pay config-interval=1 pt=96 ! \
  udpsink host=<rpi5-ip> port=5000 sync=false
```

**Option B — MediaMTX RTSP server (~500-850ms):**
```
./mediamtx  # publishes rtsp://<rpi4-ip>:8554/cam
```

### 4. Hailo Python pipeline RTSP patch

4-line patch to `gstreamer_helper_pipelines.py`:
- `get_source_type()`: recognize `rtsp://` URLs
- `SOURCE_PIPELINE()`: use `rtspsrc location=... latency=200 ! decodebin`

Enables `python detection.py --input rtsp://<rpi4-ip>:8554/cam` directly.

### 5. Switcher integration

No UI changes needed:
- v4l2loopback device auto-discovered by `detect_sources()` as a device source
- RTSP URLs already supported via the "Stream" source in the UI
- The existing `VideoSource::Stream` + `to_gst_source()` already generates correct `rtspsrc` GStreamer elements

## Out of scope

- RPi4 setup automation (documented only)
- systemd services (user can create from the helper script)
- GoPro Max integration (not supported for live streaming)
- Auto-discovery of RPi4 (user provides IP)
