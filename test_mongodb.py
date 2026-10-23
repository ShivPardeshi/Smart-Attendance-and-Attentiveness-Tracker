#!/usr/bin/env python3
"""
Test script for MongoDB Atlas connection and basic operations
"""

from database import db_manager
import hashlib

def test_connection():
    """Test MongoDB connection"""
    print("🔍 Testing MongoDB Atlas connection...")
    
    if db_manager.connect():
        print("✅ Connection successful!")
        return True
    else:
        print("❌ Connection failed!")
        return False

def test_user_operations():
    """Test user creation and retrieval"""
    print("\n👤 Testing user operations...")
    
    # Create a test user
    email = "test@example.com"
    password_hash = hashlib.sha256("test123".encode()).hexdigest()
    
    try:
        user_id = db_manager.create_user(email, password_hash, "Test User", "teacher")
        print(f"✅ Created user with ID: {user_id}")
        
        # Retrieve user
        user = db_manager.get_user_by_email(email)
        if user:
            print(f"✅ Retrieved user: {user['name']} ({user['email']})")
            return True
        else:
            print("❌ Failed to retrieve user")
            return False
            
    except Exception as e:
        print(f"❌ User operation failed: {e}")
        return False

def test_face_operations():
    """Test face data operations"""
    print("\n👥 Testing face operations...")
    
    try:
        # Save a test face
        face_id = 999
        name = "Test Student"
        face_encoding = b"test_face_data_12345"
        
        face_id_result = db_manager.save_face(face_id, name, face_encoding)
        print(f"✅ Saved face with ID: {face_id_result}")
        
        # Retrieve all faces
        faces = db_manager.get_all_faces()
        print(f"✅ Retrieved {len(faces)} faces from database")
        
        # Retrieve specific face
        test_face = db_manager.get_face_by_id(face_id)
        if test_face:
            print(f"✅ Retrieved test face: {test_face['name']}")
            return True
        else:
            print("❌ Failed to retrieve test face")
            return False
            
    except Exception as e:
        print(f"❌ Face operation failed: {e}")
        return False

def test_session_operations():
    """Test session data operations"""
    print("\n📊 Testing session operations...")
    
    try:
        # Save test session data
        session_data = {
            "session_id": "test_session_001",
            "frame_id": 123,
            "name": "Test Student",
            "ear": 0.25,
            "head_pitch": 0.1,
            "head_yaw": 0.2,
            "is_drowsy": False,
            "is_distracted": False,
            "is_attentive": True
        }
        
        session_id = db_manager.save_session_data(session_data)
        print(f"✅ Saved session data with ID: {session_id}")
        
        # Retrieve session data
        sessions = db_manager.get_session_data(limit=10)
        print(f"✅ Retrieved {len(sessions)} session records")
        
        # Get sessions list
        sessions_list = db_manager.get_sessions_list()
        print(f"✅ Retrieved {len(sessions_list)} unique sessions")
        
        return True
        
    except Exception as e:
        print(f"❌ Session operation failed: {e}")
        return False

def main():
    """Run all tests"""
    print("🚀 Starting MongoDB Atlas Tests")
    print("=" * 50)
    
    tests = [
        ("Connection Test", test_connection),
        ("User Operations", test_user_operations),
        ("Face Operations", test_face_operations),
        ("Session Operations", test_session_operations)
    ]
    
    results = []
    
    for test_name, test_func in tests:
        try:
            result = test_func()
            results.append((test_name, result))
        except Exception as e:
            print(f"❌ {test_name} crashed: {e}")
            results.append((test_name, False))
    
    # Summary
    print("\n" + "=" * 50)
    print("📋 TEST SUMMARY")
    print("=" * 50)
    
    passed = 0
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{test_name}: {status}")
        if result:
            passed += 1
    
    print(f"\n🎯 Results: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All tests passed! MongoDB Atlas is ready for use!")
    else:
        print("⚠️  Some tests failed. Check your configuration.")
    
    # Cleanup
    db_manager.disconnect()

if __name__ == "__main__":
    main()
