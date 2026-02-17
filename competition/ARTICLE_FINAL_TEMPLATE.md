# AIdeas: Skill Decay Reminder

[COVER IMAGE: Beautiful dashboard screenshot with app logo]

---

## App Category

**Daily Life Enhancement**

This app falls under Daily Life Enhancement because it directly 
improves developers' professional lives by preventing the natural 
decay of hard-earned technical skills, saving hours of relearning 
and maintaining career competitiveness.

---

## My Vision

### The Problem I Solved

Every developer knows the feeling: you spent months mastering 
a programming language, framework, or certification. Then a 
new project demands different skills, and six months later, 
you've forgotten half of what you learned.

This is **skill decay** - the natural neurological process of 
forgetting information we don't regularly use. For developers, 
this means:

- 🔴 Relearning languages before interviews
- 🔴 Struggling with frameworks you once knew well  
- 🔴 Letting certifications become outdated
- 🔴 Losing competitive advantage over time

**I experienced this personally** as a developer at Atos. After 
a project rotation, I realized my Python skills had significantly 
decayed while focusing on JavaScript for 8 months.

### What I Built

**Skill Decay Reminder** is an AI-powered web application that:

1. **Tracks your skills** across languages, frameworks, 
   certifications, and instruments

2. **Calculates optimal practice times** using the forgetting 
   curve - a psychological model showing exactly when you're 
   about to forget something

3. **Generates personalized exercises** using Amazon Bedrock's 
   Nova Micro AI model, matched to your exact proficiency level

4. **Sends smart email reminders** at precisely the right moment 
   before skill decay sets in

5. **Tracks your progress** with visual analytics showing 
   improvement over time

[Screenshot: App overview/dashboard]

The result: developers maintain their full skill portfolio 
with just 15-20 minutes of targeted practice per week, 
instead of hours of unfocused study.

---

## Why This Matters

### The Scale of Skill Decay

[TO ADD: Statistics about developer skill decay]

Skill decay affects every developer because:

**The Brain Forgets Without Practice**
Hermann Ebbinghaus discovered the "forgetting curve" in 1885 - 
we forget 70% of new information within 24 hours without review. 
For technical skills, this means code syntax, best practices, 
and problem-solving patterns fade surprisingly quickly.

**The Modern Developer Juggles Many Skills**
Today's developers need expertise in multiple languages, cloud 
platforms, DevOps tools, and domain knowledge simultaneously. 
Maintaining all of these manually is practically impossible.

**Career Impact is Real**
- Job interviews test skills you may not have used recently
- Client projects demand proficiency you haven't maintained
- Certifications expire faster than you can renew them

### Who Benefits

- 👨‍💻 **Individual Developers** - Maintain full skill portfolio
- 🏢 **Development Teams** - Track team skill currency
- 🎓 **Students** - Maintain languages learned in courses
- 🔄 **Career Changers** - Keep old skills while learning new ones

### The Opportunity

With AI-generated personalized exercises, Skill Decay Reminder 
doesn't just remind you to practice—it tells you *exactly* what 
to practice and provides the exercises to do it. This is the 
difference between "go study" and "here's a 15-minute exercise 
specifically designed for your intermediate Python level."

---

## How I Built This

### Architecture Overview

[Architecture Diagram Image]

Built entirely on AWS serverless architecture:
```
┌─────────────────────────────────────────────────────┐
│                   React Frontend (Vite)              │
│              http://localhost:5173                   │
└─────────────────────┬───────────────────────────────┘
                      │ HTTPS
┌─────────────────────▼───────────────────────────────┐
│              Amazon API Gateway                      │
│         POST /users  │  GET/POST/PUT/DELETE /skills  │
└──────────┬──────────────────────┬───────────────────┘
           │                      │
┌──────────▼──────┐    ┌──────────▼──────────────────┐
│  UserRegistration│    │      SkillManager Lambda    │
│  Lambda (Python) │    │      (Python 3.11)          │
└──────────┬───────┘    └──────────┬──────────────────┘
           │                        │
┌──────────▼────────────────────────▼──────────────────┐
│                    Amazon DynamoDB                    │
│    Users │ Skills │ ExerciseCache │ PracticeHistory  │
└──────────────────────────────────────────────────────┘
           │
┌──────────▼──────────────────────────────────────────┐
│              Amazon Bedrock (Nova Micro)             │
│          AI-Generated Practice Exercises             │
└─────────────────────────────────────────────────────┘
```

### AWS Services Used

| Service | Purpose | Monthly Cost |
|---------|---------|-------------|
| DynamoDB | User/skill data storage | $0 (Free Tier) |
| Lambda | Serverless business logic | $0 (Free Tier) |
| API Gateway | REST API management | $0 (Free Tier) |
| Bedrock (Nova Micro) | AI exercise generation | ~$3-5 |
| SES | Email reminders | $0 (first 1,000) |
| CloudFormation | Infrastructure as Code | $0 (Always free) |
| **TOTAL** | | **<$5/month** |

### Development Journey with Kiro

I used **Kiro (Amazon Q Developer)** throughout this project, 
which dramatically accelerated development.

#### Week 1: Foundation (5 days, 13.5 hours)

**Day 1: Database Infrastructure**

Using Kiro, I generated the complete DynamoDB schema for 
4 tables with a single prompt:

*My Kiro Prompt:*
```
Create CloudFormation for DynamoDB table:
- Table Name: Skills
- Partition Key: skillId (String)
- Sort Key: userId (String)  
- GSI: userId-index (partition: userId)
- Billing: PAY_PER_REQUEST
- TTL: Enabled on expiresAt attribute
Format: Complete YAML CloudFormation template
```

*Result: Deployed in 2 minutes!*

[Screenshot: DynamoDB tables in AWS Console]

**Day 2: Lambda Functions**

Kiro generated complete Python Lambda functions with:
- Email validation with regex
- Duplicate user detection
- Full CRUD for skills
- Error handling and CORS

[Screenshot: Lambda code in VS Code]

**Day 3: API Gateway**

Single Kiro prompt generated complete REST API with CORS:

[Screenshot: API Gateway in AWS Console]

**Days 4-5: React Frontend**

Kiro built:
- Beautiful user registration page
- Skills dashboard with full CRUD
- Responsive design
- Error handling

[Screenshot: Registration page]
[Screenshot: Skills dashboard]

**Kiro Impact - Week 1:**
- Lines generated: 1,970
- Development time: 13.5 hours
- Without Kiro estimate: 24 hours
- Time saved: 10.5 hours (44% faster)

---

#### Week 2: AI Integration [TO WRITE]

[AFTER BUILDING WEEK 2]

**Bedrock Integration**
[Screenshot: AI-generated exercise]

**Forgetting Curve Algorithm**
[Screenshot: Next reminder dates]

**Cache System**
[Screenshot: Cache hit rate]

---

#### Week 3: UX Polish [TO WRITE]

[AFTER BUILDING WEEK 3]

---

### Technical Deep Dive: Forgetting Curve

[TO WRITE AFTER WEEK 2]

The core algorithm uses Ebbinghaus's forgetting curve with 
intervals: [1, 3, 7, 14, 30, 60] days
```python
FORGETTING_CURVE_INTERVALS = [1, 3, 7, 14, 30, 60]

def calculate_next_reminder(current_index, practice_score):
    if practice_score >= 80:
        next_index = min(current_index + 1, 
                        len(FORGETTING_CURVE_INTERVALS) - 1)
    elif practice_score >= 60:
        next_index = current_index
    else:
        next_index = max(0, current_index - 1)
    
    return FORGETTING_CURVE_INTERVALS[next_index]
```

### Technical Deep Dive: AI Exercise Generation

[TO WRITE AFTER WEEK 2]
```python
prompt = f"""Generate a practice exercise for:
- Skill: {skill_name}
- Category: {category}  
- Proficiency Level: {proficiency}
- Duration: 15 minutes

Create an exercise that challenges at {proficiency} level..."""
```

---

## Demo

### Application Screenshots

#### 1. User Registration
[Screenshot: Registration page]

Clean, intuitive registration with email validation and 
timezone selection for personalized reminder scheduling.

---

#### 2. Skills Dashboard  
[Screenshot: Dashboard with skills]

Visual skill cards color-coded by importance level:
- 🔴 Critical (red border)
- 🟠 High (orange border)
- 🔵 Medium (blue border)
- ⚪ Low (gray border)

---

#### 3. Adding a New Skill
[Screenshot: Add skill form]

Simple form captures everything needed to start tracking:
skill name, category, proficiency level, and importance.

---

#### 4. AI-Generated Practice Exercise
[Screenshot: Practice exercise - WEEK 2]

Amazon Bedrock generates personalized exercises matched 
to your exact proficiency level.

---

#### 5. Progress Tracking
[Screenshot: Progress dashboard - WEEK 3]

Visual analytics showing skill improvement over time.

---

### Demo Video

[Embed YouTube video - 5 minutes max]

**Video covers:**
- Registering a new account (30 sec)
- Adding multiple skills (1 min)
- Receiving AI-generated exercise (1 min)
- Email reminder example (30 sec)
- Progress dashboard tour (1 min)
- Architecture overview (1 min)

---

## What I Learned

### 1. Kiro Changes Everything About Development Speed

Before this project, I thought "AI-assisted development" 
meant getting suggestions for individual lines of code. 
I was wrong.

Kiro generates entire production-ready components from 
natural language descriptions. The key insight: 
**the better your prompt, the better the code.**

My most effective prompting strategy:
- ✅ Be extremely specific about requirements
- ✅ Mention error handling explicitly
- ✅ Include validation rules
- ✅ Specify the exact format (YAML, Python, React)
- ✅ Include what NOT to do (e.g., "Only key attributes in AttributeDefinitions")

**Lesson:** Treat Kiro like a very capable developer who 
needs clear, detailed specifications.

---

### 2. Serverless Architecture is Perfect for Competition Projects

Building entirely on AWS serverless services meant:
- Zero infrastructure management
- Infinite scalability from day one
- Costs that scale with usage (perfect for testing)
- No servers to maintain or secure

The entire Week 1 backend runs at **$0/month** on AWS 
Free Tier. This isn't just good for the competition—it's 
genuinely the right architecture for this type of application.

**Lesson:** Start serverless. Add complexity only when 
you need it.

---

### 3. Infrastructure as Code From Day One

Using CloudFormation from the very beginning, even for 
a competition project, paid off immediately. When I needed 
to fix the Budget template's Outputs section, I simply 
edited the YAML and redeployed—no clicking through 
AWS Console.

**Lesson:** Even for personal/competition projects, IaC 
saves time and prevents configuration drift.

---

### 4. DynamoDB Schema Design Matters

My initial DynamoDB schema included non-key attributes 
in AttributeDefinitions (a common mistake). This caused 
deployment failures.

**Lesson:** In DynamoDB, only include partition keys and 
sort keys in AttributeDefinitions. All other attributes 
are defined when you put items, not at table creation.

---

### 5. AI Models Need Caching for Cost Control

Amazon Bedrock is powerful but can be expensive at scale. 
The exercise cache with 60-day TTL and 80% target hit rate 
was crucial for keeping costs under $5/month.

**Lesson:** Always design for cost optimization when using 
AI APIs. Cache aggressively, batch where possible.

---

### 6. The Forgetting Curve is Real

Researching the science behind this app taught me something 
personally valuable: I should be using spaced repetition 
for my own skill maintenance. The irony of building this 
app was realizing I needed it myself.

**Lesson:** The best apps solve problems their creators 
have personally experienced.

---

### 7. Community Matters

Participating in the AWS 10,000 AIdeas Competition introduced 
me to a global community of builders. The bi-weekly workshops 
and Builder Center resources significantly accelerated my 
learning.

**Lesson:** Building in public and participating in 
developer communities multiplies your growth.

---

## Technical Specifications

### Repository
**GitHub:** [YOUR_GITHUB_URL]

### Live Demo
[URL if deployed]

### Requirements
- AWS Account (Free Tier works!)
- Node.js 18+
- AWS CLI configured

### Quick Start
```bash
git clone [repo-url]
cd skill-decay-reminder
cd frontend && npm install && npm run dev
```

---

## Future Roadmap

**V2.0 Plans:**
- [ ] Team skill tracking for engineering teams
- [ ] Slack/Teams integration for reminders
- [ ] Mobile app (React Native)
- [ ] API for LMS integration
- [ ] Public skill library

**Competition-Driven Learnings to Incorporate:**
- [ ] Feedback from community voting
- [ ] AWS expert suggestions from finals stage
- [ ] Re:Invent 2026 showcase preparation

---

## Acknowledgements

🙏 **AWS** for the 10,000 AIdeas Competition and $200 credits  
🤖 **Kiro/Amazon Q** for AI-assisted development  
🏢 **Atos** for supporting developer innovation  
🌍 **AWS Builder Community** for inspiration and resources

---

*Built with ❤️ using AWS, React, Python, and Kiro*

*Tags: #aideas-2025 #daily-life-enhancement #EMEA*