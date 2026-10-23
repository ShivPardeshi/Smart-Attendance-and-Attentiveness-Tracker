import os
from pathlib import Path
from pymongo import MongoClient
from datetime import datetime, timedelta
import base64
import hashlib
from database_schema import DatabaseSchema

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

class SmartClassroomDB:
    def __init__(self):
        self.connection_string = os.getenv(
            "MONGODB_URI",
            "mongodb+srv://<username>:<password>@cluster.mongodb.net/smart_classroom?retryWrites=true&w=majority"
        )
        self.client = None
        self.db = None
        self.schema = DatabaseSchema()
        
    def connect(self):
        """Connect to MongoDB Atlas"""
        try:
            print(f"DEBUG: Attempting to connect to MongoDB...")
            print(f"DEBUG: Current state - client: {self.client is not None}, db: {self.db is not None}")
            
            # Only connect if not already connected
            if self.client is not None and self.db is not None:
                print(f"DEBUG: Existing connection found, testing...")
                # Test existing connection
                try:
                    self.client.admin.command('ping')
                    print(f"DEBUG: Existing connection is valid")
                    return True
                except Exception as ping_error:
                    print(f"DEBUG: Existing connection is stale: {ping_error}")
                    # Connection is stale, close it and reconnect
                    self.client.close()
                    self.client = None
                    self.db = None
            
            print(f"DEBUG: Creating new MongoDB connection...")
            self.client = MongoClient(self.connection_string)
            self.db = self.client.smart_classroom
            print(f"DEBUG: Created client and database objects")
            
            # Test connection
            self.client.admin.command('ping')
            print("✅ Connected to MongoDB Atlas successfully!")
            return True
        except Exception as e:
            print(f"❌ Failed to connect to MongoDB: {e}")
            print(f"DEBUG: Connection string: {self.connection_string[:50]}...")
            return False
    
    def disconnect(self):
        """Close MongoDB connection"""
        if self.client is not None:
            try:
                self.client.close()
                print("Disconnected from MongoDB")
            except Exception as e:
                print(f"Error closing MongoDB connection: {e}")
            finally:
                self.client = None
                self.db = None
    
    # Authentication Methods
    def create_user(self, email, password, name, role, teacher_id=None):
        """Create a new user"""
        users_collection = self.db.users
        password_hash = hashlib.sha256(password.encode()).hexdigest()
        
        user_doc = {
            "email": email,
            "password_hash": password_hash,
            "name": name,
            "role": role,
            "teacher_id": teacher_id,
            "created_at": datetime.now(),
            "is_active": True
        }
        result = users_collection.insert_one(user_doc)
        return str(result.inserted_id)
    
    def authenticate_user(self, email, password):
        """Authenticate user login"""
        users_collection = self.db.users
        password_hash = hashlib.sha256(password.encode()).hexdigest()
        
        user = users_collection.find_one({
            "email": email,
            "password_hash": password_hash,
            "is_active": True
        })
        
        if user:
            return {
                "id": str(user["_id"]),
                "email": user["email"],
                "name": user["name"],
                "role": user["role"],
                "teacher_id": user.get("teacher_id")
            }
        return None
    
    def authenticate_student_prn(self, prn, password):
        """Authenticate student using PRN as password"""
        students_collection = self.db.students
        
        student = students_collection.find_one({
            "prn": prn,
            "is_active": True
        })
        
        if student and prn == password:  # PRN serves as password for now
            return {
                "id": str(student["_id"]),
                "student_id": student["student_id"],
                "prn": student["prn"],
                "name": student["name"],
                "email": student["email"],
                "teacher_id": student["teacher_id"]
            }
        return None
    
    # Student Management
    def create_student(self, student_id, prn, name, email, teacher_id, face_encoding):
        """Create a new student with face data"""
        students_collection = self.db.students
        
        student_doc = {
            "student_id": student_id,
            "prn": prn,
            "name": name,
            "email": email,
            "teacher_id": teacher_id,
            "face_encoding": base64.b64encode(face_encoding).decode('utf-8'),
            "face_id": self._get_next_face_id(),
            "created_at": datetime.now(),
            "updated_at": datetime.now(),
            "is_active": True
        }
        
        result = students_collection.insert_one(student_doc)
        return str(result.inserted_id)
    
    def get_students_by_teacher(self, teacher_id):
        """Get all students for a specific teacher"""
        # Ensure database connection
        if self.db is None:
            self.connect()
        
        students_collection = self.db.students
        students = []
        
        for student in students_collection.find({"teacher_id": teacher_id, "is_active": True}):
            students.append({
                "id": str(student["_id"]),
                "student_id": student["student_id"],
                "prn": student["prn"],
                "name": student["name"],
                "email": student["email"],
                "face_id": student["face_id"]
            })
        
        return students
    
    def get_student_by_prn(self, prn):
        """Get student by PRN"""
        students_collection = self.db.students
        student = students_collection.find_one({"prn": prn, "is_active": True})
        
        if student:
            return {
                "id": str(student["_id"]),
                "student_id": student["student_id"],
                "prn": student["prn"],
                "name": student["name"],
                "email": student["email"],
                "teacher_id": student["teacher_id"],
                "face_id": student["face_id"],
                "face_encoding": base64.b64decode(student["face_encoding"])
            }
        return None
    
    def get_all_faces_for_recognition(self):
        """Get all face encodings for recognition"""
        students_collection = self.db.students
        faces = []
        
        for student in students_collection.find({"is_active": True}):
            faces.append({
                "face_id": student["face_id"],
                "name": student["name"],
                "student_id": student["student_id"],
                "prn": student["prn"],
                "face_encoding": base64.b64decode(student["face_encoding"])
            })
        
        return faces
    
    # Teacher Management
    def get_all_teachers(self):
        """Get all teachers for admin panel"""
        users_collection = self.db.users
        teachers = []
        
        for teacher in users_collection.find({"role": "teacher", "is_active": True}):
            teachers.append({
                "id": str(teacher["_id"]),
                "email": teacher["email"],
                "name": teacher["name"],
                "created_at": teacher["created_at"]
            })
        
        return teachers
    
    # Timetable Management
    def create_timetable(self, teacher_id, course_name, course_code, day_of_week, start_time, end_time, classroom):
        """Create a new timetable entry"""
        # Ensure database connection
        if self.db is None:
            self.connect()
        
        timetables_collection = self.db.timetables
        
        timetable_doc = {
            "teacher_id": teacher_id,
            "course_name": course_name,
            "course_code": course_code,
            "day_of_week": day_of_week,
            "start_time": start_time,
            "end_time": end_time,
            "classroom": classroom,
            "is_active": True,
            "created_at": datetime.now()
        }
        
        result = timetables_collection.insert_one(timetable_doc)
        return str(result.inserted_id)
    
    def get_teacher_timetables(self, teacher_id):
        """Get all timetables for a teacher"""
        # Ensure database connection
        if self.db is None:
            self.connect()
        
        timetables_collection = self.db.timetables
        timetables = []
        
        for timetable in timetables_collection.find({"teacher_id": teacher_id, "is_active": True}):
            timetables.append({
                "id": str(timetable["_id"]),
                "course_name": timetable["course_name"],
                "course_code": timetable["course_code"],
                "day_of_week": timetable["day_of_week"],
                "start_time": timetable["start_time"],
                "end_time": timetable["end_time"],
                "classroom": timetable["classroom"]
            })
        
        return timetables
    
    def get_current_lecture(self, teacher_id):
        """Get current lecture based on timetable and time"""
        try:
            print(f"DEBUG: get_current_lecture called for teacher {teacher_id}")
            print(f"DEBUG: Database state before connection - client: {self.client is not None}, db: {self.db is not None}")
            
            # Ensure database connection
            if self.db is None:
                print(f"DEBUG: Database is None, attempting to connect...")
                connection_result = self.connect()
                print(f"DEBUG: Connection result: {connection_result}")
                print(f"DEBUG: Database state after connection - client: {self.client is not None}, db: {self.db is not None}")
            
            if self.db is None:
                print(f"DEBUG: ERROR - Database is still None after connection attempt!")
                return None
            
            timetables_collection = self.db.timetables
            print(f"DEBUG: Successfully got timetables collection")
            lectures_collection = self.db.lectures
            
            now = datetime.now()
            current_day = now.strftime("%A")
            current_time = now.strftime("%H:%M")
            
            # Find timetable entry for current time or upcoming (within 1 hour)
            # First try to find current time
            timetable = timetables_collection.find_one({
                "teacher_id": teacher_id,
                "day_of_week": current_day,
                "start_time": {"$lte": current_time},
                "end_time": {"$gte": current_time},
                "is_active": True
            })
            
            # If no current lecture, find upcoming lecture within 1 hour
            if not timetable:
                current_hour, current_minute = map(int, current_time.split(':'))
                future_time = f"{min(current_hour + 1, 23):02d}:{current_minute:02d}"
                
                timetable = timetables_collection.find_one({
                    "teacher_id": teacher_id,
                    "day_of_week": current_day,
                    "start_time": {"$gte": current_time, "$lte": future_time},
                    "is_active": True
                })
            
            if timetable:
                # Check if lecture already exists for today
                today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
                today_end = today_start + timedelta(days=1)
                
                lecture = lectures_collection.find_one({
                    "timetable_id": timetable["_id"],
                    "scheduled_date": {"$gte": today_start, "$lt": today_end},
                    "status": {"$in": ["scheduled", "in_progress"]}
                })
                
                if lecture:
                    return {
                        "id": str(lecture["_id"]),
                        "course_name": lecture["course_name"],
                        "scheduled_date": lecture["scheduled_date"],
                        "start_time": lecture["start_time"],
                        "end_time": lecture["end_time"],
                        "status": lecture["status"],
                        "camera_started": lecture.get("camera_started", False)
                    }
                else:
                    # Create new lecture
                    lecture_doc = {
                        "timetable_id": timetable["_id"],
                        "teacher_id": teacher_id,
                        "course_name": timetable["course_name"],
                        "scheduled_date": now,
                        "start_time": timetable["start_time"],
                        "end_time": timetable["end_time"],
                        "status": "scheduled",
                        "camera_started": False,
                        "monitoring_duration": 0,
                        "created_at": datetime.now()
                    }
                    
                    result = lectures_collection.insert_one(lecture_doc)
                    lecture_doc["_id"] = result.inserted_id
                    
                    return {
                        "id": str(lecture_doc["_id"]),
                        "course_name": lecture_doc["course_name"],
                        "scheduled_date": lecture_doc["scheduled_date"],
                        "start_time": lecture_doc["start_time"],
                        "end_time": lecture_doc["end_time"],
                        "status": lecture_doc["status"],
                        "camera_started": lecture_doc["camera_started"]
                    }
            else:
                return None
        except Exception as e:
            print(f"Error in get_current_lecture: {e}")
            return None
    
    # Lecture Monitoring
    def start_lecture_monitoring(self, lecture_id):
        """Start camera monitoring for a lecture"""
        try:
            # Ensure database connection
            if self.db is None:
                self.connect()
            
            lectures_collection = self.db.lectures
        
            result = lectures_collection.update_one(
                {"_id": lecture_id},
                {"$set": {"status": "in_progress", "camera_started": True}}
            )
            return result.matched_count > 0
        except Exception as e:
            print(f"Error in start_lecture_monitoring: {e}")
            return False
    
    def save_attendance(self, lecture_id, student_id, prn, name, confidence_score):
        """Save attendance record"""
        attendance_collection = self.db.attendance
        
        attendance_doc = {
            "lecture_id": lecture_id,
            "student_id": student_id,
            "prn": prn,
            "name": name,
            "status": "present",
            "check_in_time": datetime.now(),
            "confidence_score": confidence_score,
            "lecture_date": datetime.now()
        }
        
        result = attendance_collection.insert_one(attendance_doc)
        return str(result.inserted_id)
    
    def save_attentiveness_data(self, lecture_id, student_id, prn, ear, head_pitch, head_yaw, is_drowsy, is_distracted, is_attentive):
        """Save attentiveness tracking data"""
        attentiveness_collection = self.db.attentiveness
        
        attentiveness_doc = {
            "lecture_id": lecture_id,
            "student_id": student_id,
            "prn": prn,
            "timestamp": datetime.now(),
            "frame_id": 0,  # Will be updated in real-time
            "ear": ear,
            "head_pitch": head_pitch,
            "head_yaw": head_yaw,
            "is_drowsy": is_drowsy,
            "is_distracted": is_distracted,
            "is_attentive": is_attentive
        }
        
        result = attentiveness_collection.insert_one(attentiveness_doc)
        return str(result.inserted_id)
    
    # Student Reports
    def get_student_attendance_report(self, student_id, start_date=None, end_date=None):
        """Get attendance report for a student"""
        attendance_collection = self.db.attendance
        
        query = {"student_id": student_id}
        if start_date or end_date:
            date_query = {}
            if start_date:
                date_query["$gte"] = start_date
            if end_date:
                date_query["$lte"] = end_date
            query["lecture_date"] = date_query
        
        attendance_records = list(attendance_collection.find(query).sort("lecture_date", -1))
        
        return attendance_records
    
    def get_student_attentiveness_report(self, student_id, start_date=None, end_date=None):
        """Get attentiveness report for a student"""
        attentiveness_collection = self.db.attentiveness
        
        query = {"student_id": student_id}
        if start_date or end_date:
            date_query = {}
            if start_date:
                date_query["$gte"] = start_date
            if end_date:
                date_query["$lte"] = end_date
            query["timestamp"] = date_query
        
        attentiveness_records = list(attentiveness_collection.find(query).sort("timestamp", -1))
        
        return attentiveness_records
    
    def _get_next_face_id(self):
        """Get next available face ID"""
        students_collection = self.db.students
        latest_student = students_collection.find_one({}, sort=[("face_id", -1)])
        
        if latest_student:
            return latest_student["face_id"] + 1
        return 1

# Global database instance
db_manager = SmartClassroomDB()
