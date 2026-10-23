import React, { useState, useRef } from 'react';
import Webcam from 'react-webcam';
import { Camera, UserPlus, Save, RefreshCw, AlertCircle, CheckCircle, Sparkles } from 'lucide-react';
import api from '../api/axios';

const StudentRegistration = ({ onStudentAdded, onClose }) => {
  const webcamRef = useRef(null);
  const [formData, setFormData] = useState({
    student_id: '',
    prn: '',
    name: '',
    email: ''
  });

  const generateStudentId = () => {
    const timestamp = Date.now().toString().slice(-4);
    return `STU${timestamp}`;
  };

  const generatePRN = () => {
    const timestamp = Date.now().toString().slice(-4);
    return `2024${timestamp}`;
  };

  const useSuggestedIds = () => {
    setFormData(prev => ({
      ...prev,
      student_id: generateStudentId(),
      prn: generatePRN()
    }));
  };

  const [faceImage, setFaceImage] = useState(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [message, setMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [cameraError, setCameraError] = useState(false);

  const handleInputChange = (e) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const captureFace = () => {
    if (webcamRef.current) {
      const imageSrc = webcamRef.current.getScreenshot();
      if (imageSrc) {
        setFaceImage(imageSrc);
        setMessage('Face captured! Review your photo and submit.');
        setIsSuccess(true);
        setTimeout(() => setMessage(''), 3000);
      }
    }
  };

  const retakePhoto = () => {
    setFaceImage(null);
    setMessage('');
    setIsSuccess(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!faceImage) {
      setMessage('Please capture the student\'s face first using the camera.');
      setIsSuccess(false);
      return;
    }

    if (!formData.student_id || !formData.prn || !formData.name || !formData.email) {
      setMessage('Please fill in all required student details.');
      setIsSuccess(false);
      return;
    }

    setIsRegistering(true);
    setMessage('');
    setIsSuccess(false);

    try {
      // Prepare base64 and binary array for maximum backend compatibility
      const base64Data = faceImage.includes('base64,') ? faceImage.split('base64,')[1] : faceImage;
      const binaryData = atob(base64Data);
      const uint8Array = new Uint8Array(binaryData.length);
      for (let i = 0; i < binaryData.length; i++) {
        uint8Array[i] = binaryData.charCodeAt(i);
      }

      const requestData = {
        ...formData,
        face_image: faceImage,
        face_encoding: Array.from(uint8Array)
      };

      const response = await api.post('/api/teacher/add-student', requestData);
      const result = response.data;

      if (response.status === 201 || response.status === 200) {
        setMessage('🎉 Student registered and AI face model trained successfully!');
        setIsSuccess(true);
        setTimeout(() => {
          if (onStudentAdded) onStudentAdded();
          if (onClose) onClose();
        }, 1800);
      } else {
        setMessage(result.message || 'Failed to register student.');
        setIsSuccess(false);
      }
    } catch (error) {
      const serverMsg = error.response?.data?.message;
      if (serverMsg) {
        setMessage(`❌ ${serverMsg}`);
      } else {
        setMessage(`❌ Registration failed: ${error.message || 'Server error'}`);
      }
      setIsSuccess(false);
    } finally {
      setIsRegistering(false);
    }
  };

  const videoConstraints = {
    width: { ideal: 640 },
    height: { ideal: 480 },
    facingMode: 'user'
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[92vh] overflow-y-auto shadow-2xl border border-gray-100">
        <div className="p-6">
          <div className="flex justify-between items-center pb-4 border-b border-gray-100 mb-6">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                <UserPlus className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Register New Student</h2>
                <p className="text-xs text-gray-500">Capture face for real-time recognition & automatic attendance</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 p-2 rounded-lg hover:bg-gray-100 transition"
            >
              ✕
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Webcam / Face Capture Column */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-700">
                  Step 1: Face Photo Capture
                </h3>
                {faceImage && (
                  <span className="text-xs font-medium text-emerald-600 flex items-center">
                    <CheckCircle className="w-3.5 h-3.5 mr-1" /> Ready
                  </span>
                )}
              </div>

              {!faceImage ? (
                <div className="space-y-3">
                  <div className="relative rounded-2xl overflow-hidden bg-gray-950 aspect-[4/3] flex items-center justify-center border-2 border-gray-200">
                    <Webcam
                      audio={false}
                      ref={webcamRef}
                      screenshotFormat="image/jpeg"
                      constraints={videoConstraints}
                      className="w-full h-full object-cover"
                      mirrored={false}
                      onUserMediaError={() => setCameraError(true)}
                      onUserMedia={() => setCameraError(false)}
                    />
                    
                    {/* Face alignment oval guide */}
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                      <div className="w-48 h-60 border-2 border-dashed border-white/60 rounded-full flex items-center justify-center">
                        <span className="text-[11px] font-medium text-white/80 bg-black/40 px-2 py-0.5 rounded-full backdrop-blur-xs">
                          Align Face Here
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  {cameraError && (
                    <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl text-sm flex items-center">
                      <AlertCircle className="w-4 h-4 mr-2 shrink-0" />
                      Camera access denied. Please allow camera access in browser permissions.
                    </div>
                  )}
                  
                  <button
                    onClick={captureFace}
                    disabled={cameraError}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-xl disabled:opacity-50 transition shadow-sm flex items-center justify-center space-x-2"
                  >
                    <Camera className="w-4 h-4" />
                    <span>Capture Face Photo</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="relative rounded-2xl overflow-hidden aspect-[4/3] border-2 border-emerald-500 shadow-md">
                    <img 
                      src={faceImage} 
                      alt="Captured face preview" 
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-3 right-3 bg-emerald-500 text-white p-2 rounded-full shadow-lg">
                      <CheckCircle className="w-5 h-5" />
                    </div>
                    <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-sm text-white px-3 py-1 rounded-lg text-xs font-medium">
                      Captured Face Ready
                    </div>
                  </div>
                  
                  <button
                    onClick={retakePhoto}
                    className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2.5 px-4 rounded-xl transition flex items-center justify-center space-x-2 text-sm"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>Retake Photo</span>
                  </button>
                </div>
              )}

              <div className="bg-blue-50/70 border border-blue-100 rounded-xl p-3 text-xs text-blue-800 space-y-1">
                <p className="font-semibold flex items-center">
                  <Sparkles className="w-3.5 h-3.5 mr-1 text-blue-600" /> AI Face Model Tip:
                </p>
                <p>Sit facing forward in balanced lighting. The model automatically trains 10 synthetic illumination and angle variations for high-accuracy recognition.</p>
              </div>
            </div>

            {/* Student Information Form Column */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-700">
                  Step 2: Student Details
                </h3>
                <button
                  type="button"
                  onClick={useSuggestedIds}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-800 underline"
                >
                  Generate IDs
                </button>
              </div>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">
                      Student ID *
                    </label>
                    <input
                      type="text"
                      name="student_id"
                      value={formData.student_id}
                      onChange={handleInputChange}
                      className="w-full px-3.5 py-2.5 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                      placeholder="e.g. STU101"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">
                      PRN *
                    </label>
                    <input
                      type="text"
                      name="prn"
                      value={formData.prn}
                      onChange={handleInputChange}
                      className="w-full px-3.5 py-2.5 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                      placeholder="e.g. 2024101"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    className="w-full px-3.5 py-2.5 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                    placeholder="e.g. John Doe"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="w-full px-3.5 py-2.5 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                    placeholder="student@example.com"
                    required
                  />
                </div>

                {message && (
                  <div className={`p-3.5 rounded-xl text-sm font-medium flex items-center space-x-2 ${
                    isSuccess 
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
                      : 'bg-rose-50 text-rose-800 border border-rose-200'
                  }`}>
                    {isSuccess ? <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" /> : <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />}
                    <span>{message}</span>
                  </div>
                )}

                <div className="flex space-x-3 pt-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isRegistering || !faceImage}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2.5 px-4 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm flex items-center justify-center space-x-2 text-sm"
                  >
                    {isRegistering ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Training AI Model...</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        <span>Register & Train Face</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentRegistration;
