
import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { Profile } from '../types';
import { Check, X, Search, Loader2, UserX, UserCheck, Users, Mail, Calendar, Clock, Eye, Building, IdCard, GraduationCap } from 'lucide-react';

interface Props {
  onUpdate?: () => void;
}

export const AdminScholars: React.FC<Props> = ({ onUpdate }) => {
  const [pendingScholars, setPendingScholars] = useState<Profile[]>([]);
  const [activeScholars, setActiveScholars] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Review Modal State
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [scholarToReview, setScholarToReview] = useState<Profile | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchScholars = async () => {
    if (activeScholars.length === 0 && loading) setLoading(true);
    
    const { data: pending } = await supabase.from('profiles').select('*').eq('role', 'scholar').eq('is_approved', false).order('created_at', { ascending: false });
    const { data: active } = await supabase.from('profiles').select('*').eq('role', 'scholar').eq('is_approved', true).order('full_name', { ascending: true });
    
    setPendingScholars(pending as Profile[] || []);
    setActiveScholars(active as Profile[] || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchScholars();
  }, []);

  const openReviewModal = (scholar: Profile) => {
    setScholarToReview(scholar);
    setReviewModalOpen(true);
  };

  const handleApprove = async () => {
    if (!scholarToReview) return;
    setProcessingId(scholarToReview.id);
    try {
      await supabase.from('profiles').update({ is_approved: true }).eq('id', scholarToReview.id);
      setReviewModalOpen(false);
      setScholarToReview(null);
      await fetchScholars();
      if (onUpdate) onUpdate();
    } catch(e) {
      console.error(e);
      alert('Error approving scholar');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async () => {
    if (!scholarToReview) return;
    if (!confirm("Are you sure you want to permanently reject this application?")) return;
    
    setProcessingId(scholarToReview.id);
    try {
      await supabase.from('profiles').delete().eq('id', scholarToReview.id);
      setReviewModalOpen(false);
      setScholarToReview(null);
      await fetchScholars();
      if (onUpdate) onUpdate();
    } catch(e) {
      console.error(e);
      alert('Error rejecting scholar');
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="space-y-6 md:space-y-8 relative">
      
      {/* APPLICATION REVIEW MODAL */}
      {reviewModalOpen && scholarToReview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full overflow-hidden border border-gray-100 flex flex-col md:flex-row max-h-[90vh]">
            
            {/* ID Photo Side */}
            <div className="w-full md:w-1/2 bg-gray-100 p-6 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-gray-200">
               {scholarToReview.id_photo_data ? (
                 <img src={scholarToReview.id_photo_data} alt="Scholar ID" className="max-w-full max-h-[300px] object-contain rounded-lg shadow-md border border-gray-300" />
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
                <h3 className="text-xl font-bold text-gray-900">Application Review</h3>
                <button onClick={() => setReviewModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4 flex-1 overflow-y-auto">
                 <div>
                   <label className="text-xs text-gray-500 font-bold uppercase">Applicant Name</label>
                   <p className="font-bold text-gray-900 text-lg">{scholarToReview.full_name}</p>
                 </div>
                 
                 <div className="grid grid-cols-2 gap-4">
                   <div>
                     <label className="text-xs text-gray-500 font-bold uppercase flex items-center gap-1"><Building className="w-3 h-3" /> Department</label>
                     <p className="text-gray-800">{scholarToReview.department || 'N/A'}</p>
                   </div>
                   <div>
                     <label className="text-xs text-gray-500 font-bold uppercase flex items-center gap-1"><GraduationCap className="w-3 h-3" /> Year Level</label>
                     <p className="text-gray-800">{scholarToReview.year_level || 'N/A'}</p>
                   </div>
                 </div>

                 <div>
                   <label className="text-xs text-gray-500 font-bold uppercase flex items-center gap-1"><Mail className="w-3 h-3" /> Email</label>
                   <p className="text-gray-800 font-mono text-sm">{scholarToReview.email}</p>
                 </div>
                 
                 <div>
                   <label className="text-xs text-gray-500 font-bold uppercase flex items-center gap-1"><Calendar className="w-3 h-3" /> Applied On</label>
                   <p className="text-gray-800 text-sm">{new Date(scholarToReview.created_at || '').toLocaleDateString()}</p>
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

      {/* ... (Rest of UI identical to original file, just ensuring layout rendering matches) ... */}
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
        <div>
           <h1 className="text-2xl font-bold text-gray-900">Scholar Management</h1>
           <p className="text-gray-500">Directory of all registered and pending scholars.</p>
        </div>
        <button onClick={fetchScholars} className="self-start md:self-center p-2 bg-white border border-gray-200 rounded-lg text-gray-500 hover:text-indigo-600 transition-colors shadow-sm">
          <Loader2 className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>
      
      {/* Pending Approvals Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 bg-amber-50 border-b border-amber-100 flex justify-between items-center">
          <h2 className="text-sm font-bold text-amber-900 flex items-center gap-2 uppercase tracking-wide">
            <UserX className="w-4 h-4" />
            Pending Approval Queue
          </h2>
          <span className="bg-amber-200 text-amber-900 text-xs font-bold px-2 py-0.5 rounded-full">
            {pendingScholars.length} Requests
          </span>
        </div>
        
        {pendingScholars.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">
             No pending registration requests.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 text-gray-500 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 font-medium min-w-[150px]">Applicant</th>
                  <th className="px-6 py-3 font-medium hidden sm:table-cell">Dept / Year</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 font-medium text-right min-w-[150px]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pendingScholars.map((scholar) => (
                  <tr key={scholar.id} className="hover:bg-amber-50/20 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-gray-900">{scholar.full_name}</div>
                      <div className="font-mono text-gray-600 text-xs mt-0.5">{scholar.email}</div>
                    </td>
                    <td className="px-6 py-4 text-xs hidden sm:table-cell">
                      <div className="font-bold text-gray-700">{scholar.department || 'N/A'}</div>
                      <div className="text-gray-500">{scholar.year_level || 'N/A'}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200">
                        <Clock className="w-3 h-3" /> Waiting
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end">
                        <button 
                          onClick={() => openReviewModal(scholar)}
                          className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 rounded-md transition-colors text-xs font-bold"
                        >
                          <Eye className="w-3 h-3" />
                          Review Application
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

      {/* Active Scholars Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gray-50">
          <h2 className="text-sm font-bold text-gray-700 flex items-center gap-2 uppercase tracking-wide">
            <UserCheck className="w-4 h-4 text-indigo-600" />
            Active Scholars Directory
          </h2>
          <div className="relative w-full md:w-auto">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input 
              type="text" 
              placeholder="Search..." 
              className="pl-9 pr-4 py-1.5 bg-white border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent w-full md:w-64"
            />
          </div>
        </div>
        
        {activeScholars.length === 0 ? (
          <div className="p-16 text-center text-gray-500">
            No active scholars found.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
             {activeScholars.map((scholar) => (
              <div key={scholar.id} className="border border-gray-200 rounded-lg p-4 hover:border-indigo-300 transition-colors group bg-white shadow-sm">
                <div className="flex items-start justify-between mb-3">
                   <div className="w-10 h-10 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-700 font-bold">
                    {scholar.full_name?.charAt(0).toUpperCase()}
                   </div>
                   <span className="px-2 py-0.5 bg-green-100 text-green-700 text-[10px] font-bold rounded-full border border-green-200">ACTIVE</span>
                </div>
                <h3 className="font-bold text-gray-900 truncate">{scholar.full_name}</h3>
                <div className="flex items-center gap-2 text-xs text-gray-500 mt-1 mb-2">
                   <Mail className="w-3 h-3" />
                   <span className="truncate font-mono">{scholar.email}</span>
                </div>
                
                {(scholar.department || scholar.year_level) && (
                  <div className="mb-3 flex gap-2 text-[10px] font-bold text-gray-600">
                    {scholar.department && <span className="bg-gray-100 px-1.5 py-0.5 rounded">{scholar.department}</span>}
                    {scholar.year_level && <span className="bg-gray-100 px-1.5 py-0.5 rounded">{scholar.year_level}</span>}
                  </div>
                )}

                <div className="pt-3 border-t border-gray-100 flex items-center gap-2 text-[10px] text-gray-400">
                   <Calendar className="w-3 h-3" />
                   Joined {new Date(scholar.created_at || '').toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
