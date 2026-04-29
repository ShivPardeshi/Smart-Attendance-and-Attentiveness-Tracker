import cv2
import pandas as pd
from datetime import datetime
import os
import glob
from fastapi import FastAPI, BackgroundTasks, Response

os.environ["OPENCV_AVFOUNDATION_SKIP_AUTH"] = "1"

# Trigger macOS Camera Permission on Main Thread
print("Ping camera for permissions...")
temp_cap = cv2.VideoCapture(0)
if temp_cap.isOpened():
    temp_cap.read()
    temp_cap.release()
print("Camera ping complete.")

from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from attendance import FaceTracker
from attentiveness import AttentivenessTracker
from main import calculate_iou

app = FastAPI(title="Smart Classroom API")

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global trackers and variables
face_tracker = None
attentiveness_tracker = None
cap = None
is_streaming = False
PROCESS_FACE_REC_EVERY_N_FRAMES = 5
SESSION_LOG_FILE = ""
frame_count = 0
current_face_locations = []
current_face_names = []
latest_stats = {
    "students_present": 0,
    "daily_students": set(),  # Persists total unique faces seen this session
    "total_frames": 0,
    "total_faces": 0,
    "attentive_frames": 0,
    "distractions": 0,
    "drowsy_events": 0,
    "current_status": "Idle"
}

def init_trackers():
    global face_tracker, attentiveness_tracker, SESSION_LOG_FILE, latest_stats, frame_count
    print("Initializing Smart Trackers...")
    face_tracker = FaceTracker()
    attentiveness_tracker = AttentivenessTracker()
    
    if not os.path.exists("logs"):
        os.makedirs("logs")
        
    SESSION_LOG_FILE = f"logs/session_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    if not os.path.exists(SESSION_LOG_FILE):
        df = pd.DataFrame(columns=["timestamp", "frame_id", "name", "ear", "head_pitch", "head_yaw", "is_drowsy", "is_distracted", "is_attentive"])
        df.to_csv(SESSION_LOG_FILE, index=False)
        
    frame_count = 0
    latest_stats = {
        "students_present": 0,
        "daily_students": set(),
        "total_frames": 0,
        "total_faces": 0,
        "attentive_frames": 0,
        "distractions": 0,
        "drowsy_events": 0,
        "current_status": "Running"
    }

def get_video_stream():
    global cap, frame_count, current_face_locations, current_face_names, latest_stats
    
    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        print("Error: Could not open camera.")
        return

    while cap.isOpened() and is_streaming:
        ret, frame = cap.read()
        if not ret:
            break

        frame_count += 1
        timestamp = datetime.now().isoformat()
        logs_to_write = []
        
        # 1. Attentiveness Tracking
        if attentiveness_tracker:
            attentiveness_results = attentiveness_tracker.process_frame(frame)
        else:
            attentiveness_results = []
            
        # 2. Face Recognition
        if face_tracker and (frame_count % PROCESS_FACE_REC_EVERY_N_FRAMES == 0 or frame_count == 1):
            current_face_locations, current_face_names = face_tracker.identify_faces(frame)
            
        latest_stats["total_frames"] += 1
        current_students_in_frame = set()

        # 3. Match and Draw
        latest_stats["total_faces"] += len(attentiveness_results)
        for att_res in attentiveness_results:
            bbox_mp = att_res["bbox"]
            best_name = "Unknown"
            best_iou = 0.0
            
            for (top, right, bottom, left), name in zip(current_face_locations, current_face_names):
                iou = calculate_iou((top, right, bottom, left), bbox_mp)
                if iou > best_iou and iou > 0.3:
                    best_iou = iou
                    best_name = name
                    
            if best_name != "Unknown":
                current_students_in_frame.add(best_name)
                latest_stats["daily_students"].add(best_name)

            color = (0, 255, 0) if att_res["is_attentive"] else (0, 0, 255)
            status_text = "Attentive" if att_res["is_attentive"] else "Distracted"
            if att_res["is_distracted"]:
                latest_stats["distractions"] += 1
            elif att_res["is_drowsy"]:
                status_text = "Drowsy"
                color = (0, 165, 255)
                latest_stats["drowsy_events"] += 1
            else:
                latest_stats["attentive_frames"] += 1
                
            x_min, y_min, x_max, y_max = bbox_mp
            cv2.rectangle(frame, (x_min, y_min), (x_max, y_max), color, 2)
            cv2.putText(frame, f"{best_name}", (x_min, y_min - 30), cv2.FONT_HERSHEY_DUPLEX, 0.6, (255,255,255), 1)
            cv2.putText(frame, f"{status_text}", (x_min, y_min - 10), cv2.FONT_HERSHEY_DUPLEX, 0.6, color, 1)

            logs_to_write.append({
                "timestamp": timestamp,
                "frame_id": frame_count,
                "name": best_name,
                "ear": att_res["ear"],
                "head_pitch": att_res["pitch"],
                "head_yaw": att_res["yaw"],
                "is_drowsy": att_res["is_drowsy"],
                "is_distracted": att_res["is_distracted"],
                "is_attentive": att_res["is_attentive"]
            })
            
        # Update present stats logically
        if current_students_in_frame:
            latest_stats["students_present"] = len(current_students_in_frame)

        if logs_to_write:
            df = pd.DataFrame(logs_to_write)
            df.to_csv(SESSION_LOG_FILE, mode='a', header=False, index=False)

        # Encode frame for streaming
        _, buffer = cv2.imencode('.jpg', frame)
        frame_bytes = buffer.tobytes()

        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')

    if cap:
        cap.release()

@app.on_event("startup")
def startup_event():
    # Will be triggered via API call instead to avoid holding camera early
    pass

@app.get("/api/start_stream")
def start_stream():
    global is_streaming
    if not is_streaming:
        init_trackers()
        is_streaming = True
        return {"status": "started"}
    return {"status": "already running"}

@app.get("/api/stop_stream")
def stop_stream():
    global is_streaming, cap, latest_stats
    is_streaming = False
    if cap:
        cap.release()
    latest_stats["current_status"] = "Stopped"
    return {"status": "stopped"}

@app.get("/api/video_feed")
def video_feed():
    if not is_streaming:
        return Response(status_code=400, content="Stream not started. Call /api/start_stream first.")
    return StreamingResponse(get_video_stream(), media_type="multipart/x-mixed-replace; boundary=frame")

@app.get("/api/live_stats")
def live_stats():
    # Calculate live percentages
    total_faces = latest_stats.get("total_faces", 0)
    att_rate = (latest_stats["attentive_frames"] / total_faces * 100) if total_faces > 0 else 0
    
    return {
        "status": latest_stats["current_status"],
        "students_present": len(latest_stats["daily_students"]),
        "students_list": list(latest_stats["daily_students"]),
        "attentiveness_rate": round(att_rate, 1),
        "total_distractions": latest_stats["distractions"],
        "total_drowsy_events": latest_stats["drowsy_events"],
        "frames_processed": latest_stats["total_frames"]
    }

@app.get("/api/sessions")
def get_sessions():
    log_files = glob.glob("logs/session_*.csv")
    sessions = []
    for f in sorted(log_files, reverse=True):
        basename = os.path.basename(f)
        sessions.append({
            "id": basename,
            "path": f,
            "name": basename.replace("session_", "").replace(".csv", "")
        })
    return sessions

@app.get("/api/session/{session_id}")
def get_session_details(session_id: str):
    file_path = f"logs/{session_id}"
    if not os.path.exists(file_path):
        return Response(status_code=404, content="Session not found")
        
    df = pd.read_csv(file_path)
    if df.empty:
        return {"empty": True}
        
    students = [s for s in df['name'].unique() if str(s) != "nan" and s != "Unknown"]
    
    total = len(df)
    attentive = len(df[df['is_attentive'] == True])
    distracted = len(df[df['is_distracted'] == True])
    drowsy = len(df[df['is_drowsy'] == True])
    
    # Timeline
    timeline_df = df.groupby('frame_id')['is_attentive'].mean().reset_index()
    timeline = [{"frame": row['frame_id'], "attentiveness": float(row['is_attentive']*100)} for _, row in timeline_df.iterrows()]
    
    return {
        "empty": False,
        "students_present": len(students),
        "student_list": students,
        "overall_attentiveness": round((attentive / total * 100) if total > 0 else 0, 1),
        "distractions": distracted,
        "drowsy_events": drowsy,
        "timeline": timeline
    }

from pydantic import BaseModel
import base64
import numpy as np

class RegisterRequest(BaseModel):
    name: str
    image: str

@app.post("/api/register")
def register_student(request: RegisterRequest):
    global face_tracker
    if not face_tracker:
        face_tracker = FaceTracker()
        
    try:
        # Decode base64 image
        header, encoded = request.image.split(",", 1) if "," in request.image else ("", request.image)
        image_bytes = base64.b64decode(encoded)
        image_np = np.frombuffer(image_bytes, dtype=np.uint8)
        img_cv2 = cv2.imdecode(image_np, cv2.IMREAD_COLOR)
        
        success = face_tracker.register_face_from_image(img_cv2, request.name)
        if success:
            return {"status": "success", "message": f"Successfully registered {request.name}"}
        else:
            return Response(status_code=400, content="No face detected in the image.")
            
    except Exception as e:
        print("Registration error:", e)
        return Response(status_code=500, content=f"Internal server error: {str(e)}")

@app.get("/api/students")
def get_students():
    global face_tracker
    if not face_tracker:
        face_tracker = FaceTracker()
    
    # Returns list of unique names registered
    names = list(set(face_tracker.known_face_names.values()))
    return {"students": names}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api:app", host="0.0.0.0", port=8000, reload=True)
