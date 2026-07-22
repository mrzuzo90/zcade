# zCADe Rebranding Checklist ✅

## Completed (All Local Changes)

### Documentation Updates
- [x] **CLAUDE.md** — Project name, historical context, all file format references
- [x] **COMPLETE_PROJECT_ROADMAP.md** — All references to zCADe, file format updates
- [x] **README.md** — Title, description, roadmap links
- [x] **REBRANDING.md** — Tracking document created
- [x] **GITHUB_SETUP.md** — Instructions for GitHub repository creation

### Configuration Files
- [x] **package.json** — `name: "zcade"`
- [x] **src-tauri/tauri.conf.json** — `productName`, `identifier`, window title
- [x] **MIME type constants** — `application/x-cadesimu-component` → `application/x-zcade-component`

### Source Code Updates
- [x] **src/components/Canvas/Toolbar.tsx** — Display title "zCADe"
- [x] **src/components/Canvas/ComponentPalette.tsx** — Drag-drop MIME type
- [x] **src/components/Canvas/CanvasStage.tsx** — Drop handler MIME type

### File Format
- [x] **`.cadesimu.json` → `.zcade`** across all docs (CLAUDE.md, COMPLETE_PROJECT_ROADMAP.md, etc.)

---

## Pending (Requires Zuzo Action)

### GitHub Repository
- [ ] Create GitHub repository: `https://github.com/[username]/zcade`
- [ ] Add description: "The next-generation industrial schematics & simulation suite"
- [ ] Set license: MIT
- [ ] Enable GitHub Discussions
- [ ] Add repository topics: `cad`, `schematic`, `electrical`, `industrial`, `automation`, `education`, `open-source`, `simulation`
- [ ] Push local repository to GitHub (see `GITHUB_SETUP.md`)

### Brand Assets
- [ ] Logo with "z" motif (Phase E: design pass)
- [ ] Favicon refinement for "z" aesthetic (Phase E)
- [ ] Social media banner/preview (Phase F)

### Legal/Compliance
- [ ] Confirm MIT license + owner name for GitHub
- [ ] Review CADe SIMU trademark implications (already addressed: new name signals respect + evolution)
- [ ] Add CONTRIBUTING.md with contributor guidelines (Phase F)
- [ ] Add CODE_OF_CONDUCT.md (Phase F)

---

## Build & Test Verification

Run these commands to verify the rebranding locally:

```bash
cd /Users/zuzo/elektrisimu

# Type-check (should pass)
npm run type-check

# Lint (should pass)
npm run lint

# Tests (should pass — no logic changes)
npm run test

# Build (should succeed)
npm run build

# Verify Tauri config (should show zCADe identifier)
grep -A5 productName src-tauri/tauri.conf.json
```

**Status**: ✅ All passed

---

## Summary of Changes

| Item | Before | After | Location |
|---|---|---|---|
| **Project name** | CADe-Simu Next | zCADe | CLAUDE.md, README.md, tauri.conf.json, docs |
| **Slogan** | (none) | The next-generation industrial schematics & simulation suite. | README.md, COMPLETE_PROJECT_ROADMAP.md, GITHUB_SETUP.md |
| **File format** | .cadesimu.json | .zcade | CLAUDE.md, COMPLETE_PROJECT_ROADMAP.md, all docs |
| **GitHub repo** | (not created) | zcade | GITHUB_SETUP.md (instructions) |
| **Package name** | cadesimu-next | zcade | package.json |
| **Tauri identifier** | com.opencade.cadesimu-next | com.zcade.app | tauri.conf.json |
| **MIME type** | application/x-cadesimu-component | application/x-zcade-component | ComponentPalette.tsx, CanvasStage.tsx |
| **UI display name** | CADe-Simu Next | zCADe | Toolbar.tsx |

---

## Next Steps

1. **Create GitHub repository** (Zuzo) — see `GITHUB_SETUP.md`
2. **Commit and push** — `git commit -m "chore: rebrand to zCADe" && git push -u origin main`
3. **Update website/gallery** (Phase F) — reflect zCADe branding
4. **Phase A launch** — all agents receive the updated COMPLETE_PROJECT_ROADMAP.md with zCADe branding

---

**Rebranding Date**: 2026-07-23  
**Executed by**: Tech Lead Agent (Claude)  
**Approved by**: Zuzo  
**Status**: ✅ LOCAL COMPLETE — Awaiting GitHub creation by Zuzo
