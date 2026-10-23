import os
from pathlib import Path
from pymongo import MongoClient
from datetime import datetime
import base64

# Load environment variables from .env if present
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    env_path = Path(__file__).resolve().parent / ".env"
    if env_path.exists():
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, val = line.split("=", 1)
                    os.environ.setdefault(key.strip(), val.strip())

class MongoDBManager:
    def __init__(self):
        # MongoDB Atlas connection string from environment variable
        self.connection_string = os.getenv(
            "MONGODB_URI",
            "mongodb+srv://<username>:<password>@cluster.mongodb.net/smart_classroom?retryWrites=true&w=majority"
        )
        self.client = None
        self.db = None
        
    def connect(self):
        """Connect to MongoDB Atlas"""
        try:
            self.client = MongoClient(self.connection_string)
            self.db = self.client.smart_classroom
            # Test connection
            self.client.admin.command('ping')
            print("✅ Connected to MongoDB Atlas successfully!")
            return True
        except Exception as e:
            print(f"❌ Failed to connect to MongoDB: {e}")
            return False
    
    def disconnect(self):
        """Close MongoDB connection"""
        if self.client:
            self.client.close()
            print("Disconnected from MongoDB")
    
    # User Management
    def create_user(self, email, password_hash, name, role="teacher"):
        """Create a new user"""
        users_collection = self.db.users
        user_doc = {
            "email": email,
            "password_hash": password_hash,
            "name": name,
            "role": role,
            "created_at": datetime.now()
        }
        result = users_collection.insert_one(user_doc)
        return str(result.inserted_id)
    
    def get_user_by_email(self, email):
        """Get user by email"""
        users_collection = self.db.users
        return users_collection.find_one({"email": email})
    
    # Face Recognition Management
    def save_face(self, face_id, name, face_encoding):
        """Save face data to database"""
        faces_collection = self.db.faces
        face_doc = {
            "face_id": face_id,
            "name": name,
            "face_encoding": base64.b64encode(face_encoding).decode('utf-8'),
            "created_at": datetime.now()
        }
        result = faces_collection.insert_one(face_doc)
        return str(result.inserted_id)
    
    def get_all_faces(self):
        """Get all faces from database"""
        faces_collection = self.db.faces
        faces = []
        for face in faces_collection.find({}):
            faces.append({
                "face_id": face["face_id"],
                "name": face["name"],
                "face_encoding": base64.b64decode(face["face_encoding"])
            })
        return faces
    
    def get_face_by_id(self, face_id):
        """Get specific face by ID"""
        faces_collection = self.db.faces
        face = faces_collection.find_one({"face_id": face_id})
        if face:
            return {
                "face_id": face["face_id"],
                "name": face["name"],
                "face_encoding": base64.b64decode(face["face_encoding"])
            }
        return None
    
    # Session Data Management
    def save_session_data(self, session_data):
        """Save session tracking data"""
        sessions_collection = self.db.sessions
        session_doc = {
            "session_id": session_data["session_id"],
            "timestamp": datetime.now(),
            "frame_id": session_data["frame_id"],
            "name": session_data["name"],
            "ear": session_data["ear"],
            "head_pitch": session_data["head_pitch"],
            "head_yaw": session_data["head_yaw"],
            "is_drowsy": session_data["is_drowsy"],
            "is_distracted": session_data["is_distracted"],
            "is_attentive": session_data["is_attentive"]
        }
        result = sessions_collection.insert_one(session_doc)
        return str(result.inserted_id)
    
    def get_session_data(self, session_id=None, limit=1000):
        """Get session data"""
        sessions_collection = self.db.sessions
        if session_id:
            return list(sessions_collection.find({"session_id": session_id}).limit(limit))
        return list(sessions_collection.find({}).sort("timestamp", -1).limit(limit))
    
    def get_sessions_list(self):
        """Get list of all sessions"""
        sessions_collection = self.db.sessions
        sessions = sessions_collection.aggregate([
            {"$group": {"_id": "$session_id", "count": {"$sum": 1}, "latest": {"$max": "$timestamp"}}},
            {"$sort": {"latest": -1}}
        ])
        return list(sessions)

# Global database instance
db_manager = MongoDBManager()
