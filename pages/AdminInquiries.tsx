
import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { Inquiry, InquiryMessage } from '../types';
import { MessageCircleQuestion, Send, Loader2, Reply, Check, X, Sparkles, AlertTriangle, CheckCircle2, RotateCcw } from 'lucide-react';
import { generateFastReply } from '../services/geminiService';

interface Props {
  onUpdate?: () => void;
}

// Helper to safely extract error message
const getErrorMessage = (error: any): string => {
  if (!error) return "Unknown error";
  if (typeof error === 'string') return error;
  
  // Specific check for constraint violations
  if (error?.code === '23514') {
    return "Database Schema Error: Status constraint violation. Please click 'Database Config' in the corner and run the SQL to fix.";
  }

  if (error?.message) return error.message;
  if (error?.error_description) return error.error_description;
  
  // Fallback: Try to stringify the object so we see content instead of [object Object]
  try {
    return JSON.stringify(error);
  } catch (e) {
    return "An unexpected error occurred (object could not be stringified).";
  }
};

export const AdminInquiries: React.FC<Props> = ({ onUpdate }) => {
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending'>('all');
  const [dbError, setDbError] = useState<string | null>(null);
  
  // Reply Modal
  const [replyModalOpen, setReplyModalOpen] = useState(false);
  const [selectedInquiry, setSelectedInquiry] = useState<Inquiry | null>(null);
  const [messages, setMessages] = useState<InquiryMessage[]>([]);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  
  // AI State
  const [generating, setGenerating] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchInquiries = async () => {
    setLoading(true);
    setDbError(null);
    let dataToSet: Inquiry[] = [];

    try {
      // 1. Try Main Query with Join
      let query = supabase
        .from('inquiries')
        .select(`
          *,
          scholar:profiles (full_name, email)
        `)
        .order('updated_at', { ascending: false });

      if (filter === 'pending') {
        // 'pending' = initial ticket, 'pending_admin' = scholar replied
        query = query.in('status', ['pending', 'pending_admin']);
      }

      const { data, error } = await query;
      
      if (error) {
        throw error;
      } else {
        setInquiries(data as any[] || []);
      }
    } catch (err: any) {
      console.error("Main query failed (Join Error):", err);
      setDbError(getErrorMessage(err) || "Database relationship missing or connection error.");

      // 2. Fallback Query (No Join)
      try {
        console.warn("Attempting fallback fetch without scholar details...");
        let fallbackQuery = supabase
          .from('inquiries')
          .select('*')
          .order('updated_at', { ascending: false });

        if (filter === 'pending') {
          fallbackQuery = fallbackQuery.in('status', ['pending', 'pending_admin']);
        }
        
        const { data: fallbackData, error: fbError } = await fallbackQuery;
        
        if (fbError) throw fbError;

        if (fallbackData) {
           // Add placeholder scholar info so UI doesn't crash
           dataToSet = fallbackData.map((item: any) => ({
             ...item,
             scholar: { full_name: 'Unknown (DB Error)', email: 'N/A' }
           }));
           setInquiries(dataToSet);
        }
      } catch (fbErr) {
        console.error("Fallback failed:", fbErr);
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (inquiryId: string) => {
    const { data } = await supabase
      .from('inquiry_messages')
      .select('*')
      .eq('inquiry_id', inquiryId)
      .order('created_at', { ascending: true });
    
    setMessages(data as InquiryMessage[] || []);
  };

  useEffect(() => {
    fetchInquiries();
  }, [filter]);

  useEffect(() => {
    if (replyModalOpen && messagesEndRef.current) {
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  }, [messages, replyModalOpen]);

  const openReplyModal = async (inq: Inquiry) => {
    setSelectedInquiry(inq);
    setReplyText('');
    setReplyModalOpen(true);
    await fetchMessages(inq.id);
  };

  const handleAiDraft = async () => {
    if (!selectedInquiry) return;
    setGenerating(true);
    
    // Get last scholar message for context
    const lastMsg = messages.filter(m => m.sender_role === 'scholar').pop()?.message || selectedInquiry.message || '';
    
    const scholarName = (selectedInquiry.scholar as any)?.full_name || 'Student';
    const context = `Scholar Name: ${scholarName}.`;
    
    const draft = await generateFastReply(lastMsg, context);
    setReplyText(draft);
    setGenerating(false);
  };

  const handleSendReply = async () => {
    if (!selectedInquiry || !replyText) return;
    
    setSending(true);
    try {
      // 1. Insert Message
      const { error: msgError } = await supabase.from('inquiry_messages').insert([{
        inquiry_id: selectedInquiry.id,
        sender_role: 'admin',
        message: replyText
      }]);

      if (msgError) throw msgError;

      // 2. Update Inquiry Status
      // Set to 'pending_scholar' to keep ticket open but waiting for scholar.
      const { error } = await supabase
        .from('inquiries')
        .update({
          status: 'pending_scholar', 
          replied_at: new Date().toISOString(),
          scholar_read: false, 
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedInquiry.id);

      if (error) throw error;

      setReplyText(''); 
      await fetchMessages(selectedInquiry.id); 
      
      // Update Local State for UI responsiveness
      const updatedInquiry = { ...selectedInquiry, status: 'pending_scholar' as const };
      setSelectedInquiry(updatedInquiry);
      setInquiries(prev => prev.map(i => i.id === selectedInquiry.id ? updatedInquiry : i));
      
      if (onUpdate) onUpdate();

    } catch (err: any) {
      console.error(err);
      alert(`Error sending reply: ${getErrorMessage(err)}`);
    } finally {
      setSending(false);
    }
  };

  const updateStatus = async (newStatus: 'resolved' | 'pending', specificInquiry?: Inquiry) => {
    const targetInquiry = specificInquiry || selectedInquiry;
    if (!targetInquiry) return;

    // OPTIMISTIC UPDATE: Update UI immediately before DB call
    const previousInquiries = [...inquiries];
    const previousSelected = selectedInquiry;
    
    const updatedInquiryObj = { ...targetInquiry, status: newStatus as any, updated_at: new Date().toISOString() };

    // 1. Update List
    setInquiries(prev => prev.map(i => i.id === targetInquiry.id ? updatedInquiryObj : i));
    
    // 2. Update Modal if open (and matching ID)
    if (selectedInquiry && selectedInquiry.id === targetInquiry.id) {
       setSelectedInquiry(updatedInquiryObj);
    }

    setSending(true);
    try {
      const { error } = await supabase
        .from('inquiries')
        .update({
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', targetInquiry.id);

      if (error) throw error;

      // Success: Notify parent to update badges
      if (onUpdate) onUpdate();

    } catch(err: any) {
      console.error(err);
      // Revert Optimistic Update on Error
      setInquiries(previousInquiries);
      if (selectedInquiry && selectedInquiry.id === targetInquiry.id) {
         setSelectedInquiry(previousSelected);
      }
      alert(`Error updating status: ${getErrorMessage(err)}`);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6 relative">
      
      {/* REPLY MODAL (Chat View) */}
      {replyModalOpen && selectedInquiry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden border border-gray-100 scale-100 animate-in zoom-in-95 duration-200 flex flex-col h-[85vh]">
            {/* Header */}
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <div>
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <Reply className="w-5 h-5 text-orange-600" /> 
                  {(selectedInquiry.scholar as any)?.full_name || 'Scholar'}
                </h3>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-gray-500 max-w-[150px] truncate">{selectedInquiry.subject}</span>
                  <span className={`px-2 py-0.5 rounded-full font-bold ${
                    selectedInquiry.status === 'resolved' ? 'bg-green-100 text-green-700' : 
                    selectedInquiry.status === 'pending_scholar' ? 'bg-blue-100 text-blue-700' :
                    'bg-orange-100 text-orange-700'
                  }`}>
                    {selectedInquiry.status === 'pending_scholar' ? 'Waiting for Scholar' : 
                     selectedInquiry.status === 'pending_admin' ? 'New Reply' : 
                     selectedInquiry.status.replace('_', ' ')}
                  </span>
                </div>
              </div>
              <button onClick={() => setReplyModalOpen(false)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* STATUS TOOLBAR */}
            <div className="px-4 py-2 bg-white border-b border-gray-100 flex gap-2 justify-end">
                {/* Manual Control Buttons */}
                <button 
                  onClick={() => updateStatus('pending', selectedInquiry)}
                  disabled={sending || selectedInquiry.status === 'pending' || selectedInquiry.status === 'pending_admin'}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors border shadow-sm ${
                    selectedInquiry.status === 'pending' || selectedInquiry.status === 'pending_admin' 
                    ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-default'
                    : 'bg-yellow-50 text-yellow-700 border-yellow-200 hover:bg-yellow-100'
                  }`}
                  title="Re-open or Mark as Open"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  {selectedInquiry.status === 'resolved' ? 'Re-open Ticket' : 'Mark Pending'}
                </button>

                <button 
                  onClick={() => updateStatus('resolved', selectedInquiry)}
                  disabled={sending || selectedInquiry.status === 'resolved'}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors border shadow-sm ${
                    selectedInquiry.status === 'resolved'
                    ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-default'
                    : 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Mark Resolved
                </button>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 custom-scrollbar">
              {/* Legacy Message Fallback */}
              {messages.length === 0 && selectedInquiry.message && (
                <div className="flex justify-start">
                   <div className="max-w-[85%] bg-white p-3 rounded-2xl rounded-tl-none border border-gray-200 text-sm text-gray-800 whitespace-pre-wrap shadow-sm">
                      {selectedInquiry.message}
                      <div className="mt-1 text-[10px] text-gray-400">Original Message</div>
                   </div>
                </div>
              )}

              {messages.map((msg) => {
                const isAdmin = msg.sender_role === 'admin';
                return (
                  <div key={msg.id} className={`flex ${isAdmin ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] p-3 rounded-2xl text-sm whitespace-pre-wrap shadow-sm ${
                      isAdmin 
                        ? 'bg-orange-600 text-white rounded-tr-none' 
                        : 'bg-white text-gray-800 rounded-tl-none border border-gray-200'
                    }`}>
                      {msg.message}
                      <div className={`mt-1 text-[10px] ${isAdmin ? 'text-orange-200' : 'text-gray-400'}`}>
                        {new Date(msg.created_at).toLocaleString()}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 border-t border-gray-100 bg-white">
              <div className="flex justify-between items-end mb-2">
                 <label className="text-xs font-bold text-gray-500 uppercase">Response</label>
                 <button 
                   onClick={handleAiDraft}
                   disabled={generating}
                   className="text-xs flex items-center gap-1 text-purple-600 hover:text-purple-700 font-bold bg-purple-50 px-2 py-1 rounded border border-purple-100 transition-colors"
                 >
                   {generating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                   Auto-Draft
                 </button>
              </div>
              <textarea 
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none h-24 resize-none text-sm"
                placeholder="Type your reply... (Replies will keep the ticket OPEN)"
                autoFocus
              />
              <div className="flex gap-3 justify-end pt-3">
                <button 
                  onClick={handleSendReply}
                  disabled={sending || !replyText.trim()}
                  className="w-full sm:w-auto px-5 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-bold shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 text-sm"
                >
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Send Reply
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* List Header */}
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
        <div>
           <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
             <MessageCircleQuestion className="w-7 h-7 text-orange-600" />
             Support Inquiries
           </h1>
           <p className="text-gray-500">Manage questions and support tickets.</p>
        </div>
        
        <div className="flex items-center bg-white border border-gray-200 rounded-lg p-1 shadow-sm">
          <button 
            onClick={() => setFilter('all')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${filter === 'all' ? 'bg-orange-100 text-orange-800' : 'text-gray-500 hover:text-gray-700'}`}
          >
            All Tickets
          </button>
          <button 
            onClick={() => setFilter('pending')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${filter === 'pending' ? 'bg-orange-100 text-orange-800' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Action Needed
          </button>
        </div>
      </div>
      
      {/* Database Error Alert */}
      {dbError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3 text-sm text-red-800 animate-in fade-in slide-in-from-top-2">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 text-red-600" />
          <div className="flex-1">
             <div className="flex items-center justify-between">
                <p className="font-bold">Database connection incomplete.</p>
                <button 
                  onClick={() => document.getElementById('db-config-btn')?.click()}
                  className="text-xs bg-red-100 hover:bg-red-200 text-red-800 px-2 py-1 rounded font-bold transition-colors"
                >
                  Repair Database
                </button>
             </div>
            <p className="mt-1">
              Some scholar details cannot be loaded (Join Failed). Using fallback data. 
              <br/>Please click the <strong>"Database Config"</strong> button in the bottom right corner to repair relationships.
            </p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center flex flex-col items-center">
            <Loader2 className="w-8 h-8 animate-spin text-orange-500 mb-2" />
            <p className="text-gray-500">Loading inquiries...</p>
          </div>
        ) : inquiries.length === 0 ? (
          <div className="p-16 text-center text-gray-400">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-green-500" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">No Inquiries Found</h3>
            <p>Great job! There are no pending support tickets.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 text-gray-500 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 font-medium">Scholar</th>
                  <th className="px-6 py-3 font-medium">Subject</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {inquiries.map((inq) => {
                  const isPendingAction = inq.status === 'pending' || inq.status === 'pending_admin';
                  return (
                    <tr key={inq.id} className="hover:bg-orange-50/20 transition-colors group">
                      <td className="px-6 py-4">
                        {/* If scholar is null (missing FK), handle gracefully */}
                        <div className="font-bold text-gray-900">{(inq.scholar as any)?.full_name || 'Unknown Scholar'}</div>
                        <div className="text-xs text-gray-500">{(inq.scholar as any)?.email || 'ID: ' + inq.scholar_id.slice(0,6)}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-bold text-gray-800">{inq.subject}</div>
                        <div className="text-xs text-gray-500 mt-1 line-clamp-1">{inq.message}</div>
                      </td>
                      <td className="px-6 py-4">
                        {inq.status === 'resolved' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-100 text-green-700 border border-green-200 rounded-full text-xs font-bold">
                            <Check className="w-3 h-3" /> Resolved
                          </span>
                        ) : inq.status === 'pending_scholar' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-100 text-blue-700 border border-blue-200 rounded-full text-xs font-bold">
                            <Loader2 className="w-3 h-3" /> Waiting for Scholar
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-orange-100 text-orange-700 border border-orange-200 rounded-full text-xs font-bold animate-pulse">
                            <AlertTriangle className="w-3 h-3" /> {inq.status === 'pending_admin' ? 'New Reply' : 'New Ticket'}
                          </span>
                        )}
                        <div className="text-[10px] text-gray-400 mt-1">
                          {new Date(inq.updated_at || inq.created_at).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          {/* Quick Resolve Button */}
                          {inq.status !== 'resolved' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                updateStatus('resolved', inq);
                              }}
                              disabled={sending}
                              className="p-2 bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100 transition-colors shadow-sm"
                              title="Quick Resolve"
                            >
                              <Check className="w-3 h-3" />
                            </button>
                          )}
                          
                          <button 
                            onClick={() => openReplyModal(inq)}
                            className={`px-3 py-1.5 border rounded-lg text-xs font-bold shadow-sm transition-colors inline-flex items-center gap-1 ${
                              isPendingAction 
                                ? 'bg-orange-600 text-white border-orange-600 hover:bg-orange-700' 
                                : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                            }`}
                          >
                            <Reply className="w-3 h-3" /> {isPendingAction ? 'Reply Now' : 'View Chat'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
