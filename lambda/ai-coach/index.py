import boto3
import json
import logging
import os
from datetime import datetime, timezone, timedelta
from decimal import Decimal

logger = logging.getLogger()
logger.setLevel(logging.INFO)

dynamodb = boto3.resource('dynamodb', region_name='us-east-1')
bedrock = boto3.client('bedrock-runtime', region_name='us-east-1')

SKILLS_TABLE = os.environ.get('SKILLS_TABLE', 'Skills')
HISTORY_TABLE = os.environ.get('HISTORY_TABLE', 'PracticeHistory')
USERS_TABLE  = os.environ.get('USERS_TABLE', 'Users')
BEDROCK_MODEL_ID = os.environ.get('BEDROCK_MODEL_ID', 'us.amazon.nova-micro-v1:0')
MAX_TOKENS = 600
MAX_HISTORY = 10  # conversation turns to keep

CORS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
}


# ── Helpers ──────────────────────────────────────────────────────────────────

def decimal_to_number(obj):
    if isinstance(obj, Decimal):
        n = float(obj)
        return int(n) if n == int(n) else n
    raise TypeError


def get_latest_analysis(user_id):
    """Fetch cached AI progress analysis from Users table (best-effort)."""
    try:
        table = dynamodb.Table(USERS_TABLE)
        resp = table.get_item(Key={'userId': user_id})
        raw = resp.get('Item', {}).get('lastAnalysis')
        return json.loads(raw) if raw else None
    except Exception:
        return None


def get_skills(user_id):
    table = dynamodb.Table(SKILLS_TABLE)
    resp = table.query(
        IndexName='userId-index',
        KeyConditionExpression=boto3.dynamodb.conditions.Key('userId').eq(user_id)
    )
    return resp.get('Items', [])


def get_practice_history(user_id, days=90):
    table = dynamodb.Table(HISTORY_TABLE)
    cutoff = int((datetime.now(timezone.utc) - timedelta(days=days)).timestamp())
    resp = table.query(
        KeyConditionExpression=(
            boto3.dynamodb.conditions.Key('userId').eq(user_id) &
            boto3.dynamodb.conditions.Key('completedAt').gte(cutoff)
        )
    )
    return resp.get('Items', [])


def calculate_health(skill):
    """Replicates skill-manager health formula: 10 pts/day overdue, 0–100."""
    next_reminder = skill.get('nextReminderDate')
    if not next_reminder:
        return 100
    today = datetime.now(timezone.utc).date()
    try:
        rd = datetime.fromisoformat(str(next_reminder)).date()
    except Exception:
        return 100
    days_overdue = (today - rd).days
    return max(0, 100 - days_overdue * 10) if days_overdue > 0 else 100


def compute_stats(skills, history):
    today = datetime.now(timezone.utc).date()
    week_end = today + timedelta(days=7)

    # Unique practice days for streak
    days_practised = set()
    for h in history:
        ts = h.get('completedAt')
        if ts:
            v = decimal_to_number(ts) if isinstance(ts, Decimal) else ts
            days_practised.add(datetime.fromtimestamp(v, tz=timezone.utc).date())

    streak = 0
    cursor = today
    while cursor in days_practised:
        streak += 1
        cursor -= timedelta(days=1)

    # Overall totals
    total_sessions = len(history)
    all_scores = [
        (decimal_to_number(h['score']) if isinstance(h.get('score'), Decimal) else h.get('score', 0))
        for h in history if h.get('score') is not None
    ]
    overall_avg = round(sum(all_scores) / len(all_scores)) if all_scores else 0

    # Per-skill aggregates: last practice ts + avg score
    skill_data = {}
    for h in history:
        sid = h.get('skillId')
        if not sid:
            continue
        ts = h.get('completedAt')
        score = decimal_to_number(h['score']) if isinstance(h.get('score'), Decimal) else h.get('score', 0)
        if sid not in skill_data:
            skill_data[sid] = {'scores': [], 'last_ts': 0}
        skill_data[sid]['scores'].append(score)
        if ts:
            v = decimal_to_number(ts) if isinstance(ts, Decimal) else ts
            skill_data[sid]['last_ts'] = max(skill_data[sid]['last_ts'], v)

    def _to_num(v):
        return decimal_to_number(v) if isinstance(v, Decimal) else v

    sorted_history = sorted(history, key=lambda x: _to_num(x.get('completedAt', 0)), reverse=True)

    # Recent AI feedback (last 3 sessions that used AI evaluation)
    recent_ai_feedback = []
    for h in sorted_history:
        if not h.get('usedAIFeedback') or not h.get('aiImprovementTip'):
            continue
        raw_score = _to_num(h.get('aiFeedbackScore') or h.get('score', 0))
        recent_ai_feedback.append({
            'skillName': h.get('skillName', 'Unknown'),
            'score': int(raw_score),
            'whatWasMissing': h.get('aiWhatWasMissing', ''),
            'improvementTip': h.get('aiImprovementTip', ''),
        })
        if len(recent_ai_feedback) >= 3:
            break

    # Recent multi-attempt sessions (last 3 where user tried again after AI feedback)
    recent_multi_attempts = []
    for h in sorted_history:
        total_att = int(_to_num(h.get('totalAttempts', 1)))
        if total_att <= 1:
            continue
        first_score = h.get('firstAttemptScore')
        final_score = _to_num(h.get('score', 0))
        if first_score is not None:
            first_score = int(_to_num(first_score))
        recent_multi_attempts.append({
            'skillName': h.get('skillName', 'Unknown'),
            'totalAttempts': total_att,
            'firstScore': first_score,
            'finalScore': int(final_score),
            'improved': first_score is not None and int(final_score) > first_score,
        })
        if len(recent_multi_attempts) >= 3:
            break

    # Overdue / due this week counts
    overdue_count = 0
    due_week_count = 0
    for skill in skills:
        next_reminder = skill.get('nextReminderDate')
        if not next_reminder:
            continue
        try:
            rd = datetime.fromisoformat(str(next_reminder)).date()
        except Exception:
            continue
        if rd < today:
            overdue_count += 1
        elif rd <= week_end:
            due_week_count += 1

    return {
        'streak': streak,
        'totalSessions': total_sessions,
        'avgScore': overall_avg,
        'overdue': overdue_count,
        'dueThisWeek': due_week_count,
        'skillData': skill_data,
        'recentAIFeedback': recent_ai_feedback,
        'recentMultiAttempts': recent_multi_attempts,
    }


def build_system_prompt(skills, stats, latest_analysis=None):
    today = datetime.now(timezone.utc).date()
    skill_data = stats['skillData']

    skill_lines = []
    for skill in skills:
        name = skill.get('skillName', 'Unknown')
        category = skill.get('category', '')
        proficiency = skill.get('proficiency', '')
        health = calculate_health(skill)
        skill_id = skill.get('skillId', '')
        next_reminder = skill.get('nextReminderDate', '')

        # Days since last practice
        sdata = skill_data.get(skill_id, {})
        last_ts = sdata.get('last_ts', 0)
        if last_ts:
            days_since = (datetime.now(timezone.utc) - datetime.fromtimestamp(last_ts, tz=timezone.utc)).days
            practice_str = f'{days_since}d ago' if days_since > 0 else 'today'
        else:
            practice_str = 'never'

        # Per-skill avg score
        scores = sdata.get('scores', [])
        skill_avg = f'{round(sum(scores)/len(scores))}%' if scores else 'no data'

        # Reminder status
        reminder_str = ''
        if next_reminder:
            try:
                rd = datetime.fromisoformat(str(next_reminder)).date()
                days_overdue = (today - rd).days
                if days_overdue > 0:
                    reminder_str = f' ⚠️ {days_overdue}d OVERDUE'
                elif days_overdue == 0:
                    reminder_str = ' (due TODAY)'
                else:
                    reminder_str = f' (due in {-days_overdue}d)'
            except Exception:
                pass

        adaptive_diff = skill.get('adaptiveDifficulty') or f'{proficiency}_medium'
        diff_label = adaptive_diff.replace('_', ' ').title()
        time_perf = skill.get('lastTimePerformance', '')
        diff_reason = skill.get('difficultyChangeReason', '')
        extra = []
        if time_perf:
            extra.append(f'last time={time_perf}')
        if diff_reason:
            extra.append(f'last adjustment="{diff_reason}"')
        extra_str = (', ' + ', '.join(extra)) if extra else ''
        skill_lines.append(
            f'  • {name} ({category}, {proficiency}): health={health}%, '
            f'avg score={skill_avg}, last practised={practice_str}{reminder_str}, '
            f'adaptive difficulty={diff_label}{extra_str}'
        )

    skills_section = '\n'.join(skill_lines) if skill_lines else '  (no skills added yet — encourage the user to add some!)'

    ai_feedback_items = stats.get('recentAIFeedback', [])
    if ai_feedback_items:
        ai_feedback_lines = [
            f'  • {fb["skillName"]}: score {fb["score"]}%'
            + (f', missing="{fb["whatWasMissing"]}"' if fb.get('whatWasMissing') else '')
            + (f', tip="{fb["improvementTip"]}"' if fb.get('improvementTip') else '')
            for fb in ai_feedback_items
        ]
        ai_feedback_section = '\n'.join(ai_feedback_lines)
    else:
        ai_feedback_section = '  (no AI-evaluated sessions yet)'

    multi_attempt_items = stats.get('recentMultiAttempts', [])
    if multi_attempt_items:
        multi_lines = []
        for ma in multi_attempt_items:
            improvement = ''
            if ma.get('firstScore') is not None:
                diff = ma['finalScore'] - ma['firstScore']
                improvement = f', improved by {diff:+d}%' if diff != 0 else ', no score change'
            multi_lines.append(
                f'  • {ma["skillName"]}: {ma["totalAttempts"]} attempts, '
                f'first={ma["firstScore"]}%, final={ma["finalScore"]}%{improvement}'
            )
        multi_attempt_section = '\n'.join(multi_lines)
    else:
        multi_attempt_section = '  (no multi-attempt sessions yet)'

    # Latest progress analysis (from progress-analysis Lambda cache)
    analysis_section = ''
    if latest_analysis:
        focus    = latest_analysis.get('focusSkill')    or {}
        momentum = latest_analysis.get('momentumSkill') or {}
        overview = latest_analysis.get('overallInsight', '')
        analysis_section = f"""

LATEST AI PROGRESS ANALYSIS:
  Overview: {overview}
  Focus skill: {focus.get('name', 'N/A')} — {focus.get('reason', '')}
  Momentum skill: {momentum.get('name', 'N/A')} — {momentum.get('reason', '')}"""

    return f"""You are an expert AI Learning Coach for SharpEdge, an app that uses the forgetting curve and spaced repetition to prevent skill decay.

You have access to this user's real learning data:

SKILLS ({len(skills)} total):
{skills_section}

PRACTICE SUMMARY:
  • Total sessions: {stats['totalSessions']}
  • Overall average score: {stats['avgScore']}%
  • Current streak: {stats['streak']} day(s)
  • Skills overdue: {stats['overdue']}
  • Skills due this week: {stats['dueThisWeek']}

RECENT AI FEEDBACK (last 3 AI-evaluated sessions):
{ai_feedback_section}

RECENT MULTI-ATTEMPT SESSIONS (user tried again after seeing AI feedback):
{multi_attempt_section}{analysis_section}

Use this data to give highly personalised, specific advice. Always be encouraging, warm and motivating. Keep responses concise — 2–4 sentences for simple questions, structured with bullet points for complex advice. When recommending practice, be specific about which skill and why. Never make up data — only reference the actual skills and scores provided above. Base your advice on spaced repetition and forgetting curve science. If asked about a skill not in their list, suggest they add it to SharpEdge."""


# ── Handler ───────────────────────────────────────────────────────────────────

def lambda_handler(event, context):
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': '{}'}

    try:
        body = json.loads(event.get('body', '{}'))
    except (json.JSONDecodeError, TypeError):
        return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'Invalid JSON body'})}

    user_id = body.get('userId', '').strip()
    message = body.get('message', '').strip()
    conv_history = body.get('conversationHistory', [])

    if not user_id or not message:
        return {'statusCode': 400, 'headers': CORS,
                'body': json.dumps({'error': 'userId and message are required'})}

    logger.info(f"[ai-coach] userId={user_id} message_len={len(message)} history_turns={len(conv_history)}")

    # Fetch user context
    skills = get_skills(user_id)
    history = get_practice_history(user_id, days=90)
    stats = compute_stats(skills, history)
    latest_analysis = get_latest_analysis(user_id)
    system_prompt = build_system_prompt(skills, stats, latest_analysis)

    # Build Bedrock messages — keep last MAX_HISTORY turns, append current
    trimmed = conv_history[-(MAX_HISTORY - 1):] if len(conv_history) >= MAX_HISTORY else conv_history
    bedrock_messages = [
        {'role': msg['role'], 'content': [{'text': str(msg['content'])}]}
        for msg in trimmed
        if msg.get('role') in ('user', 'assistant') and msg.get('content')
    ] + [
        {'role': 'user', 'content': [{'text': message}]}
    ]

    try:
        response = bedrock.converse(
            modelId=BEDROCK_MODEL_ID,
            system=[{'text': system_prompt}],
            messages=bedrock_messages,
            inferenceConfig={'maxTokens': MAX_TOKENS, 'temperature': 0.7},
        )
        reply = response['output']['message']['content'][0]['text']
        logger.info(f"[ai-coach] Bedrock replied ({len(reply)} chars)")
    except Exception as e:
        logger.error(f"[ai-coach] Bedrock error: {e}")
        return {'statusCode': 500, 'headers': CORS,
                'body': json.dumps({'error': f'AI service error: {str(e)}'})}

    return {
        'statusCode': 200,
        'headers': CORS,
        'body': json.dumps({
            'response': reply,
            'timestamp': datetime.now(timezone.utc).isoformat(),
        }),
    }
