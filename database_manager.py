import os
from pathlib import Path
from pymongo import MongoClient
from datetime import datetime, timedelta
import base64
import hashlib
from database_schema import DatabaseSchema

try:
    from bson import ObjectId
except ImportError:
    import uuid
    class ObjectId:
        def __init__(self, oid=None):
            self.oid = str(oid) if oid else uuid.uuid4().hex[:24]
        def __str__(self):
            return self.oid
        def __repr__(self):
            return f"ObjectId('{self.oid}')"
        def __eq__(self, other):
            return str(self) == str(other)

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

class MockCursor:
    def __init__(self, items):
        self.items = list(items)

    def sort(self, key, direction=1):
        reverse = (direction == -1)
        self.items.sort(key=lambda x: (x.get(key) is not None, x.get(key)), reverse=reverse)
        return self

    def limit(self, n):
        self.items = self.items[:n]
        return self

    def __iter__(self):
        return iter(self.items)

    def __len__(self):
        return len(self.items)

    def __getitem__(self, index):
        return self.items[index]

class MockCollection:
    def __init__(self, name, initial_data=None):
        self.name = name
        self.docs = list(initial_data) if initial_data else []

    def _matches(self, doc, query):
        if not query:
            return True
        for k, v in query.items():
            if k == "$or":
                if not any(self._matches(doc, q) for q in v):
                    return False
                continue
            doc_val = doc.get(k)
            if isinstance(v, dict):
                for op, target in v.items():
                    if op == "$in":
                        target_strs = [str(t) for t in target]
                        if str(doc_val) not in target_strs and doc_val not in target:
                            return False
                    elif op == "$nin":
                        target_strs = [str(t) for t in target]
                        if str(doc_val) in target_strs or doc_val in target:
                            return False
                    elif op == "$gte":
                        if doc_val is None or doc_val < target:
                            return False
                    elif op == "$lte":
                        if doc_val is None or doc_val > target:
                            return False
                    elif op == "$gt":
                        if doc_val is None or doc_val <= target:
                            return False
                    elif op == "$lt":
                        if doc_val is None or doc_val >= target:
                            return False
            else:
                if str(doc_val) != str(v):
                    return False
        return True

    def find_one(self, query=None, sort=None):
        matches = [d for d in self.docs if self._matches(d, query)]
        if not matches:
            return None
        if sort:
            key, direction = sort[0]
            matches.sort(key=lambda x: (x.get(key) is not None, x.get(key)), reverse=(direction == -1))
        return matches[0]

    def find(self, query=None):
        matches = [d for d in self.docs if self._matches(d, query)]
        return MockCursor(matches)

    def insert_one(self, doc):
        d = dict(doc)
        if "_id" not in d:
            d["_id"] = str(ObjectId())
        self.docs.append(d)
        doc["_id"] = d["_id"]
        class InsertResult:
            def __init__(self, inserted_id):
                self.inserted_id = inserted_id
        return InsertResult(d["_id"])

    def update_one(self, filter_query, update_dict):
        matched = 0
        for d in self.docs:
            if self._matches(d, filter_query):
                matched += 1
                if "$set" in update_dict:
                    d.update(update_dict["$set"])
                break
        class UpdateResult:
            def __init__(self, matched_count):
                self.matched_count = matched_count
        return UpdateResult(matched)

    def delete_one(self, filter_query):
        for i, d in enumerate(self.docs):
            if self._matches(d, filter_query):
                del self.docs[i]
                break

    def create_index(self, *args, **kwargs):
        pass

    def aggregate(self, pipeline):
        return []

class MockDatabase:
    def __init__(self):
        self.users = MockCollection("users")
        self.students = MockCollection("students")
        self.timetables = MockCollection("timetables")
        self.lectures = MockCollection("lectures")
        self.attendance = MockCollection("attendance")
        self.attentiveness = MockCollection("attentiveness")
        self.faces = MockCollection("faces")
        self.sessions = MockCollection("sessions")
        self._seed_default_data()

    def list_collection_names(self):
        return ["users", "students", "timetables", "lectures", "attendance", "attentiveness", "faces", "sessions"]

    def _seed_default_data(self):
        # 1. Admin
        self.users.insert_one({
            "_id": "admin_demo_id",
            "email": "admin@smartclass.com",
            "password_hash": hashlib.sha256("admin123".encode()).hexdigest(),
            "name": "System Administrator",
            "role": "admin",
            "teacher_id": None,
            "created_at": datetime.now(),
            "is_active": True
        })

        # 2. Teacher
        teacher_id = "TCH001"
        self.users.insert_one({
            "_id": "teacher_demo_id",
            "email": "teacher@test.com",
            "password_hash": hashlib.sha256("teacher123".encode()).hexdigest(),
            "name": "Prof. Test Teacher",
            "role": "teacher",
            "teacher_id": teacher_id,
            "created_at": datetime.now(),
            "is_active": True
        })

        # 3. Students

        # Seed all known faces from face_names.json for seamless testing
        initial_students = [
            {"student_id": "STU000", "prn": "2024000", "name": "Shiv Pardeshi", "face_id": 0, "email": "shiv@smartclass.com"},
            {"student_id": "STU001", "prn": "2024001", "name": "Demo Student", "face_id": 10, "email": "student@test.com"},
            {"student_id": "STU002", "prn": "2024002", "name": "AKASH PATIL", "face_id": 1, "email": "akash@smartclass.com"},
            {"student_id": "STU003", "prn": "2024003", "name": "President", "face_id": 2, "email": "president@smartclass.com"},
            {"student_id": "STU004", "prn": "2024004", "name": "Shiv New", "face_id": 3, "email": "shiv.new@smartclass.com"},
            {"student_id": "STU005", "prn": "2024005", "name": "Tanishq Jain", "face_id": 4, "email": "tanishq@smartclass.com"},
        ]
        for s in initial_students:
            self.students.insert_one({
                "_id": f"student_{s['student_id'].lower()}_id",
                "student_id": s["student_id"],
                "prn": s["prn"],
                "password": "password123",
                "name": s["name"],
                "email": s["email"],
                "teacher_id": teacher_id,
                "face_id": s["face_id"],
                "face_encoding": base64.b64encode(b"dummy_demo_face_encoding_data").decode('utf-8'),
                "created_at": datetime.now(),
                "updated_at": datetime.now(),
                "is_active": True
            })


        # 4. Timetable for all days so get_current_lecture works seamlessly
        days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
        for day in days:
            self.timetables.insert_one({
                "_id": f"timetable_{day.lower()}",
                "teacher_id": teacher_id,
                "course_name": "AI & Computer Vision",
                "course_code": "CS401",
                "day_of_week": day,
                "start_time": "00:00",
                "end_time": "23:59",
                "classroom": "Smart Lab 1",
                "is_active": True,
                "created_at": datetime.now()
            })

        # 5. Sample Attendance for STU001
        for i in range(5):
            rec_date = datetime.now() - timedelta(days=i)
            self.attendance.insert_one({
                "_id": f"att_demo_{i}",
                "lecture_id": "demo_lecture_1",
                "student_id": "STU001",
                "prn": "2024001",
                "name": "Demo Student",
                "status": "present",
                "check_in_time": rec_date,
                "confidence_score": round(0.92 + (i * 0.01), 2),
                "lecture_date": rec_date
            })

        # 6. Sample Attentiveness for STU001
        for i in range(12):
            self.attentiveness.insert_one({
                "_id": f"attentive_demo_{i}",
                "lecture_id": "demo_lecture_1",
                "student_id": "STU001",
                "prn": "2024001",
                "timestamp": datetime.now() - timedelta(minutes=i * 5),
                "frame_id": i * 15,
                "ear": 0.31,
                "head_pitch": 4.5,
                "head_yaw": -1.8,
                "is_drowsy": False,
                "is_distracted": (i % 4 == 0),
                "is_attentive": (i % 4 != 0)
            })

# Shared singleton mock database instance
_SHARED_MOCK_DB = MockDatabase()

class SmartClassroomDB:
    def __init__(self):
        self.connection_string = os.getenv(
            "MONGODB_URI",
            "mongodb+srv://<username>:<password>@cluster.mongodb.net/smart_classroom?retryWrites=true&w=majority"
        )
        self.client = None
        self.db = None
        self.schema = DatabaseSchema()
        self.is_mock = False
        
    def connect(self):
        """Connect to MongoDB Atlas, with automatic fallback to Mock DB for testing"""
        # If user explicitly requested mock mode via environment
        force_mock = os.getenv("USE_MOCK_DB", "").lower() in ["true", "1", "yes"]
        if force_mock:
            print("📦 USE_MOCK_DB enabled: Using in-memory mock database.")
            self.db = _SHARED_MOCK_DB
            self.is_mock = True
            return True

        # If already connected to mock
        if self.is_mock and self.db is not None:
            return True

        # If already connected to real mongo
        if self.client is not None and self.db is not None and not self.is_mock:
            try:
                self.client.admin.command('ping')
                return True
            except Exception:
                self.client = None
                self.db = None

        try:
            print("DEBUG: Connecting to MongoDB Atlas...")
            # Set a 3 second timeout so connection failures fall back to mock immediately
            self.client = MongoClient(self.connection_string, serverSelectionTimeoutMS=3000)
            self.db = self.client.smart_classroom
            self.client.admin.command('ping')
            print("✅ Connected to MongoDB Atlas successfully!")
            self.is_mock = False
            return True
        except Exception as e:
            print(f"⚠️ MongoDB connection failed: {e}")
            print("🔄 Falling back to in-memory MOCK DATABASE for testing without MongoDB.")
            self.client = None
            self.db = _SHARED_MOCK_DB
            self.is_mock = True
            return True
    
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
        if self.db is None:
            self.connect()
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
        if self.db is None:
            self.connect()
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
        """Authenticate student using PRN or demo password"""
        if self.db is None:
            self.connect()
        students_collection = self.db.students
        
        student = students_collection.find_one({
            "prn": prn,
            "is_active": True
        })
        
        # Support PRN as password, stored password match, or demo passwords
        valid_passwords = [str(prn), "password123", "student123", "2024001"]
        if student and (student.get("password") == password or str(password) in valid_passwords):
            return {
                "id": str(student["_id"]),
                "student_id": student["student_id"],
                "prn": student["prn"],
                "name": student["name"],
                "email": student.get("email", ""),
                "teacher_id": student["teacher_id"]
            }
        return None
    
    # Student Management
    def create_student(self, student_id, prn, name, email, teacher_id, face_encoding):
        """Create a new student with face data"""
        if self.db is None:
            self.connect()
        students_collection = self.db.students
        
        encoded_face = base64.b64encode(face_encoding).decode('utf-8') if isinstance(face_encoding, (bytes, bytearray)) else str(face_encoding)
        student_doc = {
            "student_id": student_id,
            "prn": prn,
            "name": name,
            "email": email,
            "teacher_id": teacher_id,
            "face_encoding": encoded_face,
            "face_id": self._get_next_face_id(),
            "created_at": datetime.now(),
            "updated_at": datetime.now(),
            "is_active": True
        }
        
        result = students_collection.insert_one(student_doc)
        return str(result.inserted_id)
    
    def get_students_by_teacher(self, teacher_id):
        """Get all students for a specific teacher"""
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
                "email": student.get("email", ""),
                "face_id": student.get("face_id", 1)
            })
        
        return students
    
    def get_student_by_prn(self, prn):
        """Get student by PRN"""
        if self.db is None:
            self.connect()
        students_collection = self.db.students
        student = students_collection.find_one({"prn": prn, "is_active": True})
        
        if student:
            face_enc = student.get("face_encoding", "")
            try:
                face_bytes = base64.b64decode(face_enc)
            except Exception:
                face_bytes = face_enc.encode('utf-8')
            return {
                "id": str(student["_id"]),
                "student_id": student["student_id"],
                "prn": student["prn"],
                "name": student["name"],
                "email": student.get("email", ""),
                "teacher_id": student.get("teacher_id"),
                "face_id": student.get("face_id", 1),
                "face_encoding": face_bytes
            }
        return None
    
    def get_all_faces_for_recognition(self):
        """Get all face encodings for recognition"""
        if self.db is None:
            self.connect()
        students_collection = self.db.students
        faces = []
        
        for student in students_collection.find({"is_active": True}):
            face_enc = student.get("face_encoding", "")
            try:
                face_bytes = base64.b64decode(face_enc)
            except Exception:
                face_bytes = face_enc.encode('utf-8') if isinstance(face_enc, str) else face_enc
            faces.append({
                "face_id": student.get("face_id", 1),
                "name": student["name"],
                "student_id": student["student_id"],
                "prn": student["prn"],
                "face_encoding": face_bytes
            })
        
        return faces
    
    # Teacher Management
    def get_all_teachers(self):
        """Get all teachers for admin panel"""
        if self.db is None:
            self.connect()
        users_collection = self.db.users
        teachers = []
        
        for teacher in users_collection.find({"role": "teacher", "is_active": True}):
            teachers.append({
                "id": str(teacher["_id"]),
                "email": teacher["email"],
                "name": teacher["name"],
                "created_at": teacher.get("created_at")
            })
        
        return teachers
    
    # Timetable Management
    def create_timetable(self, teacher_id, course_name, course_code, day_of_week, start_time, end_time, classroom):
        """Create a new timetable entry"""
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
                "classroom": timetable.get("classroom", "Room 101")
            })
        
        return timetables
    
    def get_current_lecture(self, teacher_id):
        """Get current lecture based on timetable and time"""
        try:
            if self.db is None:
                self.connect()
            
            timetables_collection = self.db.timetables
            lectures_collection = self.db.lectures
            
            now = datetime.now()
            current_day = now.strftime("%A")
            current_time = now.strftime("%H:%M")
            
            timetable = timetables_collection.find_one({
                "teacher_id": teacher_id,
                "day_of_week": current_day,
                "start_time": {"$lte": current_time},
                "end_time": {"$gte": current_time},
                "is_active": True
            })
            
            if not timetable:
                current_hour, current_minute = map(int, current_time.split(':'))
                future_time = f"{min(current_hour + 1, 23):02d}:{current_minute:02d}"
                
                timetable = timetables_collection.find_one({
                    "teacher_id": teacher_id,
                    "day_of_week": current_day,
                    "start_time": {"$gte": current_time, "$lte": future_time},
                    "is_active": True
                })

            # If still no lecture scheduled, find any active timetable for this teacher
            if not timetable:
                timetable = timetables_collection.find_one({
                    "teacher_id": teacher_id,
                    "is_active": True
                })
            
            if timetable:
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
                        "course_name": lecture.get("course_name", timetable.get("course_name", "AI & Computer Vision")),
                        "course_code": lecture.get("course_code", timetable.get("course_code", "CS401")),
                        "classroom": lecture.get("classroom", timetable.get("classroom", "Smart Lab 1")),
                        "scheduled_date": lecture["scheduled_date"],
                        "start_time": lecture["start_time"],
                        "end_time": lecture["end_time"],
                        "status": lecture["status"],
                        "camera_started": lecture.get("camera_started", False)
                    }
                else:
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
                        "course_code": timetable.get("course_code", "CS401"),
                        "classroom": timetable.get("classroom", "Smart Lab 1"),
                        "scheduled_date": lecture_doc["scheduled_date"],
                        "start_time": lecture_doc["start_time"],
                        "end_time": lecture_doc["end_time"],
                        "status": lecture_doc["status"],
                        "camera_started": lecture_doc["camera_started"]
                    }
            return None
        except Exception as e:
            print(f"Error in get_current_lecture: {e}")
            return None
    
    # Lecture Monitoring
    def start_lecture_monitoring(self, lecture_id):
        """Start camera monitoring for a lecture"""
        try:
            if self.db is None:
                self.connect()
            lectures_collection = self.db.lectures
        
            result = lectures_collection.update_one(
                {"_id": str(lecture_id)},
                {"$set": {"status": "in_progress", "camera_started": True}}
            )
            return result.matched_count > 0
        except Exception as e:
            print(f"Error in start_lecture_monitoring: {e}")
            return False
    
    def is_attendance_recorded(self, lecture_id, student_id, date=None):
        """Check if student attendance is already recorded for lecture on specified date (or today)"""
        if self.db is None:
            self.connect()
        attendance_collection = self.db.attendance
        check_date = date or datetime.now()
        start_of_day = datetime(check_date.year, check_date.month, check_date.day, 0, 0, 0)
        end_of_day = datetime(check_date.year, check_date.month, check_date.day, 23, 59, 59)
        
        query = {
            "student_id": str(student_id),
            "lecture_id": str(lecture_id),
            "lecture_date": {"": start_of_day, "": end_of_day}
        }
        rec = attendance_collection.find_one(query)
        if rec:
            return rec
        query_prn = {
            "prn": str(student_id),
            "lecture_id": str(lecture_id),
            "lecture_date": {"": start_of_day, "": end_of_day}
        }
        return attendance_collection.find_one(query_prn)

    def get_student_by_face_id(self, face_id):
        """Get student details by face ID"""
        if self.db is None:
            self.connect()
        students_collection = self.db.students
        try:
            f_id = int(face_id)
        except Exception:
            f_id = face_id
        student = students_collection.find_one({"face_id": f_id, "is_active": True})
        if not student and isinstance(f_id, int):
            student = students_collection.find_one({"face_id": str(f_id), "is_active": True})
        return student

    def save_attendance(self, lecture_id, student_id, prn, name, confidence_score):
        """Save attendance record (idempotent for same lecture on same day)"""
        if self.db is None:
            self.connect()
        attendance_collection = self.db.attendance
        
        existing = self.is_attendance_recorded(lecture_id, student_id)
        if existing:
            return str(existing.get("_id", existing.get("id", "")))
            
        now = datetime.now()
        attendance_doc = {
            "lecture_id": str(lecture_id),
            "student_id": str(student_id),
            "prn": str(prn),
            "name": name,
            "status": "present",
            "check_in_time": now,
            "confidence_score": float(confidence_score),
            "lecture_date": now
        }
        
        result = attendance_collection.insert_one(attendance_doc)
        return str(result.inserted_id)

    
    def save_attentiveness_data(self, lecture_id, student_id, prn, ear, head_pitch, head_yaw, is_drowsy, is_distracted, is_attentive):
        """Save attentiveness tracking data"""
        if self.db is None:
            self.connect()
        attentiveness_collection = self.db.attentiveness
        
        attentiveness_doc = {
            "lecture_id": lecture_id,
            "student_id": student_id,
            "prn": prn,
            "timestamp": datetime.now(),
            "frame_id": 0,
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
        if self.db is None:
            self.connect()
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
        # If no records for student_id, check by prn
        if not attendance_records:
            attendance_records = list(attendance_collection.find({"prn": student_id}).sort("lecture_date", -1))
        
        return attendance_records
    
    def get_student_attentiveness_report(self, student_id, start_date=None, end_date=None):
        """Get attentiveness report for a student"""
        if self.db is None:
            self.connect()
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
        if not attentiveness_records:
            attentiveness_records = list(attentiveness_collection.find({"prn": student_id}).sort("timestamp", -1))
        
        return attentiveness_records
    
    def _get_next_face_id(self):
        """Get next available face ID"""
        if self.db is None:
            self.connect()
        students_collection = self.db.students
        latest_student = students_collection.find_one({}, sort=[("face_id", -1)])
        
        if latest_student and "face_id" in latest_student:
            return latest_student["face_id"] + 1
        return 1

# Global database instance
db_manager = SmartClassroomDB()
