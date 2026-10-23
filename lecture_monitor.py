#!/usr/bin/env python3
"""
Automated Lecture Monitoring System
Monitors attendance and attentiveness based on teacher timetables
"""

import cv2
import time
import threading
from datetime import datetime, timedelta
import schedule
from database_manager import db_manager
from attendance import FaceTracker
from attentiveness import AttentivenessTracker

class LectureMonitor:
    def __init__(self):
        self.face_tracker = FaceTracker()
        self.attentiveness_tracker = AttentivenessTracker()
        self.current_lecture = None
        self.monitoring_active = False
        self.camera = None
        self.frame_count = 0
        self.attendance_recorded = set()  # Track students already marked present
        
    def check_and_start_lectures(self):
        """Check if any lecture should start based on current time and timetables"""
        try:
            if not db_manager.connect():
                return False
                
            # Get all teachers and their current lectures
            # This would be enhanced to check all teachers, but for now we'll check one
            print("Checking for scheduled lectures...")
            
            # For demo, we'll check a specific teacher (in production, this would check all)
            teachers = db_manager.get_all_teachers()
            
            for teacher in teachers:
                current_lecture = db_manager.get_current_lecture(teacher['id'])
                
                if current_lecture and current_lecture['status'] == 'scheduled':
                    # Check if we're within the first 5 minutes of lecture
                    now = datetime.now()
                    lecture_start = datetime.strptime(
                        f"{now.date()} {current_lecture['start_time']}", 
                        "%Y-%m-%d %H:%M"
                    )
                    
                    # Start monitoring if within 5 minutes of start time
                    if lecture_start <= now <= lecture_start + timedelta(minutes=5):
                        if not self.monitoring_active:
                            print(f"Starting lecture monitoring for {current_lecture['course_name']}")
                            self.start_lecture_monitoring(current_lecture)
                    
                elif current_lecture and current_lecture['status'] == 'in_progress':
                    # Check if lecture should end
                    now = datetime.now()
                    lecture_end = datetime.strptime(
                        f"{now.date()} {current_lecture['end_time']}", 
                        "%Y-%m-%d %H:%M"
                    )
                    
                    if now >= lecture_end:
                        print(f"Ending lecture monitoring for {current_lecture['course_name']}")
                        self.stop_lecture_monitoring()
                        
        except Exception as e:
            print(f"Error checking lectures: {e}")
        finally:
            db_manager.disconnect()
    
    def start_lecture_monitoring(self, lecture):
        """Start monitoring a specific lecture"""
        try:
            if not db_manager.connect():
                return False
                
            # Update lecture status
            db_manager.start_lecture_monitoring(lecture['id'])
            
            self.current_lecture = lecture
            self.monitoring_active = True
            self.attendance_recorded.clear()
            
            # Start camera monitoring in a separate thread
            monitoring_thread = threading.Thread(target=self.monitor_lecture)
            monitoring_thread.daemon = True
            monitoring_thread.start()
            
            return True
            
        except Exception as e:
            print(f"Error starting lecture monitoring: {e}")
            return False
        finally:
            db_manager.disconnect()
    
    def stop_lecture_monitoring(self):
        """Stop the current lecture monitoring"""
        self.monitoring_active = False
        self.current_lecture = None
        
        if self.camera:
            self.camera.release()
            self.camera = None
            
        print("Lecture monitoring stopped")
    
    def monitor_lecture(self):
        """Main monitoring loop for a lecture"""
        print("Initializing camera for lecture monitoring...")
        
        # Initialize camera
        self.camera = cv2.VideoCapture(0)
        if not self.camera.isOpened():
            print("Failed to open camera")
            return
            
        print("Camera initialized successfully")
        
        # Get all student faces for recognition
        if not db_manager.connect():
            return
            
        try:
            all_faces = db_manager.get_all_faces_for_recognition()
            if not all_faces:
                print("No student faces found in database")
                return
                
            print(f"Loaded {len(all_faces)} student faces for recognition")
            
            # Main monitoring loop
            while self.monitoring_active and self.current_lecture:
                ret, frame = self.camera.read()
                if not ret:
                    print("Failed to grab frame")
                    break
                    
                self.frame_count += 1
                timestamp = datetime.now()
                
                # Process attentiveness tracking
                attentiveness_results = self.attentiveness_tracker.process_frame(frame)
                
                # Face recognition (run every 5 frames to reduce processing)
                current_face_locations = []
                current_face_names = []
                
                if self.frame_count % 5 == 0:
                    # Use our face tracker to identify faces
                    for face_data in all_faces:
                        # This would need to be integrated with the actual face recognition
                        # For now, we'll simulate face detection
                        pass
                
                # Match attentiveness results with recognized faces
                for att_res in attentiveness_results:
                    bbox_mp = att_res["bbox"]
                    
                    # Find matching student (simplified for demo)
                    best_student = self.find_matching_student(att_res, all_faces)
                    
                    if best_student:
                        # Record attendance (only once per student per lecture)
                        if best_student['student_id'] not in self.attendance_recorded:
                            self.record_attendance(best_student)
                            self.attendance_recorded.add(best_student['student_id'])
                        
                        # Record attentiveness data
                        self.record_attentiveness(best_student, att_res, timestamp)
                        
                        # Draw bounding box and info on frame
                        self.draw_student_info(frame, bbox_mp, best_student, att_res)
                
                # Display the monitoring feed
                cv2.imshow(f"Lecture Monitoring - {self.current_lecture['course_name']}", frame)
                
                # Check for quit key
                if cv2.waitKey(1) & 0xFF == ord('q'):
                    break
                    
                # Check if lecture time has ended
                if self.should_end_lecture():
                    break
                    
        except Exception as e:
            print(f"Error during lecture monitoring: {e}")
        finally:
            db_manager.disconnect()
            if self.camera:
                self.camera.release()
            cv2.destroyAllWindows()
    
    def find_matching_student(self, att_res, all_faces):
        """Find the matching student for an attentiveness result"""
        # This is a simplified version - in production, this would use proper face recognition
        # For now, we'll return a dummy student
        if all_faces:
            return all_faces[0]  # Return first student as placeholder
        return None
    
    def record_attendance(self, student):
        """Record student attendance"""
        try:
            db_manager.save_attendance(
                lecture_id=self.current_lecture['id'],
                student_id=student['student_id'],
                prn=student['prn'],
                name=student['name'],
                confidence_score=0.95  # Placeholder confidence
            )
            print(f"Recorded attendance for {student['name']} ({student['prn']})")
        except Exception as e:
            print(f"Error recording attendance: {e}")
    
    def record_attentiveness(self, student, att_res, timestamp):
        """Record student attentiveness data"""
        try:
            db_manager.save_attentiveness_data(
                lecture_id=self.current_lecture['id'],
                student_id=student['student_id'],
                prn=student['prn'],
                ear=att_res.get('ear', 0.0),
                head_pitch=att_res.get('pitch', 0.0),
                head_yaw=att_res.get('yaw', 0.0),
                is_drowsy=att_res.get('is_drowsy', False),
                is_distracted=att_res.get('is_distracted', False),
                is_attentive=att_res.get('is_attentive', True)
            )
        except Exception as e:
            print(f"Error recording attentiveness: {e}")
    
    def draw_student_info(self, frame, bbox, student, att_res):
        """Draw student information on the frame"""
        x_min, y_min, x_max, y_max = bbox
        
        # Determine color based on attentiveness
        if att_res.get('is_attentive', True):
            color = (0, 255, 0)  # Green
            status = "Attentive"
        elif att_res.get('is_drowsy', False):
            color = (0, 165, 255)  # Orange
            status = "Drowsy"
        else:
            color = (0, 0, 255)  # Red
            status = "Distracted"
        
        # Draw bounding box
        cv2.rectangle(frame, (x_min, y_min), (x_max, y_max), color, 2)
        
        # Draw student info
        cv2.putText(frame, f"{student['name']}", (x_min, y_min - 30), 
                   cv2.FONT_HERSHEY_DUPLEX, 0.6, (255,255,255), 1)
        cv2.putText(frame, f"{student['prn']}", (x_min, y_min - 15), 
                   cv2.FONT_HERSHEY_DUPLEX, 0.5, (255,255,255), 1)
        cv2.putText(frame, f"{status}", (x_min, y_min - 0), 
                   cv2.FONT_HERSHEY_DUPLEX, 0.6, color, 1)
    
    def should_end_lecture(self):
        """Check if the current lecture should end"""
        if not self.current_lecture:
            return True
            
        now = datetime.now()
        lecture_end = datetime.strptime(
            f"{now.date()} {self.current_lecture['end_time']}", 
            "%Y-%m-%d %H:%M"
        )
        
        return now >= lecture_end
    
    def run_scheduler(self):
        """Run the main scheduler that checks for lectures"""
        print("Starting Lecture Monitor Scheduler...")
        
        # Check for lectures every minute
        schedule.every(1).minutes.do(self.check_and_start_lectures)
        
        while True:
            schedule.run_pending()
            time.sleep(10)  # Check every 10 seconds

def main():
    """Main entry point for the lecture monitoring system"""
    monitor = LectureMonitor()
    
    print("🎓 Smart Classroom Lecture Monitor")
    print("=" * 50)
    print("Monitoring system started...")
    print("Press Ctrl+C to stop")
    
    try:
        # Run the scheduler
        monitor.run_scheduler()
    except KeyboardInterrupt:
        print("\nShutting down lecture monitor...")
        monitor.stop_lecture_monitoring()
        print("Lecture monitor stopped")

if __name__ == "__main__":
    main()
