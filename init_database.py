#!/usr/bin/env python3
"""
Initialize database collections and indexes for Smart Classroom Tracker
"""

from database_manager import db_manager

def init_database():
    """Initialize all required collections and indexes"""
    try:
        if not db_manager.connect():
            print("❌ Failed to connect to database")
            return False
        
        print("🔍 Initializing database collections...")
        
        # Get database instance
        db = db_manager.db
        
        # List of collections to create
        collections = [
            'users',
            'students', 
            'timetables',
            'lectures',
            'attendance',
            'attentiveness'
        ]
        
        # Create collections by inserting and deleting dummy documents
        for collection_name in collections:
            collection = db[collection_name]
            
            # Check if collection exists
            if collection_name not in db.list_collection_names():
                print(f"Creating collection: {collection_name}")
                # Insert a dummy document to create the collection
                dummy_doc = {"_init": True}
                result = collection.insert_one(dummy_doc)
                # Delete the dummy document
                collection.delete_one({"_id": result.inserted_id})
                print(f"✅ Collection {collection_name} created")
            else:
                print(f"✅ Collection {collection_name} already exists")
        
        # Create indexes for better performance
        print("\n🔧 Creating indexes...")
        
        # Users collection indexes
        db.users.create_index("email", unique=True)
        db.users.create_index("role")
        print("✅ Users indexes created")
        
        # Students collection indexes  
        db.students.create_index("student_id", unique=True)
        db.students.create_index("prn", unique=True)
        db.students.create_index("teacher_id")
        db.students.create_index("face_id", unique=True)
        print("✅ Students indexes created")
        
        # Timetables collection indexes
        db.timetables.create_index("teacher_id")
        db.timetables.create_index([("day_of_week", 1), ("start_time", 1)])
        print("✅ Timetables indexes created")
        
        # Lectures collection indexes
        db.lectures.create_index("teacher_id")
        db.lectures.create_index("scheduled_date")
        db.lectures.create_index("status")
        print("✅ Lectures indexes created")
        
        # Attendance collection indexes
        db.attendance.create_index("lecture_id")
        db.attendance.create_index("student_id")
        db.attendance.create_index("lecture_date")
        print("✅ Attendance indexes created")
        
        # Attentiveness collection indexes
        db.attentiveness.create_index("lecture_id")
        db.attentiveness.create_index("student_id")
        db.attentiveness.create_index("timestamp")
        print("✅ Attentiveness indexes created")
        
        print("\n🎉 Database initialization completed successfully!")
        return True
        
    except Exception as e:
        print(f"❌ Database initialization failed: {e}")
        return False
    finally:
        db_manager.disconnect()

if __name__ == "__main__":
    print("🚀 Initializing Smart Classroom Tracker Database")
    print("=" * 50)
    
    if init_database():
        print("\n✅ Database is ready for use!")
    else:
        print("\n❌ Database initialization failed!")
