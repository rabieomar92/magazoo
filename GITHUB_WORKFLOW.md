# Publishing Magazoo source to GitHub

The workspace is connected to [rabieomar92/magazoo](https://github.com/rabieomar92/magazoo), on `main`. You no longer need to upload source files through the GitHub website.

The current source update includes hero-image previews on the admin article cards. Deploy both the rebuilt frontend and the complete `server/` folder for those previews: they use an authenticated server image endpoint. The earlier admin-library ZIP predates this follow-up. Pushing source to GitHub updates the repository; restarting or redeploying your website still follows the hosting setup described below.

After asking for a change, review it locally. When you want it online, tell Codex **“Push these changes to GitHub.”** Codex will run the publishing helper with a clear commit message. This is the approval to commit and push; routine edits do not publish anything by themselves.

You can also publish from PowerShell in this project folder:

```powershell
& .\scripts\publish-source.ps1 -Message 'fix: show hero images in article cards'
```

To see exactly which source files would be selected, without changing the repository or running tests:

```powershell
& .\scripts\publish-source.ps1 -Message 'fix: show hero images in article cards' -DryRun
```

The helper checks the repository, the `main` branch, the exact GitHub destination and your commit author. It checks for newer GitHub commits, runs the editor tests, server tests and production build, shows the source diff summary, then creates a commit and pushes it. It refuses unresolved merges, an existing staged selection, suspicious private files or tokens, unexpected changes during verification, and a remote branch that moved. It never force pushes or discards your files. A failed push leaves the local commit available for a retry.

Only application source under `src/`, `server/`, `public/`, the publishing helper, and the explicitly listed root source/configuration/documentation files are selected. Generated `dist/` bundles, `node_modules/`, temporary previews, screenshots, archives, databases, `.env` files and private configuration are excluded. Some older generated files already tracked on GitHub may still appear in ordinary `git status`; this helper does not publish changes to them.

The remote repository currently tracks an older `.env` containing a nonempty admin password hash. At your request, ordinary source pushes leave this existing file and the current admin password unchanged. Local `.env` changes are never staged or printed. The file remains in the repository and its history, as already discussed. This helper does not rotate your password or change the live server configuration. Removing the tracked file later requires a separate request after the host's environment settings have been preserved; the explicit `-RemoveTrackedEnv` switch then removes tracking while keeping the local file.

The existing local `.github/` deployment workflow is also excluded. Adding a new hosting deployment is a separate action. A host that is already configured to rebuild when GitHub `main` changes may still deploy a pushed source commit according to its existing configuration.

GitHub write access is not yet verified. The first push may open Git Credential Manager’s normal GitHub sign-in flow. Sign in there; never paste a password or access token into chat or put it in a repository file. If a credential prompt cannot be completed from Codex, run the same helper in your own PowerShell window. The source commit will be preserved if authentication fails.

If Git asks for an author, set the name and email you want shown on commits in this repository:

```powershell
git config user.name 'Your name'
git config user.email 'Your GitHub commit email'
```

Use your own details, or the private commit email shown in your GitHub settings. The helper does not guess or change your identity.

There is deliberately no background file watcher or scheduled push. Your explicit decision to push starts verification, commit and upload. The source tree changes already present in this workspace are included in the first approved source commit; review the dry-run list before that first push.

Secret detection checks common private-file names and token formats. Review new source and assets before publishing; these checks cannot recognize every possible secret or determine the contents of an arbitrary binary asset. Removing `.env` from current tracking does not remove secrets from older GitHub history.
