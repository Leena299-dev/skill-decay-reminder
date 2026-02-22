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

        # Record practice session in PracticeHistory
        session_id = str(uuid.uuid4())
        today = datetime.utcnow().strftime('%Y-%m-%d')

        history_table.put_item(
            Item={
                'userId': user_id,
                'sessionId': session_id,
                'skillId': skill_id,
                'exerciseId': exercise_id,
                'score': score,
                'timeSpent': time_spent,
                'completedAt': int(datetime.utcnow().timestamp()),
                'intervalIndex': current_index,
                'nextReminderDate': next_date,
                'date': today
            }
        )

        # Update Skills table with new interval
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
                ':one': 1
            },
            ReturnValues='ALL_NEW'
        )

        updated_skill = decimal_to_number(update_response.get('Attributes', {}))

        # Return success response
        return success_response({
            'message': 'Practice session recorded successfully',
            'sessionId': session_id,
            'nextReminderDate': next_date,
            'intervalDays': interval_days,
            'progressMessage': progress_message,
            'newIntervalIndex': next_index,
            'score': score,
            'updatedSkill': {
                'skillId': skill_id,
                'skillName': updated_skill.get('skillName', ''),
                'lastPracticeScore': score,
                'lastPracticeDate': today,
                'nextReminderDate': next_date,
                'currentIntervalIndex': next_index,
                'totalPracticeCount': updated_skill.get('totalPracticeCount', 1)
            }
        })

    except Exception as e:
        logger.error(f"Error: {str(e)}")
        return error_response(f'Failed to record practice session: {str(e)}', 500)