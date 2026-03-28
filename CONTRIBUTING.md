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
- `src-tauri/src/process_manager.rs` - Core process spawning logic

## Adding a New Pipeline

1. Add a `PipelineDefinition` entry in `src/data/pipelines.ts`
2. If it needs a new category, add it to `CATEGORIES` in the same file
3. For Python pipelines: ensure the script exists in `hailo-rpi5-examples/basic_pipelines/`
4. For rpicam pipelines: ensure the JSON config exists in `/usr/share/rpi-camera-assets/`

## Adding a New Theme

1. Create a CSS file in `src/themes/` defining all `--color-*` variables under a class selector
2. Register it in `src/themes/index.ts`

## Code Style

- TypeScript: Follow existing patterns, use functional React components
- Rust: Run `cargo fmt` before committing
- CSS: Use Tailwind utility classes with theme CSS variables

## Submitting Changes

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Make your changes
4. Test on a Pi 5 with Hailo hardware if possible
5. Open a pull request
