import json
import os
import boto3
from decimal import Decimal
from datetime import datetime, timezone

dynamodb = boto3.resource('dynamodb', region_name='us-east-1')

NOTIFICATION_TABLE = os.environ.get('NOTIFICATION_TABLE', 'NotificationLog')

CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key',
    'Access-Control-Allow-Methods': 'GET,PUT,OPTIONS',
}

# Maps notification type → (icon, title, description template)
TYPE_MAP = {
    'practice_due':    ('📅', 'Practice Due',          'Time to practise {skillName}'),
    'overdue_3':       ('🔴', 'Skill Overdue',          '{skillName} is 3 days overdue'),
    'overdue_7':       ('🔴', 'Skill Overdue',          '{skillName} is 7 days overdue'),
    'overdue_30':      ('🔴', 'Skill Overdue',          '{skillName} is 30 days overdue'),
    'weekly_summary':  ('📊', 'Weekly Summary',         'Your weekly progress report is ready'),
    'streak_7':        ('🔥', 'Streak Achievement!',    'You hit a 7-day streak!'),
    'streak_30':       ('🔥', 'Streak Achievement!',    'You hit a 30-day streak!'),
    'streak_100':      ('🔥', 'Streak Achievement!',    'You hit a 100-day streak!'),
    'score_improvement': ('📈', 'Score Improved!',      'Your {skillName} score jumped to {score}%'),
    'inactivity':      ('😴', 'We Miss You',            "You haven't practised in {daysSince} days"),
    'critical_health': ('⚠️', 'Critical Alert',         '{skillName} health dropped to {health}%'),
    'first_practice':  ('✅', 'First Practice!',        'You completed your first practice session'),
}


def decimal_to_number(obj):
    if isinstance(obj, Decimal):
        n = float(obj)
        return int(n) if n == int(n) else n
    raise TypeError


def json_safe(obj):
    return json.loads(json.dumps(obj, default=decimal_to_number))


def time_ago(sent_at_str):
    """Return human-readable relative time from ISO string."""
    try:
        sent = datetime.fromisoformat(sent_at_str.replace('Z', '+00:00'))
        if sent.tzinfo is None:
            sent = sent.replace(tzinfo=timezone.utc)
        delta = datetime.now(timezone.utc) - sent
        seconds = int(delta.total_seconds())
        if seconds < 60:
            return 'Just now'
        if seconds < 3600:
            mins = seconds // 60
            return f'{mins} minute{"s" if mins != 1 else ""} ago'
        if seconds < 86400:
            hrs = seconds // 3600
            return f'{hrs} hour{"s" if hrs != 1 else ""} ago'
        days = seconds // 86400
        if days == 1:
            return '1 day ago'
        return f'{days} days ago'
    except Exception:
        return ''


def build_notification(item):
    """Convert a NotificationLog item into a display-ready notification object."""
    ntype = item.get('notificationType', '')
    display = item.get('displayData', {})
    is_read = item.get('isRead', False)
    if isinstance(is_read, Decimal):
        is_read = bool(int(is_read))

    icon, title, desc_template = TYPE_MAP.get(ntype, ('🔔', 'Notification', 'You have a new notification'))

    # Fill description template from displayData
    try:
        description = desc_template.format(**{k: v for k, v in display.items()})
    except (KeyError, ValueError):
        description = desc_template

    skill_id = display.get('skillId') or None
    skill_name = display.get('skillName') or None

    return {
        'notificationKey': item.get('notificationKey', ''),
        'notificationType': ntype,
        'icon': icon,
        'title': title,
        'description': description,
        'sentAt': item.get('sentAt', ''),
        'timeAgo': time_ago(item.get('sentAt', '')),
        'isRead': bool(is_read),
        'skillId': skill_id,
        'skillName': skill_name,
    }


def response(status, body):
    return {
        'statusCode': status,
        'headers': CORS_HEADERS,
        'body': json.dumps(body, default=decimal_to_number),
    }


def handle_get(event):
    qs = event.get('queryStringParameters') or {}
    user_id = qs.get('userId')
    if not user_id:
        return response(400, {'error': 'userId is required'})

    limit = min(int(qs.get('limit', 20)), 50)

    table = dynamodb.Table(NOTIFICATION_TABLE)
    resp = table.query(
        KeyConditionExpression=boto3.dynamodb.conditions.Key('userId').eq(user_id)
    )
    items = resp.get('Items', [])

    # Sort by sentAt descending, take limit
    items.sort(key=lambda x: x.get('sentAt', ''), reverse=True)
    items = items[:limit]

    notifications = [build_notification(item) for item in items]
    unread_count = sum(1 for n in notifications if not n['isRead'])

    return response(200, {
        'notifications': notifications,
        'unreadCount': unread_count,
        'total': len(notifications),
    })


def handle_put_read(event):
    try:
        body = json.loads(event.get('body') or '{}')
    except json.JSONDecodeError:
        return response(400, {'error': 'Invalid JSON body'})

    user_id = body.get('userId')
    if not user_id:
        return response(400, {'error': 'userId is required'})

    table = dynamodb.Table(NOTIFICATION_TABLE)
    mark_all = body.get('markAllRead', False)

    if mark_all:
        # Scan all notifications for user and mark read
        resp = table.query(
            KeyConditionExpression=boto3.dynamodb.conditions.Key('userId').eq(user_id)
        )
        items = resp.get('Items', [])
        for item in items:
            nkey = item.get('notificationKey')
            if nkey and not item.get('isRead', False):
                table.update_item(
                    Key={'userId': user_id, 'notificationKey': nkey},
                    UpdateExpression='SET isRead = :t',
                    ExpressionAttributeValues={':t': True},
                )
        return response(200, {'message': f'Marked {len(items)} notifications as read'})

    notification_ids = body.get('notificationIds', [])
    if not notification_ids:
        return response(400, {'error': 'notificationIds or markAllRead is required'})

    for nkey in notification_ids:
        table.update_item(
            Key={'userId': user_id, 'notificationKey': nkey},
            UpdateExpression='SET isRead = :t',
            ExpressionAttributeValues={':t': True},
        )

    return response(200, {'message': f'Marked {len(notification_ids)} notifications as read'})


def lambda_handler(event, context):
    method = event.get('httpMethod', 'GET')

    if method == 'OPTIONS':
        return response(200, {})

    path = event.get('path', '')

    if method == 'GET' and '/notifications' in path:
        return handle_get(event)

    if method == 'PUT' and '/read' in path:
        return handle_put_read(event)

    return response(405, {'error': f'Method {method} not allowed for path {path}'})
