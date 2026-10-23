import os
import base64
import cv2
import numpy as np
from io import BytesIO
from PIL import Image
from flask import Flask, request, jsonify, session
from flask_cors import CORS
from functools import wraps
import jwt
from datetime import datetime, timedelta
from database_manager import db_manager
from attendance import FaceTracker
from attentiveness import AttentivenessTracker

app = Flask(__name__)
app.secret_key = os.getenv('FLASK_SECRET_KEY', 'your-secret-key-change-in-production')
CORS(app, supports_credentials=True)

# Initialize AI / CV Engines
print("🚀 Initializing Face Recognition & Attentiveness Models...")
face_tracker = FaceTracker()
try:
    attentiveness_tracker = AttentivenessTracker()
    print("✅ Attentiveness Tracker ready.")
except Exception as e:
    print(f"⚠️ Attentiveness tracker warning: {e}")
    attentiveness_tracker = None

# JWT Configuration
JWT_SECRET = os.getenv('JWT_SECRET', 'your-jwt-secret-change-in-production')
JWT_ALGORITHM = 'HS256'
JWT_EXPIRATION_HOURS = 24

def generate_token(user_data):
    """Generate JWT token for authenticated user"""
    payload = {
        'user_id': user_data['id'],
        'email': user_data['email'],
        'name': user_data['name'],
        'role': user_data['role'],
        'teacher_id': user_data.get('teacher_id'),
        'exp': datetime.utcnow() + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def generate_student_token(student_data):
    """Generate JWT token for authenticated student"""
    payload = {
        'student_id': student_data['id'],
        'student_number': student_data['student_id'],
        'prn': student_data['prn'],
        'name': student_data['name'],
        'role': 'student',
        'teacher_id': student_data['teacher_id'],
        'exp': datetime.utcnow() + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def token_required(f):
    """Decorator to require JWT token"""
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            try:
                token = auth_header.split(" ")[1]
            except IndexError:
                return jsonify({'message': 'Token format is invalid'}), 401
        
        if not token:
            return jsonify({'message': 'Token is missing'}), 401
        
        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
            current_user = payload
        except jwt.ExpiredSignatureError:
            return jsonify({'message': 'Token has expired'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'message': 'Token is invalid'}), 401
        
        return f(current_user, *args, **kwargs)
    return decorated

def role_required(*allowed_roles):
    """Decorator to require specific role(s)"""
    def decorator(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            token = None
            if 'Authorization' in request.headers:
                auth_header = request.headers['Authorization']
                try:
                    token = auth_header.split(" ")[1]
                except IndexError:
                    return jsonify({'message': 'Token format is invalid'}), 401
            
            if not token:
                return jsonify({'message': 'Token is missing'}), 401
            
            try:
                payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
                current_user = payload
                
                if current_user.get('role') not in allowed_roles:
                    return jsonify({'message': f'Access forbidden: requires one of {allowed_roles}'}), 403
            except jwt.ExpiredSignatureError:
                return jsonify({'message': 'Token has expired'}), 401
            except jwt.InvalidTokenError:
                return jsonify({'message': 'Token is invalid'}), 401
            
            return f(current_user, *args, **kwargs)
        return decorated
    return decorator

# System & Health Routes
@app.route('/api/health', methods=['GET'])
def health_check():
    """System health check endpoint for production monitoring"""
    return jsonify({
        'status': 'healthy',
        'service': 'smart-classroom-tracker-api',
        'timestamp': datetime.utcnow().isoformat(),
        'database_mode': 'mock' if os.getenv('USE_MOCK_DB', 'false').lower() == 'true' else 'mongodb',
        'registered_faces': len(face_tracker.known_students),
        'attentiveness_model_loaded': attentiveness_tracker is not None
    }), 200

# Authentication Routes
@app.route('/api/auth/login', methods=['POST'])
def login():
    """Universal login endpoint"""
    data = request.get_json()
    if not data or not data.get('email') or not data.get('password'):
        return jsonify({'message': 'Email and password are required'}), 400
    
    try:
        db_manager.connect()
        user = db_manager.authenticate_user(data['email'], data['password'])
        if user:
            token = generate_token(user)
            return jsonify({
                'token': token,
                'user': user
            }), 200
        else:
            return jsonify({'message': 'Invalid email or password'}), 401
    except Exception as e:
        return jsonify({'message': f'Login failed: {str(e)}'}), 500

@app.route('/api/auth/student-login', methods=['POST'])
def student_login():
    """Login for Students using PRN"""
    data = request.get_json()
    if not data or not data.get('prn') or not data.get('password'):
        return jsonify({'message': 'PRN and password are required'}), 400
    
    try:
        db_manager.connect()
        student = db_manager.authenticate_student_prn(data['prn'], data['password'])
        if student:
            token = generate_student_token(student)
            return jsonify({
                'token': token,
                'student': student
            }), 200
        else:
            return jsonify({'message': 'Invalid PRN or password'}), 401
    except Exception as e:
        return jsonify({'message': f'Login failed: {str(e)}'}), 500

@app.route('/api/auth/verify', methods=['POST'])
@token_required
def verify_token(current_user):
    return jsonify({'valid': True, 'user': current_user}), 200

@app.route('/api/auth/logout', methods=['POST'])
@token_required
def logout(current_user):
    return jsonify({'message': 'Logged out successfully'}), 200

# Admin Routes
@app.route('/api/admin/teachers', methods=['GET'])
@role_required('admin')
def get_teachers(current_user):
    try:
        db_manager.connect()
        teachers = db_manager.get_all_teachers()
        return jsonify({'teachers': teachers}), 200
    except Exception as e:
        return jsonify({'message': f'Failed to fetch teachers: {str(e)}'}), 500

@app.route('/api/admin/create-teacher', methods=['POST'])
@role_required('admin')
def create_teacher(current_user):
    data = request.get_json()
    required_fields = ['name', 'email', 'password', 'teacher_id']
    if not all(field in data for field in required_fields):
        return jsonify({'message': 'All teacher fields are required'}), 400
    try:
        db_manager.connect()
        user_id = db_manager.create_user(
            email=data['email'],
            password=data['password'],
            name=data['name'],
            role='teacher',
            teacher_id=data['teacher_id']
        )
        return jsonify({'message': 'Teacher created successfully', 'user_id': user_id}), 201
    except Exception as e:
        return jsonify({'message': f'Failed to create teacher: {str(e)}'}), 500

# Teacher Routes
@app.route('/api/teacher/students', methods=['GET'])
@role_required('teacher')
def get_teacher_students(current_user):
    try:
        db_manager.connect()
        teacher_id = current_user.get('teacher_id') or current_user.get('user_id') or 'TCH001'
        students = db_manager.get_students_by_teacher(teacher_id)
        return jsonify({'students': students}), 200
    except Exception as e:
        return jsonify({'message': f'Failed to fetch students: {str(e)}'}), 500

@app.route('/api/teacher/timetables', methods=['GET'])
@role_required('teacher')
def get_teacher_timetables(current_user):
    try:
        db_manager.connect()
        teacher_id = current_user.get('teacher_id') or current_user.get('user_id') or 'TCH001'
        timetables = db_manager.get_teacher_timetables(teacher_id)
        return jsonify({'timetables': timetables}), 200
    except Exception as e:
        return jsonify({'message': f'Failed to fetch timetables: {str(e)}'}), 500

@app.route('/api/teacher/timetable', methods=['POST'])
@role_required('teacher')
def create_timetable(current_user):
    data = request.get_json()
    required_fields = ['course_name', 'course_code', 'day_of_week', 'start_time', 'end_time', 'classroom']
    if not all(field in data for field in required_fields):
        return jsonify({'message': 'All timetable fields are required'}), 400
    try:
        db_manager.connect()
        teacher_id = current_user.get('teacher_id') or current_user.get('user_id') or 'TCH001'
        timetable_id = db_manager.create_timetable(
            teacher_id=teacher_id,
            course_name=data['course_name'],
            course_code=data['course_code'],
            day_of_week=data['day_of_week'],
            start_time=data['start_time'],
            end_time=data['end_time'],
            classroom=data['classroom']
        )
        return jsonify({'message': 'Timetable created successfully', 'timetable_id': timetable_id}), 201
    except Exception as e:
        return jsonify({'message': f'Failed to create timetable: {str(e)}'}), 500

@app.route('/api/teacher/current-lecture', methods=['GET'])
@role_required('teacher')
def get_current_lecture(current_user):
    try:
        db_manager.connect()
        teacher_id = current_user.get('teacher_id') or current_user.get('user_id') or 'TCH001'
        lecture = db_manager.get_current_lecture(teacher_id)
        return jsonify({'lecture': lecture}), 200
    except Exception as e:
        return jsonify({'message': f'Failed to fetch current lecture: {str(e)}'}), 500

@app.route('/api/teacher/start-lecture/<lecture_id>', methods=['POST'])
@role_required('teacher')
def start_lecture(current_user, lecture_id):
    try:
        db_manager.connect()
        success = db_manager.start_lecture_monitoring(lecture_id)
        if success:
            return jsonify({'message': 'Lecture monitoring started successfully'}), 200
        else:
            return jsonify({'message': 'Failed to start lecture monitoring'}), 400
    except Exception as e:
        return jsonify({'message': f'Error starting lecture: {str(e)}'}), 500

# High-Precision Student Face Registration
@app.route('/api/teacher/add-student', methods=['POST'])
@role_required('teacher')
def add_student(current_user):
    """Add a new student with face registration and LBPH model update"""
    data = request.get_json()
    required_fields = ['student_id', 'prn', 'name', 'email']
    if not all(field in data for field in required_fields):
        return jsonify({'message': 'All student text fields are required'}), 400
    
    # Check face image or encoding
    face_payload = data.get('face_image') or data.get('face_encoding')
    if not face_payload:
        return jsonify({'message': 'Student face capture is required for registration'}), 400

    try:
        # Decode image to OpenCV BGR
        if isinstance(face_payload, list):
            image_bytes = bytes(face_payload)
        elif isinstance(face_payload, str):
            clean_b64 = face_payload.split('base64,')[1] if 'base64,' in face_payload else face_payload
            image_bytes = base64.b64decode(clean_b64)
        else:
            image_bytes = bytes(face_payload)

        nparr = np.frombuffer(image_bytes, np.uint8)
        bgr_image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if bgr_image is None or bgr_image.size == 0:
            return jsonify({'message': 'Invalid image format received. Please retake photo.'}), 400

        # Register face in FaceTracker (detects face, applies CLAHE, generates 10 augmentations & trains LBPH)
        ok, msg, face_id = face_tracker.register_student_face(
            bgr_image=bgr_image,
            student_id=data['student_id'],
            name=data['name'],
            prn=data['prn'],
            email=data['email']
        )

        if not ok:
            return jsonify({'message': msg}), 400

        # Save student record in database
        db_manager.connect()
        teacher_id = current_user.get('teacher_id') or current_user.get('user_id') or 'TCH001'
        
        student_db_id = db_manager.create_student(
            student_id=data['student_id'],
            prn=data['prn'],
            name=data['name'],
            email=data['email'],
            teacher_id=teacher_id,
            face_encoding=image_bytes
        )

        return jsonify({
            'message': 'Student registered and face model trained successfully!',
            'student_id': data['student_id'],
            'face_id': face_id,
            'db_id': student_db_id
        }), 201

    except Exception as e:
        error_msg = str(e)
        if 'duplicate key' in error_msg and 'student_id' in error_msg:
            return jsonify({'message': 'Student ID already exists. Please use a unique ID.'}), 400
        elif 'duplicate key' in error_msg and 'prn' in error_msg:
            return jsonify({'message': 'PRN already exists. Please use a unique PRN.'}), 400
        else:
            return jsonify({'message': f'Failed to add student: {str(e)}'}), 500

# High-Precision Live Face Detection, Recognition & Attendance Marking
@app.route('/api/detect-faces', methods=['POST'])
@app.route('/detect-faces', methods=['POST'])
def detect_faces():
    """Detect faces, identify registered students, track attentiveness, and record attendance"""
    try:
        data = request.get_json() or {}
        image_data = data.get('image', '')
        lecture_id = data.get('lecture_id')
        teacher_id = data.get('teacher_id', 'TCH001')

        if not image_data:
            return jsonify({'faces': []}), 200

        # Remove data URL prefix if present
        if 'base64,' in image_data:
            image_data = image_data.split('base64,')[1]

        image_bytes = base64.b64decode(image_data)
        nparr = np.frombuffer(image_bytes, np.uint8)
        opencv_image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if opencv_image is None:
            return jsonify({'faces': []}), 200

        # Process frame with face recognition and attentiveness
        detected_faces = face_tracker.process_frame_full(opencv_image, attentiveness_tracker)

        # Connect to DB to check/save attendance for identified students
        db_manager.connect()

        # If lecture_id is not passed, resolve active lecture for teacher
        if not lecture_id:
            try:
                active_lec = db_manager.get_current_lecture(teacher_id)
                if active_lec:
                    lecture_id = active_lec.get('id', 'active_lecture')
            except Exception:
                lecture_id = 'default_lecture'

        for face in detected_faces:
            student_id = face.get('student_id')
            is_matched = face.get('matched', False) or (face.get('confidence', 0) >= 0.50 and student_id != 'Unknown')

            face['attendance_marked'] = False
            face['status'] = 'unverified'

            if is_matched and student_id and student_id != 'Unknown':
                face['status'] = 'present'
                
                # Check if attendance is already recorded today
                if lecture_id:
                    try:
                        already_recorded = db_manager.is_attendance_recorded(lecture_id, student_id)
                        if not already_recorded:
                            db_manager.save_attendance(
                                lecture_id=str(lecture_id),
                                student_id=str(student_id),
                                prn=str(face.get('prn', student_id)),
                                name=face.get('name', 'Student'),
                                confidence_score=face.get('confidence', 0.90)
                            )
                            face['attendance_marked'] = True
                            face['attendance_message'] = 'Attendance marked present'
                        else:
                            face['attendance_marked'] = True
                            face['attendance_message'] = 'Already checked in'

                        # Record attentiveness sample
                        db_manager.save_attentiveness_data(
                            lecture_id=str(lecture_id),
                            student_id=str(student_id),
                            prn=str(face.get('prn', student_id)),
                            ear=face.get('ear', 0.25),
                            head_pitch=face.get('pitch', 0.0),
                            head_yaw=face.get('yaw', 0.0),
                            is_drowsy=face.get('is_drowsy', False),
                            is_distracted=face.get('is_distracted', False),
                            is_attentive=face.get('is_attentive', True)
                        )
                    except Exception as err:
                        print(f"Notice: attendance DB logging: {err}")

        return jsonify({
            'faces': detected_faces,
            'count': len(detected_faces),
            'present_count': sum(1 for f in detected_faces if f.get('status') == 'present'),
            'timestamp': datetime.utcnow().isoformat()
        }), 200

    except Exception as e:
        print(f"Face detection API error: {e}")
        return jsonify({'faces': [], 'error': str(e)}), 200

# Student Routes
@app.route('/api/student/attendance', methods=['GET'])
@role_required('student')
def get_student_attendance(current_user):
    """Get student's attendance report"""
    try:
        db_manager.connect()
        s_id = current_user.get('student_number') or current_user.get('prn')
        attendance_records = db_manager.get_student_attendance_report(s_id)
        return jsonify({'attendance': attendance_records}), 200
    except Exception as e:
        return jsonify({'message': f'Failed to fetch attendance: {str(e)}'}), 500

@app.route('/api/student/attentiveness', methods=['GET'])
@role_required('student')
def get_student_attentiveness(current_user):
    """Get student's attentiveness report"""
    try:
        db_manager.connect()
        s_id = current_user.get('student_number') or current_user.get('prn')
        attentiveness_records = db_manager.get_student_attentiveness_report(s_id)
        return jsonify({'attentiveness': attentiveness_records}), 200
    except Exception as e:
        return jsonify({'message': f'Failed to fetch attentiveness: {str(e)}'}), 500

@app.route('/api/faces/all', methods=['GET'])
@role_required('teacher', 'admin')
def get_all_faces(current_user):
    try:
        db_manager.connect()
        faces = db_manager.get_all_faces_for_recognition()
        return jsonify({'faces': faces}), 200
    except Exception as e:
        return jsonify({'message': f'Failed to fetch faces: {str(e)}'}), 500

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5001))
    debug = os.getenv('FLASK_DEBUG', 'false').lower() == 'true'
    app.run(debug=debug, host='0.0.0.0', port=port)
