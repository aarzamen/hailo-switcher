# Contributing

Contributions are welcome! Here's how to get started.

## Development Setup

1. Install prerequisites (see [README.md](README.md#prerequisites))
2. Clone the repo and install dependencies:
   ```bash
   git clone https://github.com/aarzamen/hailo-switcher.git
   cd hailo-switcher
   bun install
   ```
3. Run in dev mode:
   ```bash
   bun run tauri dev
   ```

## Project Structure

- `src/` - React + TypeScript frontend
- `src-tauri/` - Rust backend (Tauri 2.x)
- `src/themes/` - CSS theme definitions
- `src/data/pipelines.ts` - Pipeline registry (add new pipelines here)
- `src-tauri/src/video_sources.rs` - Unified video source enum and GStreamer resolution
- `src-tauri/src/process_manager.rs` - Core process spawning logic
- `tests/` - Playwright UI verification scripts

## Adding a New Pipeline

1. Add a `PipelineDefinition` entry in `src/data/pipelines.ts`
2. If it needs a new category, add it to `CATEGORIES` in the same file
3. For Python pipelines: ensure the script exists in `hailo-rpi5-examples/basic_pipelines/`
4. For rpicam pipelines: ensure the JSON config exists in `/usr/share/rpi-camera-assets/`

Note: Pipelines no longer declare `supportedInputs`. All sources are available to all pipelines — the backend handles incompatibilities with clear error messages.

## Adding a New Video Source Type

1. Add a variant to the `VideoSource` enum in `src-tauri/src/video_sources.rs`
2. Implement `to_input_arg()` and `to_gst_source()` for the new variant
3. Add validation in `validate()` if the variant takes user-supplied paths
4. Add detection logic in `detect_sources()` in `src-tauri/src/commands/system.rs`
5. Update the fallback sources in `src/stores/pipelineStore.ts` (`refreshSources` catch block)

## Adding a New Theme

1. Create a CSS file in `src/themes/` defining all `--color-*` variables under a class selector
2. Register it in `src/themes/index.ts`

## Testing

Every UI change must be Playwright-verified before merging:

```bash
# Run the button audit — tests every clickable element
bunx tsx tests/button-audit.ts

# Run the visual verification — screenshot walkthrough
bun run verify
```

Both must pass with 0 failures. See `CLAUDE.md` for the full Tauri UI Testing Rule.

## Code Style

- TypeScript: Follow existing patterns, use functional React components
- Rust: Run `cargo fmt` before committing
- CSS: Use Tailwind utility classes with theme CSS variables
- All interactive elements: min 32px touch target, `cursor-pointer`, semantic `<button>` elements

## Submitting Changes

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Make your changes
4. Run Playwright tests (`bunx tsx tests/button-audit.ts && bun run verify`)
5. Test on a Pi 5 with Hailo hardware if possible
6. Open a pull request
