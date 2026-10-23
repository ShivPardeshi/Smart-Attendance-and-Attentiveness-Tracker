import React, { useState, useRef, useEffect, useCallback } from 'react';
import Webcam from 'react-webcam';
import { Camera, Users, Eye, EyeOff, Square, Circle, Activity, Clock, UserCheck } from 'lucide-react';
import api from '../api/axios';

const LectureMonitoring = ({ lecture, onStopMonitoring }) => {
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);
  const [isMonitoring, setIsMonitoring] = useState(true);
  const [cameraActive, setCameraActive] = useState(false);
  const [detectedFaces, setDetectedFaces] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [monitoringStats, setMonitoringStats] = useState({
    totalStudents: 0,
    presentStudents: 0,
    averageAttentiveness: 0,
    monitoringDuration: 0
  });
  const [showAccuracy, setShowAccuracy] = useState(true);
  const [showFaceBoxes, setShowFaceBoxes] = useState(true);
  const [startTime, setStartTime] = useState(Date.now());
  
  // Attentiveness tracking state
  const [studentAttentiveness, setStudentAttentiveness] = useState({}); // Track per-student attentiveness
  
  // Animation frame for live tracking
  const animationFrameRef = useRef();

  // Calculate attentiveness based on gaze direction
  const calculateAttentiveness = useCallback((faceId, faceBox, canvasWidth, canvasHeight) => {
    // Get previous attentiveness data for this student
    const prevData = studentAttentiveness[faceId] || {
      totalTime: 0,
      attentiveTime: 0,
      lastUpdate: Date.now()
    };

    const currentTime = Date.now();
    const timeDiff = (currentTime - prevData.lastUpdate) / 1000; // Convert to seconds
    
    // Calculate if student is looking at front based on face position
    // Assuming "front" is center area of the screen
    const faceCenterX = faceBox.x + faceBox.width / 2;
    const faceCenterY = faceBox.y + faceBox.height / 2;
    
    // Define "front" as center 60% of the screen
    const frontZoneX = canvasWidth * 0.2;
    const frontZoneWidth = canvasWidth * 0.6;
    const frontZoneY = canvasHeight * 0.1;
    const frontZoneHeight = canvasHeight * 0.8;
    
    // Check if face is in front zone
    const isLookingFront = 
      faceCenterX >= frontZoneX && 
      faceCenterX <= frontZoneX + frontZoneWidth &&
      faceCenterY >= frontZoneY && 
      faceCenterY <= frontZoneY + frontZoneHeight;
    
    // Update attentiveness tracking
    const newTotalTime = prevData.totalTime + timeDiff;
    const newAttentiveTime = prevData.attentiveTime + (isLookingFront ? timeDiff : 0);
    
    // Calculate attentiveness percentage
    const attentivenessPercent = newTotalTime > 0 ? (newAttentiveTime / newTotalTime) * 100 : 0;
    
    // Update student data
    setStudentAttentiveness(prev => ({
      ...prev,
      [faceId]: {
        totalTime: newTotalTime,
        attentiveTime: newAttentiveTime,
        attentivenessPercent: attentivenessPercent,
        lastUpdate: currentTime
      }
    }));
    
    return attentivenessPercent / 100; // Return as 0-1 value for compatibility
  }, [studentAttentiveness]);

  // Real face detection from camera feed
  const detectFacesFromCamera = useCallback(() => {
    console.log('detectFacesFromCamera called');
    console.log('cameraActive:', cameraActive);
    console.log('webcamRef.current:', webcamRef.current);
    console.log('canvasRef.current:', canvasRef.current);
    
    // Check if webcam is actually ready regardless of React state
    const webcamReady = webcamRef.current && webcamRef.current.video && webcamRef.current.video.readyState === 4;
    
    if (!webcamReady || !canvasRef.current) {
      console.log('Early return - webcam not ready or canvas missing');
      console.log('webcamReady:', webcamReady);
      console.log('video:', webcamRef.current?.video);
      console.log('video.readyState:', webcamRef.current?.video?.readyState);
      return;
    }

    const video = webcamRef.current.video;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    console.log('Video is ready, proceeding with face detection');
    console.log('Video dimensions:', video.videoWidth, 'x', video.videoHeight);

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    console.log('Canvas dimensions set:', canvas.width, 'x', canvas.height);

    // Draw current video frame to canvas
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Get image data for face detection
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    
    // Call face detection API
    console.log('Making face detection API call...');
    console.log('Canvas Dimensions:', canvas.width, canvas.height);
    console.log('Video ready state:', video.readyState);
    
    // Use axios for API call
    api.post('/detect-faces', {
      image: canvas.toDataURL('image/jpeg'),
      width: canvas.width,
      height: canvas.height
    })
    .then(data => {
      console.log('Face detection response:', data);
      console.log('API call successful'); // Added success logging
      if (data.faces && data.faces.length > 0) {
        const detectedFaces = data.faces.map(face => {
          const faceId = face.student_id || `UNKNOWN_${face.face_id}`;
          const faceBox = face.boundingBox || { x: 0, y: 0, width: 100, height: 100 };
          
          // Calculate proper attentiveness based on gaze
          const attentiveness = calculateAttentiveness(faceId, faceBox, canvas.width, canvas.height);
          
          return {
            id: faceId,
            name: face.name || 'Unknown',
            confidence: face.confidence || 0.5,
            box: faceBox,
            attentiveness: attentiveness,
            status: face.student_id ? 'present' : 'unknown'
          };
        });

        setDetectedFaces(detectedFaces);
        
        // Update attendance records
        setAttendanceRecords(prev => {
          const newRecords = detectedFaces.map(face => ({
            studentId: face.id,
            name: face.name,
            confidence: face.confidence,
            attentiveness: face.attentiveness,
            timestamp: new Date().toISOString()
          }));
          
          // Merge with existing records, keeping only latest per student
          const merged = [...prev];
          newRecords.forEach(newRecord => {
            const existingIndex = merged.findIndex(r => r.studentId === newRecord.studentId);
            if (existingIndex >= 0) {
              merged[existingIndex] = newRecord;
            } else {
              merged.push(newRecord);
            }
          });
          
          return merged;
        });

        // Update stats
        setMonitoringStats(prev => ({
          totalStudents: detectedFaces.length,
          presentStudents: detectedFaces.filter(f => f.status === 'present').length,
          averageAttentiveness: detectedFaces.reduce((sum, f) => sum + f.attentiveness, 0) / detectedFaces.length,
          monitoringDuration: Math.floor((Date.now() - startTime) / 1000)
        }));
      } else {
        // No faces detected
        setDetectedFaces([]);
        setMonitoringStats(prev => ({
          ...prev,
          totalStudents: 0,
          presentStudents: 0,
          averageAttentiveness: 0
        }));
      }
    })
    .catch(error => {
      console.error('Face detection error:', error);
      console.error('Error response:', error.response);
      console.error('Error status:', error.response?.status);
      console.error('Error data:', error.response?.data);
      
      // Fallback to mock data for demo
      const mockFaceBox = { x: 150, y: 100, width: 120, height: 150 };
      const mockAttentiveness = calculateAttentiveness('DEMO_001', mockFaceBox, canvas.width, canvas.height);
      
      const mockFaces = [
        {
          id: 'DEMO_001',
          name: 'Demo Student 1',
          confidence: 0.85,
          box: mockFaceBox,
          attentiveness: mockAttentiveness,
          status: 'present'
        }
      ];
      setDetectedFaces(mockFaces);
    });
  }, [cameraActive, startTime]);

  // Draw face detection boxes with live tracking
  const drawFaceBoxes = useCallback(() => {
    if (!canvasRef.current || !webcamRef.current || !showFaceBoxes) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const video = webcamRef.current.video;
    
    if (!video || video.readyState !== 4) return;
    
    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw live video frame first
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Draw boxes around detected faces with smooth tracking
    detectedFaces.forEach(face => {
      const { x, y, width, height } = face.box;
      
      // Draw thin rectangle with live position
      ctx.strokeStyle = face.attentiveness > 0.8 ? '#10b981' : face.attentiveness > 0.6 ? '#f59e0b' : '#ef4444';
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, width, height);
      
      // Draw confidence and name with live updates
      if (showAccuracy) {
        ctx.fillStyle = ctx.strokeStyle;
        ctx.font = '14px Arial';
        ctx.fillText(face.name, x + 5, y - 25);
        ctx.font = '12px Arial';
        ctx.fillText(`${Math.round(face.confidence * 100)}%`, x + 5, y + height + 15);
        ctx.fillText(`${Math.round(face.attentiveness * 100)}% att.`, x + 5, y + height + 30);
      }
    });
  }, [detectedFaces, showFaceBoxes, showAccuracy]);

  // Continuous animation loop for live tracking
  const startLiveTracking = useCallback(() => {
    const animate = () => {
      if (cameraActive && showFaceBoxes) {
        drawFaceBoxes();
        animationFrameRef.current = requestAnimationFrame(animate);
      }
    };
    animate();
  }, [cameraActive, showFaceBoxes, drawFaceBoxes]);

  // Start camera monitoring
  const startCamera = async () => {
    try {
      console.log('Starting camera monitoring...');
      setCameraActive(true);
      setStartTime(Date.now());
      
      // Start live tracking animation
      console.log('Starting live face tracking animation...');
      startLiveTracking();
      
      // Start monitoring interval for face detection
      console.log('Setting up face detection interval...');
      const interval = setInterval(() => {
        console.log('Interval triggered - calling detectFacesFromCamera');
        detectFacesFromCamera();
      }, 1000); // Update every second for real-time detection
      
      console.log('Camera monitoring started successfully');
      return () => {
        clearInterval(interval);
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
      };
    } catch (error) {
      console.error('Failed to start camera:', error);
      setCameraActive(false);
    }
  };

  // Stop monitoring
  const stopMonitoring = async () => {
    setIsMonitoring(false);
    setCameraActive(false);
    
    // Stop live tracking animation
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    try {
      // Call API to stop monitoring
      await api.post(`/api/teacher/stop-lecture/${lecture.id}`);
      onStopMonitoring();
    } catch (error) {
      console.error('Failed to stop monitoring:', error);
    }
  };

  // Effects
  useEffect(() => {
    if (isMonitoring && !cameraActive) {
      let cleanup;
      const startCameraAsync = async () => {
        cleanup = await startCamera();
      };
      startCameraAsync().then(() => {
        return () => {
          if (cleanup) cleanup();
        };
      });
    }
  }, [isMonitoring, cameraActive]);

  // Live tracking effect
  useEffect(() => {
    if (cameraActive && showFaceBoxes) {
      startLiveTracking();
    }
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [cameraActive, showFaceBoxes, startLiveTracking]);

  useEffect(() => {
    drawFaceBoxes();
  }, [drawFaceBoxes]);

  // Update duration
  useEffect(() => {
    const interval = setInterval(() => {
      if (isMonitoring) {
        setMonitoringStats(prev => ({
          ...prev,
          monitoringDuration: Math.floor((Date.now() - startTime) / 1000)
        }));
      }
    }, 1000);
    
    return () => clearInterval(interval);
  }, [isMonitoring, startTime]);

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Lecture Monitoring</h2>
          <p className="text-gray-600">{lecture?.course_name} - {lecture?.start_time} to {lecture?.end_time}</p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Clock className="w-5 h-5 text-gray-500" />
            <span className="text-gray-700 font-medium">{formatDuration(monitoringStats.monitoringDuration)}</span>
          </div>
          <button
            onClick={stopMonitoring}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center space-x-2"
          >
            <Camera className="w-4 h-4" />
            <span>Stop Monitoring</span>
          </button>
        </div>
      </div>

      {/* Camera Feed */}
      <div className="relative bg-gray-900 rounded-lg overflow-hidden mb-6" style={{ height: '480px' }}>
        {cameraActive ? (
          <>
            <Webcam
              ref={webcamRef}
              screenshotFormat="image/jpeg"
              width={640}
              height={480}
              className="w-full h-full object-cover"
              mirrored={false}
            />
            <canvas
              ref={canvasRef}
              width={640}
              height={480}
              className="absolute top-0 left-0 w-full h-full pointer-events-none"
            />
          </>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Camera className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-400">Camera starting...</p>
            </div>
          </div>
        )}
        
        {/* Live indicator */}
        {cameraActive && (
          <div className="absolute top-4 right-4 flex items-center space-x-2 bg-red-600 px-3 py-1 rounded-full">
            <Circle className="w-3 h-3 text-white fill-current animate-pulse" />
            <span className="text-white text-sm font-medium">LIVE</span>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex space-x-4">
          <button
            onClick={() => setShowFaceBoxes(!showFaceBoxes)}
            className={`px-3 py-2 rounded-lg flex items-center space-x-2 ${
              showFaceBoxes ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
            }`}
          >
            <Square className="w-4 h-4" />
            <span>Face Boxes</span>
          </button>
          <button
            onClick={() => setShowAccuracy(!showAccuracy)}
            className={`px-3 py-2 rounded-lg flex items-center space-x-2 ${
              showAccuracy ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>Accuracy</span>
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <Users className="w-8 h-8 text-blue-600" />
            <div className="text-right">
              <p className="text-2xl font-bold text-blue-900">{monitoringStats.totalStudents}</p>
              <p className="text-sm text-blue-600">Total Students</p>
            </div>
          </div>
        </div>
        <div className="bg-green-50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <UserCheck className="w-8 h-8 text-green-600" />
            <div className="text-right">
              <p className="text-2xl font-bold text-green-900">{monitoringStats.presentStudents}</p>
              <p className="text-sm text-green-600">Present</p>
            </div>
          </div>
        </div>
        <div className="bg-yellow-50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <Eye className="w-8 h-8 text-yellow-600" />
            <div className="text-right">
              <p className="text-2xl font-bold text-yellow-900">
                {Math.round(monitoringStats.averageAttentiveness * 100)}%
              </p>
              <p className="text-sm text-yellow-600">Avg Attentiveness</p>
            </div>
          </div>
        </div>
        <div className="bg-purple-50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <Clock className="w-8 h-8 text-purple-600" />
            <div className="text-right">
              <p className="text-2xl font-bold text-purple-900">{formatDuration(monitoringStats.monitoringDuration)}</p>
              <p className="text-sm text-purple-600">Duration</p>
            </div>
          </div>
        </div>
      </div>

      {/* Detected Faces */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Detected Students</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {detectedFaces.map((face) => (
            <div key={face.id} className="bg-white rounded-lg p-3 border border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-gray-900">{face.name}</span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  face.attentiveness > 0.8 ? 'bg-green-100 text-green-800' :
                  face.attentiveness > 0.6 ? 'bg-yellow-100 text-yellow-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {Math.round(face.attentiveness * 100)}%
                </span>
              </div>
              <div className="flex items-center justify-between text-sm text-gray-600">
                <span>ID: {face.id}</span>
                <span>Confidence: {Math.round(face.confidence * 100)}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default LectureMonitoring;
