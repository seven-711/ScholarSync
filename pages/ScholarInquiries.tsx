
import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { Inquiry, InquiryMessage, Profile } from '../types';
import { MessageCircleQuestion, Send, Loader2, Clock, CheckCircle2, User, Reply, Inbox, ArrowLeft, AlertTriangle } from 'lucide-react';

interface Props {
  profile: Profile;
  onUpdate?: () => void;
}

const getErrorMessage = (error: any): string => {
  if (!error) return "Unknown error";
  if (typeof error === 'string') return error;
  
  if (error?.code === '23514') {
    return "Database Schema Error: Status constraint violation. The system needs an update.";
  }
  
  if (error?.message) return error.message;
  if (error?.error_description) return error.error_description;
  
  // Fallback: Try to stringify
  try {
    return JSON.stringify(error);
  } catch {
    return "An unexpected error occurred (object could not be stringified).";
  }
};

export const ScholarInquiries: React.FC<Props> = ({ profile, onUpdate }) => {
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [selectedInquiry, setSelectedInquiry] = useState<Inquiry | null>(null);
  
  // Create State
  const [subject, setSubject] = useState('');
  const [firstMessage, setFirstMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  // Chat State
  const [messages, setMessages] = useState<InquiryMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchInquiries = async () => {
    setRefreshing(true);
    const { data } = await supabase
      .from('inquiries')
      .select('*')
      .eq('scholar_id', profile.id)
      .order('updated_at', { ascending: false });
    
    setInquiries(data as Inquiry[] || []);
    setRefreshing(false);
  };

  const fetchMessages = async (inquiryId: string) => {
    const { data } = await supabase
      .from('inquiry_messages')
      .select('*')
      .eq('inquiry_id', inquiryId)
      .order('created_at', { ascending: true });
    
    setMessages(data as InquiryMessage[] || []);
  };

  // Mark resolved as read
  const markAsRead = async () => {
    try {
      await supabase
        .from('inquiries')
        .update({ scholar_read: true })
        .eq('scholar_id', profile.id)
        .eq('status', 'resolved')
        .eq('scholar_read', false);
      
      if (onUpdate) onUpdate();
    } catch(e) {
      console.error("Error marking read", e);
    }
  };

  useEffect(() => {
    fetchInquiries();
    markAsRead();
  }, []);

  useEffect(() => {
    if (selectedInquiry) {
      setError(null);
      fetchMessages(selectedInquiry.id);
    }
  }, [selectedInquiry]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject || !firstMessage) return;

    setLoading(true);
    setError(null);
    try {
      // 1. Create Inquiry
      const { data: inq, error: inqError } = await supabase
        .from('inquiries')
        .insert([{
          scholar_id: profile.id,
          subject,
          status: 'pending'
        }])
        .select()
        .single();

      if (inqError) throw inqError;

      // 2. Create Initial Message
      const { error: msgError } = await supabase
        .from('inquiry_messages')
        .insert([{
          inquiry_id: inq.id,
          sender_role: 'scholar',
          message: firstMessage
        }]);

      if (msgError) throw msgError;

      setSubject('');
      setFirstMessage('');
      await fetchInquiries();
    } catch (err: any) {
      console.error(err);
      setError(`Failed to create ticket: ${getErrorMessage(err)}`);
    } finally {
      setLoading(false);
    }
  };

  const handleReply = async () => {
    if (!selectedInquiry || !newMessage.trim()) return;
    setSending(true);
    setError(null);

    try {
      // 1. Insert Message
      const { error } = await supabase.from('inquiry_messages').insert([{
        inquiry_id: selectedInquiry.id,
        sender_role: 'scholar',
        message: newMessage
      }]);

      if (error) throw error;

      // 2. Update Inquiry Status
      // FORCE status to 'pending_admin' regardless of previous status
      // This ensures the admin gets a notification
      const { error: updateError } = await supabase
        .from('inquiries')
        .update({ 
          status: 'pending_admin',
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedInquiry.id);

      if (updateError) throw updateError;

      setNewMessage('');
      await fetchMessages(selectedInquiry.id);
      
      // 3. Update Local State Immediately (Critical for UI feedback)
      const updatedInquiry = { ...selectedInquiry, status: 'pending_admin' as const };
      setSelectedInquiry(updatedInquiry);
      setInquiries(prev => prev.map(i => i.id === selectedInquiry.id ? updatedInquiry : i));
      
      if (onUpdate) onUpdate();

    } catch(err: any) {
      console.error(err);
      setError(`Failed to reply: ${getErrorMessage(err)}`);
    } finally {
      setSending(false);
    }
  };

  // --- VIEW: CHAT INTERFACE ---
  if (selectedInquiry) {
    return (
      <div className="h-[calc(100vh-140px)] flex flex-col bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden relative">
        {/* Header */}
        <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setSelectedInquiry(null)}
              className="p-2 hover:bg-gray-200 rounded-full transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div>
              <h2 className="font-bold text-gray-900 text-lg line-clamp-1">{selectedInquiry.subject}</h2>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span>Ticket #{selectedInquiry.id.slice(0,8)}</span>
                <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                <span className={`capitalize font-bold ${
                  selectedInquiry.status === 'resolved' ? 'text-green-600' : 'text-yellow-600'
                }`}>
                  {selectedInquiry.status === 'pending_admin' ? 'Sent (Waiting for Admin)' : selectedInquiry.status.replace('_', ' ')}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ERROR BANNER IN CHAT */}
        {error && (
          <div className="bg-red-50 border-b border-red-200 p-4 flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 text-red-600 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-red-800 font-bold mb-1">Action Required</p>
              <p className="text-sm text-red-700 mb-2">{error}</p>
              <button 
                onClick={() => document.getElementById('db-config-btn')?.click()}
                className="text-xs bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg font-bold transition-colors shadow-sm"
              >
                Repair Database
              </button>
            </div>
          </div>
        )}

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-gray-50 custom-scrollbar">
          {/* Fallback for old data without messages table */}
          {messages.length === 0 && selectedInquiry.message && (
             <div className="flex justify-end">
               <div className="max-w-[80%] bg-white border border-gray-200 p-4 rounded-2xl rounded-tr-none shadow-sm text-sm text-gray-800 whitespace-pre-wrap">
                  {selectedInquiry.message}
                  <div className="mt-1 text-[10px] text-gray-400 text-right">{new Date(selectedInquiry.created_at).toLocaleString()}</div>
               </div>
             </div>
          )}
          {messages.length === 0 && selectedInquiry.admin_reply && (
             <div className="flex justify-start">
               <div className="max-w-[80%] bg-rose-50 border border-rose-100 p-4 rounded-2xl rounded-tl-none shadow-sm text-sm text-gray-800 whitespace-pre-wrap">
                  <div className="text-xs font-bold text-rose-800 mb-1 flex items-center gap-1">
                     <Reply className="w-3 h-3" /> Administrator
                  </div>
                  {selectedInquiry.admin_reply}
               </div>
             </div>
          )}

          {/* New Threaded Messages */}
          {messages.map((msg) => {
            const isMe = msg.sender_role === 'scholar';
            return (
              <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] p-4 rounded-2xl shadow-sm text-sm whitespace-pre-wrap ${
                  isMe 
                    ? 'bg-white border border-gray-200 rounded-tr-none text-gray-800' 
                    : 'bg-rose-50 border border-rose-100 rounded-tl-none text-gray-800'
                }`}>
                  {!isMe && (
                     <div className="text-xs font-bold text-rose-800 mb-1 flex items-center gap-1">
                        <Reply className="w-3 h-3" /> Administrator
                     </div>
                  )}
                  {msg.message}
                  <div className={`mt-2 text-[10px] ${isMe ? 'text-gray-400 text-right' : 'text-rose-400'}`}>
                    {new Date(msg.created_at).toLocaleString()}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Reply Input */}
        <div className="p-4 bg-white border-t border-gray-100">
           <div className="relative">
             <textarea 
               value={newMessage}
               onChange={e => setNewMessage(e.target.value)}
               className="w-full pl-4 pr-12 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-rose-500 outline-none resize-none min-h-[50px] max-h-[150px]"
               placeholder="Type your reply..."
               rows={1}
               disabled={sending}
               onKeyDown={e => {
                  if(e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleReply();
                  }
               }}
             />
             <button 
               onClick={handleReply}
               disabled={sending || !newMessage.trim()}
               className="absolute right-2 bottom-2 p-2 bg-rose-900 text-white rounded-lg hover:bg-rose-950 disabled:opacity-50 disabled:bg-gray-300 transition-colors"
             >
               {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
             </button>
           </div>
           <p className="text-[10px] text-gray-400 mt-2 text-center">Press Enter to send, Shift+Enter for new line</p>
        </div>
      </div>
    );
  }

  // --- VIEW: LIST & CREATE ---
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-[calc(100vh-140px)]">
      
      {/* LEFT: New Message Form */}
      <div className="lg:col-span-1 flex flex-col h-full">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex-1 flex flex-col">
          <h2 className="text-xl font-bold text-gray-900 mb-2 flex items-center gap-2">
            <MessageCircleQuestion className="w-6 h-6 text-rose-700" />
            Contact Support
          </h2>
          <p className="text-sm text-gray-500 mb-6">
            Create a new support ticket.
          </p>

          {/* MAIN ERROR BANNER */}
          {error && !selectedInquiry && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 flex flex-col gap-2">
              <div className="flex items-start gap-2 text-sm text-red-800">
                <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
              <button 
                onClick={() => document.getElementById('db-config-btn')?.click()}
                className="text-xs bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded font-bold transition-colors w-fit self-end"
              >
                Repair Database
              </button>
            </div>
          )}

          <form onSubmit={handleCreate} className="space-y-4 flex-1 flex flex-col">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Subject</label>
              <input 
                type="text" 
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-rose-500 outline-none transition-all"
                placeholder="e.g. Question about Assignment 3"
                required
                disabled={loading}
              />
            </div>
            
            <div className="flex-1 flex flex-col">
              <label className="block text-sm font-bold text-gray-700 mb-1">Message</label>
              <textarea 
                value={firstMessage}
                onChange={(e) => setFirstMessage(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-rose-500 outline-none transition-all resize-none flex-1 min-h-[150px] whitespace-pre-wrap"
                placeholder="Type your concern here..."
                required
                disabled={loading}
              />
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full py-3 bg-rose-900 text-white rounded-xl hover:bg-rose-950 font-bold shadow-md transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Create Ticket
            </button>
          </form>
        </div>
      </div>

      {/* RIGHT: History List */}
      <div className="lg:col-span-2 h-full flex flex-col">
        <div className="flex items-center justify-between mb-4 px-2">
          <h2 className="text-lg font-bold text-gray-900">Your Tickets</h2>
          <button onClick={fetchInquiries} disabled={refreshing} className="text-xs text-rose-700 font-bold hover:underline">
            {refreshing ? 'Refreshing...' : 'Refresh List'}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
          {inquiries.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-gray-400 bg-white rounded-xl border border-dashed border-gray-200">
              <Inbox className="w-12 h-12 mb-2 opacity-30" />
              <p>No tickets found.</p>
            </div>
          ) : (
            inquiries.map((inq) => (
              <div 
                key={inq.id} 
                onClick={() => setSelectedInquiry(inq)}
                className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden cursor-pointer hover:border-rose-300 transition-all group"
              >
                <div className="p-5">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="font-bold text-gray-900 text-lg flex items-center gap-2 group-hover:text-rose-700 transition-colors">
                       <span className="text-rose-900 opacity-50">#</span> {inq.subject}
                    </h3>
                    {inq.status === 'resolved' ? (
                      <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Resolved
                      </span>
                    ) : (
                      <span className="bg-yellow-100 text-yellow-700 text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {inq.status === 'pending_scholar' ? 'Reply Needed' : 'Pending'}
                      </span>
                    )}
                  </div>
                  
                  <p className="text-sm text-gray-500 line-clamp-2 mb-3">
                     Click to view conversation thread...
                  </p>
                  
                  <div className="text-[10px] text-gray-400 font-medium">
                    Last Updated: {new Date(inq.updated_at || inq.created_at).toLocaleString()}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
