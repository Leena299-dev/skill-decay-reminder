# Practice Generator Lambda Function

AI-powered practice exercise generation using Amazon Bedrock Nova Micro with intelligent caching.

## Overview

This Lambda function generates personalized practice exercises for skill maintenance using:
- **Amazon Bedrock Nova Micro** for AI generation
- **DynamoDB ExerciseCache** for cost optimization (80% cache hit target)
- **Smart prompt engineering** for quality exercises
- **60-day TTL caching** to reduce Bedrock costs by 60%

## Function Details

- **Runtime:** Python 3.11
- **Handler:** index.lambda_handler
- **Timeout:** 30 seconds (recommended)
- **Memory:** 256 MB (recommended)

## Required IAM Permissions

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "bedrock:InvokeModel",
        "bedrock:InvokeModelWithResponseStream"
      ],
      "Resource": "arn:aws:bedrock:us-east-1::foundation-model/amazon.nova-micro-v1:0"
    },
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:PutItem"
      ],
      "Resource": "arn:aws:dynamodb:us-east-1:*:table/ExerciseCache"
    }
  ]
}
```

## Request Format

### POST Request Body

```json
{
  "userId": "user-123",
  "skillId": "skill-456",
  "skillName": "Python",
  "category": "coding",
  "proficiency": "intermediate",
  "exerciseType": "coding_challenge"
}
```

### Required Fields
- `userId` (string) - User identifier
- `skillId` (string) - Skill identifier
- `skillName` (string) - Name of the skill (e.g., "Python", "Spanish", "Guitar")
- `category` (string) - One of: `coding`, `language`, `certification`, `instrument`, `other`
- `proficiency` (string) - One of: `beginner`, `intermediate`, `advanced`, `expert`

### Optional Fields
- `exerciseType` (string) - Default: `coding_challenge`

## Response Format

### Success Response (200)

```json
{
  "exerciseId": "uuid-generated",
  "skillName": "Python",
  "category": "coding",
  "proficiency": "intermediate",
  "exerciseType": "coding_challenge",
  "title": "Build a REST API Rate Limiter",
  "description": "Implement a decorator-based rate limiter for API endpoints",
  "content": "Create a Python decorator that limits API calls to 100 requests per minute per user...",
  "hints": [
    "Use a dictionary to track timestamps per user",
    "Consider using collections.deque for efficient time window management",
    "Remember to handle edge cases like concurrent requests"
  ],
  "solution": "Complete implementation with explanation...",
  "estimatedTime": 20,
  "keyConcepts": [
    "Decorators",
    "Rate Limiting Algorithms",
    "Time Window Management"
  ],
  "fromCache": false
}
```

### Error Response (400/500)

```json
{
  "error": "Missing required fields: skillName, proficiency"
}
```

## Caching Strategy

### Cache Key Format
```
{skillName}_{proficiency}_{exerciseType}
```
Example: `python_intermediate_coding_challenge`

### Cache Behavior
1. **Cache Hit:** Returns cached exercise with `fromCache: true`
2. **Cache Miss:** Generates new exercise via Bedrock, stores in cache
3. **TTL:** 60 days (5,184,000 seconds)
4. **Expiration:** Automatic via DynamoDB TTL

### Cost Optimization
- **Target:** 80% cache hit rate
- **Savings:** 60% reduction in Bedrock costs
- **Example:** 1000 requests → 200 Bedrock calls (800 from cache)

## Bedrock Integration

### Model Configuration
- **Model ID:** `amazon.nova-micro-v1:0`
- **Temperature:** 0.7 (balanced creativity)
- **Max Tokens:** 2000
- **API:** Converse API (latest)

### Prompt Engineering

The function uses context-aware prompts based on:
- **Category-specific context** (coding vs language vs instrument)
- **Proficiency-level guidance** (beginner → expert)
- **Exercise type requirements**

Example prompt structure:
```
Generate a practice exercise for Python (programming) at intermediate level.

Requirements:
- Focus on practical application, moderate complexity
- Exercise type: coding_challenge
- Estimated time: 10-30 minutes
- Include 3 progressive hints
- Provide complete solution

Return ONLY valid JSON...
```

## Testing

### Local Testing with AWS CLI

```bash
aws lambda invoke \
  --function-name PracticeGenerator \
  --payload file://test-events/practice-generator-test.json \
  response.json

cat response.json
```

### Test Event Examples

#### Python Coding Challenge
```json
{
  "body": "{\"userId\":\"user-1\",\"skillId\":\"skill-1\",\"skillName\":\"Python\",\"category\":\"coding\",\"proficiency\":\"intermediate\",\"exerciseType\":\"coding_challenge\"}"
}
```

#### Spanish Language Practice
```json
{
  "body": "{\"userId\":\"user-2\",\"skillId\":\"skill-2\",\"skillName\":\"Spanish\",\"category\":\"language\",\"proficiency\":\"beginner\",\"exerciseType\":\"conversation\"}"
}
```

#### AWS Certification Prep
```json
{
  "body": "{\"userId\":\"user-3\",\"skillId\":\"skill-3\",\"skillName\":\"AWS Solutions Architect\",\"category\":\"certification\",\"proficiency\":\"advanced\",\"exerciseType\":\"scenario_based\"}"
}
```

## Deployment

### Using AWS CLI

```bash
# Package function
cd lambda/practice-generator
zip -r function.zip index.py

# Create/Update Lambda
aws lambda create-function \
  --function-name PracticeGenerator \
  --runtime python3.11 \
  --role arn:aws:iam::ACCOUNT_ID:role/LambdaBedrockRole \
  --handler index.lambda_handler \
  --zip-file fileb://function.zip \
  --timeout 30 \
  --memory-size 256

# Or update existing
aws lambda update-function-code \
  --function-name PracticeGenerator \
  --zip-file fileb://function.zip
```

### Using CloudFormation

See `infrastructure/practice-generator-lambda.yaml` (to be created)

## Error Handling

The function handles:
- ✅ Missing required fields (400 error)
- ✅ Invalid JSON in request body
- ✅ Bedrock API failures (retries, fallback)
- ✅ DynamoDB cache errors (continues without cache)
- ✅ JSON parsing errors from Bedrock response
- ✅ Markdown code block removal from AI responses

## Performance

### Expected Metrics
- **Cold Start:** ~2-3 seconds (Bedrock initialization)
- **Warm Start (Cache Hit):** <200ms
- **Warm Start (Cache Miss):** 1-3 seconds (Bedrock generation)
- **Cache Hit Rate Target:** 80%

### Cost Estimates (per 1000 requests)

| Scenario | Bedrock Calls | Lambda Invocations | Estimated Cost |
|----------|---------------|-------------------|----------------|
| 0% Cache Hit | 1000 | 1000 | ~$0.50 |
| 50% Cache Hit | 500 | 1000 | ~$0.25 |
| 80% Cache Hit | 200 | 1000 | ~$0.10 |

**Bedrock Nova Micro:** ~$0.0004 per request  
**Lambda:** Free Tier (1M requests/month)  
**DynamoDB:** Free Tier (on-demand)

## Monitoring

### CloudWatch Metrics to Track
- `Invocations` - Total function calls
- `Duration` - Execution time
- `Errors` - Failed invocations
- `Throttles` - Rate limit hits

### Custom Metrics (Log Insights)
```
# Cache hit rate
fields @timestamp, @message
| filter @message like /fromCache/
| stats count(*) by fromCache

# Bedrock errors
fields @timestamp, @message
| filter @message like /Bedrock error/
```

## Troubleshooting

### Issue: "Missing required fields" error
**Solution:** Ensure all required fields are in request body

### Issue: Bedrock timeout
**Solution:** Increase Lambda timeout to 30+ seconds

### Issue: Invalid JSON from Bedrock
**Solution:** Function auto-strips markdown, but check logs for parsing errors

### Issue: Cache not working
**Solution:** Verify ExerciseCache table exists with `cacheKey` as partition key

## Next Steps

1. ✅ Deploy Lambda function
2. ✅ Test with sample requests
3. ✅ Integrate with API Gateway
4. ✅ Monitor cache hit rate
5. ✅ Optimize prompts based on quality feedback

## Related Files

- `test-events/practice-generator-test.json` - Test event
- `infrastructure/practice-generator-lambda.yaml` - CloudFormation (TBD)
- `docs/BEDROCK_INTEGRATION.md` - Bedrock setup guide (TBD)

---

**Built for AWS 10,000 AIdeas Competition**  
*Cost-optimized AI exercise generation with 80% cache hit target*
