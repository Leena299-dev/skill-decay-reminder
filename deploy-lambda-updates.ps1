# PowerShell script to deploy updated Lambda functions

Write-Host "Deploying updated Lambda functions..." -ForegroundColor Green

# Deploy analytics Lambda
Write-Host "`nDeploying analytics Lambda..." -ForegroundColor Yellow
aws lambda update-function-code `
  --function-name SkillDecay-Analytics `
  --zip-file fileb://lambda/analytics.zip `
  --region us-east-1

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Analytics Lambda deployed successfully" -ForegroundColor Green
} else {
    Write-Host "✗ Failed to deploy Analytics Lambda" -ForegroundColor Red
}

# Deploy practice-session Lambda
Write-Host "`nDeploying practice-session Lambda..." -ForegroundColor Yellow
aws lambda update-function-code `
  --function-name SkillDecay-PracticeSession `
  --zip-file fileb://lambda/practice-session.zip `
  --region us-east-1

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Practice-session Lambda deployed successfully" -ForegroundColor Green
} else {
    Write-Host "✗ Failed to deploy Practice-session Lambda" -ForegroundColor Red
}

Write-Host "`nDeployment complete!" -ForegroundColor Green
Write-Host "Note: If function names are different, update them in this script." -ForegroundColor Cyan
