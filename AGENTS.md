# Magazoo workspace instructions

Read `CLAUDE.md` before making implementation changes. Preserve unrelated user changes and follow its layout constraints. This workspace shares one source tree with the user.

## GitHub publishing

The intended source repository is `https://github.com/rabieomar92/magazoo.git`, branch `main`.

Implement requested changes, verify them, and make the result reviewable. Commit and push only after the user explicitly says to push/upload the source to GitHub. The standing preference is that an approved push also creates the necessary source commit automatically; do not ask for a second confirmation after a clear push instruction.

Use `scripts/publish-source.ps1` with a descriptive conventional commit message for approved publishing. Use its `-DryRun` mode to review the candidate list without writes. Read `GITHUB_WORKFLOW.md` for the workflow. Do not bypass the helper with `git add .`, `git add -A`, a force push, an automatic watcher or a scheduled publishing task.

Publish only application source and assets clearly belonging to the application. Never stage `.env`, credentials, article data, databases, archives, local previews, generated bundles, screenshots, dependencies or unrelated files. The helper uses an explicit source whitelist. The local `.github/` deployment workflow is excluded; adding or changing hosting/deployment requires a separate explicit user request.

The existing remote tracks an older `.env`. The user explicitly wants to retain the current admin password and deployment configuration. Leave the existing tracked `.env` unchanged on source pushes; never stage local changes to it or print its values. Do not remove its tracking, rewrite history or rotate the password unless separately requested. The helper's optional `-RemoveTrackedEnv` is only for a later explicitly requested migration after the host's configuration has been preserved outside Git; it removes tracking while keeping the local file.

Do not guess the user’s Git commit identity, expose secrets, embed a token in a remote URL, or silently discard changes. Use Git Credential Manager for GitHub authentication. If a push fails, preserve the local commit and report the cause. If GitHub contains newer commits, inspect and merge safely while preserving user edits; do not force push.
