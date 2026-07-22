# zCADe Rebranding (2026-07-23)

## Changes Made

This document tracks the rebranding from **CADe-Simu Next** to **zCADe** as of July 23, 2026.

### Project Identity

| Aspect | Before | After |
|---|---|---|
| **Name** | CADe-Simu Next | zCADe |
| **Slogan** | (none) | The next-generation industrial schematics & simulation suite. |
| **File format** | `.cadesimu.json` | `.zcade` |
| **GitHub repo** | (not created) | `zcade` (to be created) |
| **Tauri identifier** | `com.opencade.cadesimu-next` | `com.zcade.app` |
| **Package name** | `cadesimu-next` | `zcade` |

### Files Updated

1. **`CLAUDE.md`** — Project overview, historical context, all `.cadesimu.json` references → `.zcade`
2. **`COMPLETE_PROJECT_ROADMAP.md`** — All references to zCADe + file format updates
3. **`README.md`** — Title, description, roadmap links
4. **`package.json`** — `name` field updated to `zcade`
5. **`src-tauri/tauri.conf.json`** — `productName`, `identifier`, window title updated

### Action Items for Zuzo

1. **GitHub Repository Creation**
   - Create a new GitHub repository named `zcade`
   - Add description: "The next-generation industrial schematics & simulation suite"
   - License: MIT (pre-confirmed in brief, but finalize on GitHub)
   - Settings:
     - Enable GitHub Discussions (for community support)
     - Add topics: `cad`, `schematic`, `electrical`, `industrial`, `automation`, `education`, `open-source`
     - Set homepage to final project website URL (when ready, Phase F)

2. **Push This Repository**
   - Update local origin: `git remote set-url origin https://github.com/[username]/zcade.git`
   - Or create new origin and push with force if needed
   - Ensure all commits from Phase 1–3 (commits `68d7383` → `9f714b2`) are preserved

3. **Brand Assets (Future)**
   - Logo with "z" motif (Phase E: design pass)
   - Favicon (already exists as `icons/`; may refine for z aesthetic)
   - Social media assets (Phase F)

### Notes on the Name

The name **"zCADe"** carries multiple meanings:
- **"z"** signals a "final evolution" or "the complete chapter" — CADe SIMU → zCADe is the natural successor
- **Phonetically** pronounces as "zee-cade" (clear, memorable)
- **Acronym** reads as: industrial CAD Editor
- **Respects CADe SIMU's legacy** while signaling a complete modernization

### Consistency Across Phases

All future work (Phases A–F) must refer to **zCADe** and use the `.zcade` file format. The `COMPLETE_PROJECT_ROADMAP.md` has been updated as the single source of truth. Any new code, documentation, or UI strings must use the new branding.

---

**Approved by**: Zuzo (verbal approval, 2026-07-23)  
**Executed by**: Tech Lead Agent (Claude)  
**Status**: ✅ Complete (awaiting GitHub repo creation by Zuzo)
