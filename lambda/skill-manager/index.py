import boto3
import json
from decimal import Decimal
import uuid
import logging
import os
from datetime import datetime, timedelta
from boto3.dynamodb.conditions import Key

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Initialize DynamoDB resource
dynamodb = boto3.resource('dynamodb')
table_name = os.environ.get('TABLE_NAME', 'Skills')
table = dynamodb.Table(table_name)
history_table = dynamodb.Table(os.environ.get('HISTORY_TABLE', 'PracticeHistory'))

# ADD THIS HELPER FUNCTION - converts Decimal to int/float for JSON
def decimal_to_number(obj):
    """Convert Decimal objects to int or float for JSON serialization"""
    if isinstance(obj, list):
        return [decimal_to_number(i) for i in obj]
    elif isinstance(obj, dict):
        return {k: decimal_to_number(v) for k, v in obj.items()}
    elif isinstance(obj, Decimal):
        # Convert to int if it's a whole number, otherwise float
        if obj % 1 == 0:
            return int(obj)
        else:
            return float(obj)
    else:
        return obj

# Validation constants
VALID_CATEGORIES = ['language', 'coding', 'certification', 'instrument', 'other']
VALID_PROFICIENCY = ['beginner', 'intermediate', 'advanced', 'expert']
VALID_IMPORTANCE = ['low', 'medium', 'high', 'critical']
FORGETTING_CURVE_INTERVALS = [1, 3, 7, 14, 30, 60]

def success_response(data, status_code=200):
    return {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
        },
        'body': json.dumps(decimal_to_number(data))  # <-- FIXED!
    }

def error_response(status, message):
    """Helper function to create error response with CORS headers"""
    return {
        'statusCode': status,
        'headers': {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json'
        },
        'body': json.dumps({'error': message})
    }

def validate_skill_name(name):
    """Validate skill name length (2-100 characters)"""
    return name and 2 <= len(name) <= 100

def validate_category(category):
    """Validate category is in allowed list"""
    return category in VALID_CATEGORIES

def validate_proficiency(proficiency):
    """Validate proficiency is in allowed list"""
    return proficiency in VALID_PROFICIENCY

def validate_importance(importance):
    """Validate importance is in allowed list"""
    return importance in VALID_IMPORTANCE

def validate_date(date_string):
    """Validate date format YYYY-MM-DD"""
    try:
        datetime.strptime(date_string, '%Y-%m-%d')
        return True
    except ValueError:
        return False

def calculate_next_reminder_date(learning_date, interval_days=1):
    """Calculate next reminder date based on learning date and interval"""
    date_obj = datetime.strptime(learning_date, '%Y-%m-%d')
    next_date = date_obj + timedelta(days=interval_days)
    return next_date.strftime('%Y-%m-%d')

def handle_create_skill(body):
    """Handle POST request to create a new skill"""
    # Extract required fields
    user_id = body.get('userId')
    skill_name = body.get('skillName')
    category = body.get('category')
    proficiency = body.get('proficiency')
    learning_date = body.get('learningDate')
    importance = body.get('importance')
    
    # Validate required fields
    if not user_id:
        return error_response(400, "userId is required")
    if not skill_name:
        return error_response(400, "skillName is required")
    if not category:
        return error_response(400, "category is required")
    if not proficiency:
        return error_response(400, "proficiency is required")
    if not learning_date:
        return error_response(400, "learningDate is required")
    if not importance:
        return error_response(400, "importance is required")
    
    # Validate field values
    if not validate_skill_name(skill_name):
        return error_response(400, "skillName must be 2-100 characters")
    if not validate_category(category):
        return error_response(400, f"category must be one of {VALID_CATEGORIES}")
    if not validate_proficiency(proficiency):
        return error_response(400, f"proficiency must be one of {VALID_PROFICIENCY}")
    if not validate_importance(importance):
        return error_response(400, f"importance must be one of {VALID_IMPORTANCE}")
    if not validate_date(learning_date):
        return error_response(400, "learningDate must be in YYYY-MM-DD format")
    
    # Generate skillId
    skill_id = str(uuid.uuid4())
    
    # Calculate next reminder date (learning date + 1 day)
    next_reminder_date = calculate_next_reminder_date(learning_date, 1)
    
    # Create skill item
    skill_item = {
        'skillId': skill_id,
        'userId': user_id,
        'skillName': skill_name,
        'category': category,
        'proficiency': proficiency,
        'learningDate': learning_date,
        'importance': importance,
        'createdAt': datetime.utcnow().isoformat(),
        'nextReminderDate': next_reminder_date,
        'currentIntervalIndex': 0,
        'lastPracticeScore': 0
    }
    
    # Store in DynamoDB
    table.put_item(Item=skill_item)
    logger.info(f"Skill created successfully with skillId: {skill_id}")
    
    return success_response({
        'skillId': skill_id,
        'message': 'Skill created successfully'
    }, 201)

def handle_get_skills(query_params):
    """Handle GET request to retrieve skills by userId"""
    user_id = query_params.get('userId')
    
    if not user_id:
        return error_response(400, "userId query parameter is required")
    
    try:
        # Query using GSI
        response = table.query(
            IndexName='userId-index',
            KeyConditionExpression=Key('userId').eq(user_id)
        )
        
        skills = response.get('Items', [])

        # Query all practice history for this user, group scores by skillId
        history_response = history_table.query(
            KeyConditionExpression=Key('userId').eq(user_id)
        )
        skill_scores = {}
        for item in history_response.get('Items', []):
            sid = str(item.get('skillId', ''))
            score_val = item.get('score')
            if sid and score_val is not None:
                skill_scores.setdefault(sid, []).append(float(decimal_to_number(score_val)))

        # Compute average-score health per skill
        for skill in skills:
            sid = skill.get('skillId', '')
            scores = skill_scores.get(sid, [])
            skill['totalPracticeCount'] = len(scores)
            health = round(sum(scores) / len(scores)) if scores else 0
            skill['health'] = health

            if not scores:
                skill['healthStatus'] = 'new'
            elif health >= 80:
                skill['healthStatus'] = 'excellent'
            elif health >= 60:
                skill['healthStatus'] = 'good'
            elif health >= 40:
                skill['healthStatus'] = 'at-risk'
            else:
                skill['healthStatus'] = 'critical'
        
        logger.info(f"Retrieved {len(skills)} skills for userId: {user_id}")
        
        return success_response({
            'skills': skills,
            'count': len(skills)
        })
        
    except Exception as e:
        logger.error(f"Error querying skills: {str(e)}")
        raise

def handle_update_skill(body):
    """Handle PUT request to update an existing skill"""
    skill_id = body.get('skillId')
    user_id = body.get('userId')
    
    if not skill_id or not user_id:
        return error_response(400, "skillId and userId are required")
    
    try:
        # Get existing skill
        response = table.get_item(Key={'skillId': skill_id, 'userId': user_id})
        
        if 'Item' not in response:
            logger.error(f"Skill not found: {skill_id}")
            return error_response(404, "Skill not found")
        
        existing_skill = response['Item']
        
        # Update fields if provided
        update_expression = []
        expression_values = {}
        expression_names = {}
        
        if 'skillName' in body:
            if not validate_skill_name(body['skillName']):
                return error_response(400, "skillName must be 2-100 characters")
            update_expression.append("#sn = :sn")
            expression_values[':sn'] = body['skillName']
            expression_names['#sn'] = 'skillName'
        
        if 'proficiency' in body:
            if not validate_proficiency(body['proficiency']):
                return error_response(400, f"proficiency must be one of {VALID_PROFICIENCY}")
            update_expression.append("proficiency = :p")
            expression_values[':p'] = body['proficiency']
        
        if 'importance' in body:
            if not validate_importance(body['importance']):
                return error_response(400, f"importance must be one of {VALID_IMPORTANCE}")
            update_expression.append("importance = :i")
            expression_values[':i'] = body['importance']
        
        if not update_expression:
            return error_response(400, "No fields to update")
        
        # Perform update
        update_params = {
            'Key': {'skillId': skill_id, 'userId': user_id},
            'UpdateExpression': 'SET ' + ', '.join(update_expression),
            'ExpressionAttributeValues': expression_values,
            'ReturnValues': 'ALL_NEW'
        }
        
        if expression_names:
            update_params['ExpressionAttributeNames'] = expression_names
        
        response = table.update_item(**update_params)
        
        logger.info(f"Skill updated successfully: {skill_id}")
        return success_response(response['Attributes'])
        
    except Exception as e:
        logger.error(f"Error updating skill: {str(e)}")
        raise

def handle_delete_skill(query_params):
    """Handle DELETE request to delete a skill"""
    skill_id = query_params.get('skillId')
    user_id = query_params.get('userId')
    
    if not skill_id or not user_id:
        return error_response(400, "skillId and userId query parameters are required")
    
    try:
        # Delete skill
        table.delete_item(Key={'skillId': skill_id, 'userId': user_id})
        logger.info(f"Skill deleted successfully: {skill_id}")
        
        return success_response({'message': 'Skill deleted successfully'})
        
    except Exception as e:
        logger.error(f"Error deleting skill: {str(e)}")
        raise

def lambda_handler(event, context):
    """
    Lambda function handler for skill management CRUD operations.
    
    Args:
        event: API Gateway Lambda proxy integration event
        context: Lambda context object
        
    Returns:
        dict: API Gateway response with status code, headers, and body
    """
    try:
        http_method = event.get('httpMethod')
        logger.info(f"Processing {http_method} request")
        
        # Route based on HTTP method
        if http_method == 'POST':
            if not event.get('body'):
                return error_response(400, "Request body is required")
            body = json.loads(event['body'])
            return handle_create_skill(body)
        
        elif http_method == 'GET':
            query_params = event.get('queryStringParameters') or {}
            return handle_get_skills(query_params)
        
        elif http_method == 'PUT':
            if not event.get('body'):
                return error_response(400, "Request body is required")
            body = json.loads(event['body'])
            return handle_update_skill(body)
        
        elif http_method == 'DELETE':
            query_params = event.get('queryStringParameters') or {}
            return handle_delete_skill(query_params)
        
        else:
            logger.error(f"Method not allowed: {http_method}")
            return error_response(405, "Method not allowed")
    
    except json.JSONDecodeError as e:
        logger.error(f"Invalid JSON in request body: {str(e)}")
        return error_response(400, "Invalid JSON format")
    
    except Exception as e:
        logger.error(f"Internal server error: {str(e)}")
        return error_response(500, "Internal server error")
