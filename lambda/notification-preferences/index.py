import json
import os
import boto3
from decimal import Decimal

dynamodb = boto3.resource('dynamodb', region_name='us-east-1')

PREFERENCES_TABLE = os.environ.get('PREFERENCES_TABLE', 'UserNotificationPreferences')
USERS_TABLE = os.environ.get('USERS_TABLE', 'Users')

CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key',
    'Access-Control-Allow-Methods': 'GET,PUT,OPTIONS',
}

DEFAULT_PREFS = {
    'emailEnabled': True,
    'practiceReminders': True,
    'weeklyDigest': True,
    'streakAlerts': True,
}


def decimal_to_number(obj):
    if isinstance(obj, Decimal):
        n = float(obj)
        return int(n) if n == int(n) else n
    raise TypeError


def json_safe(item):
    return json.loads(json.dumps(item, default=decimal_to_number))


def response(status, body):
    return {
        'statusCode': status,
        'headers': CORS_HEADERS,
        'body': json.dumps(body),
    }


def get_user(user_id):
    table = dynamodb.Table(USERS_TABLE)
    resp = table.get_item(Key={'userId': user_id})
    return resp.get('Item')


def lambda_handler(event, context):
    method = event.get('httpMethod', 'GET')

    if method == 'OPTIONS':
        return response(200, {})

    if method == 'GET':
        user_id = (event.get('queryStringParameters') or {}).get('userId')
        if not user_id:
            return response(400, {'error': 'userId is required'})

        prefs_table = dynamodb.Table(PREFERENCES_TABLE)
        resp = prefs_table.get_item(Key={'userId': user_id})
        item = resp.get('Item')

        # Merge with defaults; also pull email/timezone from Users table
        prefs = dict(DEFAULT_PREFS)
        if item:
            for k in DEFAULT_PREFS:
                if k in item:
                    prefs[k] = item[k]

        user = get_user(user_id) or {}
        prefs['email'] = user.get('email', '')
        prefs['timezone'] = user.get('timezone', 'UTC')
        prefs['userId'] = user_id

        return response(200, json_safe(prefs))

    if method == 'PUT':
        try:
            body = json.loads(event.get('body') or '{}')
        except json.JSONDecodeError:
            return response(400, {'error': 'Invalid JSON body'})

        user_id = body.get('userId')
        if not user_id:
            return response(400, {'error': 'userId is required'})

        allowed = {'emailEnabled', 'practiceReminders', 'weeklyDigest', 'streakAlerts'}
        updates = {k: v for k, v in body.items() if k in allowed}

        if not updates:
            return response(400, {'error': 'No valid preference fields provided'})

        prefs_table = dynamodb.Table(PREFERENCES_TABLE)
        expr_parts = []
        expr_values = {}
        expr_names = {}
        for i, (k, v) in enumerate(updates.items()):
            placeholder = f':v{i}'
            name_placeholder = f'#f{i}'
            expr_parts.append(f'{name_placeholder} = {placeholder}')
            expr_values[placeholder] = v
            expr_names[name_placeholder] = k

        prefs_table.update_item(
            Key={'userId': user_id},
            UpdateExpression='SET ' + ', '.join(expr_parts),
            ExpressionAttributeValues=expr_values,
            ExpressionAttributeNames=expr_names,
        )

        return response(200, {'message': 'Preferences updated', 'userId': user_id, **updates})

    return response(405, {'error': f'Method {method} not allowed'})
