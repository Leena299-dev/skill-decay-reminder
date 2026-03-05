import json
import os
import boto3
from decimal import Decimal

ses = boto3.client('ses', region_name='us-east-1')

SENDER_EMAIL = os.environ.get('SENDER_EMAIL', 'noreply@sharpedge.app')
APP_URL = os.environ.get('APP_URL', 'https://sharpedge.app')

CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'OPTIONS,GET,POST,PUT',
}


def decimal_to_number(obj):
    if isinstance(obj, Decimal):
        n = float(obj)
        return int(n) if n == int(n) else n
    raise TypeError


def base_template(content_html, cta_url, cta_text, user_email):
    unsubscribe_url = f"{APP_URL}?page=settings"
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>SharpEdge</title>
</head>
<body style="margin:0;padding:0;background:#f4f6fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.10);">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);padding:32px 40px;text-align:center;">
              <span style="font-size:32px;">⚡</span>
              <h1 style="margin:8px 0 0;color:#ffffff;font-size:24px;font-weight:700;letter-spacing:-0.5px;">SharpEdge</h1>
              <p style="margin:4px 0 0;color:rgba(255,255,255,0.8);font-size:13px;">Keep your skills sharp</p>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding:40px 40px 24px;">
              {content_html}
            </td>
          </tr>
          <!-- CTA -->
          <tr>
            <td style="padding:0 40px 40px;text-align:center;">
              <a href="{cta_url}"
                 style="display:inline-block;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:15px;font-weight:600;letter-spacing:0.3px;">
                {cta_text}
              </a>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background:#f8f9fc;padding:24px 40px;text-align:center;border-top:1px solid #e8ecf4;">
              <p style="margin:0 0 8px;font-size:12px;color:#9aa5b4;">SharpEdge &ndash; Keep your skills sharp</p>
              <p style="margin:0;font-size:11px;color:#b0b8c4;">
                You are receiving this because you enabled email notifications for {user_email}.<br/>
                <a href="{unsubscribe_url}" style="color:#667eea;text-decoration:none;">Manage notification preferences</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


def health_bar_html(health):
    colour = '#4caf50' if health >= 70 else '#ff9800' if health >= 40 else '#f44336'
    return f"""
    <div style="background:#f0f2f8;border-radius:6px;height:10px;margin:12px 0 4px;overflow:hidden;">
      <div style="width:{health}%;background:{colour};height:100%;border-radius:6px;"></div>
    </div>
    <p style="margin:0 0 20px;font-size:12px;color:#9aa5b4;text-align:right;">{health}% health</p>"""


# ── Email builders ──────────────────────────────────────────────────────────

def build_practice_due_email(data):
    skill = data.get('skillData', {})
    name = data.get('userName', 'there')
    skill_name = skill.get('skillName', 'your skill')
    health = skill.get('health', 100)
    subject = f"Time to practise your {skill_name} \u2014 don\u2019t let it fade!"
    content = f"""
    <h2 style="margin:0 0 8px;font-size:20px;color:#1a1d2e;">Hi {name},</h2>
    <p style="margin:0 0 20px;font-size:15px;color:#4a5568;line-height:1.6;">
      Your <strong>{skill_name}</strong> practice is due today. Keep the momentum going!
    </p>
    {health_bar_html(health)}
    <p style="font-size:14px;color:#718096;">
      Consistent practice is the key to retention. A quick 10-minute session today can prevent weeks of forgetting.
    </p>"""
    html = base_template(content, APP_URL, "Practice Now →", data.get('userEmail', ''))
    return subject, html


def build_overdue_email(data, days):
    skill = data.get('skillData', {})
    name = data.get('userName', 'there')
    skill_name = skill.get('skillName', 'your skill')
    health = skill.get('health', 50)
    subject = f"Your {skill_name} is {days} days overdue \u2014 knowledge fading!"
    urgency = 'Your skill health is dropping fast.' if health < 40 else 'Act soon to prevent further decay.'
    content = f"""
    <h2 style="margin:0 0 8px;font-size:20px;color:#1a1d2e;">Hi {name},</h2>
    <p style="margin:0 0 20px;font-size:15px;color:#4a5568;line-height:1.6;">
      Your <strong>{skill_name}</strong> practice is <strong>{days} days overdue</strong>. {urgency}
    </p>
    {health_bar_html(health)}
    <p style="font-size:14px;color:#718096;">
      The longer you wait, the more you forget. Jump back in now — your brain will thank you.
    </p>"""
    html = base_template(content, APP_URL, "Catch Up Now →", data.get('userEmail', ''))
    return subject, html


def build_weekly_summary_email(data):
    name = data.get('userName', 'there')
    extra = data.get('additionalData', {})
    streak = extra.get('streak', 0)
    week_history = extra.get('weekHistory', [])
    all_skills = extra.get('allSkills', [])
    sessions = len(week_history)
    subject = "Your week in review \u2014 SharpEdge Summary"

    skills_html = ''
    for skill in all_skills[:6]:
        sname = skill.get('skillName', '')
        health = skill.get('health', 100)
        h = int(health) if isinstance(health, (int, float)) else 100
        colour = '#4caf50' if h >= 70 else '#ff9800' if h >= 40 else '#f44336'
        skills_html += f"""
        <tr>
          <td style="padding:8px 0;font-size:14px;color:#4a5568;">{sname}</td>
          <td style="padding:8px 0;text-align:right;">
            <span style="background:{colour};color:#fff;font-size:11px;font-weight:700;padding:2px 8px;border-radius:10px;">{h}%</span>
          </td>
        </tr>"""

    content = f"""
    <h2 style="margin:0 0 8px;font-size:20px;color:#1a1d2e;">Your weekly summary, {name}</h2>
    <p style="margin:0 0 24px;font-size:15px;color:#4a5568;line-height:1.6;">
      Here\u2019s how your skills are doing this week.
    </p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:24px;">
      <tr>
        <td style="background:#f0f2f8;border-radius:8px;padding:16px;text-align:center;width:50%;">
          <div style="font-size:28px;font-weight:700;color:#667eea;">{sessions}</div>
          <div style="font-size:12px;color:#9aa5b4;margin-top:4px;">sessions this week</div>
        </td>
        <td style="width:16px;"></td>
        <td style="background:#f0f2f8;border-radius:8px;padding:16px;text-align:center;width:50%;">
          <div style="font-size:28px;font-weight:700;color:#667eea;">{streak}</div>
          <div style="font-size:12px;color:#9aa5b4;margin-top:4px;">day streak 🔥</div>
        </td>
      </tr>
    </table>
    {'<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-top:1px solid #e8ecf4;">' + skills_html + '</table>' if skills_html else ''}"""
    html = base_template(content, APP_URL, "View Dashboard →", data.get('userEmail', ''))
    return subject, html


def build_first_practice_email(data):
    skill = data.get('skillData', {})
    name = data.get('userName', 'there')
    skill_name = skill.get('skillName', 'your skill')
    subject = f"Great start! You just took your first step with {skill_name}"
    content = f"""
    <h2 style="margin:0 0 8px;font-size:20px;color:#1a1d2e;">You did it, {name}! 🎉</h2>
    <p style="margin:0 0 20px;font-size:15px;color:#4a5568;line-height:1.6;">
      You\u2019ve completed your first practice session for <strong>{skill_name}</strong>.
      The hardest part is starting — and you\u2019ve already done it!
    </p>
    <p style="font-size:14px;color:#718096;line-height:1.6;">
      SharpEdge will remind you when it\u2019s time to practise again based on the
      <strong>forgetting curve</strong> — so your knowledge stays fresh with minimal effort.
    </p>"""
    html = base_template(content, APP_URL, "Keep Going →", data.get('userEmail', ''))
    return subject, html


def build_streak_email(data, milestone):
    name = data.get('userName', 'there')
    subject = f"\U0001f525 {milestone}-Day Streak! You\u2019re building a real habit"
    content = f"""
    <h2 style="margin:0 0 8px;font-size:20px;color:#1a1d2e;">🔥 {milestone} days in a row, {name}!</h2>
    <p style="margin:0 0 20px;font-size:15px;color:#4a5568;line-height:1.6;">
      You\u2019ve practised for <strong>{milestone} consecutive days</strong>. That\u2019s a real achievement —
      you\u2019re building a habit that will compound over time.
    </p>
    <p style="font-size:14px;color:#718096;">
      Research shows it takes about 21 days to build a new habit. Keep it up and your skills will become second nature.
    </p>"""
    html = base_template(content, APP_URL, "Keep the Streak →", data.get('userEmail', ''))
    return subject, html


def build_score_improvement_email(data):
    skill = data.get('skillData', {})
    extra = data.get('additionalData', {})
    name = data.get('userName', 'there')
    skill_name = skill.get('skillName', 'your skill')
    score = extra.get('score', 0)
    subject = f"Your {skill_name} score jumped to {score}%!"
    content = f"""
    <h2 style="margin:0 0 8px;font-size:20px;color:#1a1d2e;">Great improvement, {name}! 📈</h2>
    <p style="margin:0 0 20px;font-size:15px;color:#4a5568;line-height:1.6;">
      Your <strong>{skill_name}</strong> score jumped to <strong>{score}%</strong> —
      a significant improvement over your recent average!
    </p>
    <p style="font-size:14px;color:#718096;">
      Consistent practice is clearly paying off. Keep it up to advance your skill interval and reduce how often you need to review.
    </p>"""
    html = base_template(content, APP_URL, "View Progress →", data.get('userEmail', ''))
    return subject, html


def build_inactivity_email(data):
    extra = data.get('additionalData', {})
    name = data.get('userName', 'there')
    days_since = extra.get('daysSince', 14)
    subject = "We miss you \u2014 your skills are waiting"
    content = f"""
    <h2 style="margin:0 0 8px;font-size:20px;color:#1a1d2e;">It\u2019s been a while, {name}</h2>
    <p style="margin:0 0 20px;font-size:15px;color:#4a5568;line-height:1.6;">
      You haven\u2019t practised in <strong>{days_since} days</strong>.
      Your skills may be starting to fade — now is the perfect time to jump back in.
    </p>
    <p style="font-size:14px;color:#718096;">
      Even a single 10-minute session will reset the clock and help consolidate what you\u2019ve learned.
    </p>"""
    html = base_template(content, APP_URL, "Resume Practice →", data.get('userEmail', ''))
    return subject, html


def build_critical_health_email(data):
    skill = data.get('skillData', {})
    name = data.get('userName', 'there')
    skill_name = skill.get('skillName', 'your skill')
    health = skill.get('health', 20)
    subject = f"Your {skill_name} knowledge is at critical risk"
    content = f"""
    <h2 style="margin:0 0 8px;font-size:20px;color:#c53030;">⚠️ Critical: {skill_name} needs attention</h2>
    <p style="margin:0 0 20px;font-size:15px;color:#4a5568;line-height:1.6;">
      Hi {name}, your <strong>{skill_name}</strong> skill health has dropped to a critical level.
      Without practice soon, you may lose significant knowledge you\u2019ve built up.
    </p>
    {health_bar_html(health)}
    <p style="font-size:14px;color:#718096;">
      Don\u2019t let your hard work go to waste. A few focused practice sessions will bring your health back up quickly.
    </p>"""
    html = base_template(content, APP_URL, "Practice Now →", data.get('userEmail', ''))
    return subject, html


def build_email(notification_type, data):
    if notification_type == 'practice_due':
        return build_practice_due_email(data)
    if notification_type in ('overdue_3', 'overdue_7', 'overdue_30'):
        days = int(notification_type.split('_')[1])
        return build_overdue_email(data, days)
    if notification_type == 'weekly_summary':
        return build_weekly_summary_email(data)
    if notification_type == 'first_practice':
        return build_first_practice_email(data)
    if notification_type in ('streak_7', 'streak_30', 'streak_100'):
        milestone = int(notification_type.split('_')[1])
        return build_streak_email(data, milestone)
    if notification_type == 'score_improvement':
        return build_score_improvement_email(data)
    if notification_type == 'inactivity':
        return build_inactivity_email(data)
    if notification_type == 'critical_health':
        return build_critical_health_email(data)
    raise ValueError(f"Unknown notification type: {notification_type}")


def lambda_handler(event, context):
    # Accept direct invocation payload (not API Gateway)
    notification_type = event.get('notificationType')
    user_email = event.get('userEmail')

    if not notification_type or not user_email:
        print(f"[email-sender] Missing notificationType or userEmail in event: {event}")
        return {'statusCode': 400, 'body': 'Missing required fields'}

    try:
        subject, html_body = build_email(notification_type, event)
    except ValueError as e:
        print(f"[email-sender] {e}")
        return {'statusCode': 400, 'body': str(e)}

    try:
        ses.send_email(
            Source=f'SharpEdge <{SENDER_EMAIL}>',
            Destination={'ToAddresses': [user_email]},
            Message={
                'Subject': {'Data': subject, 'Charset': 'UTF-8'},
                'Body': {'Html': {'Data': html_body, 'Charset': 'UTF-8'}},
            }
        )
        print(f"[email-sender] Sent '{notification_type}' to {user_email}")
        return {'statusCode': 200, 'body': 'sent'}
    except Exception as e:
        print(f"[email-sender] SES error: {e}")
        return {'statusCode': 500, 'body': str(e)}
