# Obsidian AI Terminal - Installation Guide

## 1. Local Installation (Immediate Use)
To use this plugin purely locally without GitHub:
1. Copy the `obsidian-ai-terminal` folder.
2. Paste it into your Vault's plugin folder: `<Vault>/.obsidian/plugins/`.
3. Reload Obsidian.

## 2. BRAT Installation (Recommended for Updates)
To use **BRAT** (Beta Reviewers Auto-update Tester), you must host this code on GitHub.

### Steps:
1. **Create a GitHub Repository** (e.g., `my-ai-terminal`).
2. **Push** the contents of this folder to the repository.
   - Ensure `main.js`, `manifest.json`, `styles.css` are in the root or part of a Release.
   - *Note*: Standard BRAT usage often looks for **Releases**. You should create a GitHub Release and attach `main.js`, `manifest.json`, `styles.css` as assets.
3. **Install BRAT** in Obsidian (Community Plugins).
4. **Add Plugin in BRAT**:
   - Command: `BRAT: Add a beta plugin for testing`.
   - Enter your URL: `https://github.com/your-username/my-ai-terminal`.
5. **Done!** BRAT will now update the plugin whenever you push a new version/release.

## Development
- Build: `npm run build`
- Dev mode: `npm run dev`
