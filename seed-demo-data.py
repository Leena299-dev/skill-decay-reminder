"""
SharpEdge Demo Data Seeding Script
===================================
Run this to populate realistic demo data for screenshots.
Usage: python seed-demo-data.py

Prerequisites:
  pip install boto3
  AWS credentials configured (same profile used for deployment)

What this creates:
  - 1 demo user
  - 4 skills at different stages
  - 15 practice sessions showing realistic history
  - Notification log entries for bell icon demo
"""

import boto3
import json
import uuid
from datetime import datetime, timezone, timedelta
from decimal import Decimal

# ── Config ────────────────────────────────────────────────────────────────────
REGION       = 'us-east-1'
DEMO_USER_ID = 'demo-user-sharpedge-001'
DEMO_EMAIL   = 'demo@sharpedge.app'

dynamodb = boto3.resource('dynamodb', region_name=REGION)

def ts(days_ago=0):
    """Unix timestamp for N days ago."""
    dt = datetime.now(timezone.utc) - timedelta(days=days_ago)
    return int(dt.timestamp())

def date_str(days_ago=0):
    """Date string for N days ago."""
    dt = datetime.now(timezone.utc) - timedelta(days=days_ago)
    return dt.strftime('%Y-%m-%d')

def future_date(days_ahead=0):
    """Date string for N days in the future."""
    dt = datetime.now(timezone.utc) + timedelta(days=days_ahead)
    return dt.strftime('%Y-%m-%d')

# ── Skill IDs (fixed so sessions reference correctly) ─────────────────────────
SKILL_AWS    = 'demo-skill-aws-001'
SKILL_PYTHON = 'demo-skill-python-001'
SKILL_SPANISH = 'demo-skill-spanish-001'
SKILL_FRENCH  = 'demo-skill-french-001'

# ── 1. Create User ────────────────────────────────────────────────────────────
def seed_user():
    table = dynamodb.Table('Users')
    table.put_item(Item={
        'userId':    DEMO_USER_ID,
        'email':     DEMO_EMAIL,
        'name':      'Alex Johnson',
        'createdAt': datetime.now(timezone.utc).isoformat(),
        'streak':    7,
    })
    print(f'✅ User created: {DEMO_EMAIL}  (userId: {DEMO_USER_ID})')

# ── 2. Create Skills ──────────────────────────────────────────────────────────
def seed_skills():
    table = dynamodb.Table('Skills')

    skills = [
        # AWS — excellent health, high scores, ready to level up
        {
            'skillId':            SKILL_AWS,
            'userId':             DEMO_USER_ID,
            'skillName':          'AWS Solutions Architect',
            'category':           'certification',
            'proficiency':        'intermediate',
            'importance':         'high',
            'learningDate':       date_str(60),
            'lastPracticeDate':   date_str(1),
            'lastPracticeScore':  Decimal('92'),
            'nextReminderDate':   future_date(6),
            'currentIntervalIndex': Decimal('3'),
            'totalPracticeCount': Decimal('7'),
            'adaptiveDifficulty': 'intermediate_hard',
            'recentScores':       [Decimal('85'), Decimal('90'), Decimal('92')],
            'createdAt':          datetime.now(timezone.utc).isoformat(),
            'healthStatus':       'Excellent',
        },
        # Python — struggling, difficulty decreased, hints showing
        {
            'skillId':            SKILL_PYTHON,
            'userId':             DEMO_USER_ID,
            'skillName':          'Python Programming',
            'category':           'programming',
            'proficiency':        'beginner',
            'importance':         'high',
            'learningDate':       date_str(30),
            'lastPracticeDate':   date_str(5),
            'lastPracticeScore':  Decimal('42'),
            'nextReminderDate':   date_str(2),   # overdue!
            'currentIntervalIndex': Decimal('0'),
            'totalPracticeCount': Decimal('4'),
            'adaptiveDifficulty': 'beginner_easy',
            'recentScores':       [Decimal('55'), Decimal('42'), Decimal('38')],
            'showMoreHints':      True,
            'createdAt':          datetime.now(timezone.utc).isoformat(),
            'healthStatus':       'At Risk',
        },
        # Spanish — good progress, consistent scores
        {
            'skillId':            SKILL_SPANISH,
            'userId':             DEMO_USER_ID,
            'skillName':          'Spanish',
            'category':           'language',
            'proficiency':        'beginner',
            'importance':         'medium',
            'learningDate':       date_str(45),
            'lastPracticeDate':   date_str(3),
            'lastPracticeScore':  Decimal('74'),
            'nextReminderDate':   future_date(4),
            'currentIntervalIndex': Decimal('2'),
            'totalPracticeCount': Decimal('5'),
            'adaptiveDifficulty': 'beginner_hard',
            'recentScores':       [Decimal('65'), Decimal('70'), Decimal('74')],
            'createdAt':          datetime.now(timezone.utc).isoformat(),
            'healthStatus':       'Good',
        },
        # French — brand new, never practised
        {
            'skillId':            SKILL_FRENCH,
            'userId':             DEMO_USER_ID,
            'skillName':          'French',
            'category':           'language',
            'proficiency':        'beginner',
            'importance':         'low',
            'learningDate':       date_str(2),
            'nextReminderDate':   future_date(1),
            'currentIntervalIndex': Decimal('0'),
            'totalPracticeCount': Decimal('0'),
            'lastPracticeScore':  Decimal('0'),
            'adaptiveDifficulty': 'beginner',
            'createdAt':          datetime.now(timezone.utc).isoformat(),
            'healthStatus':       'New',
        },
    ]

    for skill in skills:
        table.put_item(Item=skill)
        print(f'  ✅ Skill: {skill["skillName"]} ({skill["healthStatus"]})')

    print(f'✅ 4 skills created')

# ── 3. Create Practice History ────────────────────────────────────────────────
def seed_practice_history():
    table = dynamodb.Table('PracticeHistory')

    sessions = [
        # AWS — 7 sessions showing improvement trajectory
        {
            'sessionId':   str(uuid.uuid4()),
            'userId':      DEMO_USER_ID,
            'skillId':     SKILL_AWS,
            'skillName':   'AWS Solutions Architect',
            'score':       Decimal('72'),
            'date':        date_str(30),
            'completedAt': ts(30),
            'timeSpent':   Decimal('18'),
            'intervalIndex': Decimal('0'),
            'nextReminderDate': date_str(27),
            'adaptiveDifficulty': 'intermediate',
            'timePerformance': 'on_time',
            'usedAIFeedback': False,
            'totalAttempts': Decimal('1'),
        },
        {
            'sessionId':   str(uuid.uuid4()),
            'userId':      DEMO_USER_ID,
            'skillId':     SKILL_AWS,
            'skillName':   'AWS Solutions Architect',
            'score':       Decimal('78'),
            'date':        date_str(22),
            'completedAt': ts(22),
            'timeSpent':   Decimal('15'),
            'intervalIndex': Decimal('1'),
            'nextReminderDate': date_str(19),
            'adaptiveDifficulty': 'intermediate',
            'timePerformance': 'on_time',
            'usedAIFeedback': False,
            'totalAttempts': Decimal('1'),
        },
        {
            'sessionId':   str(uuid.uuid4()),
            'userId':      DEMO_USER_ID,
            'skillId':     SKILL_AWS,
            'skillName':   'AWS Solutions Architect',
            'score':       Decimal('81'),
            'date':        date_str(15),
            'completedAt': ts(15),
            'timeSpent':   Decimal('20'),
            'intervalIndex': Decimal('1'),
            'nextReminderDate': date_str(12),
            'adaptiveDifficulty': 'intermediate',
            'timePerformance': 'on_time',
            'usedAIFeedback': True,
            'aiWhatWasMissing': 'VPC peering limitations across regions',
            'aiImprovementTip': 'Review cross-region networking options',
            'aiFeedbackScore':  Decimal('81'),
            'totalAttempts': Decimal('2'),
            'firstAttemptScore': Decimal('65'),
        },
        {
            'sessionId':   str(uuid.uuid4()),
            'userId':      DEMO_USER_ID,
            'skillId':     SKILL_AWS,
            'skillName':   'AWS Solutions Architect',
            'score':       Decimal('85'),
            'date':        date_str(10),
            'completedAt': ts(10),
            'timeSpent':   Decimal('14'),
            'intervalIndex': Decimal('2'),
            'nextReminderDate': date_str(7),
            'adaptiveDifficulty': 'intermediate_hard',
            'timePerformance': 'under_time',
            'usedAIFeedback': True,
            'aiWhatWasMissing': 'RDS Multi-AZ vs Read Replica differences',
            'aiImprovementTip': 'Focus on high availability database patterns',
            'aiFeedbackScore':  Decimal('85'),
            'totalAttempts': Decimal('1'),
        },
        {
            'sessionId':   str(uuid.uuid4()),
            'userId':      DEMO_USER_ID,
            'skillId':     SKILL_AWS,
            'skillName':   'AWS Solutions Architect',
            'score':       Decimal('88'),
            'date':        date_str(6),
            'completedAt': ts(6),
            'timeSpent':   Decimal('12'),
            'intervalIndex': Decimal('2'),
            'nextReminderDate': date_str(3),
            'adaptiveDifficulty': 'intermediate_hard',
            'timePerformance': 'under_time',
            'usedAIFeedback': False,
            'totalAttempts': Decimal('1'),
        },
        {
            'sessionId':   str(uuid.uuid4()),
            'userId':      DEMO_USER_ID,
            'skillId':     SKILL_AWS,
            'skillName':   'AWS Solutions Architect',
            'score':       Decimal('90'),
            'date':        date_str(3),
            'completedAt': ts(3),
            'timeSpent':   Decimal('11'),
            'intervalIndex': Decimal('3'),
            'nextReminderDate': future_date(4),
            'adaptiveDifficulty': 'intermediate_hard',
            'timePerformance': 'under_time',
            'usedAIFeedback': True,
            'aiWhatWasMissing': 'CloudFront signed URLs vs signed cookies',
            'aiImprovementTip': 'Practice content delivery security scenarios',
            'aiFeedbackScore':  Decimal('90'),
            'totalAttempts': Decimal('1'),
        },
        {
            'sessionId':   str(uuid.uuid4()),
            'userId':      DEMO_USER_ID,
            'skillId':     SKILL_AWS,
            'skillName':   'AWS Solutions Architect',
            'score':       Decimal('92'),
            'date':        date_str(1),
            'completedAt': ts(1),
            'timeSpent':   Decimal('10'),
            'intervalIndex': Decimal('3'),
            'nextReminderDate': future_date(6),
            'adaptiveDifficulty': 'intermediate_hard',
            'timePerformance': 'under_time',
            'usedAIFeedback': True,
            'aiWhatWasMissing': 'Step Functions vs SQS for workflow orchestration',
            'aiImprovementTip': 'Study serverless orchestration patterns',
            'aiFeedbackScore':  Decimal('92'),
            'totalAttempts': Decimal('1'),
            'difficultyChanged': True,
            'difficultyDirection': 'up',
        },

        # Python — 4 sessions showing decline
        {
            'sessionId':   str(uuid.uuid4()),
            'userId':      DEMO_USER_ID,
            'skillId':     SKILL_PYTHON,
            'skillName':   'Python Programming',
            'score':       Decimal('55'),
            'date':        date_str(20),
            'completedAt': ts(20),
            'timeSpent':   Decimal('25'),
            'intervalIndex': Decimal('0'),
            'nextReminderDate': date_str(17),
            'adaptiveDifficulty': 'beginner',
            'timePerformance': 'over_time',
            'usedAIFeedback': True,
            'aiWhatWasMissing': 'List comprehension syntax and usage',
            'aiImprovementTip': 'Practice rewriting for loops as comprehensions',
            'aiFeedbackScore':  Decimal('55'),
            'totalAttempts': Decimal('1'),
        },
        {
            'sessionId':   str(uuid.uuid4()),
            'userId':      DEMO_USER_ID,
            'skillId':     SKILL_PYTHON,
            'skillName':   'Python Programming',
            'score':       Decimal('48'),
            'date':        date_str(12),
            'completedAt': ts(12),
            'timeSpent':   Decimal('28'),
            'intervalIndex': Decimal('0'),
            'nextReminderDate': date_str(9),
            'adaptiveDifficulty': 'beginner',
            'timePerformance': 'over_time',
            'usedAIFeedback': True,
            'aiWhatWasMissing': 'Dictionary methods and iteration patterns',
            'aiImprovementTip': 'Review .items(), .keys(), .values() methods',
            'aiFeedbackScore':  Decimal('48'),
            'totalAttempts': Decimal('2'),
            'firstAttemptScore': Decimal('30'),
            'difficultyChanged': True,
            'difficultyDirection': 'down',
        },
        {
            'sessionId':   str(uuid.uuid4()),
            'userId':      DEMO_USER_ID,
            'skillId':     SKILL_PYTHON,
            'skillName':   'Python Programming',
            'score':       Decimal('42'),
            'date':        date_str(7),
            'completedAt': ts(7),
            'timeSpent':   Decimal('30'),
            'intervalIndex': Decimal('0'),
            'nextReminderDate': date_str(4),
            'adaptiveDifficulty': 'beginner_easy',
            'timePerformance': 'over_time',
            'usedAIFeedback': True,
            'aiWhatWasMissing': 'Function parameters vs arguments, *args usage',
            'aiImprovementTip': 'Start with simple functions before adding complexity',
            'aiFeedbackScore':  Decimal('42'),
            'totalAttempts': Decimal('3'),
            'firstAttemptScore': Decimal('25'),
        },
        {
            'sessionId':   str(uuid.uuid4()),
            'userId':      DEMO_USER_ID,
            'skillId':     SKILL_PYTHON,
            'skillName':   'Python Programming',
            'score':       Decimal('38'),
            'date':        date_str(5),
            'completedAt': ts(5),
            'timeSpent':   Decimal('32'),
            'intervalIndex': Decimal('0'),
            'nextReminderDate': date_str(2),
            'adaptiveDifficulty': 'beginner_easy',
            'timePerformance': 'over_time',
            'usedAIFeedback': False,
            'totalAttempts': Decimal('1'),
        },

        # Spanish — 5 sessions showing gradual improvement
        {
            'sessionId':   str(uuid.uuid4()),
            'userId':      DEMO_USER_ID,
            'skillId':     SKILL_SPANISH,
            'skillName':   'Spanish',
            'score':       Decimal('58'),
            'date':        date_str(28),
            'completedAt': ts(28),
            'timeSpent':   Decimal('20'),
            'intervalIndex': Decimal('0'),
            'nextReminderDate': date_str(25),
            'adaptiveDifficulty': 'beginner',
            'timePerformance': 'on_time',
            'usedAIFeedback': False,
            'totalAttempts': Decimal('1'),
        },
        {
            'sessionId':   str(uuid.uuid4()),
            'userId':      DEMO_USER_ID,
            'skillId':     SKILL_SPANISH,
            'skillName':   'Spanish',
            'score':       Decimal('63'),
            'date':        date_str(18),
            'completedAt': ts(18),
            'timeSpent':   Decimal('18'),
            'intervalIndex': Decimal('1'),
            'nextReminderDate': date_str(15),
            'adaptiveDifficulty': 'beginner',
            'timePerformance': 'on_time',
            'usedAIFeedback': True,
            'aiWhatWasMissing': 'Ser vs estar distinction in context',
            'aiImprovementTip': 'Use ser for permanent, estar for temporary states',
            'aiFeedbackScore':  Decimal('63'),
            'totalAttempts': Decimal('1'),
        },
        {
            'sessionId':   str(uuid.uuid4()),
            'userId':      DEMO_USER_ID,
            'skillId':     SKILL_SPANISH,
            'skillName':   'Spanish',
            'score':       Decimal('68'),
            'date':        date_str(11),
            'completedAt': ts(11),
            'timeSpent':   Decimal('16'),
            'intervalIndex': Decimal('1'),
            'nextReminderDate': date_str(8),
            'adaptiveDifficulty': 'beginner_hard',
            'timePerformance': 'on_time',
            'usedAIFeedback': True,
            'aiWhatWasMissing': 'Preterite vs imperfect tense selection',
            'aiImprovementTip': 'Preterite for completed actions, imperfect for ongoing',
            'aiFeedbackScore':  Decimal('68'),
            'totalAttempts': Decimal('2'),
            'firstAttemptScore': Decimal('52'),
        },
        {
            'sessionId':   str(uuid.uuid4()),
            'userId':      DEMO_USER_ID,
            'skillId':     SKILL_SPANISH,
            'skillName':   'Spanish',
            'score':       Decimal('70'),
            'date':        date_str(6),
            'completedAt': ts(6),
            'timeSpent':   Decimal('14'),
            'intervalIndex': Decimal('2'),
            'nextReminderDate': date_str(3),
            'adaptiveDifficulty': 'beginner_hard',
            'timePerformance': 'on_time',
            'usedAIFeedback': False,
            'totalAttempts': Decimal('1'),
        },
        {
            'sessionId':   str(uuid.uuid4()),
            'userId':      DEMO_USER_ID,
            'skillId':     SKILL_SPANISH,
            'skillName':   'Spanish',
            'score':       Decimal('74'),
            'date':        date_str(3),
            'completedAt': ts(3),
            'timeSpent':   Decimal('13'),
            'intervalIndex': Decimal('2'),
            'nextReminderDate': future_date(4),
            'adaptiveDifficulty': 'beginner_hard',
            'timePerformance': 'under_time',
            'usedAIFeedback': True,
            'aiWhatWasMissing': 'Subjunctive mood for expressing doubt',
            'aiImprovementTip': 'Focus on trigger phrases like "espero que" + subjunctive',
            'aiFeedbackScore':  Decimal('74'),
            'totalAttempts': Decimal('1'),
        },
    ]

    # ── Streak sessions: one per day for last 7 days ──────────────────────
    # These ensure the dashboard streak counter shows 7
    # Rotates across skills so it looks natural
    streak_skills = [
        (SKILL_AWS,     'AWS Solutions Architect',  'certification', 'intermediate_hard'),
        (SKILL_SPANISH, 'Spanish',                  'language',      'beginner_hard'),
        (SKILL_AWS,     'AWS Solutions Architect',  'certification', 'intermediate_hard'),
        (SKILL_PYTHON,  'Python Programming',       'programming',   'beginner_easy'),
        (SKILL_SPANISH, 'Spanish',                  'language',      'beginner_hard'),
        (SKILL_AWS,     'AWS Solutions Architect',  'certification', 'intermediate_hard'),
        (SKILL_PYTHON,  'Python Programming',       'programming',   'beginner_easy'),
    ]
    streak_scores = [90, 72, 88, 45, 70, 92, 40]

    for i, (skill_id, skill_name, category, difficulty) in enumerate(streak_skills):
        days_ago = 6 - i  # days 6,5,4,3,2,1,0 = 7 consecutive days
        sessions.append({
            'sessionId':          str(uuid.uuid4()),
            'userId':             DEMO_USER_ID,
            'skillId':            skill_id,
            'skillName':          skill_name,
            'score':              Decimal(str(streak_scores[i])),
            'date':               date_str(days_ago),
            'completedAt':        ts(days_ago),
            'timeSpent':          Decimal('15'),
            'intervalIndex':      Decimal('1'),
            'nextReminderDate':   future_date(3),
            'adaptiveDifficulty': difficulty,
            'timePerformance':    'on_time',
            'usedAIFeedback':     False,
            'totalAttempts':      Decimal('1'),
        })

    for s in sessions:
        table.put_item(Item=s)

    print(f'✅ {len(sessions)} practice sessions created')
    print(f'   AWS: 7 sessions (72→92, improving) 📈')
    print(f'   Python: 4 sessions (55→38, struggling) 📉')
    print(f'   Spanish: 5 sessions (58→74, progressing) 📈')
    print(f'   French: 0 sessions (new skill) ✨')
    print(f'   Streak: 7 consecutive days covered ✅')

# ── 4. Create Notification Log ────────────────────────────────────────────────
def seed_notifications():
    table = dynamodb.Table('NotificationLog')

    now = datetime.now(timezone.utc)

    notifications = [
        {
            'userId':           DEMO_USER_ID,
            'notificationKey':  f'practice_due#{SKILL_PYTHON}#{date_str(0)}',
            'type':             'practice_due',
            'skillName':        'Python Programming',
            'skillId':          SKILL_PYTHON,
            'message':          'Python Programming is overdue for practice. Your retention is dropping — 5 minutes now could save hours of relearning later.',
            'createdAt':        (now - timedelta(hours=2)).isoformat(),
            'isRead':           False,
            'ttl':              Decimal(str(ts(-90))),
        },
        {
            'userId':           DEMO_USER_ID,
            'notificationKey':  f'score_improvement#{SKILL_AWS}#{date_str(1)}',
            'type':             'score_improvement',
            'skillName':        'AWS Solutions Architect',
            'skillId':          SKILL_AWS,
            'message':          '🎉 Great improvement! Your AWS Solutions Architect score jumped from 88% to 92% — you\'re on a roll!',
            'createdAt':        (now - timedelta(days=1)).isoformat(),
            'isRead':           False,
            'ttl':              Decimal(str(ts(-90))),
        },
        {
            'userId':           DEMO_USER_ID,
            'notificationKey':  f'streak_milestone#{DEMO_USER_ID}#7',
            'type':             'streak_milestone',
            'message':          '🔥 7-day streak! You\'ve practised every day this week. Consistency is the secret to lasting knowledge.',
            'createdAt':        (now - timedelta(days=2)).isoformat(),
            'isRead':           False,
            'ttl':              Decimal(str(ts(-90))),
        },
        {
            'userId':           DEMO_USER_ID,
            'notificationKey':  f'weekly_summary#{date_str(3)}',
            'type':             'weekly_summary',
            'message':          '📊 Weekly Summary: 5 sessions completed, average score 73%. AWS Solutions Architect leading at 90%. Keep the momentum going!',
            'createdAt':        (now - timedelta(days=3)).isoformat(),
            'isRead':           True,
            'ttl':              Decimal(str(ts(-90))),
        },
        {
            'userId':           DEMO_USER_ID,
            'notificationKey':  f'critical_health#{SKILL_PYTHON}#{date_str(5)}',
            'type':             'critical_health',
            'skillName':        'Python Programming',
            'skillId':          SKILL_PYTHON,
            'message':          '⚠️ Python Programming health has dropped to At Risk. The forgetting curve is working against you — schedule a session today.',
            'createdAt':        (now - timedelta(days=5)).isoformat(),
            'isRead':           True,
            'ttl':              Decimal(str(ts(-90))),
        },
    ]

    for n in notifications:
        table.put_item(Item=n)

    print(f'✅ {len(notifications)} notifications created')
    print(f'   3 unread (bell icon will show badge)')

# ── 5. Seed Notification Preferences ─────────────────────────────────────────
def seed_preferences():
    table = dynamodb.Table('UserNotificationPreferences')
    table.put_item(Item={
        'userId':              DEMO_USER_ID,
        'practiceReminders':   True,
        'overdueAlerts':       True,
        'weeklySummary':       True,
        'streakMilestones':    True,
        'scoreImprovement':    True,
        'inactivityWarnings':  True,
        'criticalHealth':      True,
        'email':               DEMO_EMAIL,
        'updatedAt':           datetime.now(timezone.utc).isoformat(),
    })
    print(f'✅ Notification preferences seeded')

# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    print('\n🌱 SharpEdge Demo Data Seeder')
    print('=' * 45)
    print(f'Region:  {REGION}')
    print(f'UserId:  {DEMO_USER_ID}')
    print(f'Email:   {DEMO_EMAIL}')
    print('=' * 45)

    try:
        seed_user()
        seed_skills()
        seed_practice_history()
        seed_notifications()
        seed_preferences()

        print('\n' + '=' * 45)
        print('✅ All demo data seeded successfully!')
        print('\nTo log in with this demo account:')
        print(f'  Email: {DEMO_EMAIL}')
        print('\nWhat you will see:')
        print('  Dashboard: Python Programming as Priority')
        print('             (overdue, At Risk, 38% last score)')
        print('  Skills: AWS Excellent, Spanish Good,')
        print('          Python At Risk, French New')
        print('  Analytics: AI insights with real trends')
        print('  Bell icon: 3 unread notifications')
        print('\nTo remove demo data later run:')
        print(f'  python seed-demo-data.py --cleanup')

    except Exception as e:
        print(f'\n❌ Error: {e}')
        print('Make sure your AWS credentials are configured')
        print('and you have write access to DynamoDB tables')
        raise

if __name__ == '__main__':
    import sys
    if '--cleanup' in sys.argv:
        print('🧹 Cleanup not yet implemented')
        print('Delete demo data manually from DynamoDB console')
        print(f'Filter by userId: {DEMO_USER_ID}')
    else:
        main()
