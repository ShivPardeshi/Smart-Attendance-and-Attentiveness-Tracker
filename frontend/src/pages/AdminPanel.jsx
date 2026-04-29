import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import Webcam from 'react-webcam';
import { Camera, UserPlus, Save, Users, RefreshCw, Fingerprint, Search } from 'lucide-react';

const API_BASE = 'http://localhost:8000/api';

function AdminPanel() {
    const webcamRef = useRef(null);
    const [name, setName] = useState('');
    const [students, setStudents] = useState([]);
    const [statusMsg, setStatusMsg] = useState('');
    const [isRegistering, setIsRegistering] = useState(false);

    const fetchStudents = async () => {
        try {
            const res = await axios.get(`${API_BASE}/students`);
            setStudents(res.data.students || []);
        } catch (err) {
            console.error("Failed to fetch students:", err);
        }
    };

    useEffect(() => {
        fetchStudents();
    }, []);

    const captureAndRegister = async () => {
        if (!name.trim()) {
            setStatusMsg('Please enter a valid student name.');
            return;
        }

        setStatusMsg('');
        setIsRegistering(true);

        const imageSrc = webcamRef.current.getScreenshot();
        if (!imageSrc) {
            setStatusMsg('Capture fault. Device may be in use.');
            setIsRegistering(false);
            return;
        }

        try {
            const response = await axios.post(`${API_BASE}/register`, {
                name: name.trim(),
                image: imageSrc
            });
            setStatusMsg(response.data.message || 'Identity encoded successfully.');
            setName('');
            fetchStudents(); // refresh the list
        } catch (error) {
            console.error(error);
            setStatusMsg(error.response?.data?.content || error.response?.data || 'Encoding failed. Verify lighting conditions.');
        } finally {
            setIsRegistering(false);
        }
    };

    return (
        <div className="flex flex-col h-full space-y-6">
            <header className="flex justify-between items-end pb-4 border-b border-gray-200">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-gray-900">Identity Enrollment</h1>
                    <p className="text-sm text-gray-500 font-medium tracking-wide mt-1">Register deep-learning features for specific subjects</p>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 flex-1">
                {/* Left Col - Registration Form */}
                <div className="lg:col-span-7 saas-card p-8 space-y-6">
                    <div className="saas-card-header pb-5 border-gray-100">
                        <h2 className="text-[13px] font-black uppercase tracking-widest text-gray-500 flex items-center">
                            <Fingerprint size={14} className="mr-2 text-blue-600" />
                            Biometric Capture
                        </h2>
                    </div>

                    <div className="bg-gray-50 rounded-2xl overflow-hidden border border-gray-200 relative flex justify-center min-h-[300px] shadow-[inset_0_2px_12px_rgba(0,0,0,0.03)] p-1">
                        <div className="w-full h-full relative overflow-hidden rounded-xl bg-black">
                            <Webcam
                                audio={false}
                                ref={webcamRef}
                                screenshotFormat="image/jpeg"
                                className="w-full h-full object-cover opacity-90"
                                videoConstraints={{ facingMode: "user" }}
                            />
                            {/* Visual bracket UI overlays */}
                            <div className="absolute top-4 left-4 w-6 h-6 border-t-2 border-l-2 border-white/40 rounded-tl-lg"></div>
                            <div className="absolute top-4 right-4 w-6 h-6 border-t-2 border-r-2 border-white/40 rounded-tr-lg"></div>
                            <div className="absolute bottom-4 left-4 w-6 h-6 border-b-2 border-l-2 border-white/40 rounded-bl-lg"></div>
                            <div className="absolute bottom-4 right-4 w-6 h-6 border-b-2 border-r-2 border-white/40 rounded-br-lg"></div>
                        </div>
                    </div>

                    <div className="space-y-5 pt-2">
                        <div>
                            <label className="saas-label">Legal Subject Name</label>
                            <div className="relative">
                                <Search size={16} className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-gray-400" />
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="Enter full unique identifier..."
                                    className="saas-input pl-10 h-12 text-[15px] font-medium"
                                />
                            </div>
                        </div>

                        {statusMsg && (
                            <div className={`p-4 rounded-xl text-[13px] font-semibold flex items-center ${statusMsg.includes('Success') || statusMsg.includes('encoded') ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
                                <div className={`w-1.5 h-1.5 rounded-full mr-2 ${statusMsg.includes('Success') || statusMsg.includes('encoded') ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
                                {statusMsg}
                            </div>
                        )}

                        <button
                            onClick={captureAndRegister}
                            disabled={isRegistering || !name.trim()}
                            className="w-full btn-primary h-12 text-[14px] mt-2 shadow-[0_4px_14px_rgba(37,99,235,0.3)] hover:shadow-[0_6px_20px_rgba(37,99,235,0.4)]"
                        >
                            {isRegistering ? (
                                <><RefreshCw className="mr-2 animate-spin" size={18} /> Processing Spatial Data...</>
                            ) : (
                                <><Save className="mr-2" size={18} /> Enroll to Database</>
                            )}
                        </button>
                    </div>
                </div>

                {/* Right Col - Enrolled Directory */}
                <div className="lg:col-span-5 saas-card flex flex-col h-full bg-subtle-pattern p-0">
                    <div className="saas-card-header px-6 py-6 border-gray-100 bg-white/80 backdrop-blur-md sticky top-0 z-10 rounded-t-2xl mb-0">
                        <div className="flex items-center justify-between w-full">
                            <h2 className="text-[13px] font-black uppercase tracking-widest text-gray-800 flex items-center">
                                <Users size={14} className="mr-2 text-blue-600" />
                                Database Registry
                            </h2>
                            <span className="bg-white text-gray-700 text-[11px] px-2.5 py-1 rounded border border-gray-200 font-bold shadow-sm">
                                {students.length} Entries
                            </span>
                        </div>
                    </div>

                    <div className="flex-1 p-6 pt-4 overflow-y-auto custom-scrollbar">
                        {students.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-[200px] text-gray-400 bg-white border border-dashed border-gray-200 rounded-xl">
                                <Users size={28} className="mb-2 text-gray-300" />
                                <p className="font-semibold text-[13px]">Engine empty.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-3">
                                {students.map((student, idx) => (
                                    <div key={idx} className="group flex justify-between items-center p-3.5 rounded-xl bg-white border border-gray-200 shadow-[0_1px_2px_rgba(0,0,0,0.02)] hover:border-blue-300 hover:shadow-[0_4px_12px_rgba(37,99,235,0.06)] transition-all duration-300">
                                        <div className="flex items-center space-x-3">
                                            <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 font-bold text-xs flex items-center justify-center border border-blue-100 shadow-sm">
                                                {student.charAt(0).toUpperCase()}
                                            </div>
                                            <span className="font-bold text-gray-800 text-[14px] tracking-tight">{student}</span>
                                        </div>
                                        <span className="text-[10px] uppercase tracking-wider bg-gray-50 text-gray-500 px-2 py-1 rounded border border-gray-200 font-bold">SHA-{1000 + idx}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default AdminPanel;
