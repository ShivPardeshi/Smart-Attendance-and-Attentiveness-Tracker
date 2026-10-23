import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Box, Github, Twitter, Heart } from 'lucide-react';
import './index.css';

import { AuthProvider, useAuth } from './contexts/AuthContext';
import LoginPage from './pages/LoginPage';
import AdminPanel from './pages/AdminPanel';
import TeacherDashboard from './pages/TeacherDashboard';
import StudentPortal from './pages/StudentPortal';
import LiveDashboard from './pages/LiveDashboard';

function AppContent() {
    const { isAuthenticated, user, logout } = useAuth();

    if (!isAuthenticated) {
        return <LoginPage />;
    }

    return (
        <div className="min-h-screen w-full flex flex-col bg-[#FAFAFB] text-[#111827] selection:bg-blue-100/60 selection:text-blue-900">

            {/* Header */}
            <header className="w-full bg-white border-b border-gray-200 shadow-sm sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">

                    {/* Logo & Branding */}
                    <div className="flex items-center space-x-3">
                        <div className="p-1.5 bg-gradient-to-tr from-blue-600 to-blue-500 text-white rounded-lg shadow-[0_2px_8px_rgba(37,99,235,0.25)] ring-1 ring-black/5 transition-transform hover:scale-105">
                            <Box size={20} strokeWidth={2.5} />
                        </div>
                        <h1 className="text-xl font-bold tracking-tight text-gray-900 leading-none">
                            SmartClass <span className="text-blue-600 font-extrabold text-xs align-super ml-0.5">PRO</span>
                        </h1>
                    </div>

                    {/* User Info & Logout */}
                    <div className="flex items-center space-x-4">
                        <div className="hidden sm:flex items-center">
                            <span className="text-sm text-gray-600">Welcome, </span>
                            <span className="text-sm font-medium text-gray-900 ml-1">{user?.name}</span>
                            <span className="text-xs text-gray-500 ml-2 bg-gray-100 px-2 py-1 rounded">
                                {user?.role?.charAt(0).toUpperCase() + user?.role?.slice(1)}
                            </span>
                        </div>
                        <button
                            onClick={logout}
                            className="px-3 py-1 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
                        >
                            Logout
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 w-full">
                <Routes>
                    <Route path="/" element={<Navigate to={`/${user?.role}`} replace />} />
                    <Route path="/admin" element={user?.role === 'admin' ? <AdminPanel /> : <Navigate to={`/${user?.role}`} replace />} />
                    <Route path="/teacher" element={user?.role === 'teacher' ? <TeacherDashboard /> : <Navigate to={`/${user?.role}`} replace />} />
                    <Route path="/student" element={user?.role === 'student' ? <StudentPortal /> : <Navigate to={`/${user?.role}`} replace />} />
                    <Route path="/live" element={<LiveDashboard />} />
                    <Route path="*" element={<Navigate to={`/${user?.role}`} replace />} />
                </Routes>
            </main>

            {/* Footer */}
            <footer className="w-full bg-white border-t border-gray-200 mt-auto">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
                        <div className="flex items-center space-x-2">
                            <Box size={18} className="text-blue-600" />
                            <span className="text-sm font-semibold text-gray-900">SmartClass Tracker</span>
                            <span className="text-gray-300 px-2">|</span>
                            <span className="text-xs text-gray-500">© 2026 Vision Systems Inc. All rights reserved.</span>
                        </div>

                        <div className="flex items-center space-x-6">
                            <a href="#" className="text-gray-400 hover:text-blue-500 transition-colors">
                                <span className="sr-only">GitHub</span>
                                <Github size={18} />
                            </a>
                            <a href="#" className="text-gray-400 hover:text-blue-400 transition-colors">
                                <span className="sr-only">Twitter</span>
                                <Twitter size={18} />
                            </a>
                            <span className="text-xs text-gray-400 flex items-center font-medium bg-gray-50 px-2 py-1 rounded-md border border-gray-100">
                                Built with <Heart size={12} className="text-red-500 mx-1 fill-current" /> by Deepmind
                            </span>
                        </div>
                    </div>
                </div>
            </footer>

        </div>
    );
}

function App() {
    return (
        <AuthProvider>
            <Router>
                <AppContent />
            </Router>
        </AuthProvider>
    );
}

export default App;
