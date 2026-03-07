import boto3
import json
import logging
import os
import re

logger = logging.getLogger()
logger.setLevel(logging.INFO)

bedrock = boto3.client('bedrock-runtime', region_name='us-east-1')
BEDROCK_MODEL_ID = os.environ.get('BEDROCK_MODEL_ID', 'us.amazon.nova-micro-v1:0')

CORS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
}


def success_response(data, status_code=200):
    return {'statusCode': status_code, 'headers': CORS, 'body': json.dumps(data)}


def error_response(message, status_code=500):
    return {'statusCode': status_code, 'headers': CORS, 'body': json.dumps({'error': message})}


def evaluate_with_bedrock(skill_name, category, exercise_title, exercise_description,
                           exercise_problem, model_answer, user_answer, adaptive_difficulty):
    difficulty_label = adaptive_difficulty.replace('_', ' ').title() if adaptive_difficulty else 'Intermediate Medium'
    is_beginner = 'beginner' in (adaptive_difficulty or '').lower()
    feedback_tone = (
        'This is a beginner level exercise. Use extra encouragement and simple language.'
        if is_beginner else
        'Use technical language appropriate for this level. Be precise and specific.'
    )

    blank_note = ''
    if not user_answer.strip():
        blank_note = '\nNOTE: The student submitted a blank or near-blank answer. Score 0-10 and warmly encourage them to try again with a proper attempt.\n'

    prompt = f"""Evaluate this practice answer:

SKILL: {skill_name} ({category})
DIFFICULTY LEVEL: {difficulty_label}
EXERCISE: {exercise_title}
DESCRIPTION: {exercise_description}
PROBLEM: {exercise_problem}
MODEL ANSWER: {model_answer if model_answer else "(no model answer — evaluate based on problem and student answer)"}
STUDENT ANSWER: {user_answer if user_answer.strip() else "(blank)"}
{blank_note}
{feedback_tone}

Provide evaluation in this EXACT JSON format, no markdown, no extra text:
{{
  "score": <number 0-100>,
  "whatWasCorrect": "<specific praise referencing their actual words, or 'Nothing yet — have a go!' if blank>",
  "whatWasMissing": "<specific constructive gaps, max 2 points, never harsh>",
  "improvementTip": "<one specific actionable tip for next time>",
  "encouragingMessage": "<short warm closing message 1-2 sentences referencing their skill>",
  "detailedFeedback": "<2-3 sentence overall summary>"
}}

Scoring guide:
- 90-100: Complete, accurate, well explained
- 70-89: Mostly correct, minor gaps
- 50-69: Core concept understood, key details missing
- 30-49: Partial understanding, significant gaps
- 0-29: Fundamental misunderstanding or blank answer

IMPORTANT: Never reveal the model answer directly. Always be encouraging."""

    response = bedrock.converse(
        modelId=BEDROCK_MODEL_ID,
        system=[{
            'text': (
                'You are an expert tutor evaluating a student\'s answer. '
                'Be specific, constructive and encouraging. '
                'Always reference the actual content of their answer. '
                'Never be harsh or discouraging. '
                'Focus on helping them improve.'
            )
        }],
        messages=[{'role': 'user', 'content': [{'text': prompt}]}],
        inferenceConfig={'maxTokens': 800, 'temperature': 0.3},
    )

    response_text = response['output']['message']['content'][0]['text']
    logger.info(f"Bedrock responded ({len(response_text)} chars)")

    try:
        return json.loads(response_text)
    except json.JSONDecodeError:
        json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
        if json_match:
            return json.loads(json_match.group())
        logger.error(f"Could not parse JSON from Bedrock: {response_text[:300]}")
        raise Exception("Bedrock returned invalid JSON format")


def lambda_handler(event, context):
    logger.info(f"Event: {json.dumps(event)}")

    if event.get('httpMethod') == 'OPTIONS':
        return success_response({})

    try:
        body = event.get('body', '{}')
        if isinstance(body, str):
            body = json.loads(body)

        user_id = body.get('userId')
        skill_name = body.get('skillName')

        if not user_id:
            return error_response('userId is required', 400)
        if not skill_name:
            return error_response('skillName is required', 400)

        user_answer = body.get('userAnswer', '')
        logger.info(f"Evaluating answer for userId={user_id}, skill={skill_name}, answer_len={len(user_answer)}")

        feedback = evaluate_with_bedrock(
            skill_name=skill_name,
            category=body.get('category', ''),
            exercise_title=body.get('exerciseTitle', ''),
            exercise_description=body.get('exerciseDescription', ''),
            exercise_problem=body.get('exerciseProblem', ''),
            model_answer=body.get('modelAnswer', ''),
            user_answer=user_answer,
            adaptive_difficulty=body.get('adaptiveDifficulty', 'intermediate_medium'),
        )

        # Clamp score to valid range
        score = int(feedback.get('score', 0))
        feedback['score'] = max(0, min(100, score))

        return success_response(feedback)

    except Exception as e:
        logger.error(f"Error in answer-evaluator: {str(e)}")
        # Graceful fallback — frontend shows self-mark option
        return success_response({
            'score': None,
            'whatWasCorrect': '',
            'whatWasMissing': '',
            'improvementTip': '',
            'encouragingMessage': '',
            'detailedFeedback': 'AI feedback is temporarily unavailable. Please use self-marking instead.',
            'error': True,
        })
