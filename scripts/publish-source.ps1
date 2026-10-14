[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateNotNullOrEmpty()]
    [string]$Message,
    [switch]$DryRun,
    [switch]$RemoveTrackedEnv
)

$ErrorActionPreference = 'Stop'
$expectedRemote = 'https://github.com/rabieomar92/magazoo.git'
$expectedBranch = 'main'
$projectRoot = [IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot))
$rootFiles = @(
    '.gitignore', '.gitattributes', '.npmrc', '.oxlintrc.json',
    'package.json', 'package-lock.json', 'index.html',
    'tsconfig.json', 'tsconfig.app.json', 'tsconfig.node.json',
    'vite.config.ts', 'vitest.config.ts', 'vercel.json',
    'README.md', 'LICENSE', 'LICENSE.md', 'CLAUDE.md', 'AGENTS.md',
    'ARTICLE_LAYOUTS.md', 'ARTICLE_PARITY.md', 'EDIT_LOCK_WRITING.md',
    'IMAGE_HEIGHT.md', 'MAGAZOO_ANIMATION_NOTES.md', 'READONLY_SAVE_FIX.md',
    'SERVER_SETUP.md', 'TYPOGRAPHY_TOPBAR.md', 'ADMIN_LIBRARY_PARAGRAPHS.md',
    'GITHUB_WORKFLOW.md'
)

function Get-GitText {
    param([string[]]$Arguments, [switch]$AllowMissing)
    # Windows PowerShell 5 treats successful Git progress on stderr as an error
    # record. The exit code determines success; restore the caller's preference.
    $previousPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'Continue'
        $result = & git --no-optional-locks --literal-pathspecs @Arguments 2>&1
        $gitExitCode = $LASTEXITCODE
    } finally { $ErrorActionPreference = $previousPreference }
    if ($gitExitCode -eq 1 -and $AllowMissing) { return '' }
    if ($gitExitCode -ne 0) {
        throw "Git could not complete '$($Arguments[0])'. $($result -join [Environment]::NewLine)"
    }
    return ($result -join "`n")
}

function Get-GitPaths {
    param([string[]]$Arguments)
    $raw = Get-GitText -Arguments $Arguments
    if ($raw) { return @($raw.Split([char]0) | Where-Object { $_ -ne '' }) }
    return @()
}

function Test-SecretPath {
    param([string]$Path)
    return $Path -match '(?i)(^|/)(\.env(?:\..*)?|\.magazoo-data|credentials(?:\.[^/]*)?)($|/)|\.(?:sqlite(?:3)?(?:-wal|-shm)?|db|pem|pfx|p12|key)$'
}

function Test-SourcePath {
    param([string]$Path)
    if ($Path -match '[\r\n]' -or (Test-SecretPath $Path)) { return $false }
    if ($Path -match '(?i)(^|/)(node_modules|dist|dist-ssr|tmp|output|deployment-artifacts|logs)(/|$)') { return $false }
    if ($Path -match '(?i)(^|/)\.tmp|\.(?:zip|log|local|tsbuildinfo)$') { return $false }
    return $Path -cmatch '^(src|server|public)/' -or $Path -ceq 'scripts/publish-source.ps1' -or $rootFiles -ccontains $Path
}

function Assert-NoSecretContent {
    param([string]$Path, [string]$Content)
    $patterns = @(
        '-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----',
        '\bgh[pousr]_[A-Za-z0-9]{20,}\b',
        '\bgithub_pat_[A-Za-z0-9_]{20,}\b',
        '\bAKIA[A-Z0-9]{16}\b',
        '\bxox[baprs]-[A-Za-z0-9-]{20,}\b',
        '\bsk-(?:proj-)?[A-Za-z0-9_-]{40,}\b',
        '(?im)^\s*(?://[^\r\n]+:)?_authToken\s*=\s*(?!\$\{)[A-Za-z0-9_-]{15,}'
    )
    foreach ($pattern in $patterns) {
        if ($Content -match $pattern) {
            throw "Potential secret detected in '$Path'. Nothing will be committed or pushed. Remove it from the source and review it locally; do not paste it into chat."
        }
    }
}

function Assert-CandidateFiles {
    param([string[]]$Paths)
    foreach ($path in $Paths) {
        if (-not (Test-SourcePath $path)) { throw "File is outside the source publishing list: $path" }
        $absolute = [IO.Path]::GetFullPath((Join-Path $projectRoot $path))
        if (-not $absolute.StartsWith($projectRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
            throw "Path is outside the project: $path"
        }
        if (Test-Path -LiteralPath $absolute -PathType Leaf) {
            $file = Get-Item -LiteralPath $absolute
            if ($file.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw "Review this symbolic link before publishing: $path" }
            if ($file.Length -gt 50MB) { throw "File exceeds the 50 MB source limit: $path" }
            if ($path -match '(?i)\.(mjs|cjs|js|jsx|ts|tsx|json|md|html|css|svg|yml|yaml|txt|ps1)$|(^|/)\.(npmrc|gitignore|gitattributes)$') {
                Assert-NoSecretContent -Path $path -Content ([IO.File]::ReadAllText($absolute))
            }
        }
    }
}

function Get-CandidateFingerprint {
    param([string[]]$Paths)
    return (($Paths | ForEach-Object {
        $absolute = Join-Path $projectRoot $_
        if (Test-Path -LiteralPath $absolute -PathType Leaf) {
            "$_ $((Get-FileHash -LiteralPath $absolute -Algorithm SHA256).Hash)"
        } else { "$_ DELETED" }
    }) -join "`n")
}

function Invoke-RequiredCheck {
    param([string]$Executable, [string[]]$Arguments, [string]$Label)
    Write-Host "Checking $Label..."
    & $Executable @Arguments
    if ($LASTEXITCODE -ne 0) { throw "$Label failed. Nothing has been staged, committed or pushed." }
}

Push-Location -LiteralPath $projectRoot
try {
    if ($Message.Trim() -notmatch '^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\([^)]+\))?!?: [^\r\n]+$') {
        throw 'Use a one-line commit message such as: fix: show hero images in article cards'
    }
    if (-not (Get-Command git -ErrorAction SilentlyContinue)) { throw 'Install Git for Windows, then run this again.' }
    $actualRoot = Get-GitText -Arguments @('rev-parse', '--show-toplevel')
    if ([IO.Path]::GetFullPath($actualRoot) -ne $projectRoot) { throw 'Run this helper from the Magazoo working repository.' }
    $remote = Get-GitText -Arguments @('remote', 'get-url', 'origin')
    $pushRemote = Get-GitText -Arguments @('remote', 'get-url', '--push', 'origin')
    foreach ($url in @($remote, $pushRemote)) {
        if ($url.TrimEnd('/') -notin @($expectedRemote, $expectedRemote.Substring(0, $expectedRemote.Length - 4))) {
            throw "The origin remote must be $expectedRemote. No source has been published."
        }
    }
    $branch = Get-GitText -Arguments @('symbolic-ref', '--quiet', '--short', 'HEAD')
    if ($branch -cne $expectedBranch) { throw "This helper publishes '$expectedBranch' only. Current branch: $branch" }
    $gitDirectory = Get-GitText -Arguments @('rev-parse', '--absolute-git-dir')
    foreach ($operation in @('MERGE_HEAD', 'CHERRY_PICK_HEAD', 'REVERT_HEAD', 'rebase-merge', 'rebase-apply')) {
        if (Test-Path -LiteralPath (Join-Path $gitDirectory $operation)) { throw 'Finish the pending Git operation before publishing.' }
    }
    if (Get-GitText -Arguments @('ls-files', '--unmerged')) { throw 'Resolve the merge conflicts before publishing.' }
    $staged = @(Get-GitPaths -Arguments @('diff', '--cached', '--name-only', '-z'))
    if ($staged.Count -gt 0) { throw 'The index already contains staged changes. Review those changes separately; this helper will not overwrite the staging area.' }
    $untracked = @(Get-GitPaths -Arguments @('ls-files', '--others', '--exclude-standard', '-z'))
    $untrackedSecrets = @($untracked | Where-Object { Test-SecretPath $_ })
    if ($untrackedSecrets.Count -gt 0) {
        throw "Unignored private files were found. Add them to .gitignore before publishing: $($untrackedSecrets -join ', ')"
    }
    $changed = @(Get-GitPaths -Arguments @('ls-files', '--modified', '--deleted', '--others', '--exclude-standard', '-z') | Sort-Object -Unique)
    $candidates = @($changed | Where-Object { Test-SourcePath $_ })
    $excluded = @($changed | Where-Object { -not (Test-SourcePath $_) })
    $trackedEnv = @(Get-GitPaths -Arguments @('ls-files', '-z', '--', '.env')).Count -gt 0
    $removeTrackedEnv = $RemoveTrackedEnv -and $trackedEnv
    Assert-CandidateFiles -Paths $candidates
    Write-Host "Source files selected: $($candidates.Count). Other changed files excluded: $($excluded.Count)."
    foreach ($path in $candidates) { Write-Host "  $path" }
    if ($removeTrackedEnv) { Write-Host '  .env (remove from tracking; keep the local copy)' }
    elseif ($trackedEnv) { Write-Host 'Existing tracked .env will remain unchanged. Its local contents will not be staged.' }
    Write-Host 'Generated bundles, local data, private configuration and deployment workflows are excluded.'

    if ($DryRun) {
        Write-Host 'Dry run complete. No fetch, test, staging, commit or push was performed.'
        exit 0
    }

    $authorName = Get-GitText -Arguments @('config', '--get', 'user.name') -AllowMissing
    $authorEmail = Get-GitText -Arguments @('config', '--get', 'user.email') -AllowMissing
    if (-not $authorName.Trim() -or -not $authorEmail.Trim()) { throw 'Set the Git author name and email for this repository before publishing.' }
    Write-Host "Commit author: $authorName <$authorEmail>"
    Write-Host "Commit message: $Message"
    [void](Get-GitText -Arguments @('fetch', '--no-tags', 'origin', $expectedBranch))
    $remoteHead = Get-GitText -Arguments @('rev-parse', "origin/$expectedBranch")
    $distance = (Get-GitText -Arguments @('rev-list', '--left-right', '--count', "HEAD...origin/$expectedBranch")) -split '\s+'
    if ([int]$distance[1] -gt 0) { throw 'GitHub contains newer commits. Review and merge those changes locally before publishing. Your files have not been changed.' }
    if ([int]$distance[0] -gt 0) {
        $outgoingPaths = @(Get-GitPaths -Arguments @('diff', '--name-only', '-z', "origin/$expectedBranch..HEAD"))
        foreach ($path in $outgoingPaths) {
            if ($path -ceq '.env') {
                $envChange = Get-GitText -Arguments @('diff', '--name-status', "origin/$expectedBranch..HEAD", '--', '.env')
                if ($envChange -ceq "D`t.env") { continue }
            }
            if (-not (Test-SourcePath $path)) { throw "An existing local commit changes an excluded file: $path. Review that commit separately before publishing." }
        }
        $outgoingSourcePaths = @($outgoingPaths | Where-Object { Test-SourcePath $_ })
        if ($outgoingSourcePaths.Count -gt 0) {
            $outgoingPatch = Get-GitText -Arguments (@('log', '-p', '--format=', "origin/$expectedBranch..HEAD", '--') + $outgoingSourcePaths)
            Assert-NoSecretContent -Path 'existing local commits' -Content $outgoingPatch
        }
    }
    if ($candidates.Count -eq 0 -and -not $removeTrackedEnv -and [int]$distance[0] -eq 0) {
        Write-Host 'There are no source changes to publish.'
        exit 0
    }
    if (-not (Test-Path -LiteralPath 'node_modules' -PathType Container)) { throw 'Install the project dependencies with npm ci before publishing.' }
    $beforeChecks = Get-CandidateFingerprint -Paths $candidates
    Invoke-RequiredCheck -Executable 'npm.cmd' -Arguments @('test', '--', '--maxWorkers=2') -Label 'editor tests'
    Invoke-RequiredCheck -Executable 'npm.cmd' -Arguments @('run', 'test:server') -Label 'server tests'
    Invoke-RequiredCheck -Executable 'npm.cmd' -Arguments @('run', 'build') -Label 'production build and TypeScript'
    $afterChanges = @(Get-GitPaths -Arguments @('ls-files', '--modified', '--deleted', '--others', '--exclude-standard', '-z') | Sort-Object -Unique | Where-Object { Test-SourcePath $_ })
    if (($candidates -join "`n") -cne ($afterChanges -join "`n") -or $beforeChecks -cne (Get-CandidateFingerprint -Paths $candidates)) {
        throw 'Source files changed during verification. Review the new changes and run this helper again. Nothing has been staged or committed.'
    }
    Assert-CandidateFiles -Paths $candidates
    $latestRemote = Get-GitText -Arguments @('ls-remote', 'origin', "refs/heads/$expectedBranch")
    if (($latestRemote -split '\s+')[0] -cne $remoteHead) { throw 'GitHub changed during verification. Review the new remote commit before publishing; nothing has been staged or committed.' }
    if ($candidates.Count -gt 0 -or $removeTrackedEnv) {
        # Explicit literal paths keep generated files and local data out of the commit.
        if ($candidates.Count -gt 0) { [void](Get-GitText -Arguments (@('add', '--') + $candidates)) }
        if ($removeTrackedEnv) {
            # Stage only a deletion from tracking. Never read or display the private file.
            [void](Get-GitText -Arguments @('rm', '--cached', '--ignore-unmatch', '--', '.env'))
        }
        $expectedStaged = @($candidates)
        if ($removeTrackedEnv) { $expectedStaged += '.env' }
        $expectedStaged = @($expectedStaged | Sort-Object -Unique)
        $finalStaged = @(Get-GitPaths -Arguments @('diff', '--cached', '--name-only', '-z') | Sort-Object -Unique)
        if (($finalStaged -join "`n") -cne ($expectedStaged -join "`n")) {
            throw 'The staged file list differs from the verified source list. Review the staging area before continuing.'
        }
        Write-Host (Get-GitText -Arguments @('diff', '--cached', '--stat'))
        [void](Get-GitText -Arguments @('diff', '--cached', '--check'))
        [void](Get-GitText -Arguments @('commit', '-m', $Message.Trim()))
    }
    Write-Host "Pushing the verified source to origin/$expectedBranch..."
    & git push origin "HEAD:refs/heads/$expectedBranch"
    if ($LASTEXITCODE -ne 0) {
        throw 'The push failed. Your local commit has been preserved. Complete GitHub sign-in or review the remote changes, then rerun this helper; do not force push.'
    }
    Write-Host "Published commit $(Get-GitText -Arguments @('rev-parse', '--short', 'HEAD')) to $expectedRemote."
} finally {
    Pop-Location
}
