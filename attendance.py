import cv2
import numpy as np
import os
import json
from pathlib import Path
from database_manager import db_manager

def non_max_suppression_fast(boxes, overlapThresh=0.35):
    """Cleanly merges overlapping bounding boxes from multiple cascade passes"""
    if len(boxes) == 0:
        return []
    if boxes.dtype.kind == "i":
        boxes = boxes.astype("float")

    pick = []
    x1 = boxes[:, 0]
    y1 = boxes[:, 1]
    x2 = boxes[:, 0] + boxes[:, 2]
    y2 = boxes[:, 1] + boxes[:, 3]

    area = (x2 - x1 + 1) * (y2 - y1 + 1)
    idxs = np.argsort(y2)

    while len(idxs) > 0:
        last = len(idxs) - 1
        i = idxs[last]
        pick.append(i)

        xx1 = np.maximum(x1[i], x1[idxs[:last]])
        yy1 = np.maximum(y1[i], y1[idxs[:last]])
        xx2 = np.minimum(x2[i], x2[idxs[:last]])
        yy2 = np.minimum(y2[i], y2[idxs[:last]])

        w = np.maximum(0, xx2 - xx1 + 1)
        h = np.maximum(0, yy2 - yy1 + 1)

        overlap = (w * h) / area[idxs[:last]]
        idxs = np.delete(idxs, np.concatenate(([last], np.where(overlap > overlapThresh)[0])))

    return boxes[pick].astype("int")

class FaceTracker:
    def __init__(self, model_file="face_model.yml", names_file="face_names.json", meta_file="face_metadata.json"):
        self.model_file = model_file
        self.names_file = names_file
        self.meta_file = meta_file
        
        # Dual cascades for maximum detection recall and pose tolerance
        self.face_cascade_default = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
        self.face_cascade_alt = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_alt2.xml')
        
        # Local Binary Patterns Histograms (LBPH) Face Recognizer
        self.recognizer = cv2.face.LBPHFaceRecognizer_create(radius=1, neighbors=8, grid_x=8, grid_y=8)
        
        # CLAHE for illumination-invariant preprocessing
        self.clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        
        self.known_face_names = {}      # face_id -> name string
        self.known_students = {}        # face_id -> {student_id, prn, name, email}
        self.current_id = 0
        self.model_trained = False
        
        self.load_model()

    def preprocess_face(self, face_roi, target_size=(160, 160)):
        """Standardizes face resolution, applies CLAHE lighting equalization and noise reduction"""
        if face_roi.size == 0:
            return None
        resized = cv2.resize(face_roi, target_size)
        equalized = self.clahe.apply(resized)
        smoothed = cv2.GaussianBlur(equalized, (3, 3), 0)
        return smoothed

    def detect_faces(self, gray_frame):
        """Runs dual cascade detectors with Non-Maximum Suppression to find all faces accurately"""
        boxes1 = self.face_cascade_alt.detectMultiScale(
            gray_frame, scaleFactor=1.1, minNeighbors=5, minSize=(60, 60)
        )
        boxes2 = self.face_cascade_default.detectMultiScale(
            gray_frame, scaleFactor=1.15, minNeighbors=5, minSize=(60, 60)
        )
        
        all_boxes = []
        if len(boxes1) > 0:
            all_boxes.extend(boxes1)
        if len(boxes2) > 0:
            all_boxes.extend(boxes2)
            
        if not all_boxes:
            return []
            
        boxes_array = np.array(all_boxes)
        clean_boxes = non_max_suppression_fast(boxes_array, overlapThresh=0.35)
        return clean_boxes

    def load_model(self):
        """Loads model file, names, and student metadata from DB and local cache"""
        # 1. Sync from DB first
        try:
            if db_manager.connect():
                db_faces = db_manager.get_all_faces_for_recognition()
                for f in db_faces:
                    fid = int(f.get("face_id", 0))
                    self.known_face_names[fid] = f.get("name", "Unknown")
                    self.known_students[fid] = {
                        "face_id": fid,
                        "name": f.get("name", ""),
                        "student_id": f.get("student_id", ""),
                        "prn": f.get("prn", "")
                    }
                if self.known_face_names:
                    self.current_id = max(self.known_face_names.keys()) + 1
        except Exception as e:
            print(f"Notice: sync from DB: {e}")

        # 2. Sync from local files
        if os.path.exists(self.names_file):
            try:
                with open(self.names_file, 'r') as f:
                    data = json.load(f)
                    for k, v in data.items():
                        fid = int(k)
                        self.known_face_names[fid] = v
                        if fid not in self.known_students:
                            self.known_students[fid] = {
                                "face_id": fid,
                                "name": v,
                                "student_id": f"STU{fid:03d}",
                                "prn": f"2024{fid:03d}"
                            }
                if self.known_face_names:
                    self.current_id = max(self.current_id, max(self.known_face_names.keys()) + 1)
            except Exception as e:
                print(f"Error reading {self.names_file}: {e}")

        if os.path.exists(self.meta_file):
            try:
                with open(self.meta_file, 'r') as f:
                    meta = json.load(f)
                    for k, v in meta.items():
                        self.known_students[int(k)] = v
            except Exception as e:
                pass

        # 3. Load trained LBPH model if exists
        if os.path.exists(self.model_file) and os.path.getsize(self.model_file) > 1000:
            try:
                self.recognizer.read(self.model_file)
                self.model_trained = True
                print(f"✅ Loaded LBPH model with {len(self.known_face_names)} identities.")
            except Exception as e:
                print(f"Could not read existing LBPH model ({e}). Will train on first registration.")
                self.model_trained = False
        else:
            print("No existing LBPH weights found. Ready for student registrations.")

    def save_model(self):
        """Persists trained weights and identity metadata"""
        try:
            self.recognizer.write(self.model_file)
            with open(self.names_file, 'w') as f:
                json.dump({str(k): v for k, v in self.known_face_names.items()}, f, indent=2)
            with open(self.meta_file, 'w') as f:
                json.dump({str(k): v for k, v in self.known_students.items()}, f, indent=2)
            print(f"✅ Saved face model with {len(self.known_face_names)} profiles to {self.model_file}")
            return True
        except Exception as e:
            print(f"Error saving face model: {e}")
            return False

    def generate_augmentations(self, face_roi):
        """Generates 10 illumination and pose invariant variations of face ROI for LBPH training"""
        preprocessed = self.preprocess_face(face_roi)
        if preprocessed is None:
            return []

        h, w = preprocessed.shape
        samples = [preprocessed]

        # 1. Brightness +20
        samples.append(cv2.convertScaleAbs(preprocessed, alpha=1.0, beta=20))
        # 2. Brightness -20
        samples.append(cv2.convertScaleAbs(preprocessed, alpha=1.0, beta=-20))
        # 3. Enhanced Contrast (CLAHE 3.0)
        c3 = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
        samples.append(c3.apply(preprocessed))
        # 4. Horizontal Flip (Mirror)
        samples.append(cv2.flip(preprocessed, 1))
        # 5. Rotate +5 degrees
        M_rot_p = cv2.getRotationMatrix2D((w / 2, h / 2), 5, 1.0)
        samples.append(cv2.warpAffine(preprocessed, M_rot_p, (w, h), borderMode=cv2.BORDER_REFLECT))
        # 6. Rotate -5 degrees
        M_rot_n = cv2.getRotationMatrix2D((w / 2, h / 2), -5, 1.0)
        samples.append(cv2.warpAffine(preprocessed, M_rot_n, (w, h), borderMode=cv2.BORDER_REFLECT))
        # 7. Zoom in 105%
        crop_w, crop_h = int(w * 0.95), int(h * 0.95)
        start_x, start_y = (w - crop_w) // 2, (h - crop_h) // 2
        cropped = preprocessed[start_y:start_y + crop_h, start_x:start_x + crop_w]
        samples.append(cv2.resize(cropped, (w, h)))
        # 8. Zoom out 95%
        small = cv2.resize(preprocessed, (int(w * 0.95), int(h * 0.95)))
        padded = cv2.copyMakeBorder(small, 4, 4, 4, 4, cv2.BORDER_REFLECT)
        samples.append(cv2.resize(padded, (w, h)))
        # 9. Gentle Gaussian blur
        samples.append(cv2.GaussianBlur(preprocessed, (5, 5), 0))

        return samples

    def register_student_face(self, bgr_image, student_id, name, prn, email=""):
        """Extracts face, runs augmentations, updates LBPH model and persists metadata"""
        if bgr_image is None or bgr_image.size == 0:
            return False, "Invalid image", None

        gray = cv2.cvtColor(bgr_image, cv2.COLOR_BGR2GRAY)
        boxes = self.detect_faces(gray)

        if len(boxes) == 0:
            return False, "No face detected in the photo. Please align your face in good lighting.", None

        # Pick the largest face (most prominent subject)
        boxes = sorted(boxes, key=lambda b: b[2] * b[3], reverse=True)
        (x, y, w, h) = boxes[0]

        # Add 5% padding around face if possible
        pad_x = int(w * 0.05)
        pad_y = int(h * 0.05)
        x1 = max(0, x - pad_x)
        y1 = max(0, y - pad_y)
        x2 = min(gray.shape[1], x + w + pad_x)
        y2 = min(gray.shape[0], y + h + pad_y)
        face_roi = gray[y1:y2, x1:x2]

        # Determine face_id
        target_fid = -1
        for fid, sinfo in self.known_students.items():
            if sinfo.get("student_id") == student_id or sinfo.get("prn") == prn:
                target_fid = fid
                break

        if target_fid == -1:
            target_fid = self.current_id
            self.current_id += 1

        self.known_face_names[target_fid] = name
        self.known_students[target_fid] = {
            "face_id": target_fid,
            "student_id": student_id,
            "prn": prn,
            "name": name,
            "email": email
        }

        # Generate robust augmentations
        samples = self.generate_augmentations(face_roi)
        labels = np.array([target_fid] * len(samples))

        try:
            if self.model_trained:
                self.recognizer.update(samples, labels)
            else:
                self.recognizer.train(samples, labels)
                self.model_trained = True

            self.save_model()
            print(f"🎉 Successfully registered face for {name} ({student_id}) with {len(samples)} augmented samples!")
            return True, "Registration successful", target_fid
        except Exception as e:
            print(f"Error training face model: {e}")
            return False, f"Model training error: {str(e)}", None

    def identify_faces(self, frame):
        """Finds all faces in frame and returns bounding boxes and identified student information"""
        if frame is None or frame.size == 0:
            return []

        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        boxes = self.detect_faces(gray)

        results = []
        for (x, y, w, h) in boxes:
            face_roi = gray[y:y+h, x:x+w]
            preprocessed = self.preprocess_face(face_roi)

            student_id = "Unknown"
            name = "Unknown"
            prn = ""
            confidence = 0.0
            matched = False

            if self.model_trained and len(self.known_face_names) > 0 and preprocessed is not None:
                try:
                    label_id, distance = self.recognizer.predict(preprocessed)
                    # Convert LBPH distance to calibrated 0.0-1.0 confidence score
                    # Distances: <45 is very strong, 45-65 is confident, >65 is unknown
                    calculated_conf = max(0.1, min(0.98, round(1.0 - (distance / 85.0), 2)))

                    if distance < 65 and label_id in self.known_students:
                        student_info = self.known_students[label_id]
                        name = student_info.get("name", "Unknown")
                        student_id = student_info.get("student_id", f"STU{label_id:03d}")
                        prn = student_info.get("prn", "")
                        confidence = calculated_conf
                        matched = True
                    elif distance < 72 and label_id in self.known_students:
                        # Moderate confidence match
                        student_info = self.known_students[label_id]
                        name = student_info.get("name", "Unknown")
                        student_id = student_info.get("student_id", "")
                        prn = student_info.get("prn", "")
                        confidence = round(calculated_conf * 0.85, 2)
                        matched = False  # treat as unverified
                    else:
                        name = "Unknown"
                        confidence = round(max(0.15, calculated_conf * 0.4), 2)
                except Exception as e:
                    pass

            results.append({
                "boundingBox": {
                    "x": int(x),
                    "y": int(y),
                    "width": int(w),
                    "height": int(h)
                },
                "face_id": f"face_{x}_{y}",
                "student_id": student_id,
                "name": name,
                "prn": prn,
                "confidence": confidence,
                "matched": matched
            })

        return results

    def process_frame_full(self, frame, attentiveness_tracker=None):
        """Processes frame for both Face Recognition and Attentiveness Tracking"""
        face_results = self.identify_faces(frame)
        if not face_results:
            return []

        # If attentiveness tracker is provided, calculate EAR and 3D pose
        if attentiveness_tracker:
            try:
                att_results = attentiveness_tracker.process_frame(frame)
                # Match attentiveness results to face bounding boxes using spatial overlap (IoU)
                for f in face_results:
                    fbox = f["boundingBox"]
                    fx1, fy1, fx2, fy2 = fbox["x"], fbox["y"], fbox["x"] + fbox["width"], fbox["y"] + fbox["height"]
                    best_match = None
                    best_iou = 0.0

                    for att in att_results:
                        ax1, ay1, ax2, ay2 = att["bbox"]
                        # Intersection
                        ix1 = max(fx1, ax1)
                        iy1 = max(fy1, ay1)
                        ix2 = min(fx2, ax2)
                        iy2 = min(fy2, ay2)
                        iw = max(0, ix2 - ix1)
                        ih = max(0, iy2 - iy1)
                        intersection = iw * ih
                        f_area = fbox["width"] * fbox["height"]
                        a_area = (ax2 - ax1) * (ay2 - ay1)
                        union = f_area + a_area - intersection
                        iou = intersection / union if union > 0 else 0

                        if iou > best_iou:
                            best_iou = iou
                            best_match = att

                    if best_match and best_iou > 0.2:
                        f["ear"] = round(float(best_match.get("ear", 0.25)), 3)
                        f["pitch"] = round(float(best_match.get("pitch", 0.0)), 2)
                        f["yaw"] = round(float(best_match.get("yaw", 0.0)), 2)
                        f["is_drowsy"] = bool(best_match.get("is_drowsy", False))
                        f["is_distracted"] = bool(best_match.get("is_distracted", False))
                        f["is_attentive"] = bool(best_match.get("is_attentive", True))

                        # Calculate attentiveness score (0.0 to 1.0)
                        if f["is_drowsy"]:
                            score = max(0.2, min(0.45, f["ear"] * 2.0))
                        elif f["is_distracted"]:
                            yaw_penalty = min(0.5, abs(f["yaw"]) / 90.0)
                            pitch_penalty = min(0.3, abs(f["pitch"]) / 90.0)
                            score = max(0.3, round(1.0 - (yaw_penalty + pitch_penalty), 2))
                        else:
                            score = round(0.85 + (min(0.35, f["ear"]) * 0.3), 2)
                        f["attentiveness"] = min(0.99, max(0.15, score))
                    else:
                        f["is_attentive"] = True
                        f["is_drowsy"] = False
                        f["is_distracted"] = False
                        f["attentiveness"] = 0.88
            except Exception as e:
                print(f"Attentiveness tracking notice: {e}")
                for f in face_results:
                    f["is_attentive"] = True
                    f["is_drowsy"] = False
                    f["is_distracted"] = False
                    f["attentiveness"] = 0.88
        else:
            for f in face_results:
                f["is_attentive"] = True
                f["is_drowsy"] = False
                f["is_distracted"] = False
                f["attentiveness"] = 0.88

        return face_results

if __name__ == "__main__":
    tracker = FaceTracker()
    print("Known students:", tracker.known_students)
