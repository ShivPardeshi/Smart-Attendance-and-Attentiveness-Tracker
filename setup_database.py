#!/usr/bin/env python3
"""
Setup MongoDB Atlas database and collections
"""

from database import db_manager

def setup_database():
    """Create database and collections"""
    print("🔧 Setting up MongoDB Atlas database...")
    
    # First, let's get the correct connection string from user
    print("Please get your connection string from MongoDB Atlas:")
    print("1. Go to Clusters → Connect → Connect your application")
    print("2. Copy the connection string")
    print("3. Update database.py with the correct string")
    
    # Try to connect
    if not db_manager.connect():
        print("❌ Cannot connect. Please check your connection string.")
        return False
    
    print("✅ Connected to MongoDB Atlas!")
    
    # Create collections by inserting dummy documents (MongoDB creates collections on first write)
    try:
        # Create users collection
        print("📝 Creating users collection...")
        dummy_user = {
            "email": "admin@example.com",
            "password_hash": "dummy_hash",
            "name": "Admin User",
            "role": "admin",
            "created_at": db_manager.db.command("serverStatus")["localTime"]
        }
        result = db_manager.db.users.insert_one(dummy_user)
        print(f"✅ Created users collection (inserted document: {result.inserted_id})")
        
        # Create faces collection
        print("👥 Creating faces collection...")
        dummy_face = {
            "face_id": 0,
            "name": "Test Student",
            "face_encoding": "dummy_encoding",
            "created_at": db_manager.db.command("serverStatus")["localTime"]
        }
        result = db_manager.db.faces.insert_one(dummy_face)
        print(f"✅ Created faces collection (inserted document: {result.inserted_id})")
        
        # Create sessions collection
        print("📊 Creating sessions collection...")
        dummy_session = {
            "session_id": "test_session",
            "timestamp": db_manager.db.command("serverStatus")["localTime"],
            "frame_id": 1,
            "name": "Test Student",
            "ear": 0.25,
            "head_pitch": 0.1,
            "head_yaw": 0.2,
            "is_drowsy": False,
            "is_distracted": False,
            "is_attentive": True
        }
        result = db_manager.db.sessions.insert_one(dummy_session)
        print(f"✅ Created sessions collection (inserted document: {result.inserted_id})")
        
        # Clean up dummy data
        print("🧹 Cleaning up dummy data...")
        db_manager.db.users.delete_one({"email": "admin@example.com"})
        db_manager.db.faces.delete_one({"face_id": 0})
        db_manager.db.sessions.delete_one({"session_id": "test_session"})
        print("✅ Dummy data cleaned up")
        
        print("\n🎉 Database setup complete!")
        print("Collections created: users, faces, sessions")
        
        return True
        
    except Exception as e:
        print(f"❌ Error setting up database: {e}")
        return False
    
    finally:
        db_manager.disconnect()

if __name__ == "__main__":
    setup_database()
