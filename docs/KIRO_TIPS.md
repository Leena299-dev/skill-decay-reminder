# How to Use Kiro/Amazon Q Effectively

## Good Prompt Formula

**Always include these 4 things:**

1. **WHAT** you want (Lambda function, DynamoDB table, etc.)
2. **TECHNOLOGY** (Python 3.11, CloudFormation, etc.)
3. **SPECIFIC REQUIREMENTS** (error handling, logging, etc.)
4. **FORMAT** (CloudFormation template, Python code, etc.)

---

## Example Good Prompts

### For Lambda Functions:
```
Create a Python 3.11 Lambda function that:
1. Accepts a POST request from API Gateway
2. Extracts email and name from the request body
3. Validates the email format using regex
4. Stores the data in DynamoDB table called "Users"
5. Returns a JSON response with success/error message
6. Includes proper error handling with try/except
7. Includes CloudWatch logging
8. Returns proper HTTP status codes (200, 400, 500)
```

### For DynamoDB Tables:
```
Create a CloudFormation template for a DynamoDB table with these specifications:
- Table name: Skills
- Partition key: skillId (String type)
- Sort key: userId (String type)
- Global Secondary Index: userId-index for querying by userId
- On-demand billing mode (PAY_PER_REQUEST)
- Include a TTL attribute called expiresAt
- Add tags for the project
```

### For IAM Roles:
```
Create a CloudFormation template for an IAM role that:
- Role name: SkillDecayLambdaRole
- Service: Lambda
- Permissions needed:
  1. Read/write to DynamoDB tables: Users, Skills, ExerciseCache
  2. Invoke Bedrock models
  3. Send emails via SES
  4. Write logs to CloudWatch
- Use least-privilege principle
- Include all necessary policies
```

### For API Gateway:
```
Create a CloudFormation template for API Gateway:
- REST API named "SkillDecayAPI"
- Deployment stage: prod
- CORS enabled for all endpoints
- Endpoints needed:
  1. POST /users - connected to UserRegistration Lambda
  2. POST /skills - connected to SkillManager Lambda
  3. GET /skills - connected to SkillManager Lambda
  4. GET /practice - connected to PracticeGenerator Lambda
- Use Lambda proxy integration
```

---

## Bad Prompts (DON'T DO THIS!)

❌ "Create a Lambda function"
- Too vague! What should it do?

❌ "Make a database"
- What kind? What fields? What's it for?

❌ "Build an API"
- What endpoints? What data? What responses?

❌ "Write some code for users"
- What language? What functionality? What format?

**Problem:** Kiro will make guesses and probably get it wrong!

---

## How to Use Kiro: Step-by-Step Workflow

### Step 1: Write a Clear, Detailed Prompt
- Include all 4 elements (WHAT, TECHNOLOGY, REQUIREMENTS, FORMAT)
- Be specific about names, types, and behavior
- Mention any constraints (must be Free Tier, must use specific service, etc.)

### Step 2: Let Kiro Generate
- In AWS Console: Type prompt → Wait for response
- In VS Code: Write comment → Wait for gray text → Press Tab

### Step 3: Review the Output CAREFULLY
- Don't blindly copy-paste!
- Read every line
- Understand what it does
- Check for:
  - Correct table names
  - Proper error handling
  - Appropriate permissions
  - Free Tier compatibility

### Step 4: Modify as Needed
- Kiro's output is a STARTING POINT
- You'll usually need to adjust it
- Change names, add logic, fix errors
- Make it fit YOUR specific needs

### Step 5: Test the Code
- Never deploy without testing
- Use small test cases first
- Verify it works as expected

### Step 6: Save and Document
- Save Kiro's output even if not using it now
- Add comments explaining what it does
- Document any changes you made

---

## Kiro Keyboard Shortcuts in VS Code

- **Accept suggestion:** Press `Tab`
- **Reject suggestion:** Press `Esc`
- **Next suggestion:** Press `Alt + ]` (Windows) or `Option + ]` (Mac)
- **Previous suggestion:** Press `Alt + [` (Windows) or `Option + [` (Mac)
- **Open Amazon Q chat:** Click AWS icon (left sidebar) → Amazon Q

---

## Tips for Better Results

### DO:
✅ Be extremely specific
✅ Mention error cases you want handled
✅ Specify exact AWS service names
✅ Include example data/inputs
✅ Ask for comments in the code
✅ Request Free Tier compatible solutions

### DON'T:
❌ Be vague or general
❌ Assume Kiro knows your context
❌ Trust output without reviewing
❌ Skip testing
❌ Forget to verify Free Tier status
❌ Use output without understanding it

---

## Cost Warning 🚨

**CRITICAL REMINDERS:**

1. **Kiro itself is FREE** ✅
2. **The AWS resources Kiro suggests might COST MONEY** ⚠️
3. **Always verify Free Tier status before deploying**
4. **Check pricing at:** https://aws.amazon.com/pricing/

**Examples:**
- Kiro suggests Lambda → Lambda has Free Tier ✅
- Kiro suggests Bedrock → Bedrock is pay-per-use ⚠️ (but affordable)
- Kiro suggests EC2 → EC2 t2.micro has Free Tier, but others cost money ⚠️

**ALWAYS ASK:** "Is this service in AWS Free Tier?"

---

## Common Kiro Mistakes to Watch For

### Mistake 1: Wrong Service Names
```yaml
# Kiro might generate:
TableName: users

# But you wanted:
TableName: Users
```
**Fix:** Change to match your naming convention

### Mistake 2: Missing Error Handling
```python
# Kiro might generate:
user = table.get_item(Key={'id': user_id})
return user['Item']

# Problem: Crashes if user doesn't exist!
# Fix: Add try/except and check if 'Item' exists
```

### Mistake 3: Overly Permissive IAM Policies
```yaml
# Kiro might generate:
Action: "*"
Resource: "*"

# Problem: Too much access! Security risk!
# Fix: Specify exact actions and resources needed
```

### Mistake 4: Hardcoded Values
```python
# Kiro might generate:
table = dynamodb.Table('Users')

# Better: Use environment variables
table = dynamodb.Table(os.environ['TABLE_NAME'])
```

---

## When NOT to Use Kiro

**Skip Kiro for:**
- One-line changes (faster to type yourself)
- Very simple code (you already know how)
- Business-specific logic (Kiro won't know your rules)
- Debugging (Kiro can't see your errors)

**Use Kiro for:**
- Boilerplate and templates
- AWS service configurations
- Infrastructure as Code
- Repetitive patterns
- Learning new AWS services

---

## Practice Exercise

**Try this prompt in Kiro and review the output:**
```
Create a Python 3.11 Lambda function that:
1. Receives an API Gateway event
2. Extracts 'userId' from query parameters
3. Queries DynamoDB table 'Skills' using userId-index GSI
4. Returns list of skills as JSON
5. Handles errors with proper HTTP status codes
6. Includes logging
```

**Then:**
1. Review the generated code
2. Check if it handles missing userId
3. Verify error handling is complete
4. Test if the DynamoDB query syntax is correct
5. Make any necessary improvements

---

## Resources

- Amazon Q Documentation: https://aws.amazon.com/q/
- AWS Free Tier: https://aws.amazon.com/free/
- CloudFormation Docs: https://docs.aws.amazon.com/cloudformation/
- Lambda Best Practices: https://docs.aws.amazon.com/lambda/latest/dg/best-practices.html

---

## Remember

**Kiro is a TOOL, not a replacement for thinking**

- It helps you write FASTER ✅
- But YOU must understand what it creates ✅
- YOU make the final decisions ✅
- YOU are responsible for the code ✅

**Use Kiro to save time on boring stuff, so you can focus on the interesting stuff!** 🚀
```

3. **Save the file** (Ctrl+S or Cmd+S)

4. **This is YOUR cheat sheet - refer to it often!**

**✅ Kiro Cheat Sheet Created!**

---
