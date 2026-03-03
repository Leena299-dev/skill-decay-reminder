# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Skill Decay Reminder** ("SharpEdge") is a full-stack serverless application that helps users track and maintain technical skills using spaced repetition. It was built as an AWS 10,000 AIdeas Competition entry.

## Development Commands

### Frontend (React + Vite)
```bash
cd frontend
npm install       # Install dependencies
npm run dev       # Start dev server at http://localhost:5173
npm run build     # Production build
npm run lint      # Run ESLint
npm run preview   # Preview production build
```

### Lambda Deployment
```bash
# Deploy individual Lambda (from repo root):
cd lambda/<function-name>
zip -r ../<function-name>.zip .
aws lambda update-function-code \
  --function-name SkillDecay-<FunctionName> \
  --zip-file fileb://../<function-name>.zip \
  --region us-east-1

# Or use the deploy script for analytics and practice-session:
./deploy-lambda-updates.sh
```

### Infrastructure (CloudFormation)
```bash
# Deploy a CloudFormation stack:
aws cloudformation deploy \
  --template-file infrastructure/<template>.yaml \
  --stack-name <stack-name> \
  --region us-east-1
```

### Testing Lambda Functions Locally
```bash
# Use test event files in test-events/
python test-dynamodb.py
python test-events/test-dynamodb-tables.py
```

## Architecture

### Full-Stack Serverless on AWS

```
React Frontend (Vite)
       │
       │ axios HTTP calls
       ▼
AWS API Gateway (REST, /prod stage)
       │
       ├── POST   /users          → Lambda: user-registration
       ├── GET/POST/PUT/DELETE /skills → Lambda: skill-manager
       ├── POST   /practice       → Lambda: practice-generator (Bedrock)
       ├── POST   /practice-session → Lambda: practice-session
       └── GET    /analytics      → Lambda: analytics
              │
              ▼
        DynamoDB (4 tables)
```

### DynamoDB Tables
| Table | Partition Key | Sort Key | Notes |
|-------|--------------|----------|-------|
| `Users` | `userId` | — | |
| `Skills` | `skillId` | `userId` | GSI: `userId-index` on `userId` |
| `ExerciseCache` | `cacheKey` | — | TTL: `expiresAt` (60-day), saves Bedrock costs |
| `PracticeHistory` | `userId` | `completedAt` (Unix timestamp) | |

### Lambda Functions (Python 3.11)
- **user-registration** — Creates users; scans for duplicate emails
- **skill-manager** — Full CRUD for skills; computes `health` score and `trend` on every GET; implements forgetting curve interval scheduling
- **practice-generator** — Checks `ExerciseCache` first; on cache miss, calls Amazon Bedrock Nova Micro (`us.amazon.nova-micro-v1:0`) to generate a JSON exercise
- **practice-session** — Records completed sessions to `PracticeHistory`; updates `Skills` with new `lastPracticeScore`, `nextReminderDate`, and `currentIntervalIndex` using the forgetting curve algorithm
- **analytics** — Aggregates `PracticeHistory` to compute streak, totals, frequency chart, and per-skill breakdowns

### Frontend Structure
- **`src/App.jsx`** — Root: shows `UserRegistration` if no `userId`, otherwise `AppShell`
- **`src/components/AppShell.jsx`** — Sidebar layout with nav; renders `SkillsDashboard` or `Analytics` page
- **`src/pages/SkillsDashboard.jsx`** — Main page: skill CRUD, inline navigation to `PracticePage` and `Analytics`
- **`src/pages/PracticePage.jsx`** — Fetches AI exercise from `/practice`, displays it, accepts self-scored result, submits to `/practice-session`
- **`src/pages/Analytics.jsx`** — Charts (Recharts) for practice frequency and per-skill data
- **`src/services/api.js`** — All API calls via axios; reads `VITE_API_URL` from `frontend/.env`

### Key Domain Logic
- **Forgetting curve** — `INTERVALS = [1, 3, 7, 14, 30, 60]` days. Score ≥ 80 → advance interval index; 60–79 → keep; < 60 → regress. Implemented in `lambda/practice-session/index.py:calculate_next_reminder()`.
- **Skill health score** — 0–100 computed from `nextReminderDate` vs today. Overdue decays at 10 pts/day. Computed server-side in `lambda/skill-manager/index.py:calculate_skill_health()` on every GET.
- **Exercise caching** — Cache key: `{skillName}_{proficiency}_{exerciseType}` (lowercase, spaces replaced). Reduces Bedrock API costs.
- **Decimal serialization** — DynamoDB returns `Decimal` types; all Lambdas use a `decimal_to_number()` helper before `json.dumps`.

## Configuration

- **API endpoint** is set in `frontend/.env` as `VITE_API_URL` (Vite exposes it via `import.meta.env.VITE_API_URL`)
- **Lambda env vars**: `TABLE_NAME`, `CACHE_TABLE_NAME`, `SKILLS_TABLE`, `HISTORY_TABLE`, `BEDROCK_MODEL_ID`
- All Lambdas return CORS headers (`Access-Control-Allow-Origin: *`) and handle OPTIONS preflight

## AWS Region

All resources are deployed in **us-east-1**.
