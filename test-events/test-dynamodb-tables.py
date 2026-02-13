import boto3
import uuid
import time
from decimal import Decimal

dynamodb = boto3.resource('dynamodb')

def test_users_table():
    print("\n=== Testing Users Table ===")
    table = dynamodb.Table('Users')
    test_user_id = str(uuid.uuid4())
    
    try:
        # Create test item
        test_item = {
            'userId': test_user_id,
            'email': 'test@example.com',
            'name': 'Test User',
            'createdAt': int(time.time())
        }
        
        # Put item
        print(f"Putting item with userId: {test_user_id}")
        table.put_item(Item=test_item)
        
        # Get item
        response = table.get_item(Key={'userId': test_user_id})
        retrieved_item = response.get('Item')
        
        if retrieved_item:
            print(f"✓ Successfully retrieved: {retrieved_item}")
        else:
            print("✗ Failed to retrieve item")
            return False
        
        # Delete item
        table.delete_item(Key={'userId': test_user_id})
        print("✓ Test item deleted")
        return True
        
    except Exception as e:
        print(f"✗ Error testing Users table: {e}")
        return False

def test_skills_table():
    print("\n=== Testing Skills Table ===")
    table = dynamodb.Table('Skills')
    test_skill_id = str(uuid.uuid4())
    test_user_id = str(uuid.uuid4())
    
    try:
        # Create test item
        test_item = {
            'skillId': test_skill_id,
            'userId': test_user_id,
            'skillName': 'Python Programming',
            'lastPracticed': int(time.time()),
            'proficiencyLevel': 'Intermediate'
        }
        
        # Put item
        print(f"Putting item with skillId: {test_skill_id}, userId: {test_user_id}")
        table.put_item(Item=test_item)
        
        # Get item
        response = table.get_item(Key={'skillId': test_skill_id, 'userId': test_user_id})
        retrieved_item = response.get('Item')
        
        if retrieved_item:
            print(f"✓ Successfully retrieved: {retrieved_item}")
        else:
            print("✗ Failed to retrieve item")
            return False
        
        # Delete item
        table.delete_item(Key={'skillId': test_skill_id, 'userId': test_user_id})
        print("✓ Test item deleted")
        return True
        
    except Exception as e:
        print(f"✗ Error testing Skills table: {e}")
        return False

def test_exercise_cache_table():
    print("\n=== Testing ExerciseCache Table ===")
    table = dynamodb.Table('ExerciseCache')
    test_cache_key = str(uuid.uuid4())
    
    try:
        # Create test item with TTL (expires in 60 days)
        test_item = {
            'cacheKey': test_cache_key,
            'exercise': 'Write a function to reverse a string',
            'difficulty': 'Easy',
            'expiresAt': int(time.time()) + (60 * 24 * 60 * 60)  # 60 days from now
        }
        
        # Put item
        print(f"Putting item with cacheKey: {test_cache_key}")
        table.put_item(Item=test_item)
        
        # Get item
        response = table.get_item(Key={'cacheKey': test_cache_key})
        retrieved_item = response.get('Item')
        
        if retrieved_item:
            print(f"✓ Successfully retrieved: {retrieved_item}")
        else:
            print("✗ Failed to retrieve item")
            return False
        
        # Delete item
        table.delete_item(Key={'cacheKey': test_cache_key})
        print("✓ Test item deleted")
        return True
        
    except Exception as e:
        print(f"✗ Error testing ExerciseCache table: {e}")
        return False

def test_practice_history_table():
    print("\n=== Testing PracticeHistory Table ===")
    table = dynamodb.Table('PracticeHistory')
    test_user_id = str(uuid.uuid4())
    test_completed_at = int(time.time())
    
    try:
        # Create test item
        test_item = {
            'userId': test_user_id,
            'completedAt': test_completed_at,
            'skillId': str(uuid.uuid4()),
            'score': Decimal('85.5'),
            'exerciseType': 'Multiple Choice'
        }
        
        # Put item
        print(f"Putting item with userId: {test_user_id}, completedAt: {test_completed_at}")
        table.put_item(Item=test_item)
        
        # Get item
        response = table.get_item(Key={'userId': test_user_id, 'completedAt': test_completed_at})
        retrieved_item = response.get('Item')
        
        if retrieved_item:
            print(f"✓ Successfully retrieved: {retrieved_item}")
        else:
            print("✗ Failed to retrieve item")
            return False
        
        # Delete item
        table.delete_item(Key={'userId': test_user_id, 'completedAt': test_completed_at})
        print("✓ Test item deleted")
        return True
        
    except Exception as e:
        print(f"✗ Error testing PracticeHistory table: {e}")
        return False

if __name__ == "__main__":
    print("Starting DynamoDB Tables Test...")
    
    results = []
    results.append(test_users_table())
    results.append(test_skills_table())
    results.append(test_exercise_cache_table())
    results.append(test_practice_history_table())
    
    if all(results):
        print("\n" + "="*50)
        print("✓ All DynamoDB tables working correctly!")
        print("="*50)
    else:
        print("\n" + "="*50)
        print("✗ Some tables failed testing")
        print("="*50)
