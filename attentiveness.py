import cv2
import numpy as np
import math
import os

class AttentivenessTracker:
    def __init__(self, ear_threshold=0.20, ear_consec_frames=15, pose_threshold_yaw=20, pose_threshold_pitch=20):
        # Load Haar Cascade
        self.face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
        
        # Load Facemark LBF Model
        self.facemark = cv2.face.createFacemarkLBF()
        if os.path.exists("lbfmodel.yaml"):
            self.facemark.loadModel("lbfmodel.yaml")
        else:
            print("WARNING: lbfmodel.yaml not found! Attentiveness tracking requires it.")
            
        # EAR thresholds and variables
        self.EAR_THRESHOLD = ear_threshold
        self.EAR_CONSEC_FRAMES = ear_consec_frames
        
        # Yaw/Pitch threshold
        self.POSE_THRESHOLD_YAW = 35    # Increased to allow more natural side movement
        self.POSE_THRESHOLD_PITCH = 60  # Euclidean Fallback averages 20-50 for straight-facing depending on angle
        
        # EAR Landmark Indices (OpenCV Facemark LBF 68 points)
        self.LEFT_EYE = [36, 37, 38, 39, 40, 41]
        self.RIGHT_EYE = [42, 43, 44, 45, 46, 47]

    def _euclidean_distance(self, pt1, pt2):
        return math.sqrt((pt1[0] - pt2[0])**2 + (pt1[1] - pt2[1])**2)

    def _calculate_ear(self, eye_pts, landmarks):
        # Extract the (x, y) coordinates for the eye points
        pts = [landmarks[0][idx] for idx in eye_pts]
        
        # vertical eye landmarks
        A = self._euclidean_distance(pts[1], pts[5])
        B = self._euclidean_distance(pts[2], pts[4])
        
        # horizontal eye landmarks
        C = self._euclidean_distance(pts[0], pts[3])
        
        if C == 0:
            return 0
        ear = (A + B) / (2.0 * C)
        return ear

    def _get_head_pose(self, face_landmarks, img_w, img_h):
        # Fallback to 2D Symmetry for extremely robust Yaw calculation
        # instead of volatile 3D projection matrix (solvePnP)
        
        # 30: Nose tip, 36: Left Eye Outer, 45: Right Eye Outer
        nose = face_landmarks[0][30]
        left_eye = face_landmarks[0][36]
        right_eye = face_landmarks[0][45]
        
        # Horizontal distance from nose to eyes
        dist_left = self._euclidean_distance(nose, left_eye)
        dist_right = self._euclidean_distance(nose, right_eye)
        
        # Calculate ratio (ideal forward facing is ~1.0)
        if dist_right == 0:
            return 0, 90, 0
            
        ratio = dist_left / dist_right
        
        # Map ratio to a rough 'Yaw' angle (-90 to 90 degrees)
        # Ratio 1.0 -> 0 yaw. Ratio 0.5 -> ~45 left. Ratio 2.0 -> ~45 right.
        if ratio > 1:
            yaw = (ratio - 1) * 30  # Looking Right
        else:
            yaw = (1 - ratio) * -30 # Looking Left
            
        # Bound yaw to reasonable limits
        yaw = max(-90, min(90, yaw))
        
        # For Pitch, simple heuristic based on Nose to Eye vertical distance vs Nose to Chin
        chin = face_landmarks[0][8]
        eye_y_center = (left_eye[1] + right_eye[1]) / 2
        
        nose_to_eye_y = abs(nose[1] - eye_y_center)
        nose_to_chin_y = abs(nose[1] - chin[1])
        
        if nose_to_chin_y == 0:
            return 0, yaw, 0
            
        pitch_ratio = nose_to_eye_y / nose_to_chin_y
        
        # Ideal pitch ratio looking forward is usually ~0.65 to 0.8
        # Higher means looking down (nose closer to chin). Lower means looking up.
        pitch = (0.75 - pitch_ratio) * 100
        pitch = max(-90, min(90, pitch))

        return pitch, yaw, 0

    def process_frame(self, frame):
        """Processes a frame to calculate EAR and head pose for each detected face."""
        results_list = []
        
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        img_h, img_w = gray.shape
        
        # Stricter detection logic matching attendance pipeline
        faces = self.face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=8, minSize=(60, 60))
        
        if len(faces) > 0:
            ok, landmarks_list = self.facemark.fit(gray, faces)
            if ok:
                for idx, face_landmarks in enumerate(landmarks_list):
                    # 1. EAR Calculation
                    left_ear = self._calculate_ear(self.LEFT_EYE, face_landmarks)
                    right_ear = self._calculate_ear(self.RIGHT_EYE, face_landmarks)
                    ear = (left_ear + right_ear) / 2.0
                    
                    is_drowsy = ear < self.EAR_THRESHOLD
                    
                    # 2. Head Pose Calculation
                    pitch, yaw, roll = self._get_head_pose(face_landmarks, img_w, img_h)
                    
                    # Print exact angles for debugging
                    print(f"EAR: {ear:.3f} | Pitch: {pitch:.2f}, Yaw: {yaw:.2f}, Roll: {roll:.2f}")

                    is_distracted = abs(yaw) > self.POSE_THRESHOLD_YAW or abs(pitch) > self.POSE_THRESHOLD_PITCH
                    is_attentive = not (is_drowsy or is_distracted)
                    
                    # Convert bounding box array back to exactly how main.py expects it
                    (x, y, w, h) = faces[idx]
                    bbox = (int(x), int(y), int(x+w), int(y+h))
                    
                    results_list.append({
                        "bbox": bbox,
                        "ear": ear,
                        "pitch": pitch,
                        "yaw": yaw,
                        "roll": roll,
                        "is_drowsy": is_drowsy,
                        "is_distracted": is_distracted,
                        "is_attentive": is_attentive
                    })
                
        return results_list

if __name__ == "__main__":
    tracker = AttentivenessTracker()
    print("Tracker initialized.")
