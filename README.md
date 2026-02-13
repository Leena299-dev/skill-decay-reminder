# Skill Decay Reminder

AI-powered skill maintenance system for AWS Global 10,000 AIdeas Competition

## Overview
An intelligent platform that prevents skill loss using forgetting curve science and AI-generated practice exercises.

## Status
🚧 Week 1: Setup in progress

## Tech Stack
- **Frontend:** React
- **Backend:** AWS Lambda (Python 3.11)
- **Database:** Amazon DynamoDB
- **AI:** Amazon Bedrock (Nova Micro)
- **AI Assistant:** AWS Kiro/Amazon Q
- **Infrastructure:** Serverless (API Gateway, S3, CloudFront, SES)

## Features (Planned)
- [ ] Multi-skill tracking (languages, coding, certifications)
- [ ] AI-generated personalized practice exercises
- [ ] Forgetting curve-based reminder scheduling
- [ ] Automated email notifications
- [ ] Progress analytics dashboard
- [ ] Mobile-responsive interface

## Progress Tracker

### Week 1: Infrastructure
- [x] Development environment setup ✅
- [x] AWS account and Kiro configuration ✅
- [x] Budget alerts deployed ✅
- [x] DynamoDB tables (4 tables created and tested) ✅
- [ ] Lambda functions (Day 2)
- [ ] API Gateway (Day 2)
- [ ] React frontend (Day 3-4)

### Week 2: AI Integration
- [ ] Bedrock Nova Micro access
- [ ] Cache warming
- [ ] Practice generator
- [ ] Reminder system

### Week 3: User Experience
- [ ] Practice UI
- [ ] Progress dashboard
- [ ] Mobile responsive design

### Week 4: Testing & Launch
- [ ] Beta testing
- [ ] Documentation
- [ ] Demo video
- [ ] Competition submission

## Budget Tracking
- **Total Budget:** $200 AWS credits
- **Spent So Far:** $0
- **Remaining:** $200
- **Target:** Stay under $25 total

## Repository Structure
```
skill-decay-reminder/
├── infrastructure/      # CloudFormation templates
├── lambda/             # Lambda function code
├── frontend/           # React application
├── test-events/        # Test data for Lambda
└── docs/               # Documentation
```

## Team
- Leena Kaur - Developer

## Competition Category
Daily Life Enhancement

## License
MIT