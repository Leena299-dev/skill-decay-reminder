import json


def lambda_handler(event, context):
    """
    Lambda function that accepts a name parameter and returns a greeting message in JSON format.
    
    Args:
        event: Lambda event object containing request parameters
        context: Lambda context object
        
    Returns:
        dict: Response with statusCode and body containing greeting message in JSON format
    """
    try:
        # Extract name from event
        # Support both queryStringParameters and body for flexibility
        name = None
        
        # Check queryStringParameters (for API Gateway GET requests)
        if event.get("queryStringParameters") and event["queryStringParameters"].get("name"):
            name = event["queryStringParameters"]["name"]
        
        # Check body (for API Gateway POST requests)
        elif event.get("body"):
            try:
                body = json.loads(event["body"]) if isinstance(event["body"], str) else event["body"]
                name = body.get("name")
            except json.JSONDecodeError:
                pass
        
        # Check direct parameters
        if not name:
            name = event.get("name")
        
        # Validate name parameter
        if not name:
            return {
                "statusCode": 400,
                "body": json.dumps({
                    "error": "Missing required parameter: 'name'",
                    "message": "Please provide a name parameter"
                })
            }
        
        # Generate greeting message
        greeting_message = f"Hello, {name}! Welcome to Lambda!"
        
        return {
            "statusCode": 200,
            "body": json.dumps({
                "message": greeting_message,
                "name": name
            })
        }
    
    except Exception as e:
        # Handle unexpected errors
        return {
            "statusCode": 500,
            "body": json.dumps({
                "error": "Internal server error",
                "message": str(e)
            })
        }
