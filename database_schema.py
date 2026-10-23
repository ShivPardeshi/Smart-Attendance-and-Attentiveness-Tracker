"""
MongoDB Schema for Smart Classroom Tracker - Multi-Role System
Collections: users, students, timetables, lectures, attendance, attentiveness
"""

class DatabaseSchema:
    def __init__(self):
        self.collections = {
            "users": {
                "description": "Authentication and user management",
                "schema": {
                    "_id": "ObjectId",
                    "email": "string (unique)",
                    "password_hash": "string",
                    "name": "string",
                    "role": "enum(admin|teacher|student)",
                    "teacher_id": "ObjectId (for students)",
                    "created_at": "Date",
                    "is_active": "boolean"
                }
            },
            
            "students": {
                "description": "Student profile and face data",
                "schema": {
                    "_id": "ObjectId",
                    "student_id": "string (unique)",
                    "prn": "string (unique)",
                    "name": "string",
                    "email": "string",
                    "teacher_id": "ObjectId",
                    "face_encoding": "binary",
                    "face_id": "integer",
                    "created_at": "Date",
                    "updated_at": "Date"
                }
            },
            
            "timetables": {
                "description": "Teacher timetables",
                "schema": {
                    "_id": "ObjectId",
                    "teacher_id": "ObjectId",
                    "course_name": "string",
                    "course_code": "string",
                    "day_of_week": "string (Monday-Sunday)",
                    "start_time": "string (HH:MM)",
                    "end_time": "string (HH:MM)",
                    "classroom": "string",
                    "is_active": "boolean",
                    "created_at": "Date"
                }
            },
            
            "lectures": {
                "description": "Individual lecture sessions",
                "schema": {
                    "_id": "ObjectId",
                    "timetable_id": "ObjectId",
                    "teacher_id": "ObjectId",
                    "course_name": "string",
                    "scheduled_date": "Date",
                    "start_time": "string",
                    "end_time": "string",
                    "status": "enum(scheduled|in_progress|completed|cancelled)",
                    "camera_started": "boolean",
                    "monitoring_duration": "integer (minutes)",
                    "created_at": "Date"
                }
            },
            
            "attendance": {
                "description": "Attendance records per lecture",
                "schema": {
                    "_id": "ObjectId",
                    "lecture_id": "ObjectId",
                    "student_id": "string",
                    "prn": "string",
                    "name": "string",
                    "status": "enum(present|absent|late)",
                    "check_in_time": "Date",
                    "confidence_score": "float",
                    "lecture_date": "Date"
                }
            },
            
            "attentiveness": {
                "description": "Attentiveness tracking data",
                "schema": {
                    "_id": "ObjectId",
                    "lecture_id": "ObjectId",
                    "student_id": "string",
                    "prn": "string",
                    "timestamp": "Date",
                    "frame_id": "integer",
                    "ear": "float",
                    "head_pitch": "float",
                    "head_yaw": "float",
                    "is_drowsy": "boolean",
                    "is_distracted": "boolean",
                    "is_attentive": "boolean"
                }
            }
        }
        
        self.indexes = {
            "users": [
                {"email": 1},  # Unique index for login
                {"role": 1}
            ],
            "students": [
                {"student_id": 1},  # Unique
                {"prn": 1},  # Unique for PRN login
                {"teacher_id": 1}
            ],
            "timetables": [
                {"teacher_id": 1},
                {"day_of_week": 1, "start_time": 1}
            ],
            "lectures": [
                {"teacher_id": 1},
                {"scheduled_date": 1},
                {"status": 1}
            ],
            "attendance": [
                {"lecture_id": 1},
                {"student_id": 1},
                {"lecture_date": 1}
            ],
            "attentiveness": [
                {"lecture_id": 1},
                {"student_id": 1},
                {"timestamp": 1}
            ]
        }
