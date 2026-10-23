import cv2
import numpy as np
import os
import json
from database import db_manager

class FaceTracker:
    def __init__(self, model_file="face_model.yml", names_file="face_names.json"):
        self.model_file = model_file
        self.names_file = names_file
        
        # Load Haar Cascade for face detection
        self.face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
        
        # Create LBPH Face Recognizer
        self.recognizer = cv2.face.LBPHFaceRecognizer_create()
        
        self.known_face_names = {} # Dict mapping integer ID to Name string
        self.current_id = 0
        
        self.load_model()

    def load_model(self):
        # Try MongoDB first, fallback to files
        try:
            if db_manager.connect():
                faces = db_manager.get_all_faces()
                self.known_face_names = {}
                for face in faces:
                    self.known_face_names[face["face_id"]] = face["name"]
                if self.known_face_names:
                    self.current_id = max(self.known_face_names.keys()) + 1
                    print(f"Loaded {len(self.known_face_names)} faces from MongoDB.")
                else:
                    print("No faces found in MongoDB. Started fresh.")
                db_manager.disconnect()
            else:
                # Fallback to files
                self._load_from_files()
        except Exception as e:
            print(f"Error loading from MongoDB: {e}")
            self._load_from_files()
    
    def _load_from_files(self):
        """Fallback method to load from files"""
        if os.path.exists(self.model_file) and os.path.exists(self.names_file):
            try:
                self.recognizer.read(self.model_file)
                with open(self.names_file, 'r') as f:
                    # JSON keys are strings, convert back to int
                    loaded_names = json.load(f)
                    self.known_face_names = {int(k): v for k, v in loaded_names.items()}
                if self.known_face_names:
                    self.current_id = max(self.known_face_names.keys()) + 1
                print(f"Loaded {len(self.known_face_names)} faces from files.")
            except Exception as e:
                print(f"Error loading model: {e}")
        else:
            print("No existing model found. Started fresh.")

    def save_model(self):
        self.recognizer.write(self.model_file)
        with open(self.names_file, 'w') as f:
            json.dump(self.known_face_names, f)
        print(f"Saved {len(self.known_face_names)} faces to {self.model_file}.")

    def register_face(self, image_path, name):
        """Registers a face from an image file."""
        image = cv2.imread(image_path)
        if image is None:
            print(f"Could not read {image_path}.")
            return False
        return self.register_face_from_image(image, name)

    def register_face_from_image(self, image, name):
        """Registers a face from a decoded OpenCV image array with augmentation."""
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        
        # Stricter detection logic to prevent false positives like watches
        faces = self.face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=8, minSize=(60, 60))
        
        if len(faces) > 0:
            # Take the largest face found (most likely the human)
            faces = sorted(faces, key=lambda x: x[2]*x[3], reverse=True)
            (x, y, w, h) = faces[0]
            face_roi = gray[y:y+h, x:x+w]
            
            # 1. Apply Histogram Equalization to flatten lighting immediately
            face_roi = cv2.equalizeHist(face_roi)
            
            # Check if name already exists
            person_id = -1
            for k, v in self.known_face_names.items():
                if v == name:
                    person_id = k
                    break
                    
            if person_id == -1:
                person_id = self.current_id
                self.known_face_names[person_id] = name
                self.current_id += 1
                
            # Instead of training on 1 frame, build 5 augmented frames to force LBPH robustness
            augmented_samples = [face_roi]
            
            # Aug 1: Brighter
            aug_bright = cv2.convertScaleAbs(face_roi, alpha=1.2, beta=10)
            augmented_samples.append(aug_bright)
            
            # Aug 2: Darker/Higher Contrast
            aug_dark = cv2.convertScaleAbs(face_roi, alpha=1.1, beta=-15)
            augmented_samples.append(aug_dark)
            
            # Aug 3: Slightly smaller (scale down and back up)
            s_w = int(w * 0.9)
            s_h = int(h * 0.9)
            if s_w > 0 and s_h > 0:
                small = cv2.resize(face_roi, (s_w, s_h))
                aug_zoom = cv2.resize(small, (w, h))
                augmented_samples.append(aug_zoom)
                
            # Aug 4: Slight blur
            aug_blur = cv2.GaussianBlur(face_roi, (3, 3), 0)
            augmented_samples.append(aug_blur)
            
            # Prepare arrays for OpenCV LBPH
            ids_array = np.array([person_id] * len(augmented_samples))

            # Train or update
            if os.path.exists(self.model_file):
                self.recognizer.update(augmented_samples, ids_array)
            else:
                self.recognizer.train(augmented_samples, ids_array)
                
            self.save_model()
            print(f"Successfully registered: {name} with {len(augmented_samples)} synthetic views.")
            return True
        else:
            print(f"Could not find any robust faces in the provided frame. Adjust lighting or get closer.")
            return False
            
    def register_from_webcam(self, name):
        """Registers a face directly communicating with the webcam."""
        cap = cv2.VideoCapture(0)
        print(f"Press 's' to capture the face for {name}. Press 'q' to quit without saving.")
        print("For best results, press 's' multiple times to capture different angles.")
        
        face_samples = []
        ids = []
        
        # Determine ID
        person_id = -1
        for k, v in self.known_face_names.items():
            if v == name:
                person_id = k
                break
        if person_id == -1:
            person_id = self.current_id
        
        captures = 0
        
        while True:
            ret, frame = cap.read()
            if not ret:
                break
                
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            # Stricter detection for active webcam feed too
            faces = self.face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=8, minSize=(60, 60))
            
            display_frame = frame.copy()
            for (x, y, w, h) in faces:
                cv2.rectangle(display_frame, (x, y), (x+w, y+h), (255, 0, 0), 2)
                
            cv2.imshow("Register Face", display_frame)
            
            key = cv2.waitKey(1) & 0xFF
            if key == ord('s'):
                if len(faces) > 0:
                    faces = sorted(faces, key=lambda x: x[2]*x[3], reverse=True)
                    (x, y, w, h) = faces[0]
                    face_roi = gray[y:y+h, x:x+w]
                    
                    # Force eq before saving to sample block
                    face_roi = cv2.equalizeHist(face_roi)
                    face_samples.append(face_roi)
                    ids.append(person_id)
                    captures += 1
                    print(f"Captured {captures} samples for {name}")
                else:
                    print("No face detected! Try again.")
            elif key == ord('q') or key == 27:
                break
                
        cap.release()
        cv2.destroyAllWindows()
        
        if len(face_samples) > 0:
            if person_id == self.current_id:
                self.known_face_names[person_id] = name
                self.current_id += 1
                
            if os.path.exists(self.model_file):
                self.recognizer.update(face_samples, np.array(ids))
            else:
                self.recognizer.train(face_samples, np.array(ids))
                
            self.save_model()
            print(f"Successfully registered {name} with {captures} samples.")
        else:
            print("Registration cancelled or no samples saved.")

    def identify_faces(self, frame):
        """Finds all faces in a frame and returns their names and locations."""
        if not self.known_face_names:
            return [], []
            
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        
        # Find all faces
        # Match strict sizes to avoid background patterns
        faces = self.face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=8, minSize=(60, 60))

        face_names = []
        face_locations = []
        
        for (x, y, w, h) in faces:
            # Isolate and aggressively equalize lighting just like during training
            face_roi = gray[y:y+h, x:x+w]
            face_roi = cv2.equalizeHist(face_roi)
            
            # Predict
            label_id, confidence = self.recognizer.predict(face_roi)
            
            # Confidence in LBPH is internal distance. Lower is better. 
            # Default was 75. 55 is much stricter, preventing misidentification.
            if confidence < 55:  
                name = self.known_face_names.get(label_id, "Unknown")
            else:
                name = "Unknown"
                
            face_names.append(name)
            # Convert back to (top, right, bottom, left) so rest of code doesn't break
            top = y
            right = x + w
            bottom = y + h
            left = x
            face_locations.append((top, right, bottom, left))

        return face_locations, face_names

if __name__ == "__main__":
    # Example usage / Test
    tracker = FaceTracker()
    # tracker.register_from_webcam("Student 1")
