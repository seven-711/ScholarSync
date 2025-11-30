
import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { Assignment, Profile, Submission } from '../types';
import { FileText, CheckCircle, Upload, Clock, AlertCircle, AlertOctagon, RefreshCcw, X } from 'lucide-react';

interface Props {
  profile: Profile;
  onUpdate?: () => void;
}

export const ScholarAssignments: React.FC<Props> = ({ profile, onUpdate }) => {
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

  // ... (Rest of UI remains identical) ...
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">My Assignments</h1>

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
                className={`bg-white border rounded-xl p-5 cursor-pointer transition-all ${
                  selectedAssignment?.id === assign.id 
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
                <div className={`mb-6 p-4 rounded-lg flex items-start gap-3 animate-in fade-in slide-in-from-top-2 border ${
                  flashMessage.type === 'error' 
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
                    <div className={`border-2 border-dashed rounded-lg p-4 text-center hover:bg-gray-50 transition-colors ${
                      flashMessage?.type === 'error' && flashMessage.text.includes('photo') 
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
