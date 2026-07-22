# GitHub Repository Setup for zCADe

This document provides step-by-step instructions to create and configure the zCADe repository on GitHub.

## Prerequisites

- GitHub account with permissions to create repositories
- Git installed locally
- SSH key configured for GitHub (or HTTPS credentials ready)
- Local zCADe repository already initialized (this directory)

## Step 1: Create the Repository on GitHub

1. Go to [GitHub New Repository](https://github.com/new)
2. Fill in the form:
   - **Repository name**: `zcade`
   - **Description**: `The next-generation industrial schematics & simulation suite.`
   - **Visibility**: Public
   - **Initialize repository**: No (we'll push our existing repo)
   - **Add .gitignore**: Already have one locally
   - **Add LICENSE**: Will add MIT after creation
   - **Add README**: Already have one locally

3. Click **Create repository**

## Step 2: Add License

1. On the repository page, click **Add file** → **Create new file**
2. Name it `LICENSE`
3. At the bottom, click **Choose a license template** and select **MIT License**
4. Modify the `[year]` and `[fullname]` fields:
   - Year: 2026
   - Name: Zuzo (or full legal name)
5. Commit the file with message: `chore: add MIT license`

## Step 3: Connect Local Repository to GitHub

In the local `elektrisimu` directory:

```bash
# Check current remote (should be empty or pointing to old location)
git remote -v

# Add new remote (choose one based on your GitHub setup)

# Option A: HTTPS (if you use HTTPS)
git remote add origin https://github.com/[YOUR_USERNAME]/zcade.git

# Option B: SSH (if you use SSH keys)
git remote add origin git@github.com:[YOUR_USERNAME]/zcade.git

# Verify
git remote -v
# Should show:
#   origin  https://github.com/[YOUR_USERNAME]/zcade.git (fetch)
#   origin  https://github.com/[YOUR_USERNAME]/zcade.git (push)
```

If an origin already exists and points to the wrong place, update it:

```bash
git remote set-url origin https://github.com/[YOUR_USERNAME]/zcade.git
```

## Step 4: Push the Repository

```bash
# Ensure all local changes are committed
git status
# Should show "nothing to commit, working tree clean"

# Push all branches and tags to GitHub
git push -u origin main

# Verify
git remote show origin
```

## Step 5: Configure GitHub Repository Settings

1. Go to your repository: `https://github.com/[YOUR_USERNAME]/zcade`
2. Click **Settings** (top-right, gear icon)

### General Settings
- **Default branch**: `main` (should already be set)
- **Branch protection rules**: (leave empty for now; can add in Phase F)

### Features
- ✅ **Discussions** — Enable (for community support; see COMPLETE_PROJECT_ROADMAP.md, Phase F)
- ✅ **Wiki** — Enable (optional; for extended documentation)
- ❌ **Projects** — Disable (use GitHub Issues/Discussions)
- ❌ **Packages** — Disable (not needed for V1.0)

### Code & Automation
- **Actions**: Allow (needed for CI/CD in Phase A)

### Collaborators & Teams
- Add team members as needed (Phase F: community maintainers)

## Step 6: Add Repository Topics

1. Go to the repository main page
2. Click the **About** gear icon (top-right)
3. Add topics (tags):
   - `cad`
   - `schematic`
   - `electrical`
   - `industrial`
   - `automation`
   - `education`
   - `open-source`
   - `simulation`
4. Save

## Step 7: Create Initial Issues (Optional)

Create placeholder GitHub Issues for Phase A gates and milestones (optional; can do in Phase A):

```
Title: Phase A Gate G-A: Editor Profesional
Milestone: v0.4.0-phaseA
Labels: phase-a, critical-path

Title: Phase B Gate G-B: PLC & Pneumatic Simulation
Milestone: v0.5.0-phaseB
Labels: phase-b, critical-path

... (etc. for all 6 phases)
```

## Step 8: Verify

```bash
# Clone the repository fresh to verify
cd /tmp
git clone https://github.com/[YOUR_USERNAME]/zcade.git
cd zcade
npm install
npm run type-check  # Should pass
git log --oneline | head -5  # Should show commits from Phase 1–3
```

## Next Steps

- Phase A Week 1: Set up GitHub Actions CI/CD pipeline (`COMPLETE_PROJECT_ROADMAP.md`, Phase A → CI)
- Phase F Week 10: Create release assets and configure auto-update feed (Phase F → Release Engineer)
- Post-release: Enable Discussions and create community channels

---

**Status**: Instructions ready  
**Ready when**: After Zuzo creates repository  
**Estimated time**: ~5 minutes for all steps
