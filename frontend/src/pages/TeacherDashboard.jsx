import React, { useState, useEffect } from 'react';
import axios from '../api/axios';
import { Calendar, Clock, Users, Camera, Plus, Play, Pause, BookOpen, UserPlus, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import StudentRegistration from '../components/StudentRegistration';
import SimpleStudentTest from '../components/SimpleStudentTest';
import QuickTest from '../components/QuickTest';
import LectureMonitoring from '../components/LectureMonitoring';

const TeacherDashboard = () => {
  const [currentLecture, setCurrentLecture] = useState(null);
  const [timetables, setTimetables] = useState([]);
  const [students, setStudents] = useState([]);
  const [showTimetableForm, setShowTimetableForm] = useState(false);
  const [showStudentRegistration, setShowStudentRegistration] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const [showLectureMonitoring, setShowLectureMonitoring] = useState(false);
  
  const [timetableForm, setTimetableForm] = useState({
    course_name: '',
    course_code: '',
    day_of_week: 'Monday',
    start_time: '',
    end_time: '',
    classroom: ''
  });
  
  const { user } = useAuth();

  const fetchCurrentLecture = async () => {
    try {
      const response = await axios.get('/api/teacher/current-lecture');
      console.log('Current lecture response:', response);
      console.log('Response data:', response.data);
      console.log('Response status:', response.status);
      console.log('Response status text:', response.statusText);
      console.log('Response headers:', response.headers);
      console.log('Response config:', response.config);
      console.log('Lecture data:', response.data.lecture);
      console.log('Type of lecture data:', typeof response.data.lecture);
      console.log('Keys in response.data:', Object.keys(response.data));
      setCurrentLecture(response.data.lecture);
    } catch (error) {
      console.error('Failed to fetch current lecture:', error);
      console.error('Error response:', error.response);
      console.error('Error response data:', error.response.data);
      console.error('Error response status:', error.response.status);
      console.error('Error response status text:', error.response.statusText);
      console.error('Error response headers:', error.response.headers);
    }
  };

  const fetchTimetables = async () => {
    try {
      const response = await axios.get('/api/teacher/timetables');
      setTimetables(response.data.timetables || []);
    } catch (error) {
      console.error('Failed to fetch timetables:', error);
    }
  };

  const fetchStudents = async () => {
    try {
      const response = await axios.get('/api/teacher/students');
      setStudents(response.data.students || []);
    } catch (error) {
      console.error('Failed to fetch students:', error);
    }
  };

  useEffect(() => {
    fetchCurrentLecture();
    fetchTimetables();
    fetchStudents();
    
    // Check for current lecture every minute
    const interval = setInterval(fetchCurrentLecture, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleCreateTimetable = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const response = await axios.post('/api/teacher/timetable', timetableForm);
      setMessage('Timetable created successfully!');
      setTimetableForm({
        course_name: '',
        course_code: '',
        day_of_week: 'Monday',
        start_time: '',
        end_time: '',
        classroom: ''
      });
      setShowTimetableForm(false);
      fetchTimetables();
    } catch (error) {
      setMessage(error.response?.data?.message || 'Failed to create timetable');
    } finally {
      setLoading(false);
    }
  };

  const startMonitoring = async () => {
    // Try to start monitoring for current lecture first
    if (currentLecture) {
      try {
        await axios.post(`/api/teacher/start-lecture/${currentLecture.id}`);
        setCameraActive(true);
        setShowLectureMonitoring(true);
        setMessage('Camera monitoring started!');
        fetchCurrentLecture();
        return;
      } catch (error) {
        console.error('Failed to start monitoring for current lecture:', error);
        setMessage('Failed to start monitoring. Please try again.');
      }
    }
    
    // If no current lecture, check for upcoming lectures
    try {
      const timetablesResponse = await axios.get('/api/teacher/timetables');
      const studentsResponse = await axios.get('/api/teacher/students');
      
      if (!studentsResponse.data.students || studentsResponse.data.students.length === 0) {
        setMessage('No students registered. Please register students first.');
        return;
      }
      
      if (!timetablesResponse.data.timetables || timetablesResponse.data.timetables.length === 0) {
        setMessage('No timetables found. Please create a timetable entry first.');
        return;
      }
      
      // Check if there are any timetables for today
      const currentTime = new Date();
      const currentDay = currentTime.toLocaleDateString('en-US', { weekday: 'long' });
      const currentTimeStr = currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
      
      const todayTimetables = timetablesResponse.data.timetables.filter(t => t.day_of_week === currentDay);
      
      if (todayTimetables.length === 0) {
        setMessage(`No timetables found for ${currentDay}. Please create a timetable entry for today.`);
        return;
      }
      
      // Find upcoming timetables
      const upcomingTimetables = todayTimetables.filter(t => t.start_time > currentTimeStr);
      
      if (upcomingTimetables.length > 0) {
        const nextLecture = upcomingTimetables[0];
        setMessage(`Next lecture: ${nextLecture.course_name} at ${nextLecture.start_time}. You can start monitoring when it begins.`);
        return;
      }
      
      // If we get here, there are timetables but none are current or upcoming
      setMessage('All scheduled lectures for today have ended. Please create a new timetable entry for the current time.');
      
    } catch (error) {
      setMessage('Failed to check timetables. Please try again.');
    }
  };

  const stopMonitoring = () => {
    setCameraActive(false);
    setShowLectureMonitoring(false);
    setMessage('Camera monitoring stopped');
  };

  const handleStopLectureMonitoring = () => {
    setShowLectureMonitoring(false);
    setCameraActive(false);
    setMessage('Lecture monitoring stopped successfully');
  };

  const getCurrentTime = () => {
    return new Date().toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const getCurrentDay = () => {
    return new Date().toLocaleDateString('en-US', { weekday: 'long' });
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center">
                <BookOpen className="w-8 h-8 mr-3 text-blue-600" />
                Teacher Dashboard
              </h1>
              <p className="text-gray-600 mt-2">Manage your classes and monitor student engagement</p>
            </div>
            <div className="text-sm text-gray-500">
              <div>{getCurrentDay()}, {getCurrentTime()}</div>
              <div>Logged in as: <span className="font-medium text-gray-900">{user?.name}</span></div>
            </div>
          </div>
        </div>

        {/* Current Lecture Status */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center">
              <Camera className="w-5 h-5 mr-2" />
              Current Lecture Status
            </h2>
            {currentLecture && (
              <div className="flex items-center space-x-2">
                <button
                  onClick={cameraActive ? stopMonitoring : startMonitoring}
                  className={`px-4 py-2 rounded-lg transition-colors flex items-center ${
                    cameraActive 
                      ? 'bg-red-600 hover:bg-red-700 text-white' 
                      : 'bg-green-600 hover:bg-green-700 text-white'
                  }`}
                >
                  {cameraActive ? (
                    <>
                      <Pause className="w-4 h-4 mr-2" />
                      Stop Monitoring
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 mr-2" />
                      Start Monitoring
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
          
          {currentLecture ? (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-blue-900">{currentLecture.course_name}</h3>
                  <p className="text-blue-700 text-sm">
                    {currentLecture.start_time} - {currentLecture.end_time} • Status: {currentLecture.status}
                  </p>
                </div>
                <div className="flex items-center">
                  {cameraActive && (
                    <div className="flex items-center text-green-600">
                      <div className="w-2 h-2 bg-green-600 rounded-full mr-2 animate-pulse"></div>
                      Monitoring Active
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <AlertCircle className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p>No lecture scheduled at this time</p>
              <p className="text-sm">Check your timetable below for scheduled classes</p>
            </div>
          )}
          
          {/* Lecture Monitoring Component */}
          {showLectureMonitoring && currentLecture && (
            <LectureMonitoring 
              lecture={currentLecture} 
              onStopMonitoring={handleStopLectureMonitoring}
            />
          )}
          
          {message && (
            <div className={`mt-4 p-4 rounded-lg ${message.includes('success') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              {message}
            </div>
          )}
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Total Students</p>
                <p className="text-2xl font-bold text-gray-900">{students.length}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-3 bg-green-100 rounded-lg">
                <Calendar className="w-6 h-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Classes Today</p>
                <p className="text-2xl font-bold text-gray-900">
                  {timetables.filter(t => t.day_of_week === getCurrentDay()).length}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-3 bg-purple-100 rounded-lg">
                <Clock className="w-6 h-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Weekly Classes</p>
                <p className="text-2xl font-bold text-gray-900">{timetables.length}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-3 bg-orange-100 rounded-lg">
                <Camera className="w-6 h-6 text-orange-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Camera Status</p>
                <p className="text-2xl font-bold text-gray-900">
                  {cameraActive ? 'Active' : 'Inactive'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
            <div className="space-y-3">
              <button
                onClick={() => setShowTimetableForm(!showTimetableForm)}
                className="w-full bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Timetable Entry
              </button>
              <button
                onClick={() => setShowStudentRegistration(true)}
                className="w-full bg-green-600 text-white px-4 py-3 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center"
              >
                <UserPlus className="w-4 h-4 mr-2" />
                Register New Student
              </button>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Debug Test</h3>
            <SimpleStudentTest />
          </div>
          
          <QuickTest />
          
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Today's Schedule</h3>
            <div className="space-y-2">
              {timetables.filter(t => t.day_of_week === getCurrentDay()).length === 0 ? (
                <p className="text-gray-500 text-center py-4">No classes scheduled today</p>
              ) : (
                timetables
                  .filter(t => t.day_of_week === getCurrentDay())
                  .sort((a, b) => a.start_time.localeCompare(b.start_time))
                  .map((timetable, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium text-gray-900">{timetable.course_name}</p>
                        <p className="text-sm text-gray-600">{timetable.start_time} - {timetable.end_time}</p>
                      </div>
                      <span className="text-sm text-gray-500">{timetable.classroom}</span>
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>

        {/* Forms */}
        {showTimetableForm && (
          <div className="bg-white rounded-lg shadow p-6 mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Add Timetable Entry</h3>
            <form onSubmit={handleCreateTimetable} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Course Name</label>
                  <input
                    type="text"
                    value={timetableForm.course_name}
                    onChange={(e) => setTimetableForm({...timetableForm, course_name: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., Mathematics"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Course Code</label>
                  <input
                    type="text"
                    value={timetableForm.course_code}
                    onChange={(e) => setTimetableForm({...timetableForm, course_code: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., MATH101"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Day of Week</label>
                  <select
                    value={timetableForm.day_of_week}
                    onChange={(e) => setTimetableForm({...timetableForm, day_of_week: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    <option value="Monday">Monday</option>
                    <option value="Tuesday">Tuesday</option>
                    <option value="Wednesday">Wednesday</option>
                    <option value="Thursday">Thursday</option>
                    <option value="Friday">Friday</option>
                    <option value="Saturday">Saturday</option>
                    <option value="Sunday">Sunday</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Classroom</label>
                  <input
                    type="text"
                    value={timetableForm.classroom}
                    onChange={(e) => setTimetableForm({...timetableForm, classroom: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., Room 101"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Start Time</label>
                  <input
                    type="time"
                    value={timetableForm.start_time}
                    onChange={(e) => setTimetableForm({...timetableForm, start_time: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">End Time</label>
                  <input
                    type="time"
                    value={timetableForm.end_time}
                    onChange={(e) => setTimetableForm({...timetableForm, end_time: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowTimetableForm(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {loading ? 'Creating...' : 'Create Timetable'}
                </button>
              </div>
            </form>
          </div>
        )}

        </div>
      
      {/* Student Registration Modal */}
      {showStudentRegistration && (
        <StudentRegistration
          onStudentAdded={() => {
            setShowStudentRegistration(false);
            fetchStudents();
          }}
          onClose={() => setShowStudentRegistration(false)}
        />
      )}
    </div>
  );
};

export default TeacherDashboard;
