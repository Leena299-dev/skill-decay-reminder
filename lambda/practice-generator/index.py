import boto3
import json
import uuid
import logging
import os
import time
import re
import random
from datetime import datetime
from decimal import Decimal

# Set up logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# AWS clients
bedrock = boto3.client('bedrock-runtime', region_name='us-east-1')
dynamodb = boto3.resource('dynamodb')
cache_table = dynamodb.Table(os.environ.get('CACHE_TABLE_NAME', 'ExerciseCache'))

# Bedrock model
BEDROCK_MODEL_ID = os.environ.get('BEDROCK_MODEL_ID', 'us.amazon.nova-micro-v1:0')


def check_cache(cache_key):
    """Check if exercise exists in cache and is not expired"""
    try:
        response = cache_table.get_item(Key={'cacheKey': cache_key})
        item = response.get('Item')
        if item:
            current_time = int(time.time())
            expires_at = int(item.get('expiresAt', 0))
            if expires_at > current_time:
                logger.info(f"Cache hit for: {cache_key}")
                return json.loads(item['exerciseData'])
            else:
                logger.info(f"Cache expired for: {cache_key}")
    except Exception as e:
        logger.warning(f"Cache check error (non-fatal): {e}")
    return None


def store_in_cache(cache_key, exercise_data):
    """Store exercise in DynamoDB cache with 1-hour TTL"""
    try:
        expires_at = int(time.time()) + (60 * 60)  # 1 hour
        cache_table.put_item(
            Item={
                'cacheKey': cache_key,
                'exerciseData': json.dumps(exercise_data),
                'expiresAt': expires_at,
                'createdAt': datetime.utcnow().isoformat()
            }
        )
        logger.info(f"Cached exercise: {cache_key}")
    except Exception as e:
        logger.error(f"Cache store error: {e}")
        raise


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

DIFFICULTY_PROMPTS = {
    'beginner_easy': 'very basic, entry-level, single core concept only, step-by-step instructions included, no prior knowledge assumed',
    'beginner_medium': 'beginner level, fundamental concepts, clear structure with some guidance provided',
    'beginner_hard': 'upper beginner, combines 2-3 core concepts, minimal guidance, encourages independent thinking',
    'intermediate_easy': 'intermediate level, comfortable with basics, introduces common design patterns',
    'intermediate_medium': 'intermediate, multiple concepts combined, real-world application, problem-solving required',
    'intermediate_hard': 'challenging intermediate, complex patterns, performance and edge-case awareness needed',
    'advanced_easy': 'advanced concepts, system design thinking, optimisation and best practices focus',
    'advanced_medium': 'advanced level, complex algorithms, architectural decisions required, production considerations',
    'advanced_hard': 'expert level, highly complex, edge cases and failure modes, production-ready thinking, no scaffolding',
}


def normalize_difficulty(raw):
    if raw in DIFFICULTY_LEVELS:
        return raw
    return PROFICIENCY_TO_DIFFICULTY.get(raw, 'intermediate_medium')


def generate_with_bedrock(skill_name, category, adaptive_difficulty, exercise_type, random_seed):
    """Generate practice exercise using Amazon Bedrock Nova Micro"""
    difficulty_desc = DIFFICULTY_PROMPTS.get(adaptive_difficulty, DIFFICULTY_PROMPTS['intermediate_medium'])
    difficulty_label = adaptive_difficulty.replace('_', ' ').title()

    prompt = f"""You are an expert instructor. Generate a practice exercise.

Skill: {skill_name}
Category: {category}
Difficulty Level: {difficulty_label} ({difficulty_desc})
Exercise Type: {exercise_type}
Time Available: 15 minutes
Variation Seed: {random_seed}

IMPORTANT: Generate a completely unique and different exercise each time. Never repeat the same question, scenario, or example. Use varied:
- Different scenarios and contexts each time
- Different vocabulary or concepts within the skill
- Different question formats (translate this, fill in the blank, explain this concept, write an example, spot the error, compare and contrast, etc.)
- Use the Variation Seed above to ensure this exercise is distinct from previous ones

IMPORTANT: Return ONLY valid JSON, no other text, no markdown, no code blocks.
Use this exact structure:
{{
  "title": "Exercise title",
  "description": "Clear description of what to do",
  "content": "The full exercise problem or question",
  "hints": ["Helpful hint 1", "Helpful hint 2", "Helpful hint 3"],
  "solution": "Complete solution with explanation",
  "estimatedTime": 15,
  "keyConcepts": ["key concept 1", "key concept 2"]
}}"""

    logger.info(f"Calling Bedrock for: {skill_name} ({adaptive_difficulty}) seed={random_seed}")
    
    # Call Bedrock converse API
    response = bedrock.converse(
        modelId=BEDROCK_MODEL_ID,
        messages=[
            {
                "role": "user",
                "content": [{"text": prompt}]
            }
        ]
    )
    
    # Extract text from response
    response_text = response["output"]["message"]["content"][0]["text"]
    logger.info(f"Bedrock responded ({len(response_text)} chars)")
    
    # Parse JSON response
    try:
        exercise_data = json.loads(response_text)
    except json.JSONDecodeError:
        # Try to extract JSON if there's extra text
        json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
        if json_match:
            exercise_data = json.loads(json_match.group())
        else:
            logger.error(f"Could not parse JSON: {response_text[:300]}")
            raise Exception("Bedrock returned invalid JSON format")
    
    return exercise_data


def success_response(data, status_code=200):
    return {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Allow-Methods': 'POST,OPTIONS'
        },
        'body': json.dumps(data)
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
    
    # Handle OPTIONS (CORS preflight)
    if event.get('httpMethod') == 'OPTIONS':
        return success_response({})
    
    try:
        # Parse request body
        body = event.get('body', '{}')
        if isinstance(body, str):
            body = json.loads(body)
        
        # Get parameters
        skill_name = body.get('skillName')
        category = body.get('category', 'coding')
        proficiency = body.get('proficiency', 'intermediate')
        adaptive_difficulty = normalize_difficulty(body.get('adaptiveDifficulty') or proficiency)
        exercise_type = body.get('exerciseType', 'coding_challenge')
        user_id = body.get('userId')
        skill_id = body.get('skillId')

        # Validate required fields
        if not skill_name:
            return error_response('skillName is required', 400)
        if not user_id:
            return error_response('userId is required', 400)
        if not skill_id:
            return error_response('skillId is required', 400)

        # Session-unique seed — ensures every practice click gets a fresh exercise
        # (cache key is always new so check_cache always misses)
        random_seed = f"{int(time.time())}_{random.randint(1000, 9999)}"
        cache_key = (
            f"{skill_name}_{adaptive_difficulty}_{exercise_type}_{random_seed}"
            .lower().replace(" ", "_")
        )
        logger.info(f"Session cache key: {cache_key}")

        # Cache lookup — will always miss because key includes session seed;
        # kept here so the infrastructure remains easy to re-enable if needed
        cached = check_cache(cache_key)
        if cached:
            cached['fromCache'] = True
            return success_response(cached)

        # Always generates fresh — call Bedrock with the random seed for variety
        logger.info(f"Generating fresh exercise (seed={random_seed})")
        exercise = generate_with_bedrock(
            skill_name, category, adaptive_difficulty, exercise_type, random_seed
        )

        # Add metadata to exercise
        exercise['exerciseId'] = str(uuid.uuid4())
        exercise['skillName'] = skill_name
        exercise['category'] = category
        exercise['adaptiveDifficulty'] = adaptive_difficulty
        exercise['exerciseType'] = exercise_type
        exercise['fromCache'] = False
        
        # Store in cache for next time
        try:
            store_in_cache(cache_key, exercise)
        except Exception as e:
            logger.warning(f"Cache storage failed (non-fatal): {e}")
        
        return success_response(exercise)
        
    except Exception as e:
        logger.error(f"Error: {str(e)}")
        return error_response(f'Failed to generate exercise: {str(e)}', 500)