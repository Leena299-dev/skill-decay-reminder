import json
import os
import boto3
from datetime import datetime, timezone, timedelta
from decimal import Decimal
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

dynamodb = boto3.resource('dynamodb', region_name='us-east-1')
lambda_client = boto3.client('lambda', region_name='us-east-1')

NOTIFICATION_TABLE = os.environ.get('NOTIFICATION_TABLE', 'NotificationLog')
PREFERENCES_TABLE = os.environ.get('PREFERENCES_TABLE', 'UserNotificationPreferences')
USERS_TABLE = os.environ.get('USERS_TABLE', 'Users')
SKILLS_TABLE = os.environ.get('SKILLS_TABLE', 'Skills')
HISTORY_TABLE = os.environ.get('HISTORY_TABLE', 'PracticeHistory')
EMAIL_SENDER_ARN = os.environ.get('EMAIL_SENDER_ARN', '')

DEFAULT_PREFS = {
    'emailEnabled': True,
    'practiceReminders': True,
    'overdueAlerts': True,
    'weeklyDigest': True,
    'streakAlerts': True,
    'scoreAlerts': True,
    'inactivityAlerts': True,
    'criticalHealthAlerts': True,
}


def decimal_to_number(obj):
    if isinstance(obj, Decimal):
        n = float(obj)
        return int(n) if n == int(n) else n
    raise TypeError


def get_all_users():
    table = dynamodb.Table(USERS_TABLE)
    items = []
    resp = table.scan()
    items.extend(resp.get('Items', []))
    while 'LastEvaluatedKey' in resp:
        resp = table.scan(ExclusiveStartKey=resp['LastEvaluatedKey'])
        items.extend(resp.get('Items', []))
    return items


def get_preferences(user_id):
    table = dynamodb.Table(PREFERENCES_TABLE)
    resp = table.get_item(Key={'userId': user_id})
    item = resp.get('Item')
    prefs = dict(DEFAULT_PREFS)
    if item:
        for k in DEFAULT_PREFS:
            if k in item:
                prefs[k] = item[k]
    return prefs


def get_skills_for_user(user_id):
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


def log_exists(user_id, notification_key):
    table = dynamodb.Table(NOTIFICATION_TABLE)
    resp = table.get_item(Key={'userId': user_id, 'notificationKey': notification_key})
    return 'Item' in resp


def write_log(user_id, notification_key, notification_type, display_data=None, ttl_days=90):
    table = dynamodb.Table(NOTIFICATION_TABLE)
    expires_at = int((datetime.now(timezone.utc) + timedelta(days=ttl_days)).timestamp())
    item = {
        'userId': user_id,
        'notificationKey': notification_key,
        'sentAt': datetime.now(timezone.utc).isoformat(),
        'expiresAt': expires_at,
        'notificationType': notification_type,
        'isRead': False,
    }
    if display_data:
        item['displayData'] = display_data
    table.put_item(Item=item)


def delete_log(user_id, notification_key):
    table = dynamodb.Table(NOTIFICATION_TABLE)
    table.delete_item(Key={'userId': user_id, 'notificationKey': notification_key})


def invoke_email_sender(payload):
    if not EMAIL_SENDER_ARN:
        print(f"[WARN] EMAIL_SENDER_ARN not set, skipping. Payload: {json.dumps(payload, default=decimal_to_number)}")
        return
    lambda_client.invoke(
        FunctionName=EMAIL_SENDER_ARN,
        InvocationType='Event',  # async
        Payload=json.dumps(payload, default=decimal_to_number).encode()
    )


def send_notification(user_id, notification_key, notification_type, display_data,
                      user_email, user_name, email_payload, ttl_days=90):
    """Write to notification log and fire email asynchronously."""
    write_log(user_id, notification_key, notification_type, display_data, ttl_days)
    invoke_email_sender(email_payload)


def calculate_skill_health(skill):
    next_reminder = skill.get('nextReminderDate')
    if not next_reminder:
        return 100
    today = datetime.now(timezone.utc).date()
    try:
        reminder_date = datetime.fromisoformat(str(next_reminder)).date()
    except Exception:
        return 100
    days_overdue = (today - reminder_date).days
    if days_overdue <= 0:
        return 100
    return max(0, 100 - days_overdue * 10)


def compute_streak(history):
    if not history:
        return 0
    days = set()
    for h in history:
        ts = h.get('completedAt')
        if ts:
            v = decimal_to_number(ts) if isinstance(ts, Decimal) else ts
            day = datetime.fromtimestamp(v, tz=timezone.utc).date()
            days.add(day)
    today = datetime.now(timezone.utc).date()
    streak = 0
    current = today
    while current in days:
        streak += 1
        current -= timedelta(days=1)
    return streak


def is_today(ts):
    if not ts:
        return False
    v = decimal_to_number(ts) if isinstance(ts, Decimal) else ts
    day = datetime.fromtimestamp(v, tz=timezone.utc).date()
    return day == datetime.now(timezone.utc).date()


def handle_daily(event):
    today_str = datetime.now(timezone.utc).date().isoformat()
    today = datetime.now(timezone.utc).date()

    users = get_all_users()
    print(f"[daily] Processing {len(users)} users")

    for user in users:
        user_id = user.get('userId')
        user_email = user.get('email')
        user_name = user.get('name', 'there')

        if not user_id or not user_email:
            continue

        prefs = get_preferences(user_id)
        if not prefs.get('emailEnabled', True):
            continue

        skills = get_skills_for_user(user_id)
        history = get_practice_history(user_id, days=90)
        streak = compute_streak(history)

        # ── Per-skill: practice_due ──────────────────────────────────────────
        if prefs.get('practiceReminders', True):
            for skill in skills:
                skill_id = skill.get('skillId', '')
                skill_name = skill.get('skillName', 'your skill')
                next_reminder = skill.get('nextReminderDate')
                health = int(calculate_skill_health(skill))

                if not next_reminder:
                    continue
                try:
                    reminder_date = datetime.fromisoformat(str(next_reminder)).date()
                except Exception:
                    continue

                if reminder_date == today:
                    key = f'practice_due#{skill_id}#{today_str}'
                    if not log_exists(user_id, key):
                        display = {'skillName': skill_name, 'skillId': skill_id, 'health': health, 'daysOverdue': 0}
                        send_notification(
                            user_id, key, 'practice_due', display, user_email, user_name,
                            {'notificationType': 'practice_due', 'userEmail': user_email, 'userName': user_name,
                             'userId': user_id, 'skillData': display, 'additionalData': {}},
                        )

        # ── Per-skill: overdue milestones ────────────────────────────────────
        if prefs.get('overdueAlerts', True):
            for skill in skills:
                skill_id = skill.get('skillId', '')
                skill_name = skill.get('skillName', 'your skill')
                next_reminder = skill.get('nextReminderDate')
                health = int(calculate_skill_health(skill))

                if not next_reminder:
                    continue
                try:
                    reminder_date = datetime.fromisoformat(str(next_reminder)).date()
                except Exception:
                    continue
                days_overdue = (today - reminder_date).days

                for milestone in [3, 7, 30]:
                    if days_overdue == milestone:
                        key = f'overdue_{milestone}#{skill_id}#{today_str}'
                        if not log_exists(user_id, key):
                            display = {'skillName': skill_name, 'skillId': skill_id, 'health': health, 'daysOverdue': milestone}
                            send_notification(
                                user_id, key, f'overdue_{milestone}', display, user_email, user_name,
                                {'notificationType': f'overdue_{milestone}', 'userEmail': user_email, 'userName': user_name,
                                 'userId': user_id, 'skillData': display, 'additionalData': {}},
                            )

        # ── Per-skill: critical_health ───────────────────────────────────────
        if prefs.get('criticalHealthAlerts', True):
            for skill in skills:
                skill_id = skill.get('skillId', '')
                skill_name = skill.get('skillName', 'your skill')
                next_reminder = skill.get('nextReminderDate')
                health = int(calculate_skill_health(skill))

                # Reset log when recovered
                crit_key = f'critical_health#{skill_id}'
                if health >= 40 and log_exists(user_id, crit_key):
                    delete_log(user_id, crit_key)

                if health < 40:
                    days_overdue = 0
                    if next_reminder:
                        try:
                            reminder_date = datetime.fromisoformat(str(next_reminder)).date()
                            days_overdue = (today - reminder_date).days
                        except Exception:
                            pass
                    if not log_exists(user_id, crit_key):
                        display = {'skillName': skill_name, 'skillId': skill_id, 'health': health, 'daysOverdue': days_overdue}
                        send_notification(
                            user_id, crit_key, 'critical_health', display, user_email, user_name,
                            {'notificationType': 'critical_health', 'userEmail': user_email, 'userName': user_name,
                             'userId': user_id, 'skillData': display, 'additionalData': {}},
                            ttl_days=365,
                        )

        # ── Streak milestones ────────────────────────────────────────────────
        if prefs.get('streakAlerts', True):
            for milestone in [7, 30, 100]:
                if streak == milestone:
                    key = f'streak_{milestone}#none#{today_str}'
                    if not log_exists(user_id, key):
                        display = {'streak': milestone}
                        send_notification(
                            user_id, key, f'streak_{milestone}', display, user_email, user_name,
                            {'notificationType': f'streak_{milestone}', 'userEmail': user_email, 'userName': user_name,
                             'userId': user_id, 'skillData': {}, 'additionalData': {'streak': streak}},
                        )

        # ── first_practice ───────────────────────────────────────────────────
        if prefs.get('streakAlerts', True):
            if len(history) == 1:
                key = 'first_practice#none#ever'
                if not log_exists(user_id, key):
                    first_skill_id = history[0].get('skillId', '')
                    first_skill = next((s for s in skills if s.get('skillId') == first_skill_id), {})
                    skill_name = first_skill.get('skillName', 'your skill')
                    display = {'skillName': skill_name, 'skillId': first_skill_id}
                    send_notification(
                        user_id, key, 'first_practice', display, user_email, user_name,
                        {'notificationType': 'first_practice', 'userEmail': user_email, 'userName': user_name,
                         'userId': user_id, 'skillData': {'skillName': skill_name}, 'additionalData': {}},
                        ttl_days=36500,
                    )

        # ── score_improvement ────────────────────────────────────────────────
        if prefs.get('scoreAlerts', True):
            today_sessions = [h for h in history if is_today(h.get('completedAt'))]
            past_sessions = [h for h in history if not is_today(h.get('completedAt'))]
            for session in today_sessions:
                skill_id = session.get('skillId', '')
                score = decimal_to_number(session.get('score', 0)) if isinstance(session.get('score'), Decimal) else session.get('score', 0)
                skill_past = [h for h in past_sessions if h.get('skillId') == skill_id]
                if skill_past:
                    avg = sum(
                        (decimal_to_number(h['score']) if isinstance(h.get('score'), Decimal) else h.get('score', 0))
                        for h in skill_past
                    ) / len(skill_past)
                    if score >= avg + 10:
                        skill_obj = next((s for s in skills if s.get('skillId') == skill_id), {})
                        skill_name = skill_obj.get('skillName', 'your skill')
                        key = f'score_improvement#{skill_id}#{today_str}'
                        if not log_exists(user_id, key):
                            display = {'skillName': skill_name, 'skillId': skill_id, 'score': score, 'prevAvg': round(avg, 1)}
                            send_notification(
                                user_id, key, 'score_improvement', display, user_email, user_name,
                                {'notificationType': 'score_improvement', 'userEmail': user_email, 'userName': user_name,
                                 'userId': user_id, 'skillData': {'skillName': skill_name}, 'additionalData': {'score': score, 'prevAvg': round(avg, 1)}},
                            )

        # ── inactivity ───────────────────────────────────────────────────────
        if prefs.get('inactivityAlerts', True):
            if history:
                most_recent = max(
                    (decimal_to_number(h['completedAt']) if isinstance(h.get('completedAt'), Decimal) else h.get('completedAt', 0))
                    for h in history
                )
                days_since = (datetime.now(timezone.utc) - datetime.fromtimestamp(most_recent, tz=timezone.utc)).days
            else:
                days_since = 999

            if days_since >= 14:
                epoch_days = int(datetime.now(timezone.utc).timestamp() / 86400)
                window = epoch_days // 14
                key = f'inactivity#none#{window}'
                if not log_exists(user_id, key):
                    display = {'daysSince': days_since}
                    send_notification(
                        user_id, key, 'inactivity', display, user_email, user_name,
                        {'notificationType': 'inactivity', 'userEmail': user_email, 'userName': user_name,
                         'userId': user_id, 'skillData': {}, 'additionalData': {'daysSince': days_since}},
                    )

    print("[daily] Done")


def handle_weekly_check(event):
    now_utc = datetime.now(timezone.utc)
    users = get_all_users()
    print(f"[weekly-check] Checking {len(users)} users at {now_utc.isoformat()}")

    for user in users:
        user_id = user.get('userId')
        user_email = user.get('email')
        user_name = user.get('name', 'there')
        user_tz = user.get('timezone', 'UTC')

        if not user_id or not user_email:
            continue

        prefs = get_preferences(user_id)
        if not prefs.get('emailEnabled', True) or not prefs.get('weeklyDigest', True):
            continue

        try:
            tz = ZoneInfo(user_tz)
        except ZoneInfoNotFoundError:
            tz = ZoneInfo('UTC')

        local_now = now_utc.astimezone(tz)

        if local_now.weekday() == 6 and local_now.hour == 18:
            sunday_str = local_now.date().isoformat()
            key = f'weekly_summary#none#{sunday_str}'
            if not log_exists(user_id, key):
                skills = get_skills_for_user(user_id)
                history = get_practice_history(user_id, days=7)
                display = {'weekSessions': len(history)}
                send_notification(
                    user_id, key, 'weekly_summary', display, user_email, user_name,
                    {'notificationType': 'weekly_summary', 'userEmail': user_email, 'userName': user_name,
                     'userId': user_id, 'skillData': {},
                     'additionalData': {
                         'allSkills': skills,
                         'weekHistory': history,
                         'streak': compute_streak(get_practice_history(user_id, days=120)),
                     }},
                )

    print("[weekly-check] Done")


def lambda_handler(event, context):
    event_type = event.get('type', 'daily')
    print(f"[notification-scheduler] Event type: {event_type}")

    if event_type == 'daily':
        handle_daily(event)
    elif event_type == 'weekly-check':
        handle_weekly_check(event)
    else:
        print(f"[WARN] Unknown event type: {event_type}")

    return {'statusCode': 200, 'body': 'done'}
