# v0.2.1 Release Notes

## New Features

### Network Camera Support (RPi4 → RPi5)
- **v4l2loopback bridge**: Stream a remote RPi camera over ethernet to `/dev/video10` via UDP RTP H.264
- **Helper script**: `./scripts/network-camera.sh start|stop|status` manages the GStreamer receiver and v4l2loopback module
- **Auto-discovery**: Network camera appears in the source picker automatically via `detect_sources()`
- **~150-250ms latency** over wired ethernet

### Native RTSP Input for Hailo Pipelines
- **Patched `get_source_type()`** in hailo-rpi5-examples to recognize `rtsp://` URLs
- **`SOURCE_PIPELINE()` RTSP support**: Uses `rtspsrc location=... latency=200 ! decodebin` for network streams
- **Patch file**: `patches/hailo-rtsp-support.patch` for re-applying after hailo-rpi5-examples updates
- Works with MediaMTX, IP cameras, or any RTSP source

### Pipeline Source Compatibility
- **rpicam source filter**: Non-CSI sources grayed out when an rpicam pipeline is selected, with "This pipeline requires Pi Camera Module" note
- **Pi Camera fix**: `picam-0` now sends `--input rpi` (was incorrectly hardcoded to `/dev/video0`)
- **Pi Camera detection fix**: Uses `rpicam-hello` instead of non-existent `libcamera-hello`

### Debug Logging
- Pipeline commands logged to stderr: exact program, args, and working directory
- Warning logged when no video source is provided (pipeline uses built-in default)
- Source received from frontend logged on every `start_pipeline` call

---

# v0.2.0 Release Notes

## New Features

### Detection & Inference Logging
- **Real-time detection parsing**: Automatically extracts object detections from YOLO pipeline stdout (`Detection: ID: {id} Label: {label} Confidence: {conf}`)
- **Live stats dashboard**: Total detections, unique track IDs, average confidence, detections/minute
- **Top labels view**: See most-detected object classes at a glance
- **Recent detections table**: Scrollable list with timestamp, ID, label, confidence
- **CSV/JSON export**: Export full detection log to `/tmp/` with timestamped filenames
- **New "Detections" sidebar section** with BarChart3 icon

### YouTube / RTSP Streaming Input
- **Stream source type**: New `Stream(String)` variant in VideoSource enum
- **URL input**: Enter YouTube URLs or RTSP addresses directly in the Input tab
- **yt-dlp integration**: YouTube URLs resolved via `yt-dlp -f best[height<=720] -g`
- **RTSP direct connect**: RTSP URLs passed through to GStreamer `rtspsrc`
- **URL validation**: Blocks shell metacharacters, requires http/https/rtsp scheme
- **Auto-detection**: Source picker shows "YouTube / RTSP Stream" when yt-dlp is installed, "RTSP Stream" otherwise

### Screen Capture Improvements
- **v4l2loopback detection**: Auto-detects virtual camera devices for screen capture → pipeline flow
- **Loopback device path**: Screen sources now populate `device_path` when v4l2loopback is available

### Hardening & Error Surfacing
- **Content Security Policy**: Explicit CSP replacing the previous `null` (permissive) setting
- **Capture errors visible**: Screenshot/recording failures now display as clickable red text in the footer instead of silent `console.error`
- **Pipeline errors visible**: Backend pipeline errors surface in the same footer error area

## Build

```bash
bun install
bun run tauri build
```

Produces `src-tauri/target/release/bundle/deb/Hailo Switcher_0.2.0_arm64.deb`

## Testing

```bash
# Existing tests
bunx tsx tests/button-audit.ts
bun run verify

# Sprint 3 tests
bunx tsx tests/sprint3-verify.ts
```
