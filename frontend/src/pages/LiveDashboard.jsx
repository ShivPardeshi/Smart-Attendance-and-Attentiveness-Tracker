import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Users, AlertCircle, EyeOff, Activity, Video, VideoOff, Focus, Clock, ChevronDown, ChevronUp } from 'lucide-react';

const API_BASE = 'http://localhost:8000/api';

function LiveDashboard() {
    const [stats, setStats] = useState({
        status: 'Idle',
        students_present: 0,
        attentiveness_rate: 0,
        total_distractions: 0,
        total_drowsy_events: 0,
    });
    const [isStreaming, setIsStreaming] = useState(false);
    const [sessions, setSessions] = useState([]);
    const [showAllLogs, setShowAllLogs] = useState(false);

    useEffect(() => {
        let interval;
        if (isStreaming) {
            interval = setInterval(async () => {
                try {
                    const res = await axios.get(`${API_BASE}/live_stats`);
                    setStats(res.data);
                    if (res.data.status === 'Stopped') {
                        setIsStreaming(false);
                    }
                } catch (err) {
                    console.error("Error fetching stats:", err);
                }
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [isStreaming]);

    useEffect(() => {
        const fetchSessions = async () => {
            try {
                const res = await axios.get(`${API_BASE}/sessions`);
                setSessions(res.data);
            } catch (err) {
                console.error("Error fetching sessions:", err);
            }
        };
        fetchSessions();
    }, []);

    const handleStartStream = async () => {
        try {
            await axios.get(`${API_BASE}/start_stream`);
            setIsStreaming(true);
        } catch (err) {
            console.error(err);
        }
    };

    const handleStopStream = async () => {
        try {
            await axios.get(`${API_BASE}/stop_stream`);
            setIsStreaming(false);
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <div className="flex flex-col h-full space-y-6">
            <header className="flex justify-between items-end pb-4 border-b border-gray-200">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-gray-900">Live Monitor</h1>
                    <p className="text-sm text-gray-500 font-medium tracking-wide mt-1">Real-time attendance & cognitive insights</p>
                </div>

                <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2 mr-2">
                        <span className="relative flex h-2.5 w-2.5">
                            {isStreaming && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>}
                            <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isStreaming ? 'bg-emerald-500' : 'bg-gray-300'}`}></span>
                        </span>
                        <span className="text-[13px] font-semibold text-gray-600 uppercase tracking-widest">
                            {isStreaming ? 'STREAMING ACTIVE' : 'CAMERA IDLE'}
                        </span>
                    </div>

                    {!isStreaming ? (
                        <button onClick={handleStartStream} className="btn-primary">
                            <Video className="mr-2" size={16} />
                            Engage Vision
                        </button>
                    ) : (
                        <button onClick={handleStopStream} className="btn-danger">
                            <VideoOff className="mr-2" size={16} />
                            Halt Stream
                        </button>
                    )}
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1">
                {/* Vision Feed (Spans 8 cols) */}
                <div className="lg:col-span-8 space-y-6 flex flex-col">
                    <div className="saas-card flex items-center justify-center p-1 relative bg-gray-50/50" style={{ height: "fit-content" }}>
                        {isStreaming ? (
                            <div className="w-full relative overflow-hidden rounded-[14px] bg-black" style={{ aspectRatio: '16/9' }}>
                                <img
                                    src={`${API_BASE}/video_feed`}
                                    alt="Live Feed"
                                    className="w-full h-full object-contain opacity-95"
                                />
                                <div className="scan-line"></div>
                                <div className="absolute top-4 left-4 flex items-center space-x-2 bg-black/60 px-3 py-1.5 rounded-lg border border-white/10 backdrop-blur-md">
                                    <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(239,68,68,1)]"></span>
                                    <span className="text-[10px] font-bold tracking-widest text-white uppercase">REC</span>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center text-gray-400 w-full border-2 border-dashed border-gray-200 rounded-[14px]" style={{ aspectRatio: '16/9' }}>
                                <div className="p-4 bg-white rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] ring-1 ring-gray-100 mb-4">
                                    <VideoOff size={32} className="text-gray-300" strokeWidth={1.5} />
                                </div>
                                <p className="text-base font-semibold text-gray-600">Feed Disconnected</p>
                                <p className="text-[13px] mt-1 text-gray-400 font-medium">Activate vision engine to begin tracking</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Analytics Sidebar (Spans 4 cols) */}
                <div className="lg:col-span-4 space-y-6 flex flex-col h-full">
                    <div className="saas-card p-6">
                        <div className="saas-card-header">
                            <h2 className="text-[13px] font-black uppercase tracking-widest text-gray-500 flex items-center">
                                <Activity size={14} className="mr-2 text-blue-500" />
                                Cognitive Metrics
                            </h2>
                        </div>

                        <div className="grid grid-cols-2 gap-x-4 gap-y-6">
                            <div>
                                <div className="stat-label mb-1">
                                    <Users size={12} className="mr-1 text-blue-600" /> Total Active
                                </div>
                                <div className="stat-value text-blue-600">{stats.students_present}</div>
                            </div>

                            <div>
                                <div className="stat-label mb-1">
                                    <Focus size={12} className="mr-1 text-emerald-500" /> Focus Rate
                                </div>
                                <div className="stat-value">{stats.attentiveness_rate}%</div>
                            </div>

                            <div>
                                <div className="stat-label mb-1">
                                    <AlertCircle size={12} className="mr-1 text-amber-500" /> Flags
                                </div>
                                <div className="stat-value">{stats.total_distractions}</div>
                            </div>

                            <div>
                                <div className="stat-label mb-1">
                                    <EyeOff size={12} className="mr-1 text-red-500" /> Fatigue
                                </div>
                                <div className="stat-value">{stats.total_drowsy_events}</div>
                            </div>
                        </div>

                        {/* Recent Participants Inline List */}
                        <div className="mt-8 pt-5 border-t border-gray-100">
                            <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">Identified Subjects</h3>
                            <div className="max-h-[100px] overflow-y-auto custom-scrollbar pr-2">
                                {stats.students_list && stats.students_list.length > 0 ? (
                                    <div className="flex flex-wrap gap-1.5">
                                        {stats.students_list.map((s, i) => (
                                            <span key={i} className="inline-flex items-center px-2 py-1 bg-white border border-gray-200 text-gray-700 shadow-sm rounded-md text-[11px] font-semibold tracking-wide">
                                                <div className="w-1 h-1 rounded-full bg-emerald-400 mr-1.5"></div>
                                                {s}
                                            </span>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-[12px] text-gray-400 italic bg-gray-50 rounded-md p-2 border border-dashed border-gray-200 text-center">Awaiting visual lock...</div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="saas-card p-0 flex flex-col flex-1 min-h-[250px]">
                        <div className="saas-card-header px-6 pt-6 mb-0 border-b-0 pb-2">
                            <h2 className="text-[13px] font-black uppercase tracking-widest text-gray-500 flex items-center">
                                <Clock size={14} className="mr-2 text-gray-400" />
                                Snapshot Logs
                            </h2>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 pt-2 space-y-2.5">
                            {sessions.length === 0 ? (
                                <div className="text-center py-8">
                                    <div className="w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-3 outline outline-1 outline-gray-100">
                                        <Clock size={16} className="text-gray-300" />
                                    </div>
                                    <p className="text-[12px] font-medium text-gray-400">Database empty.</p>
                                </div>
                            ) : (
                                <>
                                    {(showAllLogs ? sessions : sessions.slice(0, 8)).map((s, idx) => (
                                        <div key={idx} className="group flex justify-between items-center p-3 rounded-xl border border-gray-100 bg-white hover:border-blue-200 shadow-[0_1px_2px_rgba(0,0,0,0.02)] hover:shadow-[0_2px_8px_rgba(37,99,235,0.06)] cursor-pointer transition-all duration-200">
                                            <div className="flex flex-col space-y-0.5">
                                                <span className="text-[13px] font-bold text-gray-800 tracking-tight group-hover:text-blue-700 transition-colors">{s.name}</span>
                                                <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Indexed File</span>
                                            </div>
                                            <div className="w-6 h-6 rounded-md bg-gray-50 border border-gray-100 flex items-center justify-center group-hover:bg-blue-50 transition-colors">
                                                <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                                            </div>
                                        </div>
                                    ))}
                                    {sessions.length > 8 && (
                                        <button 
                                            onClick={() => setShowAllLogs(!showAllLogs)}
                                            className="w-full mt-2 py-2 flex items-center justify-center text-[12px] font-bold text-gray-500 hover:text-blue-600 bg-gray-50 hover:bg-blue-50 rounded-lg transition-colors border border-dashed border-gray-200 hover:border-blue-200"
                                        >
                                            {showAllLogs ? (
                                                <><ChevronUp size={14} className="mr-1" /> Show Less</>
                                            ) : (
                                                <><ChevronDown size={14} className="mr-1" /> View All ({sessions.length})</>
                                            )}
                                        </button>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default LiveDashboard;
