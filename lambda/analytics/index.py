import boto3
import json
from datetime import datetime, timedelta
from decimal import Decimal
from boto3.dynamodb.conditions import Key
import os

dynamodb = boto3.resource('dynamodb')
history_table = dynamodb.Table(os.environ.get('HISTORY_TABLE', 'PracticeHistory'))

def decimal_to_number(obj):
    """Convert Decimal to int/float for JSON"""
    if isinstance(obj, list):
        return [decimal_to_number(i) for i in obj]
    elif isinstance(obj, dict):
        return {k: decimal_to_number(v) for k, v in obj.items()}
    elif isinstance(obj, Decimal):
        return int(obj) if obj % 1 == 0 else float(obj)
    return obj

def calculate_streak(sessions):
    """Calculate current practice streak in days"""
    if not sessions:
        return 0
    
    # Group sessions by date
    dates = set()
    for session in sessions:
        completed_at = session.get('completedAt')
        if completed_at:
            # Convert Unix timestamp to date
            date = datetime.fromtimestamp(int(completed_at)).date()
            dates.add(date)
    
    if not dates:
        return 0
    
    # Sort dates descending
    sorted_dates = sorted(dates, reverse=True)
    
    # Check if practiced today or yesterday
    today = datetime.utcnow().date()
    yesterday = today - timedelta(days=1)
    
    if sorted_dates[0] not in [today, yesterday]:
        return 0  # Streak broken
    
    # Count consecutive days
    streak = 0
    current_date = sorted_dates[0]
    
    for date in sorted_dates:
        expected_date = current_date - timedelta(days=streak)
        if date == expected_date:
            streak += 1
        else:
            break
    
    return streak

def lambda_handler(event, context):
    try:
        # Get userId from query parameters
        query_params = event.get('queryStringParameters')
        if not query_params:
            return {
                'statusCode': 400,
                'headers': {'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'Missing query parameters'})
            }
        
        user_id = query_params.get('userId')
        
        if not user_id:
            return {
                'statusCode': 400,
                'headers': {'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'userId required'})
            }
        
        # Get all practice sessions for user
        try:
            response = history_table.query(
                KeyConditionExpression=Key('userId').eq(user_id)
            )
        except Exception as e:
            print(f"DynamoDB query error: {str(e)}")
            # Return empty analytics if no data
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({
                    'streak': 0,
                    'totalSessions': 0,
                    'totalTime': 0,
                    'averageScore': 0,
                    'practiceFrequency': [],
                    'practiceBySkill': []
                })
            }
        
        sessions = response.get('Items', [])
        
        # If no sessions, return empty analytics
        if not sessions:
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({
                    'streak': 0,
                    'totalSessions': 0,
                    'totalTime': 0,
                    'averageScore': 0,
                    'practiceFrequency': [],
                    'practiceBySkill': []
                })
            }
        
        # Calculate basic stats
        total_sessions = len(sessions)
        total_time = sum(int(s.get('timeSpent', 0)) for s in sessions)
        avg_score = round(sum(int(s.get('score', 0)) for s in sessions) / total_sessions, 1) if total_sessions > 0 else 0
        streak = calculate_streak(sessions)
        
        # Practice frequency (last 30 days)
        thirty_days_ago = int((datetime.utcnow() - timedelta(days=30)).timestamp())
        recent_sessions = [s for s in sessions if int(s.get('completedAt', 0)) >= thirty_days_ago]
        
        # Group by date for frequency chart
        frequency_data = {}
        for session in recent_sessions:
            completed_at = int(session.get('completedAt', 0))
            date = datetime.fromtimestamp(completed_at).strftime('%Y-%m-%d')
            frequency_data[date] = frequency_data.get(date, 0) + 1
        
        practice_frequency = [
            {'date': date, 'sessions': count}
            for date, count in sorted(frequency_data.items())
        ]
        
        # Practice by skill
        skill_data = {}
        for session in sessions:
            skill_id = session.get('skillId', 'Unknown')
            skill_name = session.get('skillName', 'Unknown')
            
            if skill_id not in skill_data:
                skill_data[skill_id] = {
                    'skillId': skill_id,
                    'skillName': skill_name,
                    'sessions': 0,
                    'totalTime': 0,
                    'scores': []
                }
            
            skill_data[skill_id]['sessions'] += 1
            skill_data[skill_id]['totalTime'] += int(session.get('timeSpent', 0))
            skill_data[skill_id]['scores'].append(int(session.get('score', 0)))
        
        # Calculate averages and format
        practice_by_skill = []
        for data in skill_data.values():
            data['avgScore'] = round(sum(data['scores']) / len(data['scores']), 1) if data['scores'] else 0
            del data['scores']
            practice_by_skill.append(data)
        
        # Sort by sessions (most practiced first)
        practice_by_skill.sort(key=lambda x: x['sessions'], reverse=True)
        
        # Build response
        analytics = {
            'streak': streak,
            'totalSessions': total_sessions,
            'totalTime': total_time,
            'averageScore': avg_score,
            'practiceFrequency': practice_frequency,
            'practiceBySkill': practice_by_skill
        }
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'GET,OPTIONS'
            },
            'body': json.dumps(decimal_to_number(analytics))
        }
        
    except Exception as e:
        print(f"Analytics error: {str(e)}")
        import traceback
        traceback.print_exc()
        return {
            'statusCode': 500,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': str(e)})
        }