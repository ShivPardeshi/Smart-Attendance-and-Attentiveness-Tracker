import React, { useState } from 'react';

const SimpleStudentTest = () => {
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const testStudentRegistration = async () => {
    setLoading(true);
    setMessage('');

    try {
      // Check if token exists
      const token = localStorage.getItem('token');
      if (!token) {
        setMessage('❌ No authentication token found. Please login again.');
        return;
      }

      const testData = {
        student_id: 'STU999',
        prn: '2024999',
        name: 'Test Student',
        email: 'test999@test.com',
        face_encoding: [1, 2, 3, 4, 5]
      };

      console.log('Sending test request:', testData);
      console.log('Token exists:', !!token);
      console.log('Token length:', token.length);

      const response = await fetch('/api/teacher/add-student', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(testData)
      });

      console.log('Response status:', response.status);
      console.log('Response headers:', response.headers);
      
      const result = await response.json();
      console.log('Response data:', result);

      if (response.ok) {
        setMessage(`✅ Test successful! Student registered. ID: ${result.student_id}`);
      } else {
        setMessage(`❌ API Error (${response.status}): ${result.message}`);
      }
    } catch (error) {
      console.error('Test error:', error);
      setMessage(`❌ Network Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow">
      <h3 className="text-lg font-bold mb-4">Student Registration Test</h3>
      
      <button
        onClick={testStudentRegistration}
        disabled={loading}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? 'Testing...' : 'Test Registration'}
      </button>
      
      {message && (
        <div className="mt-4 p-3 rounded bg-gray-100 text-sm">
          {message}
        </div>
      )}
      
      <div className="mt-4 text-xs text-gray-600">
        <p>Check browser console (F12) for detailed logs</p>
      </div>
    </div>
  );
};

export default SimpleStudentTest;
