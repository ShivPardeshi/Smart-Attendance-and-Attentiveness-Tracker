import React, { useState } from 'react';

const QuickTest = () => {
  const [result, setResult] = useState('');

  const runQuickTest = async () => {
    setResult('Testing...');
    
    try {
      // Check token first
      const token = localStorage.getItem('token');
      if (!token) {
        setResult('❌ No token found. Please login again.');
        return;
      }
      
      console.log('Token found:', token.substring(0, 50) + '...');
      
      // Test 1: Check if we can reach the API
      const authResponse = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      
      console.log('Auth response status:', authResponse.status);
      
      if (authResponse.ok) {
        const authData = await authResponse.json();
        setResult(`✅ Auth working! User: ${authData.user.name} (${authData.user.role})`);
        
        // Test 2: Try student registration
        const studentResponse = await fetch('/api/teacher/add-student', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            student_id: 'QUICK' + Date.now(),
            prn: '9' + Date.now(),
            name: 'Quick Test',
            email: 'quick' + Date.now() + '@test.com',
            face_encoding: [1,2,3]
          })
        });
        
        // Check if response is JSON
        const contentType = studentResponse.headers.get('content-type');
        console.log('Response content-type:', contentType);
        console.log('Response status:', studentResponse.status);
        
        let studentData;
        try {
          studentData = await studentResponse.json();
        } catch (jsonError) {
          // If JSON parsing fails, get the response as text
          const responseText = await studentResponse.text();
          console.log('Response text (first 200 chars):', responseText.substring(0, 200));
          setResult(`❌ API returned non-JSON response (${studentResponse.status}): ${responseText.substring(0, 100)}...`);
          return;
        }
        
        if (studentResponse.ok) {
          setResult(`✅ Student registration working! Student ID: ${studentData.student_id}`);
        } else {
          setResult(`❌ Student registration failed: ${studentData.message}`);
        }
      } else {
        const errorText = await authResponse.text();
        console.log('Auth error response:', errorText);
        setResult(`❌ Authentication failed (${authResponse.status}): ${errorText.substring(0, 100)}...`);
      }
    } catch (error) {
      console.error('Test error:', error);
      setResult(`❌ Network error: ${error.message}`);
    }
  };

  return (
    <div className="p-4 bg-yellow-50 border border-yellow-200 rounded">
      <h4 className="font-bold mb-2">Quick Diagnostic Test</h4>
      <button 
        onClick={runQuickTest}
        className="px-3 py-1 bg-yellow-600 text-white rounded text-sm"
      >
        Run Test
      </button>
      {result && (
        <div className="mt-2 p-2 bg-white rounded text-sm">
          {result}
        </div>
      )}
    </div>
  );
};

export default QuickTest;
