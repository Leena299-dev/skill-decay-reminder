import boto3
import json
import uuid
import logging
import os
from datetime import datetime, timedelta
from decimal import Decimal

# Set up logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# DynamoDB
dynamodb = boto3.resource('dynamodb')
skills_table = dynamodb.Table(os.environ.get('SKILLS_TABLE', 'Skills'))
history_table = dynamodb.Table(os.environ.get('HISTORY_TABLE', 'PracticeHistory'))

# Forgetting curve intervals (days between reviews)
INTERVALS = [1, 3, 7, 14, 30, 60]

# Adaptive difficulty levels (ordered easiest → hardest)
DIFFICULTY_LEVELS = [
    'beginner_easy', 'beginner_medium', 'beginner_hard',
    'intermediate_easy', 'intermediate_medium', 'intermediate_hard',
    'advanced_easy', 'advanced_medium', 'advanced_hard',
]

PROFICIENCY_TO_DIFFICULTY = {
    'beginner': 'beginner_medium',
    'intermediate': 'intermediate_medium',
    'advanced': 'advanced_medium',
    'expert': 'advanced_hard',
}


def normalize_difficulty(raw):
    """Map raw proficiency or difficulty string to a valid DIFFICULTY_LEVELS entry."""
    if raw in DIFFICULTY_LEVELS:
        return raw
    return PROFICIENCY_TO_DIFFICULTY.get(raw, 'intermediate_medium')


def increase_difficulty(current):
    idx = DIFFICULTY_LEVELS.index(current)
    if idx < len(DIFFICULTY_LEVELS) - 1:
        return DIFFICULTY_LEVELS[idx + 1], True
    return current, False


def decrease_difficulty(current):
    idx = DIFFICULTY_LEVELS.index(current)
    if idx > 0:
        return DIFFICULTY_LEVELS[idx - 1], True
    return current, False


def analyse_time_performance(actual_seconds, estimated_minutes):
    """
    Classify how quickly the user completed the exercise relative to estimate.
    Returns: 'rushing' | 'under_time' | 'on_time' | 'over_time' | 'unknown'
    """
    if actual_seconds is None or estimated_minutes is None or estimated_minutes <= 0:
        return 'unknown'
    estimated_seconds = estimated_minutes * 60
    ratio = actual_seconds / estimated_seconds
    if ratio < 0.25:
        return 'rushing'
    elif ratio <= 1.0:
        return 'under_time'
    elif ratio <= 1.5:
        return 'on_time'
    else:
        return 'over_time'


def calculate_new_difficulty(current_difficulty, recent_scores, new_score, time_performance):
    """
    Score × time matrix difficulty adjustment.
    Returns dict: {difficulty, changed, direction, reason, message, sessions_to_levelup, show_hints}
    """
    current_idx = DIFFICULTY_LEVELS.index(current_difficulty)
    # Build updated scores list (newest first, max 3)
    scores = [new_score] + list(recent_scores)[:2]

    diff_label = lambda d: d.replace('_', ' ').title()

    # Rule 1: rushing (finished in <25% of estimate) — warn regardless of score
    if time_performance == 'rushing':
        return {
            'difficulty': current_difficulty,
            'changed': False,
            'direction': None,
            'reason': "Exercise completed very quickly — take more time to think through problems.",
            'message': 'rushing_warning',
            'sessions_to_levelup': None,
            'show_hints': False,
        }

    # Rule 2: score ≥ 90, fast (under_time) × 3 sessions → level up immediately
    if time_performance == 'under_time' and len(scores) >= 3 and all(s >= 90 for s in scores[:3]):
        new_diff, moved = increase_difficulty(current_difficulty)
        if moved:
            return {
                'difficulty': new_diff,
                'changed': True,
                'direction': 'up',
                'reason': f"Excellent scores AND finishing early — levelled up to {diff_label(new_diff)}!",
                'message': 'fast_levelup',
                'sessions_to_levelup': None,
                'show_hints': False,
            }
        return {
            'difficulty': current_difficulty,
            'changed': False,
            'direction': None,
            'reason': "You're at the highest difficulty — outstanding performance!",
            'message': 'keep_going',
            'sessions_to_levelup': None,
            'show_hints': False,
        }

    # Rule 3: score ≥ 90 × 3 sessions → level up
    if len(scores) >= 3 and all(s >= 90 for s in scores[:3]):
        new_diff, moved = increase_difficulty(current_difficulty)
        if moved:
            return {
                'difficulty': new_diff,
                'changed': True,
                'direction': 'up',
                'reason': f"Three scores of 90%+ — levelled up to {diff_label(new_diff)}!",
                'message': 'levelup',
                'sessions_to_levelup': None,
                'show_hints': False,
            }
        return {
            'difficulty': current_difficulty,
            'changed': False,
            'direction': None,
            'reason': "You're at the highest difficulty — incredible work!",
            'message': 'keep_going',
            'sessions_to_levelup': None,
            'show_hints': False,
        }

    # Rule 4: score ≥ 90 × 2 → nearly there (1 more to level up)
    if len(scores) >= 2 and all(s >= 90 for s in scores[:2]):
        return {
            'difficulty': current_difficulty,
            'changed': False,
            'direction': None,
            'reason': "Two great scores in a row — one more to level up!",
            'message': 'nearly_there',
            'sessions_to_levelup': 1,
            'show_hints': False,
        }

    # Rule 5: score < 50, slow (over_time) × 2 → drop two levels if possible
    if time_performance == 'over_time' and len(scores) >= 2 and all(s < 50 for s in scores[:2]):
        new_diff, moved = decrease_difficulty(current_difficulty)
        if moved:
            # Try one more drop
            new_diff2, moved2 = decrease_difficulty(new_diff)
            final_diff = new_diff2 if moved2 else new_diff
            return {
                'difficulty': final_diff,
                'changed': True,
                'direction': 'down',
                'reason': f"Adjusting to {diff_label(final_diff)} to help build confidence.",
                'message': 'fast_leveldown',
                'sessions_to_levelup': None,
                'show_hints': True,
            }
        return {
            'difficulty': current_difficulty,
            'changed': False,
            'direction': None,
            'reason': "Keep practising — you'll get there!",
            'message': 'hints_added',
            'sessions_to_levelup': None,
            'show_hints': True,
        }

    # Rule 6: score < 50 × 2 → drop one level
    if len(scores) >= 2 and all(s < 50 for s in scores[:2]):
        new_diff, moved = decrease_difficulty(current_difficulty)
        if moved:
            return {
                'difficulty': new_diff,
                'changed': True,
                'direction': 'down',
                'reason': f"Adjusting to {diff_label(new_diff)} to help build confidence.",
                'message': 'leveldown',
                'sessions_to_levelup': None,
                'show_hints': False,
            }
        return {
            'difficulty': current_difficulty,
            'changed': False,
            'direction': None,
            'reason': "Keep practising — you'll get there!",
            'message': 'hints_added',
            'sessions_to_levelup': None,
            'show_hints': True,
        }

    # Rule 7: score < 50 once → hints only
    if new_score < 50:
        return {
            'difficulty': current_difficulty,
            'changed': False,
            'direction': None,
            'reason': "Hints have been enabled to help you improve.",
            'message': 'hints_added',
            'sessions_to_levelup': None,
            'show_hints': True,
        }

    # Rule 8: 50–89% → keep same level
    return {
        'difficulty': current_difficulty,
        'changed': False,
        'direction': None,
        'reason': "Steady progress — keeping the same difficulty level.",
        'message': 'keep_going',
        'sessions_to_levelup': None,
        'show_hints': False,
    }


def decimal_to_number(obj):
    """Convert DynamoDB Decimal to int or float"""
    if isinstance(obj, list):
        return [decimal_to_number(i) for i in obj]
    elif isinstance(obj, dict):
        return {k: decimal_to_number(v) for k, v in obj.items()}
    elif isinstance(obj, Decimal):
        return int(obj) if obj % 1 == 0 else float(obj)
    return obj


def calculate_next_reminder(current_index, score):
    """
    Forgetting curve algorithm:
    - Score >= 80: Extend interval (strong memory)
    - Score 60-79: Keep same interval (needs reinforcement)
    - Score < 60: Reduce interval (needs more practice)
    """
    if score >= 80:
        next_index = min(current_index + 1, len(INTERVALS) - 1)
        message_type = "excellent"
    elif score >= 60:
        next_index = current_index
        message_type = "good"
    else:
        next_index = max(current_index - 1, 0)
        message_type = "keep_going"

    interval_days = INTERVALS[next_index]
    next_date = (datetime.utcnow() + timedelta(days=interval_days)).strftime('%Y-%m-%d')

    messages = {
        "excellent": f"Excellent! Memory strong - next review in {interval_days} days",
        "good": f"Good work! Keep it up - next review in {interval_days} days",
        "keep_going": f"Keep practicing! Review sooner in {interval_days} days"
    }

    return next_index, interval_days, next_date, messages[message_type]


def success_response(data, status_code=200):
    return {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Allow-Methods': 'POST,OPTIONS'
        },
        'body': json.dumps(decimal_to_number(data))
    }


def error_response(message, status_code=500):
    return {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Allow-Methods': 'POST,OPTIONS'
        },
        'body': json.dumps({'error': message})
    }


def lambda_handler(event, context):
    logger.info(f"Event: {json.dumps(event)}")

    # Handle CORS preflight
    if event.get('httpMethod') == 'OPTIONS':
        return success_response({})

    try:
        # Parse request body
        body = event.get('body', '{}')
        if isinstance(body, str):
            body = json.loads(body)

        # Get and validate required fields
        user_id = body.get('userId')
        skill_id = body.get('skillId')
        exercise_id = body.get('exerciseId')
        score = body.get('score')
        time_spent = body.get('timeSpent')
        actual_time_seconds = body.get('actualTimeSeconds')
        estimated_time_minutes = body.get('estimatedTimeMinutes', 15)

        # Validate required fields
        if not user_id:
            return error_response('userId is required', 400)
        if not skill_id:
            return error_response('skillId is required', 400)
        if not exercise_id:
            return error_response('exerciseId is required', 400)
        if score is None:
            return error_response('score is required', 400)
        if time_spent is None:
            return error_response('timeSpent is required', 400)

        # Validate score range
        score = int(score)
        if score < 0 or score > 100:
            return error_response('score must be between 0 and 100', 400)

        # Validate timeSpent
        time_spent = int(time_spent)
        if time_spent < 0:
            return error_response('timeSpent must be positive', 400)

        # Parse optional time fields
        if actual_time_seconds is not None:
            actual_time_seconds = int(actual_time_seconds)
        if estimated_time_minutes is not None:
            estimated_time_minutes = int(estimated_time_minutes)

        logger.info(f"Processing: userId={user_id}, skillId={skill_id}, score={score}")

        # Get current skill data (composite key: skillId + userId)
        skill_response = skills_table.get_item(
            Key={
                'skillId': skill_id,
                'userId': user_id
            }
        )
    
        skill = skill_response.get('Item')

        if not skill:
            return error_response(f'Skill {skill_id} not found', 404)

        # Get current interval index (default 0)
        current_index = int(skill.get('currentIntervalIndex', 0))

        # Calculate next reminder using forgetting curve
        next_index, interval_days, next_date, progress_message = calculate_next_reminder(
            current_index, score
        )

        today = datetime.utcnow().strftime('%Y-%m-%d')

        # Record practice session in PracticeHistory
        session_id = str(uuid.uuid4())

        history_item = {
            'userId': user_id,
            'sessionId': session_id,
            'skillId': skill_id,
            'skillName': skill.get('skillName', 'Unknown'),
            'exerciseId': exercise_id,
            'score': score,
            'timeSpent': time_spent,
            'completedAt': int(datetime.utcnow().timestamp()),
            'intervalIndex': current_index,
            'nextReminderDate': next_date,
            'date': today,
            'estimatedTimeMinutes': estimated_time_minutes,
        }
        if actual_time_seconds is not None:
            history_item['actualTimeSeconds'] = actual_time_seconds
        history_table.put_item(Item=history_item)

        # ── Step 1: Core update — always runs, score is never lost ───────────
        update_response = skills_table.update_item(
            Key={
                'skillId': skill_id,
                'userId': user_id
            },
            UpdateExpression="""
                SET lastPracticeScore = :score,
                    lastPracticeDate = :today,
                    currentIntervalIndex = :next_index,
                    nextReminderDate = :next_date
                ADD totalPracticeCount :one
            """,
            ExpressionAttributeValues={
                ':score': score,
                ':today': today,
                ':next_index': next_index,
                ':next_date': next_date,
                ':one': 1,
            },
            ReturnValues='ALL_NEW'
        )
        updated_skill = decimal_to_number(update_response.get('Attributes', {}))

        # ── Step 2: Adaptive difficulty — separate update, non-fatal ─────────
        current_difficulty = normalize_difficulty(
            str(skill.get('adaptiveDifficulty') or skill.get('proficiency', 'intermediate'))
        )
        new_difficulty = current_difficulty
        diff_result = {
            'difficulty': current_difficulty,
            'changed': False,
            'direction': None,
            'reason': None,
            'message': 'keep_going',
            'sessions_to_levelup': None,
            'show_hints': False,
        }
        time_performance = analyse_time_performance(actual_time_seconds, estimated_time_minutes)

        try:
            # Safely convert recentScores — handles list, set, or missing attr
            raw_recent = skill.get('recentScores', [])
            if isinstance(raw_recent, (list, set)):
                clean_recent = []
                for s in raw_recent:
                    try:
                        clean_recent.append(
                            int(decimal_to_number(s)) if isinstance(s, Decimal) else int(s)
                        )
                    except Exception:
                        pass  # skip any unparseable element
            else:
                clean_recent = []

            # Determine new difficulty level using score × time matrix
            diff_result = calculate_new_difficulty(
                current_difficulty, clean_recent, score, time_performance
            )
            new_difficulty = diff_result['difficulty']

            # Updated scores list: newest first, keep max 3
            updated_recent = [score] + clean_recent[:2]

            # Write difficulty fields in a separate update so core is never blocked
            diff_update_expr = """
                SET adaptiveDifficulty = :ad,
                    recentScores = :rs,
                    difficultyLastChanged = :dlc,
                    difficultyChangeReason = :dcr,
                    difficultyMessage = :dm,
                    showMoreHints = :smh,
                    lastTimePerformance = :ltp
            """
            diff_update_vals = {
                ':ad': new_difficulty,
                ':rs': updated_recent,
                ':dlc': today,
                ':dcr': diff_result['reason'],
                ':dm': diff_result['message'],
                ':smh': diff_result['show_hints'],
                ':ltp': time_performance,
            }
            if actual_time_seconds is not None:
                diff_update_expr += ", lastActualTimeSeconds = :lats"
                diff_update_vals[':lats'] = actual_time_seconds

            skills_table.update_item(
                Key={'skillId': skill_id, 'userId': user_id},
                UpdateExpression=diff_update_expr,
                ExpressionAttributeValues=diff_update_vals,
            )
            logger.info(
                f"Difficulty: {current_difficulty} → {new_difficulty} "
                f"(changed={diff_result['changed']}, time={time_performance})"
            )

        except Exception as diff_err:
            logger.error(f"Adaptive difficulty error (non-fatal): {diff_err}")

        # Return success response
        return success_response({
            'message': 'Practice session recorded successfully',
            'sessionId': session_id,
            'nextReminderDate': next_date,
            'intervalDays': interval_days,
            'progressMessage': progress_message,
            'newIntervalIndex': next_index,
            'score': score,
            'newDifficulty': new_difficulty,
            'difficultyChanged': diff_result['changed'],
            'difficultyChangeReason': diff_result['reason'],
            'difficultyDirection': diff_result['direction'],
            'difficultyMessage': diff_result['message'],
            'sessionsToLevelup': diff_result['sessions_to_levelup'],
            'showMoreHints': diff_result['show_hints'],
            'timePerformance': time_performance,
            'updatedSkill': {
                'skillId': skill_id,
                'skillName': updated_skill.get('skillName', ''),
                'lastPracticeScore': score,
                'lastPracticeDate': today,
                'nextReminderDate': next_date,
                'currentIntervalIndex': next_index,
                'totalPracticeCount': updated_skill.get('totalPracticeCount', 1),
                'adaptiveDifficulty': new_difficulty,
            }
        })

    except Exception as e:
        logger.error(f"Error: {str(e)}")
        return error_response(f'Failed to record practice session: {str(e)}', 500)