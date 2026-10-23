import React, { useState, useRef } from 'react';
import Webcam from 'react-webcam';
import { Camera, UserPlus, Save, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';
import api from '../api/axios';

const StudentRegistration = ({ onStudentAdded, onClose }) => {
  const webcamRef = useRef(null);
  const [formData, setFormData] = useState({
    student_id: '',
    prn: '',
    name: '',
    email: ''
  });

  // Generate unique suggestions
  const generateStudentId = () => {
    const timestamp = Date.now().toString().slice(-4);
    return `STU${timestamp}`;
  };

  const generatePRN = () => {
    const timestamp = Date.now().toString().slice(-4);
    return `8${timestamp}`;
  };

  const useSuggestedIds = () => {
    setFormData({
      ...formData,
      student_id: generateStudentId(),
      prn: generatePRN()
    });
  };
  const [faceImage, setFaceImage] = useState(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [message, setMessage] = useState('');
  const [cameraError, setCameraError] = useState(false);

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const captureFace = () => {
    if (webcamRef.current) {
      const imageSrc = webcamRef.current.getScreenshot();
      if (imageSrc) {
        setFaceImage(imageSrc);
        setMessage('Face captured successfully!');
        setTimeout(() => setMessage(''), 3000);
      }
    }
  };

  const retakePhoto = () => {
    setFaceImage(null);
    setMessage('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    console.log('=== Student Registration Submit ===');
    console.log('Face Image:', faceImage ? 'Captured' : 'Not captured');
    console.log('Form Data:', formData);
    
    // Check each validation step and log it
    if (!faceImage) {
      console.log('❌ Validation failed: No face image');
      setMessage('Please capture student face first');
      return;
    }

    if (!formData.student_id || !formData.prn || !formData.name || !formData.email) {
      console.log('❌ Validation failed: Missing required fields');
      console.log('Missing fields:', {
        student_id: !formData.student_id,
        prn: !formData.prn,
        name: !formData.name,
        email: !formData.email
      });
      setMessage('Please fill all required fields');
      return;
    }

    // Check for duplicate student ID format
    if (formData.student_id.startsWith('STU') && formData.student_id.length <= 4) {
      const existingIds = ['STU001', 'STU002', 'STU003'];
      if (existingIds.includes(formData.student_id)) {
        console.log('❌ Validation failed: Duplicate Student ID');
        setMessage(`Student ID ${formData.student_id} already exists. Please use a different ID.`);
        return;
      }
    }
    
    console.log('✅ All validations passed');

    setIsRegistering(true);
    setMessage('');

    try {
      console.log('Processing face image...');
      
      // Convert base64 image to binary data
      const base64Data = faceImage.split(',')[1];
      console.log('Base64 data length:', base64Data.length);
      
      const binaryData = atob(base64Data);
      console.log('Binary data length:', binaryData.length);
      
      const arrayBuffer = new ArrayBuffer(binaryData.length);
      const uint8Array = new Uint8Array(arrayBuffer);
      for (let i = 0; i < binaryData.length; i++) {
        uint8Array[i] = binaryData.charCodeAt(i);
      }

      const requestData = {
        ...formData,
        face_encoding: Array.from(uint8Array) // Convert to array for JSON serialization
      };
      
      console.log('Request data keys:', Object.keys(requestData));
      console.log('Face encoding length:', requestData.face_encoding.length);
      console.log('Token exists:', !!localStorage.getItem('token'));
      console.log('Token starts with Bearer:', localStorage.getItem('token')?.startsWith('Bearer'));
      
      const token = localStorage.getItem('token');
      if (!token) {
        console.log('❌ No token found');
        setMessage('❌ No authentication token found. Please login again.');
        setIsRegistering(false);
        return;
      }

      console.log('🚀 Sending API request...');
      const response = await api.post('/api/teacher/add-student', requestData);
      
      console.log('📡 Response received:', response.status);

      const result = response.data;

      console.log('Response status:', response.status);
      console.log('Response data:', result);

      if (response.status === 201) {
        setMessage('Student registered successfully!');
        setTimeout(() => {
          onStudentAdded();
          onClose();
        }, 2000);
      } else {
        console.error('Registration failed:', result);
        const errorMsg = result.message || 'Failed to register student';
        
        // Provide helpful guidance for common errors
        if (errorMsg.includes('Student ID already exists')) {
          setMessage('❌ Student ID already exists. Click "Generate unique Student ID & PRN" for unique IDs.');
        } else if (errorMsg.includes('PRN already exists')) {
          setMessage('❌ PRN already exists. Click "Generate unique Student ID & PRN" for unique IDs.');
        } else {
          setMessage(`❌ ${errorMsg}`);
        }
      }
    } catch (error) {
      console.error('Registration error:', error);
      setMessage('Failed to register student. Please try again.');
    } finally {
      setIsRegistering(false);
    }
  };

  const videoConstraints = {
    width: 640,
    height: 480,
    facingMode: "user"
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900 flex items-center">
              <UserPlus className="w-6 h-6 mr-2 text-blue-600" />
              Register New Student
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Face Capture Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                <Camera className="w-5 h-5 mr-2" />
                Face Capture
              </h3>
              
              {!faceImage ? (
                <div className="space-y-4">
                  <div className="relative bg-gray-900 rounded-lg overflow-hidden">
                    <Webcam
                      audio={false}
                      ref={webcamRef}
                      screenshotFormat="image/jpeg"
                      constraints={videoConstraints}
                      className="w-full h-auto"
                      onUserMediaError={() => setCameraError(true)}
                      onUserMedia={() => setCameraError(false)}
                    />
                    
                    {/* Visual overlay */}
                    <div className="absolute inset-0 pointer-events-none">
                      <div className="absolute top-4 left-4 w-8 h-8 border-t-2 border-l-2 border-white/40 rounded-tl-lg"></div>
                      <div className="absolute top-4 right-4 w-8 h-8 border-t-2 border-r-2 border-white/40 rounded-tr-lg"></div>
                      <div className="absolute bottom-4 left-4 w-8 h-8 border-b-2 border-l-2 border-white/40 rounded-bl-lg"></div>
                      <div className="absolute bottom-4 right-4 w-8 h-8 border-b-2 border-r-2 border-white/40 rounded-br-lg"></div>
                    </div>
                  </div>
                  
                  {cameraError && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                      <AlertCircle className="w-4 h-4 inline mr-2" />
                      Camera access denied. Please allow camera permissions.
                    </div>
                  )}
                  
                  <button
                    onClick={captureFace}
                    disabled={cameraError}
                    className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
                  >
                    <Camera className="w-4 h-4 mr-2" />
                    Capture Face
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="relative">
                    <img 
                      src={faceImage} 
                      alt="Captured face" 
                      className="w-full rounded-lg border-2 border-green-500"
                    />
                    <div className="absolute top-2 right-2 bg-green-500 text-white p-2 rounded-full">
                      <CheckCircle className="w-4 h-4" />
                    </div>
                  </div>
                  
                  <button
                    onClick={retakePhoto}
                    className="w-full bg-gray-600 text-white py-3 px-4 rounded-lg hover:bg-gray-700 transition-colors flex items-center justify-center"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Retake Photo
                  </button>
                </div>
              )}
            </div>

            {/* Student Information Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Student Information
              </h3>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="text-sm text-gray-600">
                    <span className="font-medium">Need unique IDs?</span>
                    <button
                      type="button"
                      onClick={useSuggestedIds}
                      className="ml-2 text-blue-600 hover:text-blue-800 underline"
                    >
                      Generate unique Student ID & PRN
                    </button>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Student ID *
                  </label>
                  <input
                    type="text"
                    name="student_id"
                    value={formData.student_id}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., STU001"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    PRN (Permanent Registration Number) *
                  </label>
                  <input
                    type="text"
                    name="prn"
                    value={formData.prn}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., 2024001"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Student's full name"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="student@example.com"
                    required
                  />
                </div>

                {message && (
                  <div className={`p-4 rounded-lg text-sm ${
                    message.includes('success') 
                      ? 'bg-green-50 text-green-700 border border-green-200' 
                      : 'bg-red-50 text-red-700 border border-red-200'
                  }`}>
                    {message}
                  </div>
                )}

                <div className="flex space-x-3">
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isRegistering || !faceImage}
                    className="flex-1 bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
                  >
                    {isRegistering ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        Registering...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        Register Student
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
