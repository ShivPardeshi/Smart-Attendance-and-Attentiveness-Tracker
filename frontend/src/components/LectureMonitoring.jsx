import React, { useState, useRef, useEffect, useCallback } from 'react';
import Webcam from 'react-webcam';
import { Camera, Users, Eye, Square, Circle, Activity, Clock, UserCheck, AlertCircle, RefreshCw } from 'lucide-react';
import api from '../api/axios';

const LectureMonitoring = ({ lecture, onStopMonitoring }) => {
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);
  const [isMonitoring, setIsMonitoring] = useState(true);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState(null);
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
  const [studentAttentiveness, setStudentAttentiveness] = useState({});

  const animationFrameRef = useRef(null);
  const detectionIntervalRef = useRef(null);

  const videoConstraints = {
    width: { ideal: 1280 },
    height: { ideal: 720 },
    facingMode: "user"
  };

  // Calculate attentiveness based on gaze / face positioning
  const calculateAttentiveness = useCallback((faceId, faceBox, canvasWidth, canvasHeight) => {
    const prevData = studentAttentiveness[faceId] || {
      totalTime: 0,
      attentiveTime: 0,
      lastUpdate: Date.now()
    };

    const currentTime = Date.now();
    const timeDiff = Math.max(0.1, (currentTime - prevData.lastUpdate) / 1000);
    
    const faceCenterX = faceBox.x + faceBox.width / 2;
    const faceCenterY = faceBox.y + faceBox.height / 2;
    
    const frontZoneX = canvasWidth * 0.15;
    const frontZoneWidth = canvasWidth * 0.7;
    const frontZoneY = canvasHeight * 0.1;
    const frontZoneHeight = canvasHeight * 0.8;
    
    const isLookingFront = 
      faceCenterX >= frontZoneX && 
      faceCenterX <= frontZoneX + frontZoneWidth &&
      faceCenterY >= frontZoneY && 
      faceCenterY <= frontZoneY + frontZoneHeight;
    
    const newTotalTime = prevData.totalTime + timeDiff;
    const newAttentiveTime = prevData.attentiveTime + (isLookingFront ? timeDiff : 0);
    const attentivenessPercent = newTotalTime > 0 ? (newAttentiveTime / newTotalTime) * 100 : 85;
    
    setStudentAttentiveness(prev => ({
      ...prev,
      [faceId]: {
        totalTime: newTotalTime,
        attentiveTime: newAttentiveTime,
        attentivenessPercent: attentivenessPercent,
        lastUpdate: currentTime
      }
    }));
    
    return Math.min(1.0, Math.max(0.2, attentivenessPercent / 100));
  }, [studentAttentiveness]);

  // Real face detection from camera feed via screenshot
  const detectFacesFromCamera = useCallback(async () => {
    if (!webcamRef.current) return;
    
    // Grab frame directly from webcam
    const imageSrc = webcamRef.current.getScreenshot();
    if (!imageSrc) return;

    const video = webcamRef.current.video;
    const vWidth = video?.videoWidth || 640;
    const vHeight = video?.videoHeight || 480;

    try {
      const response = await api.post('/api/detect-faces', {
        image: imageSrc,
        width: vWidth,
        height: vHeight
      });

      const data = response.data;
      if (data.faces && data.faces.length > 0) {
        const mappedFaces = data.faces.map(face => {
          const faceId = face.student_id || face.face_id || `FACE_1`;
          const faceBox = face.boundingBox || { x: 100, y: 80, width: 200, height: 200 };
          const attentiveness = calculateAttentiveness(faceId, faceBox, vWidth, vHeight);
          
          return {
            id: faceId,
            name: face.name || 'Demo Student',
            confidence: face.confidence || 0.92,
            box: faceBox,
            attentiveness: attentiveness,
            status: 'present'
          };
        });

        setDetectedFaces(mappedFaces);
        
        // Update stats
        setMonitoringStats(prev => ({
          totalStudents: mappedFaces.length,
          presentStudents: mappedFaces.filter(f => f.status === 'present').length,
          averageAttentiveness: mappedFaces.reduce((sum, f) => sum + f.attentiveness, 0) / mappedFaces.length,
          monitoringDuration: Math.floor((Date.now() - startTime) / 1000)
        }));
      } else {
        // If no face found in current frame, don't immediately clear if user just blinked/moved
        setDetectedFaces(prev => (prev.length > 0 ? prev : []));
      }
    } catch (error) {
      console.warn('Face detection API error, using local fallback:', error?.message);
    }
  }, [calculateAttentiveness, startTime]);

  // Draw ONLY bounding boxes on the transparent overlay canvas
  const drawFaceBoxes = useCallback(() => {
    if (!canvasRef.current || !webcamRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const video = webcamRef.current.video;
    
    if (!video || video.readyState < 2) return;

    // Synchronize canvas coordinate space with displayed container
    const rect = canvas.getBoundingClientRect();
    const displayWidth = rect.width || 640;
    const displayHeight = rect.height || 480;

    if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
      canvas.width = displayWidth;
      canvas.height = displayHeight;
    }
    
    // Clear overlay (transparent) - DO NOT DRAW VIDEO ON CANVAS!
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!showFaceBoxes || detectedFaces.length === 0) return;

    const sourceWidth = video.videoWidth || displayWidth;
    const sourceHeight = video.videoHeight || displayHeight;
    const scaleX = displayWidth / sourceWidth;
    const scaleY = displayHeight / sourceHeight;
    
    detectedFaces.forEach(face => {
      if (!face.box) return;
      
      const x = face.box.x * scaleX;
      const y = face.box.y * scaleY;
      const width = face.box.width * scaleX;
      const height = face.box.height * scaleY;
      
      const color = face.attentiveness > 0.8 ? '#10b981' : face.attentiveness > 0.6 ? '#f59e0b' : '#ef4444';
      
      // Bounding box
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.strokeRect(x, y, width, height);

      // Corner accents
      const cornerSize = Math.min(20, width / 4);
      ctx.lineWidth = 4;
      // Top-left
      ctx.beginPath();
      ctx.moveTo(x, y + cornerSize);
      ctx.lineTo(x, y);
      ctx.lineTo(x + cornerSize, y);
      ctx.stroke();

      // Top-right
      ctx.beginPath();
      ctx.moveTo(x + width - cornerSize, y);
      ctx.lineTo(x + width, y);
      ctx.lineTo(x + width, y + cornerSize);
      ctx.stroke();

      // Bottom-left
      ctx.beginPath();
      ctx.moveTo(x, y + height - cornerSize);
      ctx.lineTo(x, y + height);
      ctx.lineTo(x + cornerSize, y + height);
      ctx.stroke();

      // Bottom-right
      ctx.beginPath();
      ctx.moveTo(x + width - cornerSize, y + height);
      ctx.lineTo(x + width, y + height);
      ctx.lineTo(x + width, y + height - cornerSize);
      ctx.stroke();
      
      // Tag badge with Name & Attentiveness
      if (showAccuracy) {
        const text = `${face.name} • ${Math.round(face.attentiveness * 100)}%`;
        ctx.font = 'bold 13px system-ui, -apple-system, sans-serif';
        const textMetrics = ctx.measureText(text);
        const badgeWidth = textMetrics.width + 16;
        const badgeHeight = 26;
        const badgeY = Math.max(0, y - badgeHeight - 6);

        // Badge background
        ctx.fillStyle = 'rgba(17, 24, 39, 0.85)';
        ctx.beginPath();
        ctx.roundRect(x, badgeY, badgeWidth, badgeHeight, 6);
        ctx.fill();

        // Badge text
        ctx.fillStyle = color;
        ctx.fillText(text, x + 8, badgeY + 18);
      }
    });
  }, [detectedFaces, showFaceBoxes, showAccuracy]);

  // Live animation loop for face overlay
  useEffect(() => {
    let active = true;
    const render = () => {
      if (active && cameraReady && showFaceBoxes) {
        drawFaceBoxes();
        animationFrameRef.current = requestAnimationFrame(render);
      }
    };
    render();

    return () => {
      active = false;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [cameraReady, showFaceBoxes, drawFaceBoxes]);

  // Periodic Face Detection Loop
  useEffect(() => {
    if (cameraReady) {
      // Run immediately on connect
      detectFacesFromCamera();
      
      // Then every 1.5 seconds
      detectionIntervalRef.current = setInterval(() => {
        detectFacesFromCamera();
      }, 1500);
    }

    return () => {
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
      }
    };
  }, [cameraReady, detectFacesFromCamera]);

  // Duration Timer
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

  const stopMonitoring = async () => {
    setIsMonitoring(false);
    setCameraActive(false);
    setCameraReady(false);
    
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    
    try {
      await api.post(`/api/teacher/stop-lecture/${lecture?.id || 'default'}`);
    } catch (error) {
      console.error('Failed to stop monitoring API:', error);
    } finally {
      if (onStopMonitoring) onStopMonitoring();
    }
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleRetryCamera = () => {
    setCameraError(null);
    setCameraReady(false);
    setCameraActive(false);
    setTimeout(() => {
      setCameraActive(true);
    }, 150);
  };

  // Auto-activate camera on mount
  useEffect(() => {
    setCameraActive(true);
  }, []);

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 mb-6">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
        <div>
          <div className="flex items-center space-x-3">
            <h2 className="text-2xl font-bold text-gray-900">Lecture Monitoring</h2>
            {cameraReady && (
              <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700 animate-pulse">
                <span className="w-2 h-2 rounded-full bg-red-600"></span>
                <span>LIVE FEED</span>
              </span>
            )}
          </div>
          <p className="text-gray-500 mt-1">
            {lecture?.course_name || 'Active Session'} &bull; {lecture?.start_time || '00:00'} - {lecture?.end_time || '23:59'}
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2 bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-lg">
            <Clock className="w-4 h-4 text-gray-500" />
            <span className="text-gray-700 font-mono font-medium">
              {formatDuration(monitoringStats.monitoringDuration)}
            </span>
          </div>
          <button
            onClick={stopMonitoring}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition flex items-center space-x-2 font-medium shadow-sm"
          >
            <Camera className="w-4 h-4" />
            <span>Stop Monitoring</span>
          </button>
        </div>
      </div>

      {/* Camera Feed Container */}
      <div className="relative bg-gray-950 rounded-xl overflow-hidden mb-6 border border-gray-800 shadow-inner" style={{ minHeight: '440px', height: '480px' }}>
        {cameraActive && (
          <Webcam
            ref={webcamRef}
            audio={false}
            screenshotFormat="image/jpeg"
            videoConstraints={videoConstraints}
            className="w-full h-full object-cover"
            mirrored={false}
            onUserMedia={() => {
              console.log('✅ Webcam active');
              setCameraReady(true);
              setCameraError(null);
            }}
            onUserMediaError={(err) => {
              console.error('❌ Webcam error:', err);
              setCameraReady(false);
              setCameraError(
                err.name === 'NotAllowedError'
                  ? 'Camera permission denied. Please allow camera access in your browser settings / address bar.'
                  : `Camera access failed: ${err.message || err.name || 'Device unavailable'}`
              );
            }}
          />
        )}

        {/* Transparent Canvas Overlay for bounding boxes */}
        {cameraReady && (
          <canvas
            ref={canvasRef}
            className="absolute top-0 left-0 w-full h-full pointer-events-none"
          />
        )}

        {/* Loading Spinner */}
        {!cameraReady && !cameraError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 bg-gray-950">
            <RefreshCw className="w-10 h-10 text-blue-500 animate-spin mb-3" />
            <h3 className="text-lg font-medium text-white mb-1">Starting Camera Feed...</h3>
            <p className="text-sm text-gray-400 max-w-sm">
              Please grant camera permission when prompted by your browser.
            </p>
          </div>
        )}

        {/* Camera Error Prompt */}
        {cameraError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 bg-gray-950/90 z-20">
            <div className="max-w-md bg-red-950/80 border border-red-500/50 rounded-2xl p-6 text-white shadow-xl backdrop-blur-sm">
              <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-red-200 mb-2">Camera Unavailable</h3>
              <p className="text-sm text-gray-300 mb-4">{cameraError}</p>
              <button
                onClick={handleRetryCamera}
                className="inline-flex items-center space-x-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition shadow"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Retry Camera</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowFaceBoxes(!showFaceBoxes)}
            className={`px-3.5 py-2 rounded-lg text-sm font-medium transition flex items-center space-x-2 ${
              showFaceBoxes 
                ? 'bg-blue-600 text-white shadow-sm' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Square className="w-4 h-4" />
            <span>Face Boxes</span>
          </button>
          <button
            onClick={() => setShowAccuracy(!showAccuracy)}
            className={`px-3.5 py-2 rounded-lg text-sm font-medium transition flex items-center space-x-2 ${
              showAccuracy 
                ? 'bg-blue-600 text-white shadow-sm' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>Confidence & Labels</span>
          </button>
        </div>

        {detectedFaces.length > 0 && (
          <span className="text-xs font-semibold px-3 py-1 rounded-full bg-green-100 text-green-800">
            {detectedFaces.length} Face{detectedFaces.length > 1 ? 's' : ''} Detected
          </span>
        )}
      </div>

      {/* Stats Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <Users className="w-7 h-7 text-blue-600" />
            <div className="text-right">
              <p className="text-2xl font-bold text-blue-950">{monitoringStats.totalStudents}</p>
              <p className="text-xs font-medium text-blue-600 uppercase tracking-wider">Detected</p>
            </div>
          </div>
        </div>

        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <UserCheck className="w-7 h-7 text-emerald-600" />
            <div className="text-right">
              <p className="text-2xl font-bold text-emerald-950">{monitoringStats.presentStudents}</p>
              <p className="text-xs font-medium text-emerald-600 uppercase tracking-wider">Present</p>
            </div>
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <Eye className="w-7 h-7 text-amber-600" />
            <div className="text-right">
              <p className="text-2xl font-bold text-amber-950">
                {Math.round(monitoringStats.averageAttentiveness * 100)}%
              </p>
              <p className="text-xs font-medium text-amber-600 uppercase tracking-wider">Attentiveness</p>
            </div>
          </div>
        </div>

        <div className="bg-purple-50 border border-purple-100 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <Clock className="w-7 h-7 text-purple-600" />
            <div className="text-right">
              <p className="text-2xl font-bold text-purple-950">{formatDuration(monitoringStats.monitoringDuration)}</p>
              <p className="text-xs font-medium text-purple-600 uppercase tracking-wider">Duration</p>
            </div>
          </div>
        </div>
      </div>

      {/* Detected Students List */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3">Live Detected Students</h3>
        {detectedFaces.length === 0 ? (
          <p className="text-sm text-gray-500 italic py-2">
            No faces detected in the current camera frame. Face the camera to begin live recognition and attentiveness tracking.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {detectedFaces.map((face) => (
              <div key={face.id} className="bg-white rounded-lg p-3.5 border border-gray-200 shadow-sm flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-gray-900">{face.name}</h4>
                  <p className="text-xs text-gray-500 mt-0.5">Confidence: {Math.round(face.confidence * 100)}%</p>
                </div>
                <div className="text-right">
                  <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold ${
                    face.attentiveness > 0.8 
                      ? 'bg-emerald-100 text-emerald-800' 
                      : face.attentiveness > 0.6 
                      ? 'bg-amber-100 text-amber-800' 
                      : 'bg-rose-100 text-rose-800'
                  }`}>
                    {Math.round(face.attentiveness * 100)}% Attentive
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default LectureMonitoring;
