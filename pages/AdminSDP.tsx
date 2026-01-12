
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { Profile, SDPRecord, SDPOpportunity, UserRole, Assignment, Submission, SQL_RESET_SCRIPT } from '../types';
import { Loader2, CheckCircle, XCircle, Search, FileText, AlertTriangle, Eye, Settings, Plus, Trash2, Calendar, LayoutDashboard, Download, Undo, Camera, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, X } from 'lucide-react';

interface AdminSDPProps {
    profile?: Profile;
    onUpdate?: () => void;
    onProfileRefresh?: () => void;
}

const ITEMS_PER_PAGE = 10;

// Simple error extraction helper for assignments
const getErrorText = (error: any) => {
    if (!error) return "Unknown error";
    if (typeof error === 'string') return error;
    if (error?.message) return error.message;
    try {
        return JSON.stringify(error);
    } catch {
        return "An unknown error occurred.";
    }
};

export const AdminSDP: React.FC<AdminSDPProps> = ({ profile, onUpdate, onProfileRefresh }) => {
    const [activeTab, setActiveTab] = useState<'activities' | 'assignments'>('activities');

    return (
        <div className="space-y-6">
            {/* Top Level Tabs */}
            <div className="bg-white p-2 rounded-xl border border-gray-200 shadow-sm inline-flex gap-2 mb-2">
                <button
                    onClick={() => setActiveTab('activities')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'activities'
                        ? 'bg-rose-900 text-white shadow-md'
                        : 'text-gray-500 hover:text-rose-900 hover:bg-rose-50'
                        }`}
                >
                    <FileText className="w-4 h-4" />
                    SDP Activities
                </button>
                <button
                    onClick={() => setActiveTab('assignments')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'assignments'
                        ? 'bg-rose-900 text-white shadow-md'
                        : 'text-gray-500 hover:text-rose-900 hover:bg-rose-50'
                        }`}
                >
                    <FileText className="w-4 h-4" />
                    Assignments
                </button>
            </div>

            {/* Content Area */}
            {activeTab === 'activities' ? (
                <ActivitiesManager profile={profile} onUpdate={onUpdate} />
            ) : (
                <AssignmentsManager />
            )}
        </div>
    );
};

// ==========================================
// SUB-COMPONENT: ACTIVITIES MANAGER (Original AdminSDP)
// ==========================================
const ActivitiesManager: React.FC<AdminSDPProps> = ({ profile, onUpdate, onProfileRefresh }) => {
    const [loading, setLoading] = useState(true);
    const [records, setRecords] = useState<(SDPRecord & { scholar: Profile })[]>([]);
    const [opportunities, setOpportunities] = useState<SDPOpportunity[]>([]);
    const [viewMode, setViewMode] = useState<'submissions' | 'opportunities'>('submissions');
    const [filter, setFilter] = useState('pending'); // pending, all
    const [search, setSearch] = useState('');

    // Opportunity Form
    const [showOppModal, setShowOppModal] = useState(false);
    const [newOpp, setNewOpp] = useState({ title: '', description: '', date_of_activity: '', location: '' });

    // Review Modal
    const [selectedRecord, setSelectedRecord] = useState<(SDPRecord & { scholar: Profile }) | null>(null);
    const [rejectMode, setRejectMode] = useState(false);
    const [feedback, setFeedback] = useState('');
    const [actionLoading, setActionLoading] = useState(false);

    // Settings Modal (Super Admin)
    const [showSettings, setShowSettings] = useState(false);
    const [newReq, setNewReq] = useState({ activity_type: '', description: '', required_hours: '', year_level: '1st Year' });
    const [existingReqs, setExistingReqs] = useState<any[]>([]);

    // Missing School Fix State
    const [showSchoolFixModal, setShowSchoolFixModal] = useState(false);
    const [schoolFixName, setSchoolFixName] = useState('');
    const [showResetScript, setShowResetScript] = useState(false);

    const isSuperAdmin = profile?.role === UserRole.SUPER_ADMIN;
    const hasSchool = !!profile?.school;

    const handleUpdateSchool = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!schoolFixName.trim()) return;

        try {
            const { error } = await supabase.from('profiles').update({ school: schoolFixName }).eq('id', profile?.id);
            if (error) throw error;

            alert("School Updated! Refreshing profile...");
            setShowSchoolFixModal(false);
            if (onProfileRefresh) onProfileRefresh();
        } catch (err) {
            console.error(err);
            alert("Failed to update school.");
        }
    };

    useEffect(() => {
        if (viewMode === 'submissions') fetchRecords();
        else fetchOpportunities();
    }, [filter, viewMode]);

    const fetchOpportunities = async () => {
        setLoading(true);
        const { data } = await supabase.from('sdp_opportunities').select('*').order('date_of_activity', { ascending: true });
        setOpportunities(data as any || []);
        setLoading(false);
    };

    const fetchRecords = async () => {
        setLoading(true);
        try {
            let query = supabase
                .from('sdp_records')
                .select('*, scholar:scholar_id(*)')
                .order('submitted_at', { ascending: false });

            if (filter === 'pending') {
                query = query.eq('status', 'submitted');
            }

            const { data, error } = await query;
            if (error) throw error;
            setRecords(data as any || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const fetchRequirements = async () => {
        const { data } = await supabase.from('sdp_requirements').select('*').order('year_level');
        setExistingReqs(data || []);
    };

    const handleReview = async (status: 'approved' | 'rejected') => {
        if (!selectedRecord) return;
        if (status === 'rejected' && !feedback.trim()) {
            alert("Please provide feedback for rejection.");
            return;
        }

        setActionLoading(true);
        try {
            const { error } = await supabase
                .from('sdp_records')
                .update({
                    status: status,
                    admin_feedback: status === 'rejected' ? feedback : null
                })
                .eq('id', selectedRecord.id);

            if (error) throw error;

            setSelectedRecord(null);
            setRejectMode(false);
            setFeedback('');
            fetchRecords();
            if (onUpdate) onUpdate();

        } catch (err) {
            console.error(err);
            alert("Action failed");
        } finally {
            setActionLoading(false);
        }
    };

    const handleAddRequirement = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const { error } = await supabase.from('sdp_requirements').insert([{
                activity_type: newReq.activity_type,
                description: newReq.description,
                required_hours: parseFloat(newReq.required_hours),
                year_level: newReq.year_level
            }]);
            if (error) throw error;
            setNewReq({ activity_type: '', description: '', required_hours: '', year_level: '1st Year' });
            fetchRequirements();
            alert("Requirement added!");
        } catch (err) {
            console.error(err);
            alert("Failed to add requirement.");
        }
    };

    const handleDeleteRequirement = async (id: string) => {
        if (!confirm("Delete this requirement?")) return;
        await supabase.from('sdp_requirements').delete().eq('id', id);
        fetchRequirements();
    };

    const filteredRecords = records.filter(r => {
        const matchesSearch = r.scholar?.full_name.toLowerCase().includes(search.toLowerCase()) ||
            r.activity_name.toLowerCase().includes(search.toLowerCase());

        // SCOPE CHECK: If not Super Admin, only show scholars from same school
        const matchesScope = isSuperAdmin ? true : (r.scholar?.school === profile?.school);

        return matchesSearch && matchesScope;
    });

    const handleCreateOpportunity = async (e: React.FormEvent) => {
        e.preventDefault();

        // VALIDATION: Ensure scope is correct
        const scopeSchool = isSuperAdmin ? null : profile?.school;

        if (!isSuperAdmin && !scopeSchool) {
            alert("Error: Your admin account is not linked to a generic School. Please update your profile.");
            return;
        }

        try {
            const { error } = await supabase.from('sdp_opportunities').insert([{
                title: newOpp.title,
                description: newOpp.description,
                date_of_activity: newOpp.date_of_activity,
                location: newOpp.location,
                created_by: profile?.id,
                school: scopeSchool
            }]);
            if (error) throw error;
            setShowOppModal(false);
            setNewOpp({ title: '', description: '', date_of_activity: '', location: '' });
            fetchOpportunities();
            alert("Opportunity Posted!");
        } catch (err) {
            console.error(err);
            alert("Failed to post opportunity");
        }
    };

    const handleDeleteOpp = async (id: string) => {
        if (!confirm("Delete this opportunity?")) return;
        await supabase.from('sdp_opportunities').delete().eq('id', id);
        fetchOpportunities();
    };

    return (
        <div className="space-y-6">
            {!isSuperAdmin && !hasSchool && (
                <div className="bg-red-50 border border-red-200 p-4 rounded-xl flex items-center justify-between animate-pulse">
                    <div className="flex items-center gap-3">
                        <AlertTriangle className="w-5 h-5 text-red-600" />
                        <div>
                            <p className="font-bold text-red-800">Action Required: School Not Linked</p>
                            <p className="text-sm text-red-600">You cannot post opportunities until your account is linked to a school.</p>
                        </div>
                    </div>
                    <button
                        onClick={() => setShowSchoolFixModal(true)}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg font-bold text-sm hover:bg-red-700"
                    >
                        Link School
                    </button>
                </div>
            )}

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">SDP Activities</h2>
                    <p className="text-gray-500">Manage submissions and post opportunities.</p>
                </div>
                <div className="flex gap-2">
                    {/* View Toggles */}
                    <div className="bg-gray-100 p-1 rounded-lg flex text-sm font-bold mr-2">
                        <button
                            onClick={() => setViewMode('submissions')}
                            className={`px-3 py-1.5 rounded-md transition-all ${viewMode === 'submissions' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            Submissions
                        </button>
                        <button
                            onClick={() => setViewMode('opportunities')}
                            className={`px-3 py-1.5 rounded-md transition-all ${viewMode === 'opportunities' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            Opportunities
                        </button>
                    </div>

                    {isSuperAdmin && (
                        <button
                            onClick={() => { setShowSettings(true); fetchRequirements(); }}
                            className="p-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800"
                            title="Configure Requirements"
                        >
                            <Settings className="w-5 h-5" />
                        </button>
                    )}
                </div>
            </div>

            {viewMode === 'submissions' ? (
                <>
                    <div className="flex gap-2 mb-4">
                        <button
                            onClick={() => setFilter('pending')}
                            className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${filter === 'pending' ? 'bg-orange-100 text-orange-700' : 'bg-white border border-gray-200 text-gray-600'}`}
                        >
                            Pending Review
                        </button>
                        <button
                            onClick={() => setFilter('all')}
                            className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${filter === 'all' ? 'bg-orange-100 text-orange-700' : 'bg-white border border-gray-200 text-gray-600'}`}
                        >
                            All Records
                        </button>
                    </div>
                </>
            ) : (
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-bold text-gray-700">Active Opportunities</h2>
                    <button onClick={() => setShowOppModal(true)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold text-sm hover:bg-indigo-700 flex items-center gap-2">
                        <Plus className="w-4 h-4" /> Post New
                    </button>
                </div>
            )}

            {/* Search - Only for submissions logic mainly, or search opps */}
            {viewMode === 'submissions' && (
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search scholar or activity..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                    />
                </div>
            )}

            {/* List */}
            {loading ? (
                <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-orange-600" /></div>
            ) : (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 text-xs uppercase text-gray-500 font-bold">
                            <tr>
                                <th className="p-4">Scholar</th>
                                <th className="p-4">Activity</th>
                                <th className="p-4">Status</th>
                                <th className="p-4 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredRecords.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="p-8 text-center text-gray-500">No records found.</td>
                                </tr>
                            ) : filteredRecords.map(rec => (
                                <tr key={rec.id} className="hover:bg-gray-50/50">
                                    <td className="p-4">
                                        <div className="font-bold text-gray-900">{rec.scholar?.full_name}</div>
                                        <div className="text-xs text-gray-500">{rec.scholar?.school} • {rec.scholar?.year_level}</div>
                                    </td>
                                    <td className="p-4">
                                        <div className="font-medium text-gray-900">{rec.activity_name}</div>
                                        <div className="text-xs text-gray-500">{new Date(rec.date_conducted).toLocaleDateString()}</div>
                                    </td>
                                    <td className="p-4">
                                        <span className={`text-xs font-bold px-2 py-1 rounded-full capitalize ${rec.status === 'approved' ? 'bg-green-100 text-green-700' :
                                            rec.status === 'rejected' ? 'bg-red-100 text-red-700' :
                                                'bg-orange-100 text-orange-700'
                                            }`}>
                                            {rec.status}
                                        </span>
                                    </td>
                                    <td className="p-4 text-right">
                                        <button
                                            onClick={() => { setSelectedRecord(rec); setRejectMode(false); }}
                                            className="p-2 hover:bg-gray-100 rounded-lg text-gray-600 hover:text-orange-600"
                                        >
                                            <Eye className="w-5 h-5" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Opportunities List */}
            {!loading && viewMode === 'opportunities' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {opportunities.map(opp => (
                        <div key={opp.id} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:border-indigo-300 transition-colors relative group">
                            <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => handleDeleteOpp(opp.id)} className="text-gray-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                            </div>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase mb-2 inline-block ${!opp.school ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                {!opp.school ? 'Global (CEDO)' : `${opp.school}`}
                            </span>
                            <h3 className="font-bold text-gray-900 text-lg">{opp.title}</h3>
                            <p className="text-gray-500 text-sm mt-1 line-clamp-2">{opp.description}</p>

                            <div className="mt-4 pt-4 border-t border-gray-100 space-y-2 text-sm text-gray-600">
                                <div className="flex items-center gap-2">
                                    <Calendar className="w-4 h-4 text-indigo-500" />
                                    <span>{new Date(opp.date_of_activity).toLocaleDateString()}</span>
                                </div>
                                {opp.location && (
                                    <div className="flex items-center gap-2">
                                        <div className="w-4 h-4 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-700">L</div>
                                        <span>{opp.location}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                    {opportunities.length === 0 && (
                        <div className="col-span-3 text-center p-12 text-gray-400 italic">No opportunities posted yet.</div>
                    )}
                </div>
            )}

            {/* Post Opportunity Modal */}
            {showOppModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                            <h3 className="font-bold text-lg">Post New Opportunity</h3>
                            <button onClick={() => setShowOppModal(false)} className="text-gray-400 hover:text-gray-600"><XCircle className="w-6 h-6" /></button>
                        </div>
                        <div className="px-6 pt-4 pb-0">
                            <div className={`text-xs font-bold px-3 py-2 rounded-lg inline-block border ${isSuperAdmin ? 'bg-indigo-50 text-indigo-700 border-indigo-100' : 'bg-orange-50 text-orange-700 border-orange-100'}`}>
                                Posting as: {isSuperAdmin ? 'Global (CEDO)' : (profile?.school || 'Unknown School')}
                            </div>
                        </div>
                        <form onSubmit={handleCreateOpportunity} className="p-6 space-y-4 pt-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Title</label>
                                <input type="text" required value={newOpp.title} onChange={e => setNewOpp({ ...newOpp, title: e.target.value })} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="e.g. Coastal Cleanup" />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Description</label>
                                <textarea required value={newOpp.description} onChange={e => setNewOpp({ ...newOpp, description: e.target.value })} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none h-24 resize-none" placeholder="Details..." />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Date</label>
                                    <input type="date" required value={newOpp.date_of_activity} onChange={e => setNewOpp({ ...newOpp, date_of_activity: e.target.value })} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Location</label>
                                    <input type="text" required value={newOpp.location} onChange={e => setNewOpp({ ...newOpp, location: e.target.value })} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="e.g. City Hall" />
                                </div>
                            </div>
                            <div className="pt-4">
                                <button type="submit" className="w-full py-3 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700">Post Opportunity</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {/* Review Modal */}
            {selectedRecord && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center flex-shrink-0">
                            <h3 className="font-bold text-lg">Review Submission</h3>
                            <button onClick={() => setSelectedRecord(null)} className="text-gray-400 hover:text-gray-600"><XCircle className="w-6 h-6" /></button>
                        </div>

                        <div className="p-6 overflow-y-auto flex-1">
                            <div className="grid grid-cols-2 gap-4 mb-6">
                                <div className="bg-gray-50 p-3 rounded-lg">
                                    <span className="text-xs text-gray-500 uppercase font-bold">Scholar</span>
                                    <p className="font-medium">{selectedRecord.scholar?.full_name}</p>
                                </div>
                                <div className="bg-gray-50 p-3 rounded-lg">
                                    <span className="text-xs text-gray-500 uppercase font-bold">Activity Type</span>
                                    <p className="font-medium">{selectedRecord.activity_name}</p>
                                </div>
                            </div>

                            <div className="mb-4">
                                <span className="text-xs text-gray-500 uppercase font-bold">Description</span>
                                <p className="text-gray-700 mt-1 bg-gray-50 p-3 rounded-lg border border-gray-100">{selectedRecord.description}</p>
                            </div>

                            <div className="mb-6">
                                <span className="text-xs text-gray-500 uppercase font-bold">Proof of Completion</span>
                                <div className="mt-2 bg-gray-100 rounded-lg p-2 border border-gray-200">
                                    {selectedRecord.proof_data ? (
                                        selectedRecord.proof_data.startsWith('data:image') ? (
                                            <img src={selectedRecord.proof_data} className="max-w-full h-auto rounded" />
                                        ) : (
                                            <div className="p-4 text-center text-gray-500 flex flex-col items-center">
                                                <FileText className="w-8 h-8 mb-2" />
                                                <span>Document Attached (PDF/Other)</span>
                                                <a href={selectedRecord.proof_data} download="proof" className="text-blue-600 hover:underline text-sm mt-1">Download to View</a>
                                            </div>
                                        )
                                    ) : (
                                        <div className="p-4 text-center text-red-500 font-bold flex items-center justify-center gap-2">
                                            <AlertTriangle className="w-5 h-5" /> No Proof Attached
                                        </div>
                                    )}
                                </div>
                            </div>

                            {rejectMode && (
                                <div className="animate-in fade-in slide-in-from-top-2">
                                    <label className="block text-sm font-bold text-red-700 mb-1">Reason for Rejection</label>
                                    <textarea
                                        className="w-full p-3 border border-red-200 bg-red-50 rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-sm"
                                        placeholder="Explain why this is being rejected..."
                                        rows={3}
                                        value={feedback}
                                        onChange={(e) => setFeedback(e.target.value)}
                                    />
                                </div>
                            )}
                        </div>

                        <div className="p-6 border-t border-gray-100 bg-gray-50 flex-shrink-0 flex gap-3 justify-end">
                            {selectedRecord.status === 'submitted' ? (
                                <>
                                    {isSuperAdmin ? (
                                        !rejectMode ? (
                                            <>
                                                <button
                                                    onClick={() => setRejectMode(true)}
                                                    disabled={actionLoading}
                                                    className="px-6 py-2.5 bg-white border border-red-200 text-red-700 font-bold rounded-lg hover:bg-red-50 transition-colors shadow-sm"
                                                >
                                                    Reject
                                                </button>
                                                <button
                                                    onClick={() => handleReview('approved')}
                                                    disabled={actionLoading}
                                                    className="px-6 py-2.5 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 transition-colors shadow-sm flex items-center gap-2"
                                                >
                                                    {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />} Approve
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                <button
                                                    onClick={() => setRejectMode(false)}
                                                    className="px-4 py-2 text-gray-500 font-bold hover:text-gray-700"
                                                >
                                                    Cancel
                                                </button>
                                                <button
                                                    onClick={() => handleReview('rejected')}
                                                    disabled={actionLoading}
                                                    className="px-6 py-2.5 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition-colors shadow-sm"
                                                >
                                                    {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />} Confirm Rejection
                                                </button>
                                            </>
                                        )
                                    ) : (
                                        <div className="flex items-center gap-2 text-gray-500 bg-gray-100 px-4 py-2 rounded-lg">
                                            <AlertTriangle className="w-4 h-4" />
                                            <span className="font-bold text-sm">View Only: Verification managed by Super Admin (CEDO).</span>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <span className="text-gray-500 font-medium italic">This record has already been processed.</span>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Settings Modal */}
            {showSettings && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl overflow-hidden h-[80vh] flex flex-col">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                            <h3 className="font-bold text-lg flex items-center gap-2"><Settings className="w-5 h-5" /> SDP System Configuration</h3>
                            <button onClick={() => setShowSettings(false)} className="text-gray-400 hover:text-gray-600"><XCircle className="w-6 h-6" /></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6 bg-gray-50 space-y-6">

                            {/* Add Form */}
                            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                                <h4 className="font-bold text-gray-900 mb-4 flex items-center gap-2"><Plus className="w-4 h-4" /> Add Requirement</h4>
                                <form onSubmit={handleAddRequirement} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
                                    <div className="lg:col-span-1">
                                        <label className="text-xs font-bold text-gray-500 mb-1 block">Year Level</label>
                                        <select value={newReq.year_level} onChange={e => setNewReq({ ...newReq, year_level: e.target.value })} className="w-full p-2 border rounded-lg text-sm">
                                            <option>1st Year</option>
                                            <option>2nd Year</option>
                                            <option>3rd Year</option>
                                            <option>4th Year</option>
                                            <option>5th Year</option>
                                        </select>
                                    </div>
                                    <div className="lg:col-span-1">
                                        <label className="text-xs font-bold text-gray-500 mb-1 block">Activity Type</label>
                                        <input type="text" placeholder="e.g. Volunteer" required value={newReq.activity_type} onChange={e => setNewReq({ ...newReq, activity_type: e.target.value })} className="w-full p-2 border rounded-lg text-sm" />
                                    </div>
                                    <div className="lg:col-span-1">
                                        <label className="text-xs font-bold text-gray-500 mb-1 block">Count</label>
                                        <input type="number" placeholder="10" required value={newReq.required_hours} onChange={e => setNewReq({ ...newReq, required_hours: e.target.value })} className="w-full p-2 border rounded-lg text-sm" />
                                    </div>
                                    <div className="lg:col-span-1">
                                        <label className="text-xs font-bold text-gray-500 mb-1 block">Description</label>
                                        <input type="text" placeholder="Brief details" required value={newReq.description} onChange={e => setNewReq({ ...newReq, description: e.target.value })} className="w-full p-2 border rounded-lg text-sm" />
                                    </div>
                                    <div className="lg:col-span-1">
                                        <button type="submit" className="w-full bg-indigo-600 text-white p-2 rounded-lg font-bold text-sm hover:bg-indigo-700">Add</button>
                                    </div>
                                </form>
                            </div>

                            {/* Existing List */}
                            <div className="space-y-4">
                                <h4 className="font-bold text-gray-900">Current Requirements</h4>
                                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                                    <table className="w-full text-left text-sm">
                                        <thead className="bg-gray-50 text-gray-500 font-bold">
                                            <tr>
                                                <th className="p-3">Year</th>
                                                <th className="p-3">Activity</th>
                                                <th className="p-3">Count</th>
                                                <th className="p-3">Description</th>
                                                <th className="p-3 text-right">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {existingReqs.map(req => (
                                                <tr key={req.id}>
                                                    <td className="p-3 font-medium">{req.year_level}</td>
                                                    <td className="p-3">{req.activity_type}</td>
                                                    <td className="p-3 font-bold">{req.required_hours}</td>
                                                    <td className="p-3 text-gray-500">{req.description}</td>
                                                    <td className="p-3 text-right">
                                                        <button onClick={() => handleDeleteRequirement(req.id)} className="text-red-500 hover:text-red-700 p-1"><Trash2 className="w-4 h-4" /></button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* DANGER ZONE */}
                            <div className="border-t border-red-100 pt-6 mt-6">
                                <h4 className="font-bold text-red-900 mb-2 flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> Danger Zone</h4>
                                <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center justify-between">
                                    <div>
                                        <p className="font-bold text-red-800 text-sm">Reset Scholar Portal Data</p>
                                        <p className="text-xs text-red-600 mt-1">Wipes all scholar accounts, submissions, and logs. Keeps Admins.</p>
                                    </div>
                                    <button
                                        onClick={() => setShowResetScript(true)}
                                        className="px-4 py-2 bg-white border border-red-200 text-red-700 rounded-lg text-sm font-bold hover:bg-red-100 hover:border-red-300 transition-colors shadow-sm"
                                    >
                                        Reset Data
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Reset Script Modal */}
            {showResetScript && (
                <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-red-50">
                            <div className="flex items-center gap-2 text-red-700">
                                <AlertTriangle className="w-6 h-6" />
                                <h3 className="font-bold text-lg">Reset Scholar Data</h3>
                            </div>
                            <button onClick={() => setShowResetScript(false)} className="text-gray-400 hover:text-gray-600"><XCircle className="w-6 h-6" /></button>
                        </div>
                        <div className="p-6">
                            <p className="text-sm text-gray-600 mb-4">
                                To wipe out all scholar data (profiles, activities, submissions) and resetting the portal for scholars, run the following SQL script in your <b>Supabase Dashboard {'>'} SQL Editor</b>.
                                <br /><br />
                                <span className="font-bold text-red-600">Warning: This action is irreversible. Admins and Super Admins will be preserved.</span>
                            </p>
                            <div className="bg-gray-900 rounded-lg p-4 relative group">
                                <pre className="text-xs text-green-400 overflow-x-auto whitespace-pre-wrap font-mono h-64">
                                    {SQL_RESET_SCRIPT}
                                </pre>
                                <button
                                    onClick={() => {
                                        navigator.clipboard.writeText(SQL_RESET_SCRIPT);
                                        alert("Script copied to clipboard!");
                                    }}
                                    className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 text-white px-3 py-1 rounded text-xs font-bold transition-colors"
                                >
                                    Copy SQL
                                </button>
                            </div>
                        </div>
                        <div className="p-4 border-t border-gray-100 flex justify-end">
                            <button onClick={() => setShowResetScript(false)} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-lg text-sm">Close</button>
                        </div>
                    </div>
                </div>
            )
            }
        </div >
    );
};

// ==========================================
// SUB-COMPONENT: ASSIGNMENTS MANAGER (Original AdminAssignments)
// ==========================================
const AssignmentsManager: React.FC = () => {
    const [assignments, setAssignments] = useState<Assignment[]>([]);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [submissions, setSubmissions] = useState<Submission[]>([]);
    const [totalSubmissions, setTotalSubmissions] = useState(0);
    const [loadingSubs, setLoadingSubs] = useState(false);
    const [page, setPage] = useState(1);
    const [searchQuery, setSearchQuery] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [requiresPhoto, setRequiresPhoto] = useState(false);
    const [dueDate, setDueDate] = useState('');
    const [viewingPhoto, setViewingPhoto] = useState<string | null>(null);
    const [returnModalOpen, setReturnModalOpen] = useState(false);
    const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null);
    const [returnReason, setReturnReason] = useState('');
    const [processingReturn, setProcessingReturn] = useState(false);

    const fetchAssignments = async () => {
        const { data } = await supabase.from('assignments').select('*').order('created_at', { ascending: false });
        setAssignments(data as Assignment[] || []);
    };

    useEffect(() => {
        fetchAssignments();
    }, []);

    const fetchSubmissions = useCallback(async (assignmentId: string, pageNum: number, search: string) => {
        setLoadingSubs(true);
        try {
            try {
                let query = supabase
                    .from('submissions')
                    .select(`
            *,
            scholar:profiles (full_name, email)
          `, { count: 'exact' })
                    .eq('assignment_id', assignmentId);

                if (search) {
                    query = supabase
                        .from('submissions')
                        .select(`
              *,
              scholar:profiles!inner(full_name, email)
            `, { count: 'exact' })
                        .eq('assignment_id', assignmentId)
                        .or(`full_name.ilike.%${search}%,email.ilike.%${search}%`, { foreignTable: 'profiles' });
                }

                const from = (pageNum - 1) * ITEMS_PER_PAGE;
                const to = from + ITEMS_PER_PAGE - 1;

                const { data, count, error } = await query
                    .order('submitted_at', { ascending: false })
                    .range(from, to);

                if (error) throw error;

                setSubmissions(data as any[] || []);
                setTotalSubmissions(count || 0);
            } catch (joinError) {
                console.warn("Submissions fetch fallback (join error)");
                const from = (pageNum - 1) * ITEMS_PER_PAGE;
                const to = from + ITEMS_PER_PAGE - 1;

                const { data, count } = await supabase
                    .from('submissions')
                    .select('*', { count: 'exact' })
                    .eq('assignment_id', assignmentId)
                    .order('submitted_at', { ascending: false })
                    .range(from, to);

                const mapped = (data || []).map((s: any) => ({
                    ...s,
                    scholar: { full_name: 'Unknown Scholar (DB Error)', email: 'N/A' }
                }));

                setSubmissions(mapped);
                setTotalSubmissions(count || 0);
            }
        } catch (err) {
            console.error("Error fetching submissions:", err);
        } finally {
            setLoadingSubs(false);
        }
    }, []);

    useEffect(() => {
        if (expandedId) {
            const delayDebounce = setTimeout(() => {
                fetchSubmissions(expandedId, page, searchQuery);
            }, 300);
            return () => clearTimeout(delayDebounce);
        }
    }, [expandedId, page, searchQuery, fetchSubmissions]);

    const toggleExpand = (id: string) => {
        if (expandedId === id) {
            setExpandedId(null);
        } else {
            setExpandedId(id);
            setPage(1);
            setSearchQuery('');
            setSubmissions([]);
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        const { error } = await supabase.from('assignments').insert([{
            title,
            description,
            requires_photo: requiresPhoto,
            due_date: new Date(dueDate).toISOString()
        }]);

        if (error) alert('Error creating assignment');
        else {
            setShowForm(false);
            setTitle('');
            setDescription('');
            setRequiresPhoto(false);
            setDueDate('');
            fetchAssignments();
        }
    };

    const openReturnModal = (submissionId: string) => {
        setSelectedSubmissionId(submissionId);
        setReturnReason('');
        setReturnModalOpen(true);
    };

    const handleReturnSubmit = async () => {
        if (!selectedSubmissionId) return;
        setProcessingReturn(true);
        try {
            const { error } = await supabase
                .from('submissions')
                .update({
                    status: 'returned',
                    feedback: returnReason
                })
                .eq('id', selectedSubmissionId);

            if (error) throw error;
            setReturnModalOpen(false);
            if (expandedId) fetchSubmissions(expandedId, page, searchQuery);
        } catch (err: any) {
            console.error("Error returning assignment:", err);
            alert(`Failed to return assignment: ${getErrorText(err)}`);
        } finally {
            setProcessingReturn(false);
        }
    };

    const totalPages = Math.ceil(totalSubmissions / ITEMS_PER_PAGE);

    return (
        <div className="space-y-6 md:space-y-8 relative">
            {viewingPhoto && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="relative max-w-4xl w-full max-h-[90vh] flex flex-col items-center">
                        <button
                            onClick={() => setViewingPhoto(null)}
                            className="absolute -top-12 right-0 text-white hover:text-gray-300 transition-colors flex items-center gap-2"
                        >
                            Close <X className="w-6 h-6" />
                        </button>
                        <img src={viewingPhoto} alt="Proof" className="max-w-full max-h-[80vh] rounded-lg shadow-2xl border border-white/20" />
                        <div className="mt-4 flex gap-4">
                            <a href={viewingPhoto} download="submission-proof.png" className="px-4 py-2 bg-white text-gray-900 rounded-full font-bold text-sm hover:bg-gray-100 transition-colors flex items-center gap-2">
                                <Download className="w-4 h-4" /> Download Image
                            </a>
                        </div>
                    </div>
                </div>
            )}

            {returnModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden border border-gray-100 scale-100 animate-in zoom-in-95 duration-200">
                        <div className="p-6">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                                    <Undo className="w-5 h-5 text-amber-600" /> Return Assignment
                                </h3>
                                <button onClick={() => setReturnModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="mb-4">
                                <label className="block text-sm font-bold text-gray-700 mb-2">Reason for Return</label>
                                <textarea
                                    value={returnReason}
                                    onChange={(e) => setReturnReason(e.target.value)}
                                    className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none h-32 resize-none"
                                    placeholder="Explain why this is being returned (e.g., Missing photo, incomplete answer...)"
                                    autoFocus
                                />
                                <p className="text-xs text-gray-500 mt-2">
                                    This note will be visible to the scholar, asking them to resubmit.
                                </p>
                            </div>

                            <div className="flex gap-3 justify-end">
                                <button
                                    onClick={() => setReturnModalOpen(false)}
                                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleReturnSubmit}
                                    disabled={processingReturn || !returnReason.trim()}
                                    className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 font-bold shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50"
                                >
                                    {processingReturn ? <Loader2 className="w-4 h-4 animate-spin" /> : <Undo className="w-4 h-4" />}
                                    Confirm Return
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">Assignment Manager</h2>
                    <p className="text-gray-500">Create tasks and track submissions.</p>
                </div>
                {!showForm && (
                    <button
                        onClick={() => setShowForm(true)}
                        className="w-full md:w-auto px-5 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2 font-bold shadow-sm"
                    >
                        <Plus className="w-5 h-5" /> Create New
                    </button>
                )}
            </div>

            {showForm && (
                <div className="bg-white p-6 md:p-8 rounded-2xl shadow-xl border border-gray-100 animate-in fade-in slide-in-from-top-4 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500"></div>
                    <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                        <div className="p-2 bg-emerald-100 rounded-lg">
                            <Plus className="w-5 h-5 text-emerald-700" />
                        </div>
                        New Assignment Details
                    </h2>

                    <form onSubmit={handleCreate} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">Assignment Title</label>
                                <input required type="text" value={title} onChange={e => setTitle(e.target.value)} className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all" placeholder="e.g. Monthly Report" />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">Due Date & Time</label>
                                <input required type="datetime-local" value={dueDate} onChange={e => setDueDate(e.target.value)} className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">Description / Instructions</label>
                            <textarea required rows={4} value={description} onChange={e => setDescription(e.target.value)} className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all resize-none" placeholder="Provide clear instructions for your scholars..." />
                        </div>

                        <div
                            className={`flex items-center justify-between p-5 rounded-xl border-l-4 transition-all cursor-pointer ${requiresPhoto ? 'bg-purple-50 border-purple-500' : 'bg-gray-50 border-gray-300'}`}
                            onClick={() => setRequiresPhoto(!requiresPhoto)}
                        >
                            <div className="flex items-center gap-4">
                                <div className={`p-3 rounded-full flex-shrink-0 ${requiresPhoto ? 'bg-purple-200 text-purple-800' : 'bg-gray-200 text-gray-500'}`}>
                                    <Camera className="w-6 h-6" />
                                </div>
                                <div>
                                    <h4 className={`font-bold ${requiresPhoto ? 'text-purple-900' : 'text-gray-700'}`}>Require Photo Evidence?</h4>
                                    <p className="text-sm text-gray-500">Scholars must upload an image to complete this assignment.</p>
                                </div>
                            </div>
                            <div className={`w-14 h-8 rounded-full p-1 transition-colors relative flex-shrink-0 ${requiresPhoto ? 'bg-purple-600' : 'bg-gray-300'}`}>
                                <div className={`w-6 h-6 bg-white rounded-full shadow-sm transform transition-transform ${requiresPhoto ? 'translate-x-6' : 'translate-x-0'}`}></div>
                            </div>
                        </div>

                        <div className="flex flex-col-reverse md:flex-row justify-end gap-3 pt-4 border-t border-gray-100">
                            <button type="button" onClick={() => setShowForm(false)} className="px-6 py-3 text-gray-600 hover:bg-gray-50 rounded-xl font-medium">Cancel</button>
                            <button type="submit" className="px-8 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 shadow-md font-bold transition-transform active:scale-95 flex items-center justify-center gap-2">
                                Create Assignment
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <div className="space-y-6">
                {assignments.length === 0 ? (
                    <div className="text-center p-16 bg-white rounded-2xl border border-dashed border-gray-300 flex flex-col items-center">
                        <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                            <FileText className="w-10 h-10 text-gray-300" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900">No Assignments Yet</h3>
                        <p className="text-gray-500 mb-6 max-w-sm">Get started by creating tasks for your scholars to complete.</p>
                        <button onClick={() => setShowForm(true)} className="text-emerald-600 font-bold hover:underline flex items-center gap-1">
                            <Plus className="w-4 h-4" /> Create First Assignment
                        </button>
                    </div>
                ) : (
                    assignments.map(assign => (
                        <div key={assign.id} className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow group">
                            <div className="p-6 flex flex-col md:flex-row md:items-start justify-between gap-6">
                                <div className="flex-1">
                                    <div className="flex flex-wrap items-center gap-3 mb-2">
                                        <h3 className="font-bold text-lg text-gray-900 group-hover:text-emerald-700 transition-colors">{assign.title}</h3>
                                        {assign.requires_photo && (
                                            <span className="px-2.5 py-1 bg-purple-50 text-purple-700 text-[10px] font-bold uppercase tracking-wider rounded-md flex items-center gap-1.5 border border-purple-100">
                                                <Camera className="w-3 h-3" /> Photo Required
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-gray-600 mb-4 leading-relaxed line-clamp-2">{assign.description}</p>
                                    <div className="flex items-center gap-4 text-sm">
                                        <p className="text-gray-500 flex items-center gap-1.5 bg-gray-50 px-2 py-1 rounded-lg">
                                            <Calendar className="w-4 h-4 text-gray-400" />
                                            Due: <span className="font-medium text-gray-700">{new Date(assign.due_date).toLocaleString()}</span>
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => toggleExpand(assign.id)}
                                    className={`flex items-center justify-center gap-2 text-sm font-bold px-4 py-2 rounded-xl transition-all border w-full md:w-auto h-12 ${expandedId === assign.id
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                        : 'bg-white text-gray-500 border-gray-200 hover:border-emerald-200 hover:text-emerald-600'
                                        }`}
                                >
                                    {expandedId === assign.id ? 'Close Manager' : 'Manage Submissions'}
                                    {expandedId === assign.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                </button>
                            </div>

                            {expandedId === assign.id && (
                                <div className="bg-gray-50/50 border-t border-gray-100 p-4 md:p-6 animate-in slide-in-from-top-2">
                                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                                        <div className="p-4 border-b border-gray-200 flex flex-col md:flex-row justify-between items-center gap-4 bg-gray-50/50">
                                            <div className="flex items-center gap-2">
                                                <h4 className="font-bold text-gray-700">Submissions</h4>
                                                <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-2 py-1 rounded-full">
                                                    {totalSubmissions} Total
                                                </span>
                                            </div>
                                            <div className="relative w-full md:w-64">
                                                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                                <input
                                                    type="text"
                                                    placeholder="Search scholar..."
                                                    value={searchQuery}
                                                    onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                                                    className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                                />
                                            </div>
                                        </div>

                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm text-left">
                                                <thead className="bg-gray-50 text-gray-500 border-b border-gray-200">
                                                    <tr>
                                                        <th className="px-6 py-3 font-medium">Scholar Details</th>
                                                        <th className="px-6 py-3 font-medium">Status</th>
                                                        <th className="px-6 py-3 font-medium">Content / Note</th>
                                                        <th className="px-6 py-3 font-medium text-right">Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100">
                                                    {loadingSubs ? (
                                                        <tr>
                                                            <td colSpan={4} className="p-12 text-center text-gray-500">
                                                                <div className="flex flex-col items-center gap-2">
                                                                    <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
                                                                    <span>Loading data...</span>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ) : submissions.length === 0 ? (
                                                        <tr>
                                                            <td colSpan={4} className="p-12 text-center text-gray-400">
                                                                No submissions found matching criteria.
                                                            </td>
                                                        </tr>
                                                    ) : (
                                                        submissions.map(sub => (
                                                            <tr key={sub.id} className="hover:bg-gray-50 transition-colors">
                                                                <td className="px-6 py-4">
                                                                    <div className="flex items-center gap-3">
                                                                        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center font-bold text-gray-600 text-xs">
                                                                            {(sub.scholar as any)?.full_name?.charAt(0) || 'U'}
                                                                        </div>
                                                                        <div>
                                                                            <div className="font-bold text-gray-900">{(sub.scholar as any)?.full_name || 'Unknown Scholar'}</div>
                                                                            <div className="text-xs text-gray-500 font-mono">{(sub.scholar as any)?.email || 'N/A'}</div>
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                                <td className="px-6 py-4">
                                                                    {sub.status === 'returned' ? (
                                                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-100 text-amber-700 border border-amber-200 rounded-full text-xs font-bold">
                                                                            <Undo className="w-3 h-3" /> Returned
                                                                        </span>
                                                                    ) : (
                                                                        <div className="flex flex-col">
                                                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-100 text-green-700 border border-green-200 rounded-full text-xs font-bold w-fit mb-1">
                                                                                <CheckCircle className="w-3 h-3" /> Submitted
                                                                            </span>
                                                                            <span className="text-[10px] text-gray-400">
                                                                                {new Date(sub.submitted_at).toLocaleDateString()}
                                                                            </span>
                                                                        </div>
                                                                    )}
                                                                </td>
                                                                <td className="px-6 py-4">
                                                                    {sub.content ? (
                                                                        <span className="text-gray-700 italic max-w-xs block truncate" title={sub.content}>
                                                                            "{sub.content}"
                                                                        </span>
                                                                    ) : <span className="text-gray-300">-</span>}
                                                                </td>
                                                                <td className="px-6 py-4 text-right">
                                                                    <div className="flex justify-end gap-2">
                                                                        {sub.photo_data && (
                                                                            <button
                                                                                onClick={() => setViewingPhoto(sub.photo_data!)}
                                                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 rounded-lg text-xs font-bold transition-colors"
                                                                            >
                                                                                <Eye className="w-3.5 h-3.5" /> Photo
                                                                            </button>
                                                                        )}
                                                                        <button
                                                                            onClick={() => openReturnModal(sub.id)}
                                                                            disabled={sub.status === 'returned'}
                                                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 rounded-lg text-xs font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                                        >
                                                                            <Undo className="w-3.5 h-3.5" /> Return
                                                                        </button>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        ))
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>

                                        {totalSubmissions > 0 && (
                                            <div className="p-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
                                                <span className="text-xs text-gray-500">
                                                    Showing {(page - 1) * ITEMS_PER_PAGE + 1} to {Math.min(page * ITEMS_PER_PAGE, totalSubmissions)} of {totalSubmissions}
                                                </span>
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => setPage(p => Math.max(1, p - 1))}
                                                        disabled={page === 1 || loadingSubs}
                                                        className="p-1.5 bg-white border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50"
                                                    >
                                                        <ChevronLeft className="w-4 h-4" />
                                                    </button>
                                                    <span className="text-xs font-medium text-gray-700">Page {page} of {totalPages}</span>
                                                    <button
                                                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                                        disabled={page === totalPages || loadingSubs}
                                                        className="p-1.5 bg-white border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50"
                                                    >
                                                        <ChevronRight className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};
