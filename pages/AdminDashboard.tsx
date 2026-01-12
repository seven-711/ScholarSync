import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { Users, BookOpen, AlertCircle, CheckCircle2, Clock, FileText, Check, X, Activity, Shield, AlertTriangle, UserX, Loader2, IdCard, Building, Mail, Calendar, GraduationCap, Eye } from 'lucide-react';
import { Profile, Submission, UserRole } from '../types';
import { ImagePreviewModal } from '../components/ImagePreviewModal';

interface Props {
  profile?: Profile;
  onUpdate?: () => void;
}

export const AdminDashboard: React.FC<Props> = ({ profile, onUpdate }) => {
  const [stats, setStats] = useState({
    pendingOfficers: 0, // NEW: For Super Admin
    pendingScholars: 0,
    activeScholars: 0,
    activeAssignments: 0,
    totalSubmissions: 0,
    sdpSubmissionCount: 0
  });

  const [recentPending, setRecentPending] = useState<Profile[]>([]); // Can contain Scholars OR Admins depending on viewer
  const [recentSubmissions, setRecentSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal & Processing State
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Review Modal State (Replaces simple reject modal)
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [scholarToReview, setScholarToReview] = useState<Profile | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      if (stats.totalSubmissions === 0 && loading) setLoading(true);

      // Queries
      // Queries
      let pendingQuery = supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('is_approved', false);
      // SUPER ADMIN: Approves 'admin' role (School Officers)
      // SCHOOL ADMIN: Approves 'scholar' role

      if (profile?.role === UserRole.SUPER_ADMIN) {
        pendingQuery = pendingQuery.eq('role', 'admin');
      } else {
        pendingQuery = pendingQuery.eq('role', 'scholar');
      }

      let activeQuery = supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'scholar').eq('is_approved', true);
      let sdpQuery = supabase.from('sdp_records').select('*', { count: 'exact', head: true });

      // SCOPE FILTER (For School Admin)
      if (profile?.role !== UserRole.SUPER_ADMIN && profile?.school) {
        pendingQuery = pendingQuery.eq('school', profile.school); // Ensure filtering by school for scholars
        activeQuery = activeQuery.eq('school', profile.school);
        // ... (SDP logic remains same)

        // Complex filter for SDP records relation requires specific join or view, 
        // for now assuming we can filter if we had a school column or joined. 
        // Since sdp_records relates to scholar, we can't easily deep filter with count only in one simple line without join.
        // For dashboard high-level stats, we might need to accept global count or fetch filtered via rpc/join if critical.
        // Simplification for prototype: kept global for stats or refine later. 
        // actually... let's try to be precise if possible, otherwise leave it global for MVP.
        // Given complexity, let's keep SDP count global on dashboard for now or matching filtering in detailed view.
      }

      const { count: pending } = await pendingQuery;

      // Update Stats
      const isSuper = profile?.role === UserRole.SUPER_ADMIN;

      // Fetch other counts
      const { count: active } = await activeQuery;
      const { count: assignments } = await supabase.from('assignments').select('*', { count: 'exact', head: true });
      const { count: submissions } = await supabase.from('submissions').select('*', { count: 'exact', head: true });
      const { count: sdpSubs } = await sdpQuery;

      setStats({
        pendingOfficers: isSuper ? (pending || 0) : 0,
        pendingScholars: !isSuper ? (pending || 0) : 0,
        activeScholars: active || 0,
        activeAssignments: assignments || 0,
        totalSubmissions: submissions || 0,
        sdpSubmissionCount: sdpSubs || 0
      });

      let recentPendingQuery = supabase.from('profiles').select('*').eq('is_approved', false).order('created_at', { ascending: false }).limit(10);

      if (isSuper) {
        recentPendingQuery = recentPendingQuery.eq('role', 'admin');
      } else {
        recentPendingQuery = recentPendingQuery.eq('role', 'scholar');
        if (profile?.school) recentPendingQuery = recentPendingQuery.eq('school', profile.school);
      }

      const { data: pendingData } = await recentPendingQuery;

      setRecentPending(pendingData as Profile[] || []);

      // Try fetching submissions with JOIN
      try {
        const { data: submissionData, error } = await supabase
          .from('submissions')
          .select(`
            *,
            scholar:profiles (full_name),
            assignment:assignments (title)
          `)
          .order('submitted_at', { ascending: false })
          .limit(5);

        if (error) throw error;
        setRecentSubmissions(submissionData as Submission[] || []);
      } catch (e) {
        // Fallback for submissions if join fails
        console.warn("Submissions feed join failed, using fallback");
        const { data: fallbackSub } = await supabase
          .from('submissions')
          .select('*')
          .order('submitted_at', { ascending: false })
          .limit(5);

        // Map to prevent crash
        const mapped = (fallbackSub || []).map((s: any) => ({
          ...s,
          scholar: { full_name: 'Unknown Scholar' },
          assignment: { title: 'Assignment' }
        }));
        setRecentSubmissions(mapped);
      }

    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (profile) fetchData();
  }, [profile]);

  const openReviewModal = (scholar: Profile) => {
    setScholarToReview(scholar);
    setShowReviewModal(true);
  };

  const handleApprove = async () => {
    if (!scholarToReview) return;
    setProcessingId(scholarToReview.id);
    try {
      const { error } = await supabase.from('profiles').update({ is_approved: true }).eq('id', scholarToReview.id);
      if (error) throw error;
      setShowReviewModal(false);
      setScholarToReview(null);
      await fetchData();
      if (onUpdate) onUpdate();
    } catch (err) {
      console.error("Error approving scholar:", err);
      alert("Failed to approve scholar.");
    } finally {
      setProcessingId(null);
    }
  };

  /* New State for Rejection Modal */
  const [showRejectConfirm, setShowRejectConfirm] = useState(false);

  // ... (inside handleReject)
  const handleReject = () => {
    if (!scholarToReview) return;
    setShowRejectConfirm(true);
  };

  const confirmReject = async () => {
    if (!scholarToReview) return;

    setProcessingId(scholarToReview.id);
    try {
      const { error } = await supabase.from('profiles').delete().eq('id', scholarToReview.id);
      if (error) throw error;
      setShowReviewModal(false);
      setShowRejectConfirm(false); // Close confirm
      setScholarToReview(null);
      await fetchData();
      if (onUpdate) onUpdate();
    } catch (err) {
      console.error("Error rejecting:", err);
      alert("Failed to reject request.");
    } finally {
      setProcessingId(null);
    }
  };

  // ... (Rest of component remains largely the same, just rendering logic)
  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/4"></div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-32 bg-gray-100 rounded-xl"></div>)}
        </div>
      </div>
    );
  }

  const pendingCount = profile?.role === UserRole.SUPER_ADMIN ? stats.pendingOfficers : stats.pendingScholars;
  const totalUsers = stats.activeScholars + pendingCount;
  const activePercentage = totalUsers > 0 ? (stats.activeScholars / totalUsers) * 100 : 0;

  // Risk logic (Mocked for visualization based on sdpSubmissionCount vs activeScholars)
  // Assuming each scholar needs at least 1 record...
  const complianceRate = stats.activeScholars > 0 ? (stats.sdpSubmissionCount / stats.activeScholars) * 100 : 0;
  const riskLevel = complianceRate > 80 ? 'Low' : complianceRate > 50 ? 'Medium' : 'High';

  return (
    <div className="space-y-6 md:space-y-8 relative">

      {/* REJECTION CONFIRMATION MODAL */}
      {showRejectConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 text-center transform transition-all animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8 text-red-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Confirm Rejection</h3>
            <p className="text-gray-600 mb-6 text-sm">
              Are you sure you want to reject this applicant? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowRejectConfirm(false)}
                className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors"
                disabled={!!processingId}
              >
                Cancel
              </button>
              <button
                onClick={confirmReject}
                className="flex-1 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-colors shadow-lg shadow-red-200 flex items-center justify-center gap-2"
                disabled={!!processingId}
              >
                {processingId ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REVIEW MODAL */}
      {showReviewModal && scholarToReview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full overflow-hidden border border-gray-100 flex flex-col md:flex-row max-h-[90vh]">

            {/* ID Photo Side */}
            <div className="w-full md:w-1/2 bg-gray-100 p-6 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-gray-200">
              {scholarToReview.id_photo_data ? (
                <div onClick={() => setPreviewImage(scholarToReview.id_photo_data || null)} className="relative group cursor-pointer">
                  <img src={scholarToReview.id_photo_data} alt="Scholar ID" className="max-w-full max-h-[300px] object-contain rounded-lg shadow-md border border-gray-300 transition-opacity group-hover:opacity-90" />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20 rounded-lg">
                    <Eye className="w-8 h-8 text-white drop-shadow-md" />
                  </div>
                </div>
              ) : (
                <div className="w-32 h-20 bg-gray-200 rounded flex items-center justify-center text-gray-400">
                  <IdCard className="w-8 h-8" />
                </div>
              )}
              <p className="mt-3 text-xs font-bold text-gray-500 uppercase tracking-widest">Submitted ID Proof</p>
            </div>

            {/* Details Side */}
            <div className="w-full md:w-1/2 p-6 flex flex-col">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-xl font-bold text-gray-900">Review Request</h3>
                <button onClick={() => setShowReviewModal(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4 flex-1 overflow-y-auto">
                <div>
                  <label className="text-xs text-gray-500 font-bold uppercase">Applicant Name</label>
                  <p className="font-bold text-gray-900 text-lg">{scholarToReview.full_name}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {scholarToReview.role === 'admin' ? (
                    <div className="col-span-2">
                      <label className="text-xs text-gray-500 font-bold uppercase flex items-center gap-1"><Building className="w-3 h-3" /> School Name</label>
                      <p className="text-gray-800">{scholarToReview.school || 'N/A'}</p>
                    </div>
                  ) : (
                    <>
                      <div className="col-span-2">
                        <label className="text-xs text-gray-500 font-bold uppercase flex items-center gap-1"><Building className="w-3 h-3" /> School Name</label>
                        <p className="text-gray-800">{scholarToReview.school || 'N/A'}</p>
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 font-bold uppercase flex items-center gap-1"><Building className="w-3 h-3" /> Department</label>
                        <p className="text-gray-800">{scholarToReview.department || 'N/A'}</p>
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 font-bold uppercase flex items-center gap-1"><GraduationCap className="w-3 h-3" /> Year Level</label>
                        <p className="text-gray-800">{scholarToReview.year_level || 'N/A'}</p>
                      </div>
                    </>
                  )}
                </div>

                <div>
                  <label className="text-xs text-gray-500 font-bold uppercase flex items-center gap-1"><Mail className="w-3 h-3" /> Email</label>
                  <p className="text-gray-800 font-mono text-sm">{scholarToReview.email}</p>
                </div>
              </div>

              <div className="mt-8 pt-4 border-t border-gray-100 flex gap-3">
                <button
                  onClick={handleReject}
                  disabled={!!processingId}
                  className="flex-1 py-2.5 bg-white border border-red-200 text-red-600 font-bold rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                >
                  Reject
                </button>
                <button
                  onClick={handleApprove}
                  disabled={!!processingId}
                  className="flex-1 py-2.5 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {processingId ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Approve
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between border-b border-gray-200 pb-6 gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-3">
            <Shield className="w-7 h-7 md:w-8 md:h-8 text-orange-600" />
            Admin Control Center
          </h1>
          <p className="text-gray-500 mt-2 text-sm">System Overview & Monitoring Dashboard</p>
        </div>
        <button onClick={fetchData} className="w-full md:w-auto px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium text-sm transition-colors shadow-sm flex items-center justify-center gap-2">
          <Activity className="w-4 h-4" /> Refresh Data
        </button>
      </div>

      {/* ALERT BANNER */}
      {pendingCount > 0 && (
        <div className="bg-orange-50 border-l-4 border-orange-500 p-4 md:p-6 rounded-r-xl shadow-sm flex flex-col md:flex-row items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-4 w-full">
            <div className="p-3 bg-orange-100 text-orange-600 rounded-full flex-shrink-0">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-orange-900">Action Required: {pendingCount} Pending</h3>
              <p className="text-orange-700 text-sm">
                {profile?.role === UserRole.SUPER_ADMIN ? 'New School Coordinator requests.' : 'New scholars waiting for review.'}
              </p>
            </div>
          </div>
          <button
            onClick={() => document.getElementById('pending-table')?.scrollIntoView({ behavior: 'smooth' })}
            className="w-full md:w-auto px-5 py-2.5 bg-orange-600 text-white font-bold rounded-lg hover:bg-orange-700 transition-colors shadow-md whitespace-nowrap"
          >
            Review Now
          </button>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">

        {/* PENDING APPROVALS */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
            <AlertCircle className="w-24 h-24 text-amber-600" />
          </div>
          <div className="relative z-10">
            <div className="flex justify-between items-start mb-2">
              <p className="text-xs font-bold text-amber-800 uppercase tracking-wider">Pending</p>
              <div className="p-2 bg-amber-100 rounded-lg text-amber-600">
                <Clock className="w-5 h-5" />
              </div>
            </div>
            <p className="text-4xl font-extrabold text-amber-900">{pendingCount}</p>
            <p className="text-xs font-medium text-amber-700 mt-2 flex items-center gap-1">
              {pendingCount > 0 ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-amber-600 animate-pulse"></span>
                  Review Needed
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3 h-3" />
                  All Caught Up
                </>
              )}
            </p>
          </div>
        </div>

        {/* ACTIVE SCHOLARS */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between group hover:border-blue-300 transition-colors">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Active Users</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{stats.activeScholars}</p>
            </div>
            <div className="p-2 bg-blue-50 rounded-lg group-hover:bg-blue-100 transition-colors">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
          </div>
          <div className="mt-4 w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
            <div className="bg-blue-500 h-full rounded-full" style={{ width: `${activePercentage}%` }}></div>
          </div>
        </div>

        {/* OPEN ASSIGNMENTS */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between group hover:border-emerald-300 transition-colors">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Assignments</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{stats.activeAssignments}</p>
            </div>
            <div className="p-2 bg-emerald-50 rounded-lg group-hover:bg-emerald-100 transition-colors">
              <BookOpen className="w-5 h-5 text-emerald-600" />
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-2">Active tasks</p>
        </div>

        {/* SUBMISSIONS */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between group hover:border-purple-300 transition-colors">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Submissions</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{stats.totalSubmissions}</p>
            </div>
            <div className="p-2 bg-purple-50 rounded-lg group-hover:bg-purple-100 transition-colors">
              <FileText className="w-5 h-5 text-purple-600" />
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-2">Total received</p>
        </div>

        {/* SDP COMPLIANCE (New) */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between group hover:border-pink-300 transition-colors">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">SDP Risk Level</p>
              <p className={`text-3xl font-bold mt-1 ${riskLevel === 'High' ? 'text-red-600' : riskLevel === 'Medium' ? 'text-orange-500' : 'text-green-600'
                }`}>{riskLevel}</p>
            </div>
            <div className="p-2 bg-pink-50 rounded-lg group-hover:bg-pink-100 transition-colors">
              <Activity className="w-5 h-5 text-pink-600" />
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-2">{stats.sdpSubmissionCount} Activities Logged</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">

        {/* Main Content Area - 2 Cols */}
        <div className="lg:col-span-2 space-y-6 md:space-y-8">

          {/* ACTION QUEUE */}
          <div id="pending-table" className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-5 border-b border-gray-200 bg-gray-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <h3 className="font-bold text-gray-900 flex items-center gap-2">
                  <Shield className="w-5 h-5 text-indigo-600" />
                  Approval Queue ({profile?.role === UserRole.SUPER_ADMIN ? 'Officers' : 'Scholars'})
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  {profile?.role === UserRole.SUPER_ADMIN ? 'Approve/Reject School Coordinators' : 'Manage scholar access requests'}
                </p>
              </div>
              {pendingCount > 0 && (
                <span className="bg-amber-100 text-amber-800 text-xs font-bold px-3 py-1 rounded-full border border-amber-200 self-start sm:self-auto">
                  {pendingCount} Waiting
                </span>
              )}
            </div>

            {recentPending.length === 0 ? (
              <div className="p-12 text-center flex flex-col items-center justify-center bg-white">
                <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mb-4">
                  <CheckCircle2 className="w-8 h-8 text-green-500" />
                </div>
                <p className="text-gray-900 font-bold text-lg">All Caught Up</p>
                <p className="text-sm text-gray-500 mt-1">There are no pending registration requests at this time.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50 text-gray-500 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 font-medium min-w-[150px]">Applicant</th>
                      <th className="px-6 py-3 font-medium hidden sm:table-cell">Details</th>
                      <th className="px-6 py-3 font-medium">Status</th>
                      <th className="px-6 py-3 font-medium text-right min-w-[140px]">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {recentPending.map((scholar) => (
                      <tr key={scholar.id} className="hover:bg-amber-50/30 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-bold text-gray-900">{scholar.full_name}</div>
                          <div className="font-mono text-gray-500 text-xs sm:hidden mt-1">{scholar.school}</div>
                        </td>
                        <td className="px-6 py-4 font-mono text-gray-600 text-xs hidden sm:table-cell">
                          {scholar.role === 'admin' ? (
                            <span className="flex items-center gap-1 font-bold text-indigo-900"><Building className="w-3 h-3" /> {scholar.school}</span>
                          ) : (
                            scholar.email
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200">
                            <Clock className="w-3 h-3" /> Pending
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => openReviewModal(scholar)}
                              className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors text-xs font-bold"
                            >
                              <IdCard className="w-3 h-3" />
                              Review
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right Sidebar - Activity Feed */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 h-full flex flex-col">
            <div className="p-5 border-b border-gray-200 bg-gray-50/50">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <Activity className="w-4 h-4 text-gray-500" />
                Live Activity Feed
              </h3>
            </div>

            <div className="flex-1 overflow-y-auto max-h-[500px] lg:max-h-[600px] p-0">
              {recentSubmissions.length === 0 ? (
                <div className="p-8 text-center text-gray-400 text-sm">No recent activity.</div>
              ) : (
                <div className="relative">
                  <div className="absolute left-6 top-0 bottom-0 w-px bg-gray-100"></div>

                  {recentSubmissions.map((sub, idx) => (
                    <div key={sub.id} className="relative pl-12 pr-4 py-4 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0">
                      <div className="absolute left-[21px] top-5 w-2.5 h-2.5 rounded-full border-2 border-white bg-indigo-500 shadow-sm z-10"></div>
                      <div className="flex justify-between items-start">
                        <p className="text-xs font-bold text-gray-900">{(sub.scholar as any)?.full_name || 'Unknown Scholar'}</p>
                        <span className="text-[10px] text-gray-400">{new Date(sub.submitted_at).toLocaleDateString()}</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">
                        Submitted: <span className="text-indigo-700 font-medium">{(sub.assignment as any)?.title || 'Assignment'}</span>
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* IMAGE PREVIEW MODAL */}
      {previewImage && (
        <ImagePreviewModal
          imageUrl={previewImage}
          onClose={() => setPreviewImage(null)}
          title="Applicant ID Document"
        />
      )}
    </div>
  );
};