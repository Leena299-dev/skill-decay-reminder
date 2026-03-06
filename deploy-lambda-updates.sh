#!/bin/bash
# Bash script to deploy updated Lambda functions

echo "Deploying updated Lambda functions..."

# Deploy ai-coach Lambda
echo ""
echo "Packaging ai-coach Lambda..."
cd lambda/ai-coach && zip -r ../ai-coach.zip . && cd ../..
echo "Deploying ai-coach Lambda..."
aws lambda update-function-code \
  --function-name SkillDecay-AICoach \
  --zip-file fileb://lambda/ai-coach.zip \
  --region us-east-1

if [ $? -eq 0 ]; then
    echo "✓ AI Coach Lambda deployed successfully"
else
    echo "✗ Failed to deploy AI Coach Lambda"
fi

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
echo "Packaging practice-session Lambda..."
cd lambda/practice-session && zip -r ../practice-session.zip . && cd ../..
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

# Deploy notification-scheduler Lambda
echo ""
echo "Packaging notification-scheduler Lambda..."
cd lambda/notification-scheduler && zip -r ../notification-scheduler.zip . && cd ../..
echo "Deploying notification-scheduler Lambda..."
aws lambda update-function-code \
  --function-name SkillDecay-NotificationScheduler \
  --zip-file fileb://lambda/notification-scheduler.zip \
  --region us-east-1

if [ $? -eq 0 ]; then
    echo "✓ Notification-scheduler Lambda deployed successfully"
else
    echo "✗ Failed to deploy Notification-scheduler Lambda"
fi

# Deploy email-sender Lambda
echo ""
echo "Packaging email-sender Lambda..."
cd lambda/email-sender && zip -r ../email-sender.zip . && cd ../..
echo "Deploying email-sender Lambda..."
aws lambda update-function-code \
  --function-name SkillDecay-EmailSender \
  --zip-file fileb://lambda/email-sender.zip \
  --region us-east-1

if [ $? -eq 0 ]; then
    echo "✓ Email-sender Lambda deployed successfully"
else
    echo "✗ Failed to deploy Email-sender Lambda"
fi

# Deploy notification-reader Lambda
echo ""
echo "Packaging notification-reader Lambda..."
cd lambda/notification-reader && zip -r ../notification-reader.zip . && cd ../..
echo "Deploying notification-reader Lambda..."
aws lambda update-function-code \
  --function-name SkillDecay-NotificationReader \
  --zip-file fileb://lambda/notification-reader.zip \
  --region us-east-1

if [ $? -eq 0 ]; then
    echo "✓ Notification-reader Lambda deployed successfully"
else
    echo "✗ Failed to deploy Notification-reader Lambda"
fi

# Deploy notification-preferences Lambda
echo ""
echo "Packaging notification-preferences Lambda..."
cd lambda/notification-preferences && zip -r ../notification-preferences.zip . && cd ../..
echo "Deploying notification-preferences Lambda..."
aws lambda update-function-code \
  --function-name SkillDecay-NotificationPreferences \
  --zip-file fileb://lambda/notification-preferences.zip \
  --region us-east-1

if [ $? -eq 0 ]; then
    echo "✓ Notification-preferences Lambda deployed successfully"
else
    echo "✗ Failed to deploy Notification-preferences Lambda"
fi

echo ""
echo "Deployment complete!"
echo "Note: If function names are different, update them in this script."
