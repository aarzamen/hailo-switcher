# CLAUDE.md — Project Rules for Claude Code

## Environment
- This runs on Raspberry Pi 5 (aarch64) with Hailo-8 NPU
- User is `ama`, home dir `/home/ama`
- Always use `python3`, never `python`
- Package manager: `bun` (fallback: npm)
- Rust toolchain via rustup

## Build & Run
- Dev: `bun run tauri dev`
- Build: `bun run tauri build`
- Run binary: `WEBKIT_DISABLE_DMABUF_RENDERER=1 ./src-tauri/target/release/hailo-switcher`
- Frontend only: `bun run dev` (port 1420)

## Architecture
- Frontend: React 18 + TypeScript + Zustand + Tailwind CSS 4 (CSS-first, no JS config)
- Backend: Rust (Tauri 2.x) with tokio async runtime
- IPC: Tauri commands (frontend->backend) and events (backend->frontend)
- Process management: Child processes in own process groups, SIGTERM then SIGKILL

## Conventions
- Path alias: `@/` maps to `./src/`
- State: Zustand stores in `src/stores/` — pipelineStore, detectionStore, captureStore
- Theming: CSS variables in `src/themes/*.css`, selected via class on `<html>`
- Components: Functional React with hooks, no class components except ErrorBoundary
- Rust: Commands in `src-tauri/src/commands/`, one file per domain
- Config: All paths loaded from env vars with defaults in `src-tauri/src/config.rs`
- Video sources: `VideoSource` enum (Device/File/Screen/Stream/Demo) in `video_sources.rs`

## Testing
- Button audit: `bunx tsx tests/button-audit.ts` (Playwright click-test of every UI element)
- Visual verification: `bun run verify` (Playwright screenshot walkthrough)
- Sprint 3 verification: `bunx tsx tests/sprint3-verify.ts` (detections, streaming, errors)
- Manual testing: Start app, select pipeline, verify logs stream, stop pipeline
- Verify Hailo detection: `hailortcli fw-control identify`

## Tauri UI Testing Rule (ARM64 WebKitGTK)

WebKitGTK on ARM Linux has known issues with click event propagation,
hover states, and small touch targets. EVERY interactive UI element
must be Playwright-tested before a sprint is considered complete.

If Playwright cannot click a button and observe a state change,
the button is broken — regardless of whether it works in dev tools.

Minimum test per element:
1. Element is visible (not obscured, not zero-size)
2. Click produces observable change (class toggle, new element, state update)
3. Screenshot before and after for proof

This rule is non-negotiable. Do not ship UI without Playwright proof.

## Known Constraints
- Pipelines open their own X11/Wayland windows for video output (GStreamer handles display)
- `WEBKIT_DISABLE_DMABUF_RENDERER=1` may be needed for WebKitGTK on some Pi configs
- NPU needs ~2 second cooldown between pipeline switches
- rpicam-apps pipelines require Pi Camera Module (CSI) — other sources work with Python pipelines only
- YouTube streaming requires `yt-dlp` installed (`pip install yt-dlp`)
- Screen capture via v4l2loopback requires `sudo modprobe v4l2loopback`
- CSP is set — inline scripts won't work, all scripts must be bundled
