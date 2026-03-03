import boto3
import json
import uuid
import re
import logging
import os
from datetime import datetime
from boto3.dynamodb.conditions import Attr

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Initialize DynamoDB resource
dynamodb = boto3.resource('dynamodb')
table_name = os.environ.get('TABLE_NAME', 'Users')
table = dynamodb.Table(table_name)

# Email validation regex
EMAIL_PATTERN = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'

def success_response(status_code, body):
    """Helper function to create success response with CORS headers"""
    return {
        'statusCode': status_code,
        'headers': {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json'
        },
        'body': json.dumps(body)
    }

def error_response(status_code, error_message):
    """Helper function to create error response with CORS headers"""
    return {
        'statusCode': status_code,
        'headers': {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json'
        },
        'body': json.dumps({'error': error_message})
    }

def validate_email(email):
    """Validate email format using regex pattern"""
    return re.match(EMAIL_PATTERN, email) is not None

def validate_name(name):
    """Validate name length (2-100 characters)"""
    return 2 <= len(name) <= 100

def check_email_exists(email):
    """Check if email already exists in Users table"""
    try:
        response = table.scan(
            FilterExpression=Attr('email').eq(email.lower())
        )
        return len(response.get('Items', [])) > 0
    except Exception as e:
        logger.error(f"Error checking email existence: {str(e)}")
        raise

def handle_sign_in(query_params):
    """Handle GET request - look up existing user by email"""
    email = query_params.get('email')

    if not email:
        return error_response(400, "email query parameter is required")

    if not validate_email(email):
        return error_response(400, "Invalid email format")

    try:
        response = table.scan(
            FilterExpression=Attr('email').eq(email.lower())
        )
        items = response.get('Items', [])

        if not items:
            return error_response(404, "No account found with this email address")

        user = items[0]
        logger.info(f"Sign in successful for userId: {user['userId']}")
        return success_response(200, {
            'userId': user['userId'],
            'name': user.get('name', ''),
            'message': 'Sign in successful'
        })

    except Exception as e:
        logger.error(f"Error looking up user: {str(e)}")
        raise


def lambda_handler(event, context):
    """
    Lambda function handler for user registration and sign-in.

    GET  /users?email=...  → sign in (look up userId by email)
    POST /users            → register new user
    """
    http_method = event.get('httpMethod', 'POST')

    if http_method == 'GET':
        query_params = event.get('queryStringParameters') or {}
        return handle_sign_in(query_params)

    try:
        # Parse JSON body from API Gateway event
        if not event.get('body'):
            logger.error("Missing request body")
            return error_response(400, "Request body is required")
        
        body = json.loads(event['body'])
        logger.info(f"Processing registration request for email: {body.get('email')}")
        
        # Extract and validate required fields
        email = body.get('email')
        name = body.get('name')
        timezone = body.get('timezone', 'UTC')
        
        # Validate email presence
        if not email:
            logger.error("Email field is missing")
            return error_response(400, "Email is required")
        
        # Validate name presence
        if not name:
            logger.error("Name field is missing")
            return error_response(400, "Name is required")
        
        # Validate email format
        if not validate_email(email):
            logger.error(f"Invalid email format: {email}")
            return error_response(400, "Invalid email format")
        
        # Validate name length
        if not validate_name(name):
            logger.error(f"Invalid name length: {len(name)} characters")
            return error_response(400, "Name must be 2-100 characters")
        
        # Check if email already exists
        if check_email_exists(email):
            logger.info(f"Email already exists: {email}")
            return error_response(409, "User with this email already exists")
        
        # Generate UUID for userId
        user_id = str(uuid.uuid4())
        
        # Create user record
        user_item = {
            'userId': user_id,
            'email': email.lower(),
            'name': name,
            'timezone': timezone,
            'createdAt': datetime.utcnow().isoformat()
        }
        
        # Store in DynamoDB
        table.put_item(Item=user_item)
        logger.info(f"User created successfully with userId: {user_id}")
        
        # Return success response
        return success_response(201, {
            'userId': user_id,
            'message': 'User created successfully'
        })
        
    except json.JSONDecodeError as e:
        logger.error(f"Invalid JSON in request body: {str(e)}")
        return error_response(400, "Invalid JSON format")
    
    except Exception as e:
        logger.error(f"Internal server error: {str(e)}")
        return error_response(500, "Internal server error")
