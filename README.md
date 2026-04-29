# Smart Classroom Tracker

A fully functional Attendance & Attentiveness tracking system using OpenCV, Mediapipe, and Face Recognition.

## How to Run

1. **Activate the environment**:
   ```bash
   source venv/bin/activate
   ```

2. **Register Faces**:
   First, you need to register a face so the system can recognize it. Open `attendance.py` and run the `register_from_webcam` function, or uncomment the test block at the bottom:
   ```bash
   python attendance.py
   ```
   *Press 's' to snapshot your face and register it.*

3. **Run the Tracker**:
   To start the main pipeline which will open your webcam, track faces, compute attentiveness, and log the results to a CSV file.
   ```bash
   python main.py
   ```
   *Press 'q' when you are done to save the session and exit.*

4. **View the Dashboard**:
   To visualize the session logs in the browser:
   ```bash
   streamlit run dashboard.py
   ```
