import boto3
import json
import logging
import os
import re
from datetime import datetime, timezone, timedelta
from decimal import Decimal

logger = logging.getLogger()
logger.setLevel(logging.INFO)

dynamodb = boto3.resource('dynamodb', region_name='us-east-1')
bedrock  = boto3.client('bedrock-runtime', region_name='us-east-1')

USERS_TABLE   = os.environ.get('USERS_TABLE',    'Users')
SKILLS_TABLE  = os.environ.get('SKILLS_TABLE',   'Skills')
HISTORY_TABLE = os.environ.get('HISTORY_TABLE',  'PracticeHistory')
BEDROCK_MODEL = os.environ.get('BEDROCK_MODEL_ID', 'us.amazon.nova-micro-v1:0')
CACHE_MAX_AGE_HOURS = 4

CORS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
}

SYSTEM_PROMPT = (
    "You are an expert learning coach analysing a student's skill retention data. "
    "Be specific, encouraging and actionable. Always reference actual skill names and "
    "real numbers from the data. Never be generic. Every insight should feel "
    "personally written for this student. Always respond with valid JSON only — "
    "no markdown, no explanation, no code fences."
)


# ── Helpers ───────────────────────────────────────────────────────────────────

def to_py(obj):
    """Recursively convert DynamoDB Decimals to int/float."""
    if isinstance(obj, Decimal):
        n = float(obj)
        return int(n) if n == int(n) else n
    if isinstance(obj, list):
        return [to_py(i) for i in obj]
    if isinstance(obj, dict):
        return {k: to_py(v) for k, v in obj.items()}
    return obj


def extract_json(text):
    """Parse JSON from Bedrock reply, handling markdown fences gracefully."""
    try:
        return json.loads(text)
    except Exception:
        pass
    m = re.search(r'```(?:json)?\s*([\s\S]*?)```', text)
    if m:
        try:
            return json.loads(m.group(1).strip())
        except Exception:
            pass
    m = re.search(r'\{[\s\S]*\}', text)
    if m:
        try:
            return json.loads(m.group(0))
        except Exception:
            pass
    return None


def call_bedrock(user_prompt, max_tokens=1200):
    resp = bedrock.converse(
        modelId=BEDROCK_MODEL,
        system=[{'text': SYSTEM_PROMPT}],
        messages=[{'role': 'user', 'content': [{'text': user_prompt}]}],
        inferenceConfig={'maxTokens': max_tokens, 'temperature': 0.7},
    )
    return resp['output']['message']['content'][0]['text']


# ── DynamoDB helpers ──────────────────────────────────────────────────────────

def get_skills(user_id):
    table = dynamodb.Table(SKILLS_TABLE)
    resp = table.query(
        IndexName='userId-index',
        KeyConditionExpression=boto3.dynamodb.conditions.Key('userId').eq(user_id),
    )
    return [to_py(item) for item in resp.get('Items', [])]


def get_all_history(user_id, days=90):
    """
    Fetch all practice sessions for the user within the last `days` days.
    Uses 90-day default so self-marked sessions older than 14 days are included.
    No filtering on usedAIFeedback — every session counts.
    """
    table = dynamodb.Table(HISTORY_TABLE)
    cutoff = int((datetime.now(timezone.utc) - timedelta(days=days)).timestamp())
    resp = table.query(
        KeyConditionExpression=(
            boto3.dynamodb.conditions.Key('userId').eq(user_id) &
            boto3.dynamodb.conditions.Key('completedAt').gte(cutoff)
        )
    )
    return [to_py(item) for item in resp.get('Items', [])]


def get_cached_analysis(user_id):
    """Return (analysis_dict, generated_at_str) or (None, None)."""
    table = dynamodb.Table(USERS_TABLE)
    resp = table.get_item(Key={'userId': user_id})
    item = resp.get('Item', {})
    raw = item.get('lastAnalysis')
    ts  = item.get('lastAnalysisAt')
    if not raw or not ts:
        return None, None
    try:
        return json.loads(raw), str(ts)
    except Exception:
        return None, None


def save_cached_analysis(user_id, analysis, generated_at):
    table = dynamodb.Table(USERS_TABLE)
    table.update_item(
        Key={'userId': user_id},
        UpdateExpression='SET lastAnalysis = :a, lastAnalysisAt = :t',
        ExpressionAttributeValues={':a': json.dumps(analysis), ':t': generated_at},
    )


# ── Skill metadata helpers ────────────────────────────────────────────────────

INTERVALS = [1, 3, 7, 14, 30, 60]


def calculate_health(skill):
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


def days_since_last_practice(skill):
    if not skill.get('totalPracticeCount', 0):
        return None
    idx = min(int(skill.get('currentIntervalIndex', 0)), len(INTERVALS) - 1)
    next_reminder = skill.get('nextReminderDate')
    if not next_reminder:
        return None
    try:
        next_date = datetime.fromisoformat(str(next_reminder)).date()
    except Exception:
        return None
    last_date = next_date - timedelta(days=INTERVALS[idx])
    today = datetime.now(timezone.utc).date()
    return max(0, (today - last_date).days)


# ── Full analysis ─────────────────────────────────────────────────────────────

def handle_full_analysis(user_id, force_refresh):
    # Check cache unless forced
    if not force_refresh:
        cached, cached_at = get_cached_analysis(user_id)
        if cached and cached_at:
            try:
                ts = datetime.fromisoformat(cached_at.replace('Z', '+00:00'))
                age_hours = (datetime.now(timezone.utc) - ts).total_seconds() / 3600
                if age_hours < CACHE_MAX_AGE_HOURS:
                    logger.info(f'Returning cached analysis ({age_hours:.1f}h old)')
                    cached['generatedAt'] = cached_at
                    cached['fromCache'] = True
                    return cached
            except Exception as e:
                logger.warning(f'Cache check failed: {e}')

    # Fetch data — all sessions from last 90 days regardless of AI feedback
    skills  = get_skills(user_id)
    history = get_all_history(user_id, days=90)

    # Debug logging so CloudWatch shows exactly what was found
    logger.info(f'Skills found: {len(skills)}')
    logger.info(f'Sessions found (90d): {len(history)}')
    logger.info(f'Sessions with AI feedback: {sum(1 for s in history if s.get("usedAIFeedback"))}')
    logger.info(f'Sessions without AI feedback (self-marked): {sum(1 for s in history if not s.get("usedAIFeedback"))}')
    if skills:
        logger.info(f'Skill names: {[s.get("skillName") for s in skills]}')
    if history:
        logger.info(f'Score range: {min(s.get("score", 0) for s in history)} – {max(s.get("score", 0) for s in history)}')

    # No skills at all → encouraging empty state (no Bedrock call)
    if not skills:
        return {
            'overallInsight': 'Add some skills to SharpEdge to receive personalised AI learning insights!',
            'focusSkill': None, 'momentumSkill': None, 'strengthSkill': None,
            'weeklyRecommendation': 'Start by adding a skill you want to maintain or improve.',
            'skillInsights': [],
            'generatedAt': datetime.now(timezone.utc).isoformat(),
            'fromCache': False,
        }

    # No sessions at all → encouraging first-session nudge (no Bedrock call)
    if not history:
        return {
            'overallInsight': (
                f'You have {len(skills)} skill{"s" if len(skills) != 1 else ""} ready to go — '
                'complete your first practice session to unlock personalised AI insights!'
            ),
            'focusSkill': None, 'momentumSkill': None, 'strengthSkill': None,
            'weeklyRecommendation': (
                f'Start with your first practice session on {skills[0].get("skillName", "any skill")} today.'
            ),
            'skillInsights': [],
            'generatedAt': datetime.now(timezone.utc).isoformat(),
            'fromCache': False,
        }

    # Build skill summaries for the prompt
    skill_summaries = []
    for s in skills:
        skill_summaries.append({
            'skillName':             s.get('skillName', 'Unknown'),
            'category':              s.get('category', ''),
            'healthScore':           calculate_health(s),
            'adaptiveDifficulty':    s.get('adaptiveDifficulty') or s.get('proficiency', ''),
            'daysSinceLastPractice': days_since_last_practice(s),
            'totalSessions':         s.get('totalPracticeCount', 0),
            'lastScore':             s.get('lastPracticeScore'),
            'nextReminderDate':      s.get('nextReminderDate', ''),
        })

    # Build session summaries — most recent 20, all sessions count
    # AI feedback fields are included only when they actually exist
    session_summaries = []
    for h in sorted(history, key=lambda x: x.get('completedAt', 0), reverse=True)[:20]:
        s = {
            'skillName':     h.get('skillName', 'Unknown'),
            'score':         h.get('score'),
            'date':          h.get('date', ''),
            'totalAttempts': h.get('totalAttempts', 1),
            'timePerformance': h.get('lastTimePerformance') or h.get('timePerformance', ''),
        }
        # Only add AI feedback fields if the session used AI evaluation
        if h.get('usedAIFeedback'):
            ai_fb = {}
            if h.get('aiWhatWasMissing'):
                ai_fb['whatWasMissing'] = h['aiWhatWasMissing']
            if h.get('aiImprovementTip'):
                ai_fb['improvementTip'] = h['aiImprovementTip']
            if ai_fb:
                s['aiFeedback'] = ai_fb
        # Include multi-attempt improvement if relevant
        if h.get('totalAttempts', 1) > 1 and h.get('firstAttemptScore') is not None:
            s['firstAttemptScore'] = h['firstAttemptScore']
        session_summaries.append(s)

    user_prompt = f"""Analyse this student's learning data and provide personalised insights.

SKILLS ({len(skill_summaries)}):
{json.dumps(skill_summaries, indent=2)}

RECENT SESSIONS ({len(session_summaries)} most recent, all session types included):
{json.dumps(session_summaries, indent=2)}

Respond in this EXACT JSON format (no extra text, no markdown):
{{
  "overallInsight": "2-3 sentences summarising their overall progress, referencing specific skill names and scores",
  "focusSkill": {{
    "name": "skill needing most attention right now",
    "reason": "specific reason with numbers"
  }},
  "momentumSkill": {{
    "name": "skill with the best recent improvement trajectory",
    "reason": "specific evidence of momentum"
  }},
  "strengthSkill": {{
    "name": "the student's strongest performing skill",
    "reason": "specific score or health evidence"
  }},
  "weeklyRecommendation": "one specific, actionable recommendation for this week",
  "skillInsights": [
    {{
      "skillName": "exact skill name from data",
      "insight": "specific observation about this skill",
      "trend": "improving|stable|declining|new",
      "action": "specific next action the student should take"
    }}
  ]
}}"""

    # Bedrock call — wrapped so a failure returns a soft error rather than a 500
    try:
        reply = call_bedrock(user_prompt, max_tokens=1200)
        logger.info(f'Bedrock reply (first 300 chars): {reply[:300]}')
    except Exception as bedrock_err:
        logger.error(f'Bedrock call failed: {bedrock_err}', exc_info=True)
        return {
            'error': True,
            'errorType': 'bedrock_failure',
            'message': 'AI analysis temporarily unavailable. Please try again in a moment.',
            'generatedAt': datetime.now(timezone.utc).isoformat(),
            'fromCache': False,
        }

    result = extract_json(reply)
    if not result:
        logger.error(f'JSON parse failed. Raw reply: {reply[:500]}')
        return {
            'error': True,
            'errorType': 'parse_failure',
            'message': 'AI response could not be parsed. Please try Refresh.',
            'generatedAt': datetime.now(timezone.utc).isoformat(),
            'fromCache': False,
        }

    generated_at = datetime.now(timezone.utc).isoformat()
    result['generatedAt'] = generated_at
    result['fromCache']   = False

    try:
        save_cached_analysis(user_id, result, generated_at)
    except Exception as cache_err:
        logger.warning(f'Failed to save analysis cache: {cache_err}')

    logger.info('Full analysis complete and cached successfully')
    return result


# ── Session insight ───────────────────────────────────────────────────────────

def handle_session_insight(body):
    session_data = {
        'skillName':          body.get('skillName', ''),
        'category':           body.get('category', ''),
        'currentScore':       body.get('currentScore'),
        'adaptiveDifficulty': body.get('adaptiveDifficulty', ''),
        'difficultyChanged':  body.get('difficultyChanged', False),
        'difficultyDirection': body.get('difficultyDirection', ''),
        'totalAttempts':      body.get('totalAttempts', 1),
        'timePerformance':    body.get('timePerformance', ''),
    }
    # Only include AI feedback fields if this session used AI evaluation
    if body.get('usedAIFeedback'):
        session_data['usedAIFeedback'] = True
        if body.get('aiWhatWasMissing'):
            session_data['aiWhatWasMissing'] = body['aiWhatWasMissing']
    # Only include attempt improvement if there were multiple attempts
    if body.get('totalAttempts', 1) > 1 and body.get('firstAttemptScore') is not None:
        session_data['firstAttemptScore'] = body['firstAttemptScore']

    logger.info(f'Session insight request: skill={session_data["skillName"]}, score={session_data["currentScore"]}')

    user_prompt = f"""The student just completed a practice session. Provide a brief, encouraging, personalised insight.

SESSION DATA:
{json.dumps(session_data, indent=2)}

Respond in EXACT JSON format (no extra text, no markdown):
{{
  "sessionInsight": "2-3 sentences about this specific session — reference their actual score, any improvement from previous attempts if totalAttempts > 1, and mention the difficulty change if difficultyChanged is true",
  "nextSessionTip": "1 sentence specific tip for their next practice session on this skill",
  "trend": "improving|consistent|needs_attention"
}}"""

    try:
        reply = call_bedrock(user_prompt, max_tokens=350)
        logger.info(f'Session insight reply (first 200 chars): {reply[:200]}')
    except Exception as bedrock_err:
        logger.error(f'Bedrock session insight failed: {bedrock_err}')
        return {
            'error': True,
            'errorType': 'bedrock_failure',
            'message': 'Session insight temporarily unavailable.',
        }

    result = extract_json(reply)
    if not result:
        logger.error(f'Session insight JSON parse failed. Raw: {reply[:300]}')
        return {
            'error': True,
            'errorType': 'parse_failure',
            'message': 'Could not parse session insight.',
        }

    return result


# ── Handler ───────────────────────────────────────────────────────────────────

def lambda_handler(event, context):
    logger.info(f'progress-analysis invoked | method={event.get("httpMethod")}')

    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': '{}'}

    try:
        body = json.loads(event.get('body', '{}') or '{}')
    except (json.JSONDecodeError, TypeError):
        return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'Invalid JSON'})}

    user_id      = body.get('userId', '').strip()
    request_type = body.get('requestType', '').strip()

    logger.info(f'userId={user_id}, requestType={request_type}')

    if not user_id:
        return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'userId is required'})}
    if not request_type:
        return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'requestType is required'})}

    try:
        if request_type == 'full_analysis':
            force_refresh = bool(body.get('forceRefresh', False))
            result = handle_full_analysis(user_id, force_refresh)
        elif request_type == 'session_insight':
            result = handle_session_insight(body)
        else:
            return {
                'statusCode': 400,
                'headers': CORS,
                'body': json.dumps({'error': f'Unknown requestType: {request_type}'}),
            }

        # Always return 200 — let the client distinguish error types via result.error
        return {'statusCode': 200, 'headers': CORS, 'body': json.dumps(result)}

    except Exception as e:
        logger.error(f'Unhandled error in progress-analysis: {e}', exc_info=True)
        return {
            'statusCode': 200,  # 200 so frontend .then() fires instead of .catch()
            'headers': CORS,
            'body': json.dumps({
                'error': True,
                'errorType': 'unhandled',
                'message': 'AI analysis temporarily unavailable. Please try again in a moment.',
            }),
        }
