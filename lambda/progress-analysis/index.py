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
    Query PracticeHistory directly by userId + completedAt.
    Uses 90-day window. No filtering on score, usedAIFeedback, or anything else —
    every session counts.
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


# ── Skill health ───────────────────────────────────────────────────────────────

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

    # ── Fetch raw data ─────────────────────────────────────────────────────────
    skills  = get_skills(user_id)
    history = get_all_history(user_id, days=90)

    # Debug: log exactly what we found
    logger.info(f'Skills found: {len(skills)}')
    logger.info(f'Sessions found (90d): {len(history)}')
    if skills:
        logger.info(f'Skill names: {[s.get("skillName") for s in skills]}')
    if history:
        scores = [h.get('score') for h in history if h.get('score') is not None]
        logger.info(f'Score range: {min(scores)} – {max(scores)}' if scores else 'No scores found')
        logger.info(f'Sessions with AI feedback: {sum(1 for h in history if h.get("usedAIFeedback"))}')
        logger.info(f'Self-marked sessions: {sum(1 for h in history if not h.get("usedAIFeedback"))}')

    # No skills → encourage the user to add some
    if not skills:
        logger.info('Early return: no skills found')
        return {
            'overallInsight': 'Add some skills to SharpEdge to receive personalised AI learning insights!',
            'focusSkill': None, 'momentumSkill': None, 'strengthSkill': None,
            'weeklyRecommendation': 'Start by adding a skill you want to maintain or improve.',
            'skillInsights': [],
            'generatedAt': datetime.now(timezone.utc).isoformat(),
            'fromCache': False,
        }

    # No sessions at all → nudge toward first practice
    if not history:
        logger.info('Early return: no sessions found in 90-day window')
        skill_names = ', '.join(s.get('skillName', '') for s in skills[:3])
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

    # ── Compute per-skill stats from PracticeHistory (not from Skills table) ───
    # Group all sessions by skillName
    skill_history_map = {}  # skillName -> [session, ...]
    for h in history:
        name = h.get('skillName', '').strip()
        if not name:
            continue
        if name not in skill_history_map:
            skill_history_map[name] = []
        skill_history_map[name].append(h)

    logger.info(f'Skills with practice history: {list(skill_history_map.keys())}')

    today = datetime.now(timezone.utc).date()

    # Build context for each skill in the portfolio
    practised_skills_context   = []
    unpractised_skills_context = []

    for s in skills:
        name     = s.get('skillName', 'Unknown').strip()
        category = s.get('category', '')
        health   = calculate_health(s)
        sessions = skill_history_map.get(name, [])

        if sessions:
            # Compute stats purely from PracticeHistory
            scores = [h.get('score') for h in sessions if h.get('score') is not None]
            avg_score    = round(sum(scores) / len(scores)) if scores else None
            latest_sess  = max(sessions, key=lambda h: h.get('completedAt', 0))
            last_score   = latest_sess.get('score')
            last_ts      = latest_sess.get('completedAt', 0)
            days_since   = (today - datetime.fromtimestamp(last_ts, tz=timezone.utc).date()).days if last_ts else None

            # Score trend: compare last 2 sessions
            sorted_sess  = sorted(sessions, key=lambda h: h.get('completedAt', 0))
            trend        = 'stable'
            if len(sorted_sess) >= 2:
                older  = sorted_sess[-2].get('score', 0) or 0
                newer  = sorted_sess[-1].get('score', 0) or 0
                if newer > older + 5:
                    trend = 'improving'
                elif newer < older - 5:
                    trend = 'declining'

            practised_skills_context.append({
                'skillName':         name,
                'category':          category,
                'status':            'practised',
                'healthScore':       health,
                'totalSessions':     len(sessions),
                'averageScore':      avg_score,
                'lastScore':         last_score,
                'daysSincePractice': days_since,
                'scoreTrend':        trend,
                'adaptiveDifficulty': s.get('adaptiveDifficulty') or s.get('proficiency', ''),
            })
        else:
            unpractised_skills_context.append({
                'skillName':  name,
                'category':   category,
                'status':     'never_practised',
                'proficiency': s.get('proficiency', ''),
            })

    logger.info(f'Practised skills: {[s["skillName"] for s in practised_skills_context]}')
    logger.info(f'Unpractised skills: {[s["skillName"] for s in unpractised_skills_context]}')

    # Recent session log (last 20, sorted newest first)
    sorted_history = sorted(history, key=lambda h: h.get('completedAt', 0), reverse=True)
    session_summaries = []
    for h in sorted_history[:20]:
        s = {
            'skillName':     h.get('skillName', 'Unknown'),
            'score':         h.get('score'),
            'totalAttempts': h.get('totalAttempts', 1),
        }
        if h.get('usedAIFeedback') and h.get('aiWhatWasMissing'):
            s['aiFeedback'] = {'whatWasMissing': h['aiWhatWasMissing']}
        if h.get('totalAttempts', 1) > 1 and h.get('firstAttemptScore') is not None:
            s['firstAttemptScore'] = h['firstAttemptScore']
        session_summaries.append(s)

    # ── Build Bedrock prompt ───────────────────────────────────────────────────
    unpractised_names = [s['skillName'] for s in unpractised_skills_context]
    unpractised_note = (
        f'\nNOT YET PRACTISED (recommend when to start based on current workload): '
        f'{", ".join(unpractised_names)}'
        if unpractised_names else ''
    )

    user_prompt = f"""Analyse this student's learning data and provide personalised insights.

SKILLS PORTFOLIO:

PRACTISED SKILLS ({len(practised_skills_context)}):
{json.dumps(practised_skills_context, indent=2)}
{unpractised_note}

RECENT PRACTICE SESSIONS ({len(session_summaries)} most recent):
{json.dumps(session_summaries, indent=2)}

Generate insights based on the practised skills and their actual scores.
For unpractised skills, recommend when the student should start them based on their current workload.
Reference specific skill names, scores, and session counts — never be generic.

Respond in this EXACT JSON format (no extra text, no markdown):
{{
  "overallInsight": "2-3 sentences summarising overall progress, referencing specific skill names and scores",
  "focusSkill": {{
    "name": "skill needing most attention right now (can be unpractised if never started)",
    "reason": "specific reason with numbers or context"
  }},
  "momentumSkill": {{
    "name": "skill with the best recent improvement trajectory",
    "reason": "specific evidence of momentum (score trend, session count)"
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

    # ── Call Bedrock ───────────────────────────────────────────────────────────
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
        logger.info('Full analysis cached successfully')
    except Exception as cache_err:
        logger.warning(f'Failed to save analysis cache: {cache_err}')

    return result


# ── Session insight ───────────────────────────────────────────────────────────

def handle_session_insight(body):
    session_data = {
        'skillName':           body.get('skillName', ''),
        'category':            body.get('category', ''),
        'currentScore':        body.get('currentScore'),
        'adaptiveDifficulty':  body.get('adaptiveDifficulty', ''),
        'difficultyChanged':   body.get('difficultyChanged', False),
        'difficultyDirection': body.get('difficultyDirection', ''),
        'totalAttempts':       body.get('totalAttempts', 1),
        'timePerformance':     body.get('timePerformance', ''),
    }
    if body.get('usedAIFeedback'):
        session_data['usedAIFeedback'] = True
        if body.get('aiWhatWasMissing'):
            session_data['aiWhatWasMissing'] = body['aiWhatWasMissing']
    if body.get('totalAttempts', 1) > 1 and body.get('firstAttemptScore') is not None:
        session_data['firstAttemptScore'] = body['firstAttemptScore']

    logger.info(f'Session insight: skill={session_data["skillName"]}, score={session_data["currentScore"]}')

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

        # Always 200 — client checks result.error for failure
        return {'statusCode': 200, 'headers': CORS, 'body': json.dumps(result)}

    except Exception as e:
        logger.error(f'Unhandled error: {e}', exc_info=True)
        return {
            'statusCode': 200,
            'headers': CORS,
            'body': json.dumps({
                'error': True,
                'errorType': 'unhandled',
                'message': 'AI analysis temporarily unavailable. Please try again in a moment.',
            }),
        }
