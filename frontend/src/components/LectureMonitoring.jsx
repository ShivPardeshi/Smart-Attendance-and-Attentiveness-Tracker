import React, { useState, useRef, useEffect, useCallback } from 'react';
import Webcam from 'react-webcam';
import { Camera, Users, Eye, Square, Circle, Activity, Clock, UserCheck, AlertCircle, RefreshCw, CheckCircle2, ShieldCheck } from 'lucide-react';
import api from '../api/axios';

const LectureMonitoring = ({ lecture, onStopMonitoring }) => {
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);
  const [isMonitoring, setIsMonitoring] = useState(true);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [detectedFaces, setDetectedFaces] = useState([]);
  const [markedStudents, setMarkedStudents] = useState({});
  const [recentNotification, setRecentNotification] = useState(null);
  const [monitoringStats, setMonitoringStats] = useState({
    totalStudents: 0,
    presentStudents: 0,
    averageAttentiveness: 0.85,
    monitoringDuration: 0
  });
  const [showAccuracy, setShowAccuracy] = useState(true);
  const [showFaceBoxes, setShowFaceBoxes] = useState(true);
  const [startTime, setStartTime] = useState(Date.now());

  const animationFrameRef = useRef(null);
  const detectionIntervalRef = useRef(null);
  const isRequestInFlight = useRef(false);

  const videoConstraints = {
    width: { ideal: 1280 },
    height: { ideal: 720 },
    facingMode: "user"
  };

  // Real-time face detection, recognition and attendance marking
  const detectFacesFromCamera = useCallback(async () => {
    if (!webcamRef.current || isRequestInFlight.current) return;
    
    const imageSrc = webcamRef.current.getScreenshot();
    if (!imageSrc) return;

    const video = webcamRef.current.video;
    const vWidth = video?.videoWidth || 640;
    const vHeight = video?.videoHeight || 480;

    isRequestInFlight.current = true;

    try {
      const response = await api.post('/api/detect-faces', {
        image: imageSrc,
        width: vWidth,
        height: vHeight,
        lecture_id: lecture?.id || lecture?._id || 'lecture_active',
        teacher_id: lecture?.teacher_id || 'TCH001'
      });

      const data = response.data;
      if (data.faces && data.faces.length > 0) {
        const processedFaces = data.faces.map(face => {
          const fid = face.student_id && face.student_id !== 'Unknown' 
            ? face.student_id 
            : (face.face_id || `FACE_${Math.random()}`);
          
          const box = face.boundingBox || { x: 100, y: 80, width: 200, height: 200 };
          const confidence = typeof face.confidence === 'number' ? face.confidence : 0.90;
          const attentiveness = typeof face.attentiveness === 'number' ? face.attentiveness : 0.85;

          // Track if attendance was marked
          if (face.attendance_marked && face.student_id && face.student_id !== 'Unknown') {
            setMarkedStudents(prev => {
              if (!prev[face.student_id]) {
                setRecentNotification(`🎉 Marked attendance: ${face.name} (${face.prn || face.student_id})`);
                setTimeout(() => setRecentNotification(null), 4000);
              }
              return {
                ...prev,
                [face.student_id]: {
                  name: face.name,
                  prn: face.prn,
                  time: new Date().toLocaleTimeString()
                }
              };
            });
          }

          return {
            id: fid,
            name: face.name || 'Unknown',
            student_id: face.student_id || 'Unknown',
            prn: face.prn || '',
            confidence: confidence,
            box: box,
            attentiveness: attentiveness,
            is_attentive: face.is_attentive !== false,
            is_drowsy: !!face.is_drowsy,
            is_distracted: !!face.is_distracted,
            ear: face.ear,
            pitch: face.pitch,
            yaw: face.yaw,
            attendance_marked: !!face.attendance_marked || !!markedStudents[face.student_id],
            status: face.status || (face.name !== 'Unknown' ? 'present' : 'unverified')
          };
        });

        setDetectedFaces(processedFaces);

        const recognizedCount = processedFaces.filter(f => f.status === 'present').length;
        const avgAtt = processedFaces.reduce((sum, f) => sum + f.attentiveness, 0) / processedFaces.length;

        setMonitoringStats({
          totalStudents: processedFaces.length,
          presentStudents: Math.max(recognizedCount, Object.keys(markedStudents).length),
          averageAttentiveness: avgAtt,
          monitoringDuration: Math.floor((Date.now() - startTime) / 1000)
        });
      } else {
        setDetectedFaces([]);
      }
    } catch (error) {
      console.warn('Face detection polling note:', error?.message);
    } finally {
      isRequestInFlight.current = false;
    }
  }, [lecture, markedStudents, startTime]);

  // Transparent Canvas overlay for rendering bounding boxes and labels
  const drawFaceBoxes = useCallback(() => {
    if (!canvasRef.current || !webcamRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const video = webcamRef.current.video;
    
    if (!video || video.readyState < 2) return;

    const rect = canvas.getBoundingClientRect();
    const displayWidth = rect.width || 640;
    const displayHeight = rect.height || 480;

    if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
      canvas.width = displayWidth;
      canvas.height = displayHeight;
    }
    
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
      
      // Determine outline color based on attentiveness & recognition
      let color = '#10b981'; // Green (attentive)
      if (face.is_drowsy) {
        color = '#f59e0b'; // Amber (drowsy)
      } else if (face.is_distracted) {
        color = '#ef4444'; // Red (distracted)
      } else if (face.name === 'Unknown') {
        color = '#64748b'; // Slate (unknown)
      }

      // 1. Bounding box rectangle
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.strokeRect(x, y, width, height);

      // 2. Corner accents
      const cornerSize = Math.min(22, width / 4);
      ctx.lineWidth = 4;
      ctx.strokeStyle = color;

      // Top-Left
      ctx.beginPath();
      ctx.moveTo(x, y + cornerSize);
      ctx.lineTo(x, y);
      ctx.lineTo(x + cornerSize, y);
      ctx.stroke();

      // Top-Right
      ctx.beginPath();
      ctx.moveTo(x + width - cornerSize, y);
      ctx.lineTo(x + width, y);
      ctx.lineTo(x + width, y + cornerSize);
      ctx.stroke();

      // Bottom-Left
      ctx.beginPath();
      ctx.moveTo(x, y + height - cornerSize);
      ctx.lineTo(x, y + height);
      ctx.lineTo(x + cornerSize, y + height);
      ctx.stroke();

      // Bottom-Right
      ctx.beginPath();
      ctx.moveTo(x + width - cornerSize, y + height);
      ctx.lineTo(x + width, y + height);
      ctx.lineTo(x + width, y + height - cornerSize);
      ctx.stroke();

      if (showAccuracy) {
        // Tag badge above face box
        const badgeY = Math.max(24, y - 10);
        const nameText = face.name !== 'Unknown' ? face.name : 'Unknown Student';
        const statusText = face.is_drowsy ? 'Drowsy' : face.is_distracted ? 'Distracted' : 'Attentive';
        const label = `${nameText} (${Math.round(face.confidence * 100)}%) • ${statusText}`;

        ctx.font = 'bold 12px Inter, system-ui, sans-serif';
        const textWidth = ctx.measureText(label).width;
        const padding = 16;
        const badgeWidth = textWidth + padding;
        const badgeHeight = 22;

        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.beginPath();
        ctx.roundRect(x, badgeY - 18, badgeWidth, badgeHeight, 6);
        ctx.fill();

        // Status indicator dot
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x + 10, badgeY - 7, 4, 0, Math.PI * 2);
        ctx.fill();

        // Label text
        ctx.fillStyle = '#ffffff';
        ctx.fillText(label, x + 20, badgeY - 3);

        // Attendance check badge below box if verified
        if (face.attendance_marked || markedStudents[face.student_id]) {
          const checkLabel = '✓ Attendance Marked';
          ctx.font = 'bold 11px Inter, system-ui, sans-serif';
          const cWidth = ctx.measureText(checkLabel).width + 16;
          
          ctx.fillStyle = 'rgba(16, 185, 129, 0.95)';
          ctx.beginPath();
          ctx.roundRect(x, y + height + 6, cWidth, 20, 5);
          ctx.fill();

          ctx.fillStyle = '#ffffff';
          ctx.fillText(checkLabel, x + 8, y + height + 20);
        }
      }
    });
  }, [detectedFaces, showFaceBoxes, showAccuracy, markedStudents]);

  // Animation loop for smooth overlay drawing
  useEffect(() => {
    const loop = () => {
      drawFaceBoxes();
      animationFrameRef.current = requestAnimationFrame(loop);
    };
    animationFrameRef.current = requestAnimationFrame(loop);

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [drawFaceBoxes]);

  // Polling interval for AI detection
  useEffect(() => {
    if (cameraReady && isMonitoring) {
      detectFacesFromCamera(); // Run immediately
      detectionIntervalRef.current = setInterval(detectFacesFromCamera, 1500); // Poll every 1.5s
    }

    return () => {
      if (detectionIntervalRef.current) clearInterval(detectionIntervalRef.current);
    };
  }, [cameraReady, isMonitoring, detectFacesFromCamera]);

  // Duration timer
  useEffect(() => {
    const timer = setInterval(() => {
      setMonitoringStats(prev => ({
        ...prev,
        monitoringDuration: Math.floor((Date.now() - startTime) / 1000)
      }));
    }, 1000);
    return () => clearInterval(timer);
  }, [startTime]);

  // Initialize camera
  useEffect(() => {
    setCameraActive(true);
    setCameraReady(false);
    setCameraError(null);

    const fallbackTimeout = setTimeout(() => {
      if (webcamRef.current?.video?.readyState >= 2) {
        setCameraReady(true);
      }
    }, 1200);

    return () => {
      clearTimeout(fallbackTimeout);
      setCameraActive(false);
      setCameraReady(false);
    };
  }, []);

  const handleRetryCamera = () => {
    setCameraError(null);
    setCameraReady(false);
    setCameraActive(false);
    setTimeout(() => setCameraActive(true), 300);
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 mb-8 transition-all">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-center gap-4 mb-6 pb-4 border-b border-gray-100">
        <div>
          <div className="flex items-center space-x-3">
            <h2 className="text-xl font-bold text-gray-900">
              Live Classroom AI Monitoring
            </h2>
            <span className="flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>LIVE AI ENGINE</span>
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            {lecture?.course_name || 'Active Course'} ({lecture?.course_code || 'CS401'}) • Room: {lecture?.classroom || 'Smart Lab 1'}
          </p>
        </div>

        <button
          onClick={onStopMonitoring}
          className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold rounded-xl transition shadow-sm hover:shadow"
        >
          Stop Monitoring Session
        </button>
      </div>

      {/* Floating Notification */}
      {recentNotification && (
        <div className="mb-4 bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl flex items-center justify-between shadow-sm animate-fade-in">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span className="font-semibold text-sm">{recentNotification}</span>
          </div>
          <span className="text-xs text-emerald-600 font-mono">Logged to Database</span>
        </div>
      )}

      {/* Camera Viewport Container */}
      <div className="relative w-full aspect-video max-h-[540px] bg-gray-950 rounded-2xl overflow-hidden shadow-inner mb-6 flex items-center justify-center">
        {cameraActive && (
          <Webcam
            ref={webcamRef}
            audio={false}
            screenshotFormat="image/jpeg"
            videoConstraints={videoConstraints}
            className="w-full h-full object-cover"
            mirrored={false}
            onUserMedia={() => {
              setCameraReady(true);
              setCameraError(null);
            }}
            onUserMediaError={(err) => {
              setCameraReady(false);
              setCameraError(
                err.name === 'NotAllowedError'
                  ? 'Camera permission denied. Please allow camera access in browser address bar.'
                  : `Camera access failed: ${err.message || 'Device unavailable'}`
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
            <h3 className="text-lg font-medium text-white mb-1">Starting Camera Stream...</h3>
            <p className="text-sm text-gray-400 max-w-sm">
              Please grant camera permission when prompted by your browser.
            </p>
          </div>
        )}

        {/* Camera Error Prompt */}
        {cameraError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 bg-gray-950/90 z-20">
            <div className="max-w-md bg-rose-950/80 border border-rose-500/50 rounded-2xl p-6 text-white shadow-xl backdrop-blur-sm">
              <AlertCircle className="w-12 h-12 text-rose-400 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-rose-200 mb-2">Camera Unavailable</h3>
              <p className="text-sm text-gray-300 mb-4">{cameraError}</p>
              <button
                onClick={handleRetryCamera}
                className="inline-flex items-center space-x-2 px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-medium rounded-xl transition shadow"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Retry Camera</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Controls & Quick Toggles */}
      <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowFaceBoxes(!showFaceBoxes)}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider transition flex items-center space-x-2 ${
              showFaceBoxes 
                ? 'bg-blue-600 text-white shadow-sm' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Square className="w-4 h-4" />
            <span>Face Bounding Boxes</span>
          </button>
          <button
            onClick={() => setShowAccuracy(!showAccuracy)}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider transition flex items-center space-x-2 ${
              showAccuracy 
                ? 'bg-blue-600 text-white shadow-sm' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>Labels & Confidence</span>
          </button>
        </div>

        {detectedFaces.length > 0 && (
          <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
            {detectedFaces.length} Face{detectedFaces.length > 1 ? 's' : ''} in Frame
          </span>
        )}
      </div>

      {/* Key Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-50/70 border border-blue-100 rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <Users className="w-7 h-7 text-blue-600" />
            <div className="text-right">
              <p className="text-2xl font-bold text-blue-950">{monitoringStats.totalStudents}</p>
              <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider">Detected in Frame</p>
            </div>
          </div>
        </div>

        <div className="bg-emerald-50/70 border border-emerald-100 rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <UserCheck className="w-7 h-7 text-emerald-600" />
            <div className="text-right">
              <p className="text-2xl font-bold text-emerald-950">{monitoringStats.presentStudents}</p>
              <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Attendance Logged</p>
            </div>
          </div>
        </div>

        <div className="bg-amber-50/70 border border-amber-100 rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <Eye className="w-7 h-7 text-amber-600" />
            <div className="text-right">
              <p className="text-2xl font-bold text-amber-950">
                {Math.round(monitoringStats.averageAttentiveness * 100)}%
              </p>
              <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider">Class Attentiveness</p>
            </div>
          </div>
        </div>

        <div className="bg-purple-50/70 border border-purple-100 rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <Clock className="w-7 h-7 text-purple-600" />
            <div className="text-right">
              <p className="text-2xl font-bold text-purple-950">{formatDuration(monitoringStats.monitoringDuration)}</p>
              <p className="text-xs font-semibold text-purple-600 uppercase tracking-wider">Session Time</p>
            </div>
          </div>
        </div>
      </div>

      {/* Live Detected Students Detail List */}
      <div className="bg-gray-50/80 border border-gray-200 rounded-2xl p-5">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider flex items-center">
            <ShieldCheck className="w-4 h-4 mr-2 text-blue-600" /> Live Face Recognition & Attentiveness Feed
          </h3>
          <span className="text-xs text-gray-500">Auto-marks attendance for recognized students</span>
        </div>

        {detectedFaces.length === 0 ? (
          <div className="text-center py-8 bg-white rounded-xl border border-dashed border-gray-200">
            <Camera className="w-8 h-8 mx-auto text-gray-400 mb-2" />
            <p className="text-sm font-medium text-gray-700">No faces currently in view</p>
            <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
              Look directly into the camera in balanced lighting. Students registered in the system will be automatically recognized and marked present.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {detectedFaces.map((face, idx) => (
              <div 
                key={face.id || idx} 
                className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm flex flex-col justify-between space-y-2 hover:border-blue-300 transition"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-bold text-gray-900 text-sm">{face.name}</h4>
                    <p className="text-xs font-mono text-gray-500 mt-0.5">
                      {face.student_id !== 'Unknown' ? `${face.student_id} • PRN: ${face.prn}` : 'Unrecognized Student'}
                    </p>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                    face.status === 'present' 
                      ? 'bg-emerald-100 text-emerald-800' 
                      : 'bg-gray-100 text-gray-700'
                  }`}>
                    {face.status === 'present' ? '✓ Present' : 'Unverified'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-100 text-xs">
                  <div>
                    <span className="text-gray-400 text-[10px] uppercase font-semibold block">Confidence</span>
                    <span className="font-bold text-gray-800">{Math.round(face.confidence * 100)}%</span>
                  </div>
                  <div>
                    <span className="text-gray-400 text-[10px] uppercase font-semibold block">Attentiveness</span>
                    <span className={`font-bold ${
                      face.attentiveness > 0.8 ? 'text-emerald-600' : face.attentiveness > 0.6 ? 'text-amber-600' : 'text-rose-600'
                    }`}>
                      {Math.round(face.attentiveness * 100)}% ({face.is_drowsy ? 'Drowsy' : face.is_distracted ? 'Distracted' : 'Focused'})
                    </span>
                  </div>
                </div>

                {face.ear !== undefined && (
                  <div className="text-[10px] text-gray-400 font-mono">
                    EAR: {face.ear} | Yaw: {face.yaw}° | Pitch: {face.pitch}°
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default LectureMonitoring;
