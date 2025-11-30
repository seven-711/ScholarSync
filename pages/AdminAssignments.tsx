import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { Assignment, Submission } from '../types';
import { Plus, Calendar, FileText, ChevronDown, ChevronUp, Camera, Check, Search, ChevronLeft, ChevronRight, Eye, X, Loader2, Download, Undo, MessageSquare } from 'lucide-react';

const ITEMS_PER_PAGE = 10;

// Simple error extraction helper
const getErrorText = (error: any) => {
  if (!error) return "Unknown error";
  if (typeof error === 'string') return error;
  if (error?.message) return error.message;
  // Fallback: Try to stringify
  try {
    return JSON.stringify(error);
  } catch {
    return "An unknown error occurred.";
  }
};

export const AdminAssignments: React.FC = () => {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  
  // Submission View State
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [totalSubmissions, setTotalSubmissions] = useState(0);
  const [loadingSubs, setLoadingSubs] = useState(false);
  
  // Pagination & Search State
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Create Form State
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [requiresPhoto, setRequiresPhoto] = useState(false);
  const [dueDate, setDueDate] = useState('');

  // Image Modal State
  const [viewingPhoto, setViewingPhoto] = useState<string | null>(null);

  // Return/Feedback Modal State
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

  // Fetch Submissions with Pagination and Search
  const fetchSubmissions = useCallback(async (assignmentId: string, pageNum: number, search: string) => {
    setLoadingSubs(true);
    
    try {
      // 1. Base Query with Join
      try {
        let query = supabase
          .from('submissions')
          .select(`
            *,
            scholar:profiles (full_name, email)
          `, { count: 'exact' })
          .eq('assignment_id', assignmentId);

        // 2. Apply Search if exists
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
        // Fallback: If join fails, fetch raw submissions
        console.warn("Submissions fetch fallback (join error)");
        const from = (pageNum - 1) * ITEMS_PER_PAGE;
        const to = from + ITEMS_PER_PAGE - 1;

        const { data, count } = await supabase
          .from('submissions')
          .select('*', { count: 'exact' })
          .eq('assignment_id', assignmentId)
          .order('submitted_at', { ascending: false })
          .range(from, to);

        // Add placeholders
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

  // Trigger fetch when pagination or search changes
  useEffect(() => {
    if (expandedId) {
      const delayDebounce = setTimeout(() => {
        fetchSubmissions(expandedId, page, searchQuery);
      }, 300); // Debounce search
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
      setSubmissions([]); // Clear previous view
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

  // Open Return Modal
  const openReturnModal = (submissionId: string) => {
    setSelectedSubmissionId(submissionId);
    setReturnReason('');
    setReturnModalOpen(true);
  };

  // Execute Return
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

      // Close modal and refresh
      setReturnModalOpen(false);
      if (expandedId) fetchSubmissions(expandedId, page, searchQuery);
      
    } catch (err: any) {
      console.error("Error returning assignment:", err);
      // Show specific error message
      alert(`Failed to return assignment: ${getErrorText(err)}`);
    } finally {
      setProcessingReturn(false);
    }
  };

  const totalPages = Math.ceil(totalSubmissions / ITEMS_PER_PAGE);

  return (
    <div className="space-y-6 md:space-y-8 relative">
      {/* PHOTO VIEWER MODAL */}
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

      {/* RETURN FEEDBACK MODAL */}
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
          <h1 className="text-2xl font-bold text-gray-900">Assignment Manager</h1>
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

      {/* CREATE FORM CARD */}
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

      {/* LIST OF ASSIGNMENTS */}
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
              {/* Assignment Header */}
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
                  className={`flex items-center justify-center gap-2 text-sm font-bold px-4 py-2 rounded-xl transition-all border w-full md:w-auto h-12 ${
                    expandedId === assign.id 
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                      : 'bg-white text-gray-500 border-gray-200 hover:border-emerald-200 hover:text-emerald-600'
                  }`}
                >
                  {expandedId === assign.id ? 'Close Manager' : 'Manage Submissions'}
                  {expandedId === assign.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
              </div>
              
              {/* Expanded Submission View */}
              {expandedId === assign.id && (
                <div className="bg-gray-50/50 border-t border-gray-100 p-4 md:p-6 animate-in slide-in-from-top-2">
                  <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    
                    {/* Toolbar */}
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

                    {/* Table View */}
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
                                        <Check className="w-3 h-3" /> Submitted
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

                    {/* Pagination Footer */}
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