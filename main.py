import cv2
import time
import pandas as pd
from datetime import datetime
import os
from attendance import FaceTracker
from attentiveness import AttentivenessTracker

# Settings
PROCESS_FACE_REC_EVERY_N_FRAMES = 5
SESSION_LOG_FILE = f"logs/session_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"

def init_logging():
    if not os.path.exists("logs"):
        os.makedirs("logs")
    if not os.path.exists(SESSION_LOG_FILE):
        df = pd.DataFrame(columns=["timestamp", "frame_id", "name", "ear", "head_pitch", "head_yaw", "is_drowsy", "is_distracted", "is_attentive"])
        df.to_csv(SESSION_LOG_FILE, index=False)

def log_data(data_rows):
    if not data_rows:
        return
    df = pd.DataFrame(data_rows)
    df.to_csv(SESSION_LOG_FILE, mode='a', header=False, index=False)

def calculate_iou(box1, box2):
    """Calculates Intersection over Union to match face boxes from two different models."""
    # box format: (top, right, bottom, left) for face_rec 
    # and (xmin, ymin, xmax, ymax) for mediapipe
    y1_1, x2_1, y2_1, x1_1 = box1
    x1_2, y1_2, x2_2, y2_2 = box2
    
    x_left = max(x1_1, x1_2)
    y_top = max(y1_1, y1_2)
    x_right = min(x2_1, x2_2)
    y_bottom = min(y2_1, y2_2)

    if x_right < x_left or y_bottom < y_top:
        return 0.0

    intersection_area = (x_right - x_left) * (y_bottom - y_top)
    box1_area = (x2_1 - x1_1) * (y2_1 - y1_1)
    box2_area = (x2_2 - x1_2) * (y2_2 - y1_2)
    iou = intersection_area / float(box1_area + box2_area - intersection_area)
    return iou

def main():
    init_logging()
    
    print("Initializing Models...")
    face_tracker = FaceTracker()
    attentiveness_tracker = AttentivenessTracker()
    
    cap = cv2.VideoCapture(0)
    frame_count = 0
    
    # Cache face recognition results
    current_face_locations = []
    current_face_names = []
    
    print("Starting Camera...")
    
    while True:
        ret, frame = cap.read()
        if not ret:
            print("Failed to grab frame.")
            break
            
        frame_count += 1
        timestamp = datetime.now().isoformat()
        logs_to_write = []
        
        # 1. Attentiveness Tracking (runs every frame)
        attentiveness_results = attentiveness_tracker.process_frame(frame)
        
        # 2. Face Recognition (runs every N frames)
        if frame_count % PROCESS_FACE_REC_EVERY_N_FRAMES == 0 or frame_count == 1:
            current_face_locations, current_face_names = face_tracker.identify_faces(frame)
            
        # 3. Match and Draw
        for att_res in attentiveness_results:
            bbox_mp = att_res["bbox"] # (xmin, ymin, xmax, ymax)
            
            # Find best matching name by IoU
            best_name = "Unknown"
            best_iou = 0.0
            
            for (top, right, bottom, left), name in zip(current_face_locations, current_face_names):
                iou = calculate_iou((top, right, bottom, left), bbox_mp)
                if iou > best_iou and iou > 0.3: # Threshold
                    best_iou = iou
                    best_name = name
            
            # Decide color based on attentiveness
            color = (0, 255, 0) if att_res["is_attentive"] else (0, 0, 255)
            status_text = "Attentive" if att_res["is_attentive"] else "Distracted"
            if att_res["is_drowsy"]:
                status_text = "Drowsy"
                color = (0, 165, 255) # Orange for drowsy
            
            # Draw bbox
            x_min, y_min, x_max, y_max = bbox_mp
            cv2.rectangle(frame, (x_min, y_min), (x_max, y_max), color, 2)
            
            # Draw Labels
            cv2.putText(frame, f"{best_name}", (x_min, y_min - 30), cv2.FONT_HERSHEY_DUPLEX, 0.6, (255,255,255), 1)
            cv2.putText(frame, f"{status_text}", (x_min, y_min - 10), cv2.FONT_HERSHEY_DUPLEX, 0.6, color, 1)
            
            # Compile log
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
            
        log_data(logs_to_write)
        
        cv2.imshow("Smart Classroom Tracker", frame)
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break
            
    cap.release()
    cv2.destroyAllWindows()
    print("Session Ended.")

if __name__ == "__main__":
    main()
