import React from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom';
import { Camera, LayoutDashboard, UserPlus, ShieldCheck, Box, LogOut, Github, Twitter, Heart } from 'lucide-react';
import './index.css';

import AdminPanel from './pages/AdminPanel';
import LiveDashboard from './pages/LiveDashboard';

function App() {
    return (
        <Router>
            <div className="min-h-screen w-full flex flex-col bg-[#FAFAFB] text-[#111827] selection:bg-blue-100/60 selection:text-blue-900">

                {/* Proprietary SaaS Header */}
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

                        {/* Top Navigation Links */}
                        <nav className="hidden md:flex items-center space-x-1">
                            <NavLink
                                to="/"
                                className={({ isActive }) =>
                                    `px-4 py-2 rounded-md transition-all duration-200 font-medium text-sm flex items-center ${isActive ? 'bg-blue-50 text-blue-700 shadow-[0_1px_2px_rgba(0,0,0,0.02)] ring-1 ring-blue-100' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                                    }`
                                }
                            >
                                <LayoutDashboard className="mr-2" size={16} />
                                Live Monitor
                            </NavLink>

                            <NavLink
                                to="/admin"
                                className={({ isActive }) =>
                                    `px-4 py-2 rounded-md transition-all duration-200 font-medium text-sm flex items-center ${isActive ? 'bg-blue-50 text-blue-700 shadow-[0_1px_2px_rgba(0,0,0,0.02)] ring-1 ring-blue-100' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                                    }`
                                }
                            >
                                <UserPlus className="mr-2" size={16} />
                                Enrollment
                            </NavLink>
                        </nav>

                        {/* User Profile / Status */}
                        <div className="flex items-center space-x-4">
                            <div className="hidden sm:flex items-center border border-gray-200 bg-gray-50 rounded-full px-3 py-1 shadow-sm">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 mr-2 animate-pulse"></span>
                                <span className="text-[11px] font-bold text-gray-600 uppercase tracking-widest">Engine Online</span>
                            </div>
                            <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold border border-blue-200 cursor-pointer hover:bg-blue-200 transition-colors">
                                SA
                            </div>
                        </div>
                    </div>
                </header>

                {/* Main Content Frame with Animation Wrapper */}
                <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative">
                    <div className="absolute top-0 left-0 w-full h-[300px] bg-gradient-to-b from-blue-50/50 to-transparent pointer-events-none -z-10" />

                    <div className="h-full animate-fade-in">
                        <Routes>
                            <Route path="/" element={<LiveDashboard />} />
                            <Route path="/admin" element={<AdminPanel />} />
                        </Routes>
                    </div>
                </main>

                {/* Professional SaaS Footer */}
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
        </Router>
    );
}

export default App;
