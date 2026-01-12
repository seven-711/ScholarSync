
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Profile, SDPRequirement, SDPRecord, SDPOpportunity, Assignment, Submission } from '../types';
import { Loader2, Plus, CheckCircle, XCircle, Clock, Upload, AlertCircle, FileText, Calendar, AlertOctagon, RefreshCcw, X } from 'lucide-react';

interface ScholarSDPProps {
    profile: Profile;
    onUpdate?: () => void;
}

export const ScholarSDP: React.FC<ScholarSDPProps> = ({ profile, onUpdate }) => {
    const [activeTab, setActiveTab] = useState<'sdp' | 'assignments'>('sdp');

    return (
        <div className="space-y-6">
            {/* Top Level Tabs */}
            <div className="bg-white p-2 rounded-xl border border-gray-200 shadow-sm inline-flex gap-2 mb-2">
                <button
                    onClick={() => setActiveTab('sdp')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'sdp'
                        ? 'bg-rose-900 text-white shadow-md'
                        : 'text-gray-500 hover:text-rose-900 hover:bg-rose-50'
                        }`}
                >
                    <FileText className="w-4 h-4" />
                    SDP Progress
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

            {activeTab === 'sdp' ? (
                <SDPProgress profile={profile} onUpdate={onUpdate} />
            ) : (
                <AssignmentsView profile={profile} onUpdate={onUpdate} />
            )}
        </div>
    );
};

// ==========================================
// SUB-COMPONENT: SDP PROGRESS (Original ScholarSDP)
// ==========================================
const SDPProgress: React.FC<ScholarSDPProps> = ({ profile, onUpdate }) => {
    const [loading, setLoading] = useState(true);
    const [requirements, setRequirements] = useState<SDPRequirement[]>([]);
    const [records, setRecords] = useState<SDPRecord[]>([]);
    const [opportunities, setOpportunities] = useState<SDPOpportunity[]>([]);
    const [selectedOpp, setSelectedOpp] = useState<SDPOpportunity | null>(null);

    // Form State
    const [proof, setProof] = useState('');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            // 1. Fetch Requirements for current Year Level
            const { data: reqs } = await supabase
                .from('sdp_requirements')
                .select('*')
                .eq('year_level', profile.year_level || '1st Year');

            setRequirements(reqs || []);

            // 2. Fetch My Records
            const { data: recs } = await supabase
                .from('sdp_records')
                .select('*')
                .eq('scholar_id', profile.id)
                .order('date_conducted', { ascending: false });

            setRecords(recs || []);
            // 3. Fetch Opportunities (Global + My School)
            const { data: opps } = await supabase
                .from('sdp_opportunities')
                .select('*')
                .order('date_of_activity', { ascending: true });

            const filteredOpps = (opps as any[] || []).filter(o =>
                !o.school || o.school === profile.school
            );

            setOpportunities(filteredOpps);

        } catch (error) {
            console.error("Error fetching SDP data:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 5 * 1024 * 1024) {
                alert("File size must be less than 5MB");
                return;
            }
            const reader = new FileReader();
            reader.onloadend = () => {
                setProof(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedOpp) return;
        setSubmitting(true);

        try {
            const { error } = await supabase.from('sdp_records').insert([{
                scholar_id: profile.id,
                activity_name: selectedOpp.title,
                description: selectedOpp.description,
                date_conducted: selectedOpp.date_of_activity,
                proof_data: proof,
                status: 'submitted'
            }]);

            if (error) throw error;

            setSelectedOpp(null);
            setProof('');
            fetchData();
            if (onUpdate) onUpdate();
        } catch (err) {
            console.error(err);
            alert("Failed to submit record.");
        } finally {
            setSubmitting(false);
        }
    };

    const hasSubmitted = (oppTitle: string) => {
        return records.some(r => r.activity_name === oppTitle && r.status !== 'rejected');
    };

    const totalActivities = records.filter(r => r.status === 'approved').length;
    const requiredTotal = requirements.reduce((sum, r) => sum + (r.required_hours || 0), 0);
    const progressPercent = requiredTotal > 0 ? Math.min(100, (totalActivities / requiredTotal) * 100) : 0;

    if (loading) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-rose-900" /></div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">Scholar Development Program</h2>
                    <p className="text-gray-500">View opportunities and track progress.</p>
                </div>
            </div>

            {/* Progress Card */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <Clock className="w-5 h-5 text-rose-900" /> Current Progress ({profile.year_level})
                </h3>
                <div className="mb-2 flex justify-between text-sm font-medium">
                    <span className="text-gray-600">{totalActivities} / {requiredTotal} Activities Completed</span>
                    <span className="text-gray-600">Target: {requiredTotal}</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                    <div
                        className="bg-rose-900 h-full rounded-full transition-all duration-1000"
                        style={{ width: `${progressPercent}%` }}
                    />
                </div>

                <div className="mt-6">
                    <h4 className="font-bold text-gray-900 mb-4">Available Opportunities</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {opportunities.map(opp => {
                            const submitted = hasSubmitted(opp.title);
                            return (
                                <div key={opp.id} className="p-5 bg-white border border-gray-200 rounded-xl hover:border-rose-200 transition-colors shadow-sm relative overflow-hidden group">
                                    <div className={`absolute top-0 right-0 px-3 py-1 rounded-bl-xl text-[10px] font-bold uppercase tracking-wider ${!opp.school ? 'bg-indigo-900 text-white' : 'bg-rose-900 text-white'}`}>
                                        {!opp.school ? 'Global Opportunity (CEDO)' : `${opp.school} Activity`}
                                    </div>

                                    <h4 className="font-bold text-gray-900 text-lg mt-2">{opp.title}</h4>

                                    <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                                        <div className="flex items-center gap-1">
                                            <Calendar className="w-4 h-4 text-rose-900" />
                                            <span>{new Date(opp.date_of_activity).toLocaleDateString()}</span>
                                        </div>
                                        {opp.location && (
                                            <div className="flex items-center gap-1">
                                                <span className="font-bold text-rose-900">@</span>
                                                <span>{opp.location}</span>
                                            </div>
                                        )}
                                    </div>

                                    <p className="text-sm text-gray-500 mt-3 line-clamp-2">{opp.description}</p>

                                    <div className="mt-4 pt-4 border-t border-gray-50">
                                        {submitted ? (
                                            <button disabled className="w-full py-2 bg-green-50 text-green-700 font-bold rounded-lg flex items-center justify-center gap-2 cursor-not-allowed">
                                                <CheckCircle className="w-4 h-4" /> Completed / Submitted
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => setSelectedOpp(opp)}
                                                className="w-full py-2 bg-rose-900 text-white font-bold rounded-lg hover:bg-rose-950 flex items-center justify-center gap-2"
                                            >
                                                Submit Proof
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                        {opportunities.length === 0 && (
                            <div className="col-span-2 text-center p-8 text-gray-400 italic bg-gray-50 rounded-lg">
                                No active opportunities available at this time.
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* History List */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-6 border-b border-gray-100">
                    <h3 className="font-bold text-gray-900">Activity History</h3>
                </div>
                <div className="divide-y divide-gray-100">
                    {records.length === 0 ? (
                        <div className="p-8 text-center text-gray-500">No activities recorded yet.</div>
                    ) : records.map((record) => (
                        <div key={record.id} className="p-6 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    {record.status === 'approved' && <CheckCircle className="w-4 h-4 text-green-500" />}
                                    {record.status === 'rejected' && <XCircle className="w-4 h-4 text-red-500" />}
                                    {record.status === 'submitted' && <Clock className="w-4 h-4 text-orange-500" />}
                                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full capitalize ${record.status === 'approved' ? 'bg-green-100 text-green-700' :
                                        record.status === 'rejected' ? 'bg-red-100 text-red-700' :
                                            'bg-orange-100 text-orange-700'
                                        }`}>{record.status}</span>
                                </div>
                                <h4 className="font-bold text-gray-900">{record.activity_name}</h4>
                                <p className="text-sm text-gray-600 line-clamp-1">{record.description}</p>
                                <div className="text-xs text-gray-400 mt-1 flex gap-4">
                                    <span>{new Date(record.date_conducted).toLocaleDateString()}</span>
                                </div>
                                {record.admin_feedback && (
                                    <div className="mt-2 bg-red-50 p-2 rounded text-xs text-red-700 border border-red-100">
                                        <strong>Feedback:</strong> {record.admin_feedback}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Submit Modal */}
            {selectedOpp && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                            <h3 className="font-bold text-lg">Submit Activity Proof</h3>
                            <button onClick={() => setSelectedOpp(null)} className="text-gray-400 hover:text-gray-600"><XCircle className="w-6 h-6" /></button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div className="bg-rose-50 p-4 rounded-lg border border-rose-100">
                                <h4 className="font-bold text-rose-900">{selectedOpp.title}</h4>
                                <div className="text-sm text-rose-800 mt-1 flex gap-4">
                                    <span>{new Date(selectedOpp.date_of_activity).toLocaleDateString()}</span>
                                    <span>{selectedOpp.location}</span>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Proof of Participation</label>
                                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:bg-gray-50 relative">
                                    <input
                                        type="file"
                                        accept="image/*,.pdf"
                                        required
                                        onChange={handleFileChange}
                                        className="absolute inset-0 w-full h-full opacity-0"
                                    />
                                    {proof ? (
                                        <div className="text-green-600 font-bold flex items-center justify-center gap-2">
                                            <CheckCircle className="w-5 h-5" /> File Attached
                                        </div>
                                    ) : (
                                        <div className="text-gray-500 flex flex-col items-center">
                                            <Upload className="w-8 h-8 mb-2 text-rose-300" />
                                            <span className="text-sm font-medium">Click to upload certificate or photo</span>
                                            <span className="text-xs text-gray-400 mt-1">Max 5MB (Image or PDF)</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="pt-4 flex gap-3">
                                <button type="button" onClick={() => setSelectedOpp(null)} className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-lg font-bold">Cancel</button>
                                <button type="submit" disabled={submitting} className="flex-1 py-2.5 bg-rose-900 text-white rounded-lg font-bold hover:bg-rose-950 disabled:opacity-50">
                                    {submitting ? 'Submitting...' : 'Submit Proof'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

// ==========================================
// SUB-COMPONENT: ASSIGNMENTS VIEW (Original ScholarAssignments)
// ==========================================
const AssignmentsView: React.FC<ScholarSDPProps> = ({ profile, onUpdate }) => {
    const [assignments, setAssignments] = useState<Assignment[]>([]);
    const [submissionsMap, setSubmissionsMap] = useState<Map<string, Submission>>(new Map());

    const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
    const [submissionText, setSubmissionText] = useState('');
    const [fileBase64, setFileBase64] = useState<string>('');
    const [submitting, setSubmitting] = useState(false);

    // Flash Data State
    const [flashMessage, setFlashMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    useEffect(() => {
        fetchAssignments();
    }, []);

    const fetchAssignments = async () => {
        const { data: assignData } = await supabase.from('assignments').select('*').order('due_date', { ascending: true });

        const { data: subData } = await supabase
            .from('submissions')
            .select('*')
            .eq('scholar_id', profile.id);

        setAssignments(assignData as Assignment[] || []);

        const subMap = new Map<string, Submission>();
        subData?.forEach((s: any) => subMap.set(s.assignment_id, s));
        setSubmissionsMap(subMap);
    };

    const handleSelectAssignment = (assign: Assignment) => {
        // Reset flash message when switching
        setFlashMessage(null);

        const sub = submissionsMap.get(assign.id);
        if (sub && sub.status !== 'returned') return;

        if (sub && sub.status === 'returned') {
            setSubmissionText(sub.content || '');
            setFileBase64(sub.photo_data || '');
        } else {
            setSubmissionText('');
            setFileBase64('');
        }

        setSelectedAssignment(assign);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setFileBase64(reader.result as string);
                // Clear error if they upload a file
                if (flashMessage?.type === 'error' && flashMessage.text.includes('photo')) {
                    setFlashMessage(null);
                }
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setFlashMessage(null);

        if (!selectedAssignment) return;

        if (selectedAssignment.requires_photo && !fileBase64) {
            setFlashMessage({ type: 'error', text: "This assignment requires a photo submission. Please upload proof." });
            return;
        }

        setSubmitting(true);
        const existingSub = submissionsMap.get(selectedAssignment.id);

        try {
            if (existingSub) {
                const { error } = await supabase
                    .from('submissions')
                    .update({
                        content: submissionText,
                        photo_data: fileBase64,
                        status: 'submitted',
                        feedback: null
                    })
                    .eq('id', existingSub.id);

                if (error) throw error;
            } else {
                const { error } = await supabase.from('submissions').insert([{
                    assignment_id: selectedAssignment.id,
                    scholar_id: profile.id,
                    content: submissionText,
                    photo_data: fileBase64,
                    status: 'submitted'
                }]);

                if (error) throw error;
            }

            setFlashMessage({ type: 'success', text: "Assignment submitted successfully!" });

            // Notify parent to refresh notifications (clearing "returned" status badge)
            if (onUpdate) onUpdate();

            // Delay closing to show success message
            setTimeout(() => {
                setSelectedAssignment(null);
                setSubmissionText('');
                setFileBase64('');
                setFlashMessage(null);
                fetchAssignments();
            }, 1500);

        } catch (err) {
            console.error(err);
            setFlashMessage({ type: 'error', text: "Error submitting assignment. Please try again." });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900">My Assignments</h2>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                    {assignments.map((assign) => {
                        const submission = submissionsMap.get(assign.id);
                        const isSubmitted = !!submission;
                        const isReturned = submission?.status === 'returned';
                        const isDue = new Date(assign.due_date) < new Date();

                        return (
                            <div
                                key={assign.id}
                                className={`bg-white border rounded-xl p-5 cursor-pointer transition-all ${selectedAssignment?.id === assign.id
                                    ? 'border-rose-500 ring-1 ring-rose-500 shadow-md'
                                    : 'border-gray-100 shadow-sm hover:border-rose-300'
                                    }`}
                                onClick={() => handleSelectAssignment(assign)}
                            >
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h3 className="font-bold text-gray-900">{assign.title}</h3>
                                        <p className="text-sm text-gray-500 mb-2">{new Date(assign.due_date).toLocaleDateString()}</p>
                                    </div>
                                    {isReturned ? (
                                        <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1 animate-pulse">
                                            <AlertOctagon className="w-3 h-3" /> Action Required
                                        </span>
                                    ) : isSubmitted ? (
                                        <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
                                            <CheckCircle className="w-3 h-3" /> Submitted
                                        </span>
                                    ) : isDue ? (
                                        <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
                                            <AlertCircle className="w-3 h-3" /> Past Due
                                        </span>
                                    ) : (
                                        <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
                                            <Clock className="w-3 h-3" /> To Do
                                        </span>
                                    )}
                                </div>
                                <p className="text-gray-600 text-sm mt-2">{assign.description}</p>
                            </div>
                        );
                    })}
                </div>

                <div>
                    {selectedAssignment ? (
                        <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100 sticky top-8">
                            <h2 className="text-xl font-bold text-gray-900 mb-1">
                                {submissionsMap.get(selectedAssignment.id)?.status === 'returned' ? 'Resubmit Assignment' : 'Submit Assignment'}
                            </h2>
                            <p className="text-sm text-gray-500 mb-6">Task: <span className="font-medium text-gray-900">{selectedAssignment.title}</span></p>

                            {/* FLASH MESSAGE */}
                            {flashMessage && (
                                <div className={`mb-6 p-4 rounded-lg flex items-start gap-3 animate-in fade-in slide-in-from-top-2 border ${flashMessage.type === 'error'
                                    ? 'bg-red-50 text-red-800 border-red-200'
                                    : 'bg-green-50 text-green-800 border-green-200'
                                    }`}>
                                    {flashMessage.type === 'error' ? (
                                        <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-600" />
                                    ) : (
                                        <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-green-600" />
                                    )}
                                    <div className="flex-1">
                                        <p className="font-bold text-sm">{flashMessage.type === 'error' ? 'Submission Failed' : 'Success'}</p>
                                        <p className="text-sm">{flashMessage.text}</p>
                                    </div>
                                    <button onClick={() => setFlashMessage(null)} className="text-gray-400 hover:text-gray-600">
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            )}

                            {submissionsMap.get(selectedAssignment.id)?.status === 'returned' && (
                                <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800 animate-in fade-in slide-in-from-top-2">
                                    <div className="flex items-center gap-2 font-bold mb-1 text-amber-900">
                                        <AlertOctagon className="w-4 h-4" />
                                        Returned by Admin
                                    </div>
                                    <p className="mb-2">Please address the feedback below and resubmit your work:</p>
                                    <div className="p-3 bg-white border border-amber-100 rounded italic text-gray-600">
                                        "{submissionsMap.get(selectedAssignment.id)?.feedback}"
                                    </div>
                                </div>
                            )}

                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Your Work / Notes</label>
                                    <textarea
                                        rows={5}
                                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
                                        placeholder="Type your answer or notes here..."
                                        value={submissionText}
                                        onChange={e => setSubmissionText(e.target.value)}
                                    />
                                </div>

                                {selectedAssignment.requires_photo && (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Photo Proof (Required)</label>
                                        <div className={`border-2 border-dashed rounded-lg p-4 text-center hover:bg-gray-50 transition-colors ${flashMessage?.type === 'error' && flashMessage.text.includes('photo')
                                            ? 'border-red-300 bg-red-50'
                                            : 'border-gray-200'
                                            }`}>
                                            <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" id="file-upload" />
                                            <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center">
                                                {fileBase64 ? (
                                                    <img src={fileBase64} alt="Preview" className="h-32 object-contain mb-2 rounded shadow-sm" />
                                                ) : (
                                                    <Upload className={`w-8 h-8 mb-2 ${flashMessage?.type === 'error' ? 'text-red-400' : 'text-gray-400'}`} />
                                                )}
                                                <span className={`text-sm ${flashMessage?.type === 'error' ? 'text-red-600 font-bold' : 'text-gray-500'}`}>
                                                    {fileBase64 ? 'Change Photo' : 'Click to upload photo'}
                                                </span>
                                            </label>
                                        </div>
                                    </div>
                                )}

                                <div className="flex justify-end gap-3 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => { setSelectedAssignment(null); setFlashMessage(null); }}
                                        className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={submitting}
                                        className="px-6 py-2 bg-rose-900 text-white rounded-lg hover:bg-rose-950 shadow-md transition-colors flex items-center gap-2"
                                    >
                                        {submitting ? 'Processing...' : submissionsMap.get(selectedAssignment.id)?.status === 'returned' ? (
                                            <> <RefreshCcw className="w-4 h-4" /> Resubmit Work </>
                                        ) : 'Submit Assignment'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    ) : (
                        <div className="h-full flex items-center justify-center p-8 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 text-gray-400">
                            <div className="text-center">
                                <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                                <p>Select an assignment to view details or submit.</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
