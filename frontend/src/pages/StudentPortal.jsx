import React, { useState, useEffect } from 'react';
import axios from '../api/axios';
import { User, Calendar, TrendingUp, AlertCircle, CheckCircle, Clock, BookOpen, Award } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { format } from 'date-fns';

const StudentPortal = () => {
  const [attendanceData, setAttendanceData] = useState([]);
  const [attentivenessData, setAttentivenessData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState('all');
  
  const { user } = useAuth();

  const fetchStudentData = async () => {
    try {
      setLoading(true);
      setError('');
      
      const [attendanceResponse, attentivenessResponse] = await Promise.all([
        axios.get('/api/student/attendance'),
        axios.get('/api/student/attentiveness')
      ]);
      
      setAttendanceData(attendanceResponse.data.attendance || []);
      setAttentivenessData(attentivenessResponse.data.attentiveness || []);
    } catch (error) {
      console.error('Failed to fetch student data:', error);
      setError('Failed to load your data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchStudentData();
    }
  }, [user]);

  const calculateAttendanceStats = () => {
    if (attendanceData.length === 0) return { total: 0, present: 0, percentage: 0 };
    
    const total = attendanceData.length;
    const present = attendanceData.filter(record => record.status === 'present').length;
    const percentage = total > 0 ? Math.round((present / total) * 100) : 0;
    
    return { total, present, percentage };
  };

  const calculateAttentivenessStats = () => {
    if (attentivenessData.length === 0) return { total: 0, attentive: 0, percentage: 0 };
    
    const total = attentivenessData.length;
    const attentive = attentivenessData.filter(record => record.is_attentive).length;
    const percentage = total > 0 ? Math.round((attentive / total) * 100) : 0;
    
    return { total, attentive, percentage };
  };

  const getCourseStats = () => {
    const courseMap = new Map();
    
    attendanceData.forEach(record => {
      const course = record.course_name || 'Unknown Course';
      if (!courseMap.has(course)) {
        courseMap.set(course, { total: 0, present: 0 });
      }
      courseMap.get(course).total++;
      if (record.status === 'present') {
        courseMap.get(course).present++;
      }
    });
    
    return Array.from(courseMap.entries()).map(([course, stats]) => ({
      course,
      ...stats,
      percentage: stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : 0
    }));
  };

  const attendanceStats = calculateAttendanceStats();
  const attentivenessStats = calculateAttentivenessStats();
  const courseStats = getCourseStats();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center">
                <User className="w-8 h-8 mr-3 text-blue-600" />
                Student Portal
              </h1>
              <p className="text-gray-600 mt-2">View your attendance and attentiveness reports</p>
            </div>
            <div className="text-sm text-gray-500 text-right">
              <div className="font-medium text-gray-900">{user?.name}</div>
              <div>PRN: {user?.prn}</div>
              <div>Student ID: {user?.student_number}</div>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Calendar className="w-6 h-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Total Classes</p>
                <p className="text-2xl font-bold text-gray-900">{attendanceStats.total}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-3 bg-green-100 rounded-lg">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Classes Attended</p>
                <p className="text-2xl font-bold text-gray-900">{attendanceStats.present}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-3 bg-purple-100 rounded-lg">
                <Award className="w-6 h-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Attendance Rate</p>
                <p className="text-2xl font-bold text-gray-900">{attendanceStats.percentage}%</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-3 bg-orange-100 rounded-lg">
                <TrendingUp className="w-6 h-6 text-orange-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Attentiveness</p>
                <p className="text-2xl font-bold text-gray-900">{attentivenessStats.percentage}%</p>
              </div>
            </div>
          </div>
        </div>

        {/* Course-wise Attendance */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <BookOpen className="w-5 h-5 mr-2" />
            Course-wise Attendance
          </h2>
          {courseStats.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <AlertCircle className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p>No attendance data available yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Course
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total Classes
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Attended
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Attendance Rate
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {courseStats.map((course, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <p className="text-sm font-medium text-gray-900">{course.course}</p>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <p className="text-sm text-gray-900">{course.total}</p>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <p className="text-sm text-gray-900">{course.present}</p>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-1 mr-2">
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div 
                                className={`h-2 rounded-full ${
                                  course.percentage >= 75 ? 'bg-green-500' : 
                                  course.percentage >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                                }`}
                                style={{ width: `${course.percentage}%` }}
                              ></div>
                            </div>
                          </div>
                          <span className="text-sm font-medium text-gray-900">{course.percentage}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Recent Attendance Records */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Calendar className="w-5 h-5 mr-2" />
              Recent Attendance
            </h2>
            {attendanceData.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <AlertCircle className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <p>No attendance records found</p>
              </div>
            ) : (
              <div className="space-y-3">
                {attendanceData.slice(0, 10).map((record, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">
                        {record.course_name || 'Unknown Course'}
                      </p>
                      <p className="text-sm text-gray-600">
                        {format(new Date(record.lecture_date), 'MMM dd, yyyy')}
                      </p>
                    </div>
                    <div className="flex items-center">
                      {record.status === 'present' ? (
                        <span className="flex items-center text-green-600">
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Present
                        </span>
                      ) : (
                        <span className="flex items-center text-red-600">
                          <AlertCircle className="w-4 h-4 mr-1" />
                          Absent
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <TrendingUp className="w-5 h-5 mr-2" />
              Recent Attentiveness
            </h2>
            {attentivenessData.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <AlertCircle className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <p>No attentiveness records found</p>
              </div>
            ) : (
              <div className="space-y-3">
                {attentivenessData.slice(0, 10).map((record, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">
                        {format(new Date(record.timestamp), 'MMM dd, yyyy HH:mm')}
                      </p>
                      <p className="text-sm text-gray-600">
                        EAR: {record.ear?.toFixed(3) || 'N/A'}
                      </p>
                    </div>
                    <div className="flex items-center">
                      {record.is_attentive ? (
                        <span className="flex items-center text-green-600">
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Attentive
                        </span>
                      ) : record.is_drowsy ? (
                        <span className="flex items-center text-orange-600">
                          <Clock className="w-4 h-4 mr-1" />
                          Drowsy
                        </span>
                      ) : (
                        <span className="flex items-center text-red-600">
                          <AlertCircle className="w-4 h-4 mr-1" />
                          Distracted
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Performance Summary */}
        <div className="bg-white rounded-lg shadow p-6 mt-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Performance Summary</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600 mb-2">{attendanceStats.percentage}%</div>
              <p className="text-gray-600">Overall Attendance</p>
              <div className="mt-2">
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  attendanceStats.percentage >= 75 ? 'bg-green-100 text-green-800' :
                  attendanceStats.percentage >= 50 ? 'bg-yellow-100 text-yellow-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {attendanceStats.percentage >= 75 ? 'Excellent' :
                   attendanceStats.percentage >= 50 ? 'Good' : 'Needs Improvement'}
                </span>
              </div>
            </div>
            
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-600 mb-2">{attentivenessStats.percentage}%</div>
              <p className="text-gray-600">Class Attentiveness</p>
              <div className="mt-2">
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  attentivenessStats.percentage >= 75 ? 'bg-green-100 text-green-800' :
                  attentivenessStats.percentage >= 50 ? 'bg-yellow-100 text-yellow-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {attentivenessStats.percentage >= 75 ? 'Very Focused' :
                   attentivenessStats.percentage >= 50 ? 'Moderately Focused' : 'Needs More Focus'}
                </span>
              </div>
            </div>
            
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600 mb-2">
                {Math.round((attendanceStats.percentage + attentivenessStats.percentage) / 2)}%
              </div>
              <p className="text-gray-600">Overall Score</p>
              <div className="mt-2">
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  (attendanceStats.percentage + attentivenessStats.percentage) / 2 >= 75 ? 'bg-green-100 text-green-800' :
                  (attendanceStats.percentage + attentivenessStats.percentage) / 2 >= 50 ? 'bg-yellow-100 text-yellow-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {(attendanceStats.percentage + attentivenessStats.percentage) / 2 >= 75 ? 'Outstanding' :
                   (attendanceStats.percentage + attentivenessStats.percentage) / 2 >= 50 ? 'Good' : 'Room for Growth'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentPortal;
