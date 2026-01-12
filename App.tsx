
import React, { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from './supabaseClient';
import { Profile, UserRole } from './types';
import { Layout } from './components/Layout';
import { AuthPage } from './pages/AuthPage';
import { AdminDashboard } from './pages/AdminDashboard';
import { AdminScholars } from './pages/AdminScholars';
import { AdminAnnouncements } from './pages/AdminAnnouncements';

import { AdminInquiries } from './pages/AdminInquiries';
import { ScholarDashboard } from './pages/ScholarDashboard';


import { ScholarInquiries } from './pages/ScholarInquiries';
import { ScholarSDP } from './pages/ScholarSDP'; // New
import { AdminSDP } from './pages/AdminSDP'; // New
import { PendingApproval } from './pages/PendingApproval';
import { Loader2, Settings } from 'lucide-react';
import { AiChatbot } from './components/ScholarAiFeatures';

const App: React.FC = () => {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [notifications, setNotifications] = useState<{ [key: string]: number }>({});

  useEffect(() => {
    // Check for persisted demo session
    const storedUserId = localStorage.getItem('demo_user_id');
    if (storedUserId && isSupabaseConfigured()) {
      fetchProfile(storedUserId);
    } else {
      setLoading(false);
    }
  }, []);

  const fetchProfile = async (userId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error fetching profile:', error);
        localStorage.removeItem('demo_user_id');
        setProfile(null);
      } else {
        setProfile(data as Profile);
        localStorage.setItem('demo_user_id', userId);
        fetchNotifications(data as Profile);
      }
    } catch (err) {
      console.error('Unexpected error:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchNotifications = async (userProfile: Profile) => {
    const newNotes: { [key: string]: number } = {};

    if (userProfile.role === UserRole.ADMIN) {
      // 1. Pending Scholars
      const { count: scholarCount } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'scholar')
        .eq('is_approved', false);

      if (scholarCount) {
        newNotes['scholars'] = scholarCount;
        newNotes['dashboard'] = (newNotes['dashboard'] || 0) + scholarCount;
      }

      // 2. Pending Inquiries
      // Updated to include 'pending_admin' so notifications persist if scholar replies
      const { count: inquiryCount } = await supabase
        .from('inquiries')
        .select('id', { count: 'exact', head: true })
        .in('status', ['pending', 'pending_admin']);

      if (inquiryCount) newNotes['inquiries'] = inquiryCount;

    } else {
      // SCHOLAR
      // 1. Returned Assignments
      const { count: returnedCount } = await supabase
        .from('submissions')
        .select('id', { count: 'exact', head: true })
        .eq('scholar_id', userProfile.id)
        .eq('status', 'returned');

      if (returnedCount) newNotes['assignments'] = returnedCount;

      // 2. Resolved Inquiries (Admin Replies) that are NOT READ
      // Also include pending_scholar which means admin replied but waiting for scholar
      const { count: replyCount } = await supabase
        .from('inquiries')
        .select('id', { count: 'exact', head: true })
        .eq('scholar_id', userProfile.id)
        .in('status', ['resolved', 'pending_scholar'])
        .eq('scholar_read', false); // Only count unread

      if (replyCount) newNotes['inquiries'] = replyCount;
    }

    setNotifications(newNotes);
  };

  const handleLogout = async () => {
    localStorage.removeItem('demo_user_id');
    setProfile(null);
    setActiveTab('dashboard');
    setNotifications({});
  };

  const handleNavigate = (tabId: string) => {
    setActiveTab(tabId);
    if (profile) fetchNotifications(profile); // Refresh notifications on nav
  };

  const handleUpdateNotifications = () => {
    if (profile) fetchNotifications(profile);
  }

  if (!isSupabaseConfigured()) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-xl text-center border border-red-100">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <Settings className="w-8 h-8 text-red-600 animate-spin-slow" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Supabase Not Configured</h1>
          <p className="text-gray-600 mb-6">
            The application is missing your database credentials.
          </p>

          <div className="text-left bg-gray-50 p-4 rounded-lg border border-gray-200 text-sm space-y-3">
            <p className="font-bold text-gray-900">How to fix:</p>
            <ol className="list-decimal list-inside space-y-2 text-gray-700">
              <li>Open the file <code className="bg-white px-1 py-0.5 border rounded">supabaseClient.ts</code></li>
              <li>Find <code className="text-blue-600">YOUR_SUPABASE_URL</code></li>
              <li>Paste your URL and Anon Key from your Supabase Dashboard</li>
              <li>Save the file to reload</li>
            </ol>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
      </div>
    );
  }

  // Not logged in
  if (!profile) {
    return (
      <>
        <AuthPage onLoginSuccess={(userId) => fetchProfile(userId)} />
      </>
    );
  }

  // Logged in with Profile but NOT APPROVED
  if (!profile.is_approved && (profile.role === UserRole.SCHOLAR || profile.role === UserRole.ADMIN)) {
    return (
      <PendingApproval
        userId={profile.id}
        userName={profile.full_name}
        onLogout={handleLogout}
        onApproved={() => fetchProfile(profile.id)}
      />
    );
  }

  return (
    <>
      <Layout
        role={profile.role}
        activeTab={activeTab}
        onTabChange={handleNavigate}
        onLogout={handleLogout}
        notifications={notifications}
      >
        {profile.role === UserRole.ADMIN || profile.role === UserRole.SUPER_ADMIN ? (
          <>
            {activeTab === 'dashboard' && <AdminDashboard profile={profile} onUpdate={handleUpdateNotifications} />}
            {activeTab === 'scholars' && <AdminScholars profile={profile} onUpdate={handleUpdateNotifications} />}
            {activeTab === 'sdp' && <AdminSDP profile={profile} onUpdate={handleUpdateNotifications} onProfileRefresh={() => fetchProfile(profile.id)} />}
            {activeTab === 'announcements' && <AdminAnnouncements />}

            {activeTab === 'inquiries' && <AdminInquiries onUpdate={handleUpdateNotifications} />}
          </>
        ) : (
          <>
            <AiChatbot />
            {activeTab === 'dashboard' && <ScholarDashboard profile={profile} onNavigate={handleNavigate} onUpdate={handleUpdateNotifications} />}
            {activeTab === 'sdp' && <ScholarSDP profile={profile} onUpdate={handleUpdateNotifications} />}

            {activeTab === 'inquiries' && <ScholarInquiries profile={profile} onUpdate={handleUpdateNotifications} />}
          </>
        )}
      </Layout>
    </>
  );
};

export default App;
