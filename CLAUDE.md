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
- State: All app state in `src/stores/pipelineStore.ts` (Zustand)
- Theming: CSS variables in `src/themes/*.css`, selected via class on `<html>`
- Components: Functional React with hooks, no class components except ErrorBoundary
- Rust: Commands in `src-tauri/src/commands/`, one file per domain
- Config: All paths loaded from env vars with defaults in `src-tauri/src/config.rs`

## Testing
- No test framework currently configured
- Manual testing: Start app, select pipeline, verify logs stream, stop pipeline
- Verify Hailo detection: `hailortcli fw-control identify`
- Visual verification: `bun run verify` (Playwright-based screenshot walkthrough)

## Known Constraints
- Pipelines open their own X11/Wayland windows for video output (GStreamer handles display)
- `WEBKIT_DISABLE_DMABUF_RENDERER=1` may be needed for WebKitGTK on some Pi configs
- NPU needs ~2 second cooldown between pipeline switches
- rpicam-apps pipelines ONLY work with Pi Camera Module (CSI), not USB
