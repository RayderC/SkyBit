Write-Host "=== SkyBit Deploy ===" -ForegroundColor Cyan

Set-Location "C:\Users\Rayder\Desktop\SkyBit"

# Remove stale git lock if present
if (Test-Path ".git\index.lock") {
    Remove-Item ".git\index.lock" -Force
    Write-Host "Removed stale git lock" -ForegroundColor Yellow
}

# ── Git ───────────────────────────────────────────────────────────────────────
Write-Host "`n[1/3] Committing and pushing to GitHub..." -ForegroundColor Cyan

git add -A
git commit -m "Add bulk download, lightbox close button, file count status bar, share filename preview

- SelectionBar: add Download button for bulk file downloads
- Lightbox: add prominent corner X close button (absolute-positioned, always visible)
- FileBrowser: add file count status bar pinned to bottom of screen
  - Shows folder/file breakdown (e.g. '2 folders, 14 files')
  - Updates dynamically when searching
- Share page: display filename before download button
- Add /api/temp-shares/info endpoint for lightweight share metadata lookup
- Update README to document all new features"

git push origin main

if ($LASTEXITCODE -eq 0) {
    Write-Host "GitHub push OK" -ForegroundColor Green
} else {
    Write-Host "GitHub push FAILED" -ForegroundColor Red
}

# ── Docker build ──────────────────────────────────────────────────────────────
Write-Host "`n[2/3] Building Docker image..." -ForegroundColor Cyan

docker build -t rayderc/skybit:latest .

if ($LASTEXITCODE -eq 0) {
    Write-Host "Docker build OK" -ForegroundColor Green
} else {
    Write-Host "Docker build FAILED - stopping" -ForegroundColor Red
    Read-Host "Press Enter to close"
    exit 1
}

# ── Docker push ───────────────────────────────────────────────────────────────
Write-Host "`n[3/3] Pushing to Docker Hub..." -ForegroundColor Cyan

docker push rayderc/skybit:latest

if ($LASTEXITCODE -eq 0) {
    Write-Host "`nAll done! Image pushed to rayderc/skybit:latest" -ForegroundColor Green
} else {
    Write-Host "`nDocker push FAILED" -ForegroundColor Red
}

Read-Host "`nPress Enter to close"
