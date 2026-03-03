#!/bin/bash
# Bash script to deploy updated Lambda functions

echo "Deploying updated Lambda functions..."

# Deploy analytics Lambda
echo ""
echo "Deploying analytics Lambda..."
aws lambda update-function-code \
  --function-name SkillDecay-Analytics \
  --zip-file fileb://lambda/analytics.zip \
  --region us-east-1

if [ $? -eq 0 ]; then
    echo "✓ Analytics Lambda deployed successfully"
else
    echo "✗ Failed to deploy Analytics Lambda"
fi

# Deploy practice-session Lambda
echo ""
echo "Deploying practice-session Lambda..."
aws lambda update-function-code \
  --function-name SkillDecay-PracticeSession \
  --zip-file fileb://lambda/practice-session.zip \
  --region us-east-1

if [ $? -eq 0 ]; then
    echo "✓ Practice-session Lambda deployed successfully"
else
    echo "✗ Failed to deploy Practice-session Lambda"
fi

echo ""
echo "Deployment complete!"
echo "Note: If function names are different, update them in this script."
