
import React, { useState, useEffect } from 'react';
import { Database, Copy, Check, AlertTriangle } from 'lucide-react';
import { SQL_SETUP_INSTRUCTIONS } from '../types';
import { supabase } from '../supabaseClient';

export const SqlHelper: React.FC = () => {
  const [copied, setCopied] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [dbReady, setDbReady] = useState(true);

  useEffect(() => {
    const checkSetup = async () => {
      let isReady = true;

      // 1. Check Profiles (Admin User & Schema)
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, role, password, department, year_level')
        .eq('id', '00000000-0000-0000-0000-000000000001')
        .maybeSingle(); 
      
      // Check for Admin, Password column, AND new columns (department)
      if (profileError || !profileData || profileData.role !== 'admin' || profileData.password === undefined) {
        isReady = false;
      }

      // 2. Check Submissions (Return Feature)
      if (isReady) {
        const { error: subError } = await supabase
          .from('submissions')
          .select('status, feedback')
          .limit(1);
        
        if (subError) isReady = false;
      }
      
      // 3. Check New Profile Columns explicitly
      if (isReady) {
        const { error: colError } = await supabase
          .from('profiles')
          .select('department, year_level, id_photo_data')
          .limit(1);
          
        if (colError) isReady = false;
      }

      // 4. Check Inquiries Table and scholar_read column
      if (isReady) {
        const { error: inqError } = await supabase
          .from('inquiries')
          .select('id, scholar_read')
          .limit(1);
        
        if (inqError) isReady = false;
      }
      
      // 5. Check Threaded Messages Table (Step 9)
      if (isReady) {
        const { error: msgError } = await supabase
          .from('inquiry_messages')
          .select('id')
          .limit(1);
          
        if (msgError) isReady = false;
      }

      // 6. CRITICAL: Check Relationship (Join)
      // This is often what fails if foreign keys are missing
      if (isReady) {
        const { error: joinError } = await supabase
          .from('inquiries')
          .select('id, scholar:profiles(id)')
          .limit(1);

        if (joinError) isReady = false;
      }

      // 7. Check Announcement Image Column
      if (isReady) {
        const { error: annError } = await supabase
          .from('announcements')
          .select('image_data')
          .limit(1);
          
        if (annError) isReady = false;
      }

      setDbReady(isReady);
      if (!isReady) setIsOpen(true);
    };
    checkSetup();
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText(SQL_SETUP_INSTRUCTIONS);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) {
    return (
      <button
        id="db-config-btn"
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-4 right-4 text-white p-3 rounded-full shadow-lg transition-colors z-50 flex items-center gap-2 text-sm font-medium ${
          dbReady ? 'bg-gray-800 hover:bg-gray-700' : 'bg-red-600 hover:bg-red-700 animate-bounce'
        }`}
      >
        <Database className="w-4 h-4" />
        {dbReady ? "Database Config" : "Fix Database"}
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] flex flex-col">
        <div className={`p-6 border-b flex items-center justify-between ${dbReady ? 'border-gray-100' : 'bg-red-50 border-red-100 rounded-t-xl'}`}>
          <h3 className={`text-lg font-bold flex items-center gap-2 ${dbReady ? 'text-gray-900' : 'text-red-700'}`}>
            <Database className="w-5 h-5" />
            {dbReady ? "Database Setup Instructions" : "Repair Database Schema"}
          </h3>
          <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-gray-600">
            &times;
          </button>
        </div>
        <div className="p-6 overflow-y-auto flex-1 bg-gray-50">
          {!dbReady && (
            <div className="mb-4 p-4 bg-white border border-red-200 rounded-lg text-sm text-red-800 flex gap-3">
              <AlertTriangle className="w-5 h-5 flex-shrink-0 text-red-500" />
              <div>
                <strong>Connection or Schema Issue Detected</strong>
                <p className="mt-1">
                  The app cannot fetch required data or columns (e.g., Announcement Images).
                  <br/>Please run the SQL below to repair the database schema and connections.
                </p>
              </div>
            </div>
          )}
          <p className="text-sm text-gray-600 mb-4">
            Run the following SQL in your Supabase SQL Editor to fix missing tables or relationships.
          </p>
          <div className="relative">
            <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-xs overflow-x-auto">
              <code>{SQL_SETUP_INSTRUCTIONS}</code>
            </pre>
            <button
              onClick={handleCopy}
              className="absolute top-2 right-2 p-2 bg-white/10 hover:bg-white/20 rounded text-white transition-colors"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>
        <div className="p-4 border-t border-gray-100 bg-white rounded-b-xl flex justify-end">
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium"
          >
            I've Run the SQL
          </button>
        </div>
      </div>
    </div>
  );
};
