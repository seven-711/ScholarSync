
import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { ShieldAlert, LogOut, Loader2, CheckCircle2, XCircle, RefreshCw, ArrowRight } from 'lucide-react';

interface Props {
  userId: string;
  userName: string;
  onLogout: () => void;
  onApproved: () => void;
}

type StatusState = 'idle' | 'checking' | 'still_pending' | 'approved' | 'rejected';

export const PendingApproval: React.FC<Props> = ({ userId, userName, onLogout, onApproved }) => {
  const [status, setStatus] = useState<StatusState>('idle');

  const checkStatus = async () => {
    setStatus('checking');
    await new Promise(resolve => setTimeout(resolve, 800));

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('is_approved, role')
        .eq('id', userId)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        setStatus('rejected');
      } else if (data.is_approved) {
        setStatus('approved');
      } else {
        setStatus('still_pending');
      }
    } catch (err) {
      console.error(err);
      setStatus('still_pending');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100 transition-all duration-300">
        
        {/* HEADER SECTION */}
        <div className={`p-8 text-center border-b transition-colors duration-300 ${
          status === 'approved' ? 'bg-green-50 border-green-100' : 
          status === 'rejected' ? 'bg-red-50 border-red-100' : 
          'bg-rose-50 border-rose-100'
        }`}>
          <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm transition-colors duration-300 ${
            status === 'approved' ? 'bg-green-100 text-green-600' : 
            status === 'rejected' ? 'bg-red-100 text-red-600' : 
            'bg-rose-100 text-rose-700'
          }`}>
            {status === 'checking' ? (
              <Loader2 className="w-10 h-10 animate-spin" />
            ) : status === 'approved' ? (
              <CheckCircle2 className="w-10 h-10" />
            ) : status === 'rejected' ? (
              <XCircle className="w-10 h-10" />
            ) : (
              <ShieldAlert className="w-10 h-10" />
            )}
          </div>
          
          <h2 className={`text-2xl font-bold mb-2 ${
            status === 'approved' ? 'text-green-800' : 
            status === 'rejected' ? 'text-red-800' : 
            'text-gray-900'
          }`}>
            {status === 'checking' && 'Checking Status...'}
            {status === 'approved' && 'Application Approved!'}
            {status === 'rejected' && 'Application Update'}
            {(status === 'idle' || status === 'still_pending') && 'Pending Approval'}
          </h2>
          
          <p className="text-gray-600 leading-relaxed">
            {status === 'checking' && 'Connecting to ScholarSync database...'}
            
            {status === 'approved' && `Great news, ${userName}! Your account has been verified and activated by the administrator.`}
            
            {status === 'rejected' && `We're sorry, ${userName}. Your registration request could not be found or was declined by the administrator.`}
            
            {(status === 'idle' || status === 'still_pending') && (
              <>
                Welcome, <span className="font-semibold text-gray-900">{userName}</span>. 
                <br />
                Your registration is currently under review by the administrator.
              </>
            )}
          </p>
        </div>

        {/* ACTION SECTION */}
        <div className="p-8 space-y-4 bg-white">
          
          {status === 'approved' ? (
            <button
              onClick={onApproved}
              className="w-full py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-all shadow-md hover:shadow-lg font-bold flex items-center justify-center gap-2 group"
            >
              Enter Dashboard <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
          ) : status === 'rejected' ? (
             <div className="p-4 bg-red-50 rounded-lg text-sm text-red-700 border border-red-100 mb-4">
               Please contact the scholarship office for more information regarding your application status.
             </div>
          ) : (
            <button
              onClick={checkStatus}
              disabled={status === 'checking'}
              className={`w-full py-3 rounded-xl font-bold transition-all shadow-sm flex items-center justify-center gap-2 ${
                status === 'checking' 
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-rose-900 text-white hover:bg-rose-950 shadow-rose-200'
              }`}
            >
              {status === 'checking' ? (
                <>Checking...</>
              ) : (
                <>
                  <RefreshCw className={`w-5 h-5 ${status === 'still_pending' ? 'animate-spin-once' : ''}`} /> 
                  Check Status Now
                </>
              )}
            </button>
          )}

          {status === 'still_pending' && (
            <div className="text-center animate-in fade-in slide-in-from-top-2">
              <span className="inline-block px-3 py-1 bg-yellow-50 text-yellow-700 text-xs font-medium rounded-full border border-yellow-100">
                Still pending review. Please try again later.
              </span>
            </div>
          )}

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-100"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-400">or</span>
            </div>
          </div>

          <button
            onClick={onLogout}
            className="w-full py-3 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors font-medium flex items-center justify-center gap-2 border border-transparent hover:border-red-100"
          >
            <LogOut className="w-5 h-5" /> Sign Out
          </button>
        </div>
      </div>
    </div>
  );
};
