#!/usr/bin/env python3
"""
Setup script for Smart Classroom Tracker
Initialize database with default admin user and collections
"""

from database_manager import db_manager
import hashlib

def create_default_admin():
    """Create default admin user"""
    try:
        admin_email = "admin@smartclass.com"
        admin_password = "admin123"  # Change this in production
        
        # Check if admin already exists
        if db_manager.connect():
            # For now, we'll create the admin directly
            admin_id = db_manager.create_user(
                email=admin_email,
                password=admin_password,
                name="System Administrator",
                role="admin"
            )
            
            print(f"✅ Default admin user created:")
            print(f"   Email: {admin_email}")
            print(f"   Password: {admin_password}")
            print(f"   User ID: {admin_id}")
            print(f"⚠️  Remember to change the default password in production!")
            
            return True
        else:
            print("❌ Failed to connect to database")
            return False
            
    except Exception as e:
        print(f"❌ Error creating admin user: {e}")
        return False
    finally:
        db_manager.disconnect()

def test_database_connection():
    """Test database connection and basic operations"""
    print("🔍 Testing database connection...")
    
    try:
        if db_manager.connect():
            print("✅ Database connection successful!")
            
            # Test basic operations
            print("🧪 Testing basic operations...")
            
            # Create a test teacher
            teacher_id = db_manager.create_user(
                email="teacher@test.com",
                password="teacher123",
                name="Test Teacher",
                role="teacher"
            )
            print(f"✅ Test teacher created: {teacher_id}")
            
            # Create a test student
            student_id = db_manager.create_student(
                student_id="STU001",
                prn="2024001",
                name="Test Student",
                email="student@test.com",
                teacher_id=teacher_id,
                face_encoding=b"test_face_data"
            )
            print(f"✅ Test student created: {student_id}")
            
            # Create a test timetable
            timetable_id = db_manager.create_timetable(
                teacher_id=teacher_id,
                course_name="Test Course",
                course_code="TEST101",
                day_of_week="Monday",
                start_time="09:00",
                end_time="10:00",
                classroom="Room 101"
            )
            print(f"✅ Test timetable created: {timetable_id}")
            
            # Test retrieval
            teachers = db_manager.get_all_teachers()
            print(f"✅ Retrieved {len(teachers)} teachers")
            
            students = db_manager.get_students_by_teacher(teacher_id)
            print(f"✅ Retrieved {len(students)} students for test teacher")
            
            timetables = db_manager.get_teacher_timetables(teacher_id)
            print(f"✅ Retrieved {len(timetables)} timetables for test teacher")
            
            print("🎉 All database tests passed!")
            return True
            
        else:
            print("❌ Database connection failed")
            return False
            
    except Exception as e:
        print(f"❌ Database test failed: {e}")
        return False
    finally:
        db_manager.disconnect()

def main():
    """Main setup function"""
    print("🚀 Smart Classroom Tracker Setup")
    print("=" * 50)
    
    # Test database connection
    if not test_database_connection():
        print("❌ Setup failed: Database connection issues")
        return
    
    # Create default admin
    if not create_default_admin():
        print("❌ Setup failed: Could not create admin user")
        return
    
    print("\n🎯 Setup completed successfully!")
    print("\n📋 Next Steps:")
    print("1. Start the authentication API: python auth_api.py")
    print("2. Start the frontend: cd frontend && npm run dev")
    print("3. Login with admin credentials:")
    print("   - Email: admin@smartclass.com")
    print("   - Password: admin123")
    print("4. Create teachers and students")
    print("5. Set up timetables for automated monitoring")
    print("6. Start the lecture monitor: python lecture_monitor.py")
    
    print("\n🔐 Security Reminder:")
    print("- Change the default admin password in production")
    print("- Use environment variables for sensitive data")
    print("- Enable HTTPS in production")
    print("- Set up proper firewall rules")

if __name__ == "__main__":
    main()
