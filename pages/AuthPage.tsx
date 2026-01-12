
import React, { useState, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { GraduationCap, ShieldCheck, User, ArrowRight, Loader2, Database, ChevronLeft, Mail, Lock, KeyRound, Clock, IdCard, Building, Calendar, Upload, X, CheckCircle2 } from 'lucide-react';

interface AuthPageProps {
  onLoginSuccess: (userId: string) => void;
}

type AuthView = 'selection' | 'scholar-login' | 'scholar-register' | 'admin-login' | 'admin-register';

export const AuthPage: React.FC<AuthPageProps> = ({ onLoginSuccess }) => {
  const [view, setView] = useState<AuthView>('selection');
  const [registerSuccess, setRegisterSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  /* State */
  const [error, setError] = useState('');

  // Rate Limiting State
  const [rateLimitCountdown, setRateLimitCountdown] = useState(0);
  const attemptsRef = useRef(0);
  const lastAttemptTimeRef = useRef(Date.now());

  // Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState(''); // New
  const [fullName, setFullName] = useState('');

  // New Registration Fields
  const [department, setDepartment] = useState('');
  const [course, setCourse] = useState(''); // New
  const [school, setSchool] = useState(''); // New
  const [yearLevel, setYearLevel] = useState('1st Year');
  const [semester, setSemester] = useState('1st Semester'); // New
  const [idPhoto, setIdPhoto] = useState<string>('');
  const [enrollmentProof, setEnrollmentProof] = useState<string>(''); // New

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setFullName('');
    setDepartment('');
    setCourse('');
    setSchool('');
    setYearLevel('1st Year');
    setSemester('1st Semester');
    setIdPhoto('');
    setEnrollmentProof('');
    setError('');
  };


  const handleViewChange = (newView: AuthView) => {
    resetForm();
    setView(newView);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, setter: (val: string) => void) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        alert("File size must be less than 5MB");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setter(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // --- Rate Limiter / Spam Trap Logic ---
  const checkThrottling = (): boolean => {
    const now = Date.now();
    const TIME_WINDOW = 5000;
    const MAX_ATTEMPTS = 3;

    if (now - lastAttemptTimeRef.current > TIME_WINDOW) {
      attemptsRef.current = 0;
    }

    attemptsRef.current += 1;
    lastAttemptTimeRef.current = now;

    if (attemptsRef.current > MAX_ATTEMPTS) {
      const LOCKOUT_SECONDS = 15;
      setRateLimitCountdown(LOCKOUT_SECONDS);
      setError(`Too many attempts. Please wait ${LOCKOUT_SECONDS} seconds.`);

      const interval = setInterval(() => {
        setRateLimitCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            setError('');
            attemptsRef.current = 0;
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return true;
    }

    return false;
  };

  // --- Admin Logic ---
  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || rateLimitCountdown > 0) return;
    if (checkThrottling()) return;

    setLoading(true);
    setError('');
    const cleanEmail = email.trim();
    const cleanPassword = password.trim();

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .ilike('email', cleanEmail)
        .eq('password', cleanPassword)
        .maybeSingle();

      if (error) throw new Error("Connection failed.");

      if (!data) {
        const { data: userExists } = await supabase.from('profiles').select('id').ilike('email', cleanEmail).maybeSingle();
        if (userExists) throw new Error("Incorrect password.");
        else throw new Error("Account not found.");
      }

      if (data.role !== 'admin' && data.role !== 'super_admin') throw new Error("This account is not an Admin.");

      onLoginSuccess(data.id);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Login failed.");
      setLoading(false);
    }
  };

  const handleAdminRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || rateLimitCountdown > 0) return;
    if (checkThrottling()) return;

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (!school) {
      setError("School name is required.");
      return;
    }

    setLoading(true);
    setError('');
    const cleanEmail = email.trim();
    const cleanPassword = password.trim();

    try {
      const { data: existing } = await supabase.from('profiles').select('id').ilike('email', cleanEmail).maybeSingle();
      if (existing) throw new Error("Email already registered.");

      const newId = crypto.randomUUID();

      // UPLOAD FILES
      // State variables (idPhoto, enrollmentProof) are already base64 strings from handleFileChange
      let idUrl = idPhoto || null;
      let proofUrl = enrollmentProof || null;

      const { error: insertError } = await supabase.from('profiles').insert([{
        id: newId,
        email: cleanEmail,
        password: cleanPassword,
        full_name: fullName,
        role: 'admin', // School Officer
        is_approved: false, // Pending Super Admin approval
        school: school,
        id_photo_data: idUrl,
        enrollment_proof_data: proofUrl
      }]);

      if (insertError) throw insertError;

      setRegisterSuccess(true);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Registration failed.");
      setLoading(false);
    }
  };

  // --- Scholar Logic ---
  const handleScholarLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || rateLimitCountdown > 0) return;
    if (checkThrottling()) return;

    setLoading(true);
    setError('');
    const cleanEmail = email.trim();
    const cleanPassword = password.trim();

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .ilike('email', cleanEmail)
        .eq('password', cleanPassword)
        .eq('role', 'scholar')
        .maybeSingle();

      if (error) throw new Error("Connection failed.");

      if (!data) {
        const { data: userExists } = await supabase.from('profiles').select('id').ilike('email', cleanEmail).maybeSingle();
        if (userExists) throw new Error("Incorrect password.");
        else throw new Error("Account not found. Please register.");
      }

      onLoginSuccess(data.id);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handleScholarRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || rateLimitCountdown > 0) return;
    if (checkThrottling()) return;

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (!idPhoto || !enrollmentProof) {
      setError("Please upload both ID and Proof of Enrollment.");
      return;
    }

    setLoading(true);
    setError('');
    const cleanEmail = email.trim();
    const cleanPassword = password.trim();

    try {
      const { data: existing } = await supabase.from('profiles').select('id').ilike('email', cleanEmail).maybeSingle();
      if (existing) throw new Error("Email already registered.");

      const newId = crypto.randomUUID();
      const { error: insertError } = await supabase.from('profiles').insert([{
        id: newId,
        email: cleanEmail,
        password: cleanPassword,
        full_name: fullName,
        role: 'scholar',
        is_approved: false,
        department: department,
        school: school,
        course: course,
        year_level: yearLevel,
        semester: semester,
        id_photo_data: idPhoto,
        enrollment_proof_data: enrollmentProof
      }]);

      if (insertError) throw insertError;
      onLoginSuccess(newId);

    } catch (err: any) {
      console.error(err);
      setError(err.message || "Registration failed.");
      setLoading(false);
    }
  };

  // --- THEME HELPERS ---
  const isAdminView = view.includes('admin');
  const isScholarView = view.includes('scholar');

  // Dynamic Background
  const heroBgClass = isAdminView
    ? 'bg-gradient-to-br from-orange-600 to-amber-500'
    : isScholarView
      ? 'bg-gradient-to-br from-red-900 to-rose-800'
      : 'bg-red-900';

  const btnClass = isAdminView
    ? 'bg-orange-600 text-white hover:bg-orange-700'
    : 'bg-rose-900 text-white hover:bg-rose-950';

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col md:flex-row min-h-[600px] md:min-h-[550px]">

        {/* Left Side - Hero / Branding */}
        <div className={`md:w-5/12 p-8 text-white flex flex-col justify-between relative overflow-hidden transition-colors duration-500 ${heroBgClass}`}>
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-8">
              <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                <GraduationCap className="w-8 h-8" />
              </div>
              <span className="text-2xl font-bold tracking-tight">ScholarSync</span>
            </div>

            <h2 className="text-3xl font-bold mb-4">
              {view === 'selection' && "Welcome Portal"}
              {isAdminView && "Admin Access"}
              {isScholarView && "Scholar Access"}
            </h2>
            <p className="text-white/90 leading-relaxed font-medium">
              {view === 'selection' && "Connect, manage assignments, and stay updated with the latest scholarship announcements."}
              {isAdminView && "Secure portal for program administrators. Manage scholars, assignments, and approvals."}
              {isScholarView && "Track your progress, submit assignments, and view upcoming events."}
            </p>
          </div>

          <div className="absolute -bottom-24 -right-4 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
          <div className="absolute top-12 -left-12 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
        </div>

        {/* Right Side - Forms */}
        {/* Modified container: Removed justify-center from parent, added flex-1 structure */}
        <div className="md:w-7/12 p-6 md:p-12 flex flex-col relative bg-white overflow-y-auto max-h-[90vh]">

          {view !== 'selection' && (
            <button
              onClick={() => handleViewChange('selection')}
              // Static on mobile (at top of flow), Absolute on Desktop (floats in padding)
              className="w-fit mb-2 md:mb-0 md:absolute md:top-7 md:left-8 text-gray-500 hover:text-rose-900 flex items-center gap-2 text-sm font-bold transition-colors z-20"
            >
              <ChevronLeft className="w-4 h-4" /> Back to Selection
            </button>
          )}

          {/* Inner Centering Container */}
          <div className="flex-1 flex flex-col justify-center">
            <div className="max-w-sm mx-auto w-full">

              {error && (
                <div className={`mb-6 p-4 rounded-lg text-sm border flex gap-2 items-start animate-in fade-in slide-in-from-top-2 ${rateLimitCountdown > 0
                  ? 'bg-orange-50 border-orange-200 text-orange-800'
                  : 'bg-red-50 border-red-100 text-red-700'
                  }`}>
                  {rateLimitCountdown > 0 ? (
                    <Clock className="w-5 h-5 flex-shrink-0 text-orange-600 animate-pulse" />
                  ) : (
                    <Database className="w-5 h-5 flex-shrink-0" />
                  )}
                  <div>
                    <p className="font-bold">{rateLimitCountdown > 0 ? "Please Wait" : "Login Failed"}</p>
                    <p>{error}</p>
                  </div>
                </div>
              )}

              {/* VIEW: SELECTION */}
              {view === 'selection' && (
                <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                  <h3 className="text-2xl font-bold text-gray-900 mb-6 text-center">Select Your Portal</h3>

                  <button
                    onClick={() => handleViewChange('scholar-login')}
                    className="w-full group relative flex items-center p-4 bg-white border-2 border-gray-100 rounded-xl hover:border-rose-900 hover:bg-rose-50/50 transition-all text-left shadow-sm hover:shadow-md"
                  >
                    <div className="p-3 bg-rose-100 text-rose-900 rounded-full mr-4 group-hover:scale-110 transition-transform">
                      <User className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-gray-900">Scholar Portal</h4>
                      <p className="text-sm text-gray-500">Login or Register</p>
                    </div>
                    <ArrowRight className="w-5 h-5 text-gray-300 group-hover:text-rose-900 group-hover:translate-x-1 transition-all" />
                  </button>

                  <button
                    onClick={() => handleViewChange('admin-login')}
                    className="w-full group relative flex items-center p-4 bg-white border-2 border-gray-100 rounded-xl hover:border-orange-500 hover:bg-orange-50/50 transition-all text-left shadow-sm hover:shadow-md"
                  >
                    <div className="p-3 bg-orange-100 text-orange-600 rounded-full mr-4 group-hover:scale-110 transition-transform">
                      <ShieldCheck className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-gray-900">Admin Portal</h4>
                      <p className="text-sm text-gray-500">System Management</p>
                    </div>
                    <ArrowRight className="w-5 h-5 text-gray-300 group-hover:text-orange-600 group-hover:translate-x-1 transition-all" />
                  </button>
                </div>
              )}

              {/* VIEW: ADMIN LOGIN */}
              {view === 'admin-login' && (
                <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">Admin Login</h3>
                  <p className="text-gray-500 mb-8">Please sign in to access the dashboard.</p>

                  <form onSubmit={handleAdminLogin} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                          type="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all disabled:opacity-50"
                          placeholder="Enter admin credentials..."
                          disabled={loading || rateLimitCountdown > 0}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                          type="password"
                          required
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all disabled:opacity-50"
                          placeholder="••••••••"
                          disabled={loading || rateLimitCountdown > 0}
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={loading || rateLimitCountdown > 0}
                      className={`w-full py-3 rounded-lg transition-colors font-medium shadow-md flex justify-center items-center gap-2 ${loading || rateLimitCountdown > 0
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : btnClass
                        }`}
                    >
                      {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : rateLimitCountdown > 0 ? `Wait ${rateLimitCountdown}s` : 'Sign In'}
                    </button>
                  </form>

                  <div className="mt-8 text-center pt-6 border-t border-gray-100">
                    <p className="text-sm text-gray-600">
                      School Coordinator?{' '}
                      <button
                        onClick={() => handleViewChange('admin-register')}
                        disabled={loading || rateLimitCountdown > 0}
                        className="text-orange-600 font-bold hover:underline disabled:text-gray-400 ml-1"
                      >
                        Register School
                      </button>
                    </p>
                  </div>
                </div>
              )}

              {/* VIEW: ADMIN REGISTER */}
              {view === 'admin-register' && (
                <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="mb-6">
                    <div className="w-12 h-12 bg-orange-50 rounded-full flex items-center justify-center mx-auto mb-3">
                      <Building className="w-6 h-6 text-orange-600" />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 text-center">School Officer Registration</h3>
                    <p className="text-gray-500 text-sm mt-1 text-center">Register your school to manage scholars.</p>
                  </div>

                  <form onSubmit={handleAdminRegister} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="text"
                          required
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all text-sm"
                          placeholder="Officer Name"
                          disabled={loading}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">School Name</label>
                      <div className="relative">
                        <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="text"
                          required
                          value={school}
                          onChange={(e) => setSchool(e.target.value)}
                          className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all text-sm"
                          placeholder="University / College Name"
                          disabled={loading}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all text-sm"
                          placeholder="officer@school.edu"
                          disabled={loading}
                        />
                      </div>
                    </div>

                    {/* Officer Uploads */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">School ID / ID Photo</label>
                        <div className="bg-white border-2 border-dashed border-gray-300 rounded-xl p-3 text-center hover:bg-gray-50 transition-colors relative h-24 flex items-center justify-center">
                          <input
                            type="file"
                            accept="image/*"
                            required
                            onChange={(e) => handleFileChange(e, setIdPhoto)}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            disabled={loading}
                          />
                          {idPhoto ? (
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="w-5 h-5 text-green-600" />
                              <span className="text-xs font-bold text-green-700">Uploaded</span>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center">
                              <IdCard className="w-5 h-5 text-gray-400 mb-1" />
                              <span className="text-[10px] text-gray-500">Upload ID</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Proof of Employment</label>
                        <div className="bg-white border-2 border-dashed border-gray-300 rounded-xl p-3 text-center hover:bg-gray-50 transition-colors relative h-24 flex items-center justify-center">
                          <input
                            type="file"
                            accept="image/*,.pdf"
                            required
                            onChange={(e) => handleFileChange(e, setEnrollmentProof)}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            disabled={loading}
                          />
                          {enrollmentProof ? (
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="w-5 h-5 text-green-600" />
                              <span className="text-xs font-bold text-green-700">Uploaded</span>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center">
                              <Upload className="w-5 h-5 text-gray-400 mb-1" />
                              <span className="text-[10px] text-gray-500">Employment Proof</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Password</label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <input
                            type="password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all text-sm"
                            placeholder="Create password"
                            disabled={loading}
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Confirm</label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <input
                            type="password"
                            required
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className={`w-full pl-10 pr-4 py-3 bg-white border rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all text-sm ${confirmPassword && password !== confirmPassword ? 'border-red-500' : 'border-gray-200'}`}
                            placeholder="Confirm"
                            disabled={loading}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => handleViewChange('admin-login')}
                        className="w-1/3 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-bold text-sm"
                        disabled={loading}
                      >
                        Return
                      </button>
                      <button
                        type="submit"
                        disabled={loading || rateLimitCountdown > 0}
                        className={`flex-1 py-3 rounded-lg transition-colors font-medium shadow-md flex justify-center items-center gap-2 ${loading || rateLimitCountdown > 0
                          ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                          : btnClass
                          }`}
                      >
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Submit for Approval'}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* VIEW: SCHOLAR LOGIN */}
              {view === 'scholar-login' && (
                <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="text-center mb-6">
                    <div className="w-12 h-12 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-3">
                      <User className="w-6 h-6 text-rose-900" />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900">Scholar Login</h3>
                    <p className="text-gray-500">Enter your credentials to continue.</p>
                  </div>

                  <form onSubmit={handleScholarLogin} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                          type="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-rose-900/20 focus:border-rose-900 outline-none transition-all disabled:opacity-50"
                          placeholder="you@example.com"
                          disabled={loading || rateLimitCountdown > 0}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                          type="password"
                          required
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-rose-900/20 focus:border-rose-900 outline-none transition-all disabled:opacity-50"
                          placeholder="••••••••"
                          disabled={loading || rateLimitCountdown > 0}
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={loading || rateLimitCountdown > 0}
                      className={`w-full py-3 rounded-xl transition-all font-bold shadow-md hover:shadow-lg flex justify-center items-center gap-2 transform active:scale-95 ${loading || rateLimitCountdown > 0
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : btnClass
                        }`}
                    >
                      {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : rateLimitCountdown > 0 ? `Wait ${rateLimitCountdown}s` : 'Sign In'}
                    </button>
                  </form>

                  <div className="mt-8 text-center pt-6 border-t border-gray-100">
                    <p className="text-sm text-gray-600">
                      New to ScholarSync?{' '}
                      <button
                        onClick={() => handleViewChange('scholar-register')}
                        disabled={loading || rateLimitCountdown > 0}
                        className="text-rose-900 font-bold hover:underline disabled:text-gray-400 ml-1"
                      >
                        Create an Account
                      </button>
                    </p>
                  </div>
                </div>
              )}

              {/* VIEW: SCHOLAR REGISTER */}
              {view === 'scholar-register' && (
                <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="mb-6">
                    <h3 className="text-2xl font-bold text-gray-900">Create Account</h3>
                    <p className="text-gray-500 text-sm mt-1">Join ScholarSync to manage your scholarship.</p>
                  </div>

                  <form onSubmit={handleScholarRegister} className="space-y-4">
                    {/* Personal Info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Full Name</label>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <input
                            type="text"
                            required
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-rose-900/20 focus:border-rose-900 outline-none transition-all text-sm"
                            placeholder="Jane Doe"
                            disabled={loading}
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Department</label>
                        <div className="relative">
                          <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <input
                            type="text"
                            required
                            value={department}
                            onChange={(e) => setDepartment(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-rose-900/20 focus:border-rose-900 outline-none transition-all text-sm"
                            placeholder="e.g. Computer Science"
                            disabled={loading}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">School / University</label>
                        <div className="relative">
                          <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <input
                            type="text"
                            required
                            value={school}
                            onChange={(e) => setSchool(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-rose-900/20 focus:border-rose-900 outline-none transition-all text-sm"
                            placeholder="University Name"
                            disabled={loading}
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Course / Program</label>
                        <div className="relative">
                          <GraduationCap className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <input
                            type="text"
                            required
                            value={course}
                            onChange={(e) => setCourse(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-rose-900/20 focus:border-rose-900 outline-none transition-all text-sm"
                            placeholder="BS Computer Science"
                            disabled={loading}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Year Level</label>
                        <div className="relative">
                          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <select
                            value={yearLevel}
                            onChange={(e) => setYearLevel(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-rose-900/20 focus:border-rose-900 outline-none transition-all appearance-none text-sm"
                            disabled={loading}
                          >
                            <option>1st Year</option>
                            <option>2nd Year</option>
                            <option>3rd Year</option>
                            <option>4th Year</option>
                            <option>5th Year</option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Semester</label>
                        <div className="relative">
                          <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <select
                            value={semester}
                            onChange={(e) => setSemester(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-rose-900/20 focus:border-rose-900 outline-none transition-all appearance-none text-sm"
                            disabled={loading}
                          >
                            <option>1st Semester</option>
                            <option>2nd Semester</option>
                            <option>Summer</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Email</label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-rose-900/20 focus:border-rose-900 outline-none transition-all text-sm"
                          placeholder="email@example.com"
                          disabled={loading}
                        />
                      </div>
                    </div>

                    {/* Uploads Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* ID Photo */}
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">ID Photo</label>
                        <div className="bg-white border-2 border-dashed border-gray-300 rounded-xl p-3 text-center hover:bg-gray-50 transition-colors relative h-24 flex items-center justify-center">
                          <input
                            type="file"
                            accept="image/*"
                            required
                            onChange={(e) => handleFileChange(e, setIdPhoto)}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            disabled={loading}
                          />
                          {idPhoto ? (
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="w-5 h-5 text-green-600" />
                              <span className="text-xs font-bold text-green-700">Uploaded</span>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center">
                              <IdCard className="w-5 h-5 text-gray-400 mb-1" />
                              <span className="text-[10px] text-gray-500">Upload ID</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Enrollment Proof */}
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Proof of Enrollment</label>
                        <div className="bg-white border-2 border-dashed border-gray-300 rounded-xl p-3 text-center hover:bg-gray-50 transition-colors relative h-24 flex items-center justify-center">
                          <input
                            type="file"
                            accept="image/*,.pdf"
                            required
                            onChange={(e) => handleFileChange(e, setEnrollmentProof)}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            disabled={loading}
                          />
                          {enrollmentProof ? (
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="w-5 h-5 text-green-600" />
                              <span className="text-xs font-bold text-green-700">Uploaded</span>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center">
                              <Upload className="w-5 h-5 text-gray-400 mb-1" />
                              <span className="text-[10px] text-gray-500">Upload Proof</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Password</label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="password"
                          required
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-rose-900/20 focus:border-rose-900 outline-none transition-all text-sm"
                          placeholder="Create password"
                          disabled={loading}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Confirm Password</label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="password"
                          required
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className={`w-full pl-10 pr-4 py-3 bg-white border rounded-xl focus:ring-2 focus:ring-rose-900/20 focus:border-rose-900 outline-none transition-all text-sm ${confirmPassword && password !== confirmPassword ? 'border-red-500' : 'border-gray-200'
                            }`}
                          placeholder="Confirm password"
                          disabled={loading}
                        />
                      </div>
                    </div>

                    <div className="flex gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => handleViewChange('scholar-login')}
                        className="w-1/3 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-bold text-sm"
                        disabled={loading}
                      >
                        Return
                      </button>
                      <button
                        type="submit"
                        disabled={loading || rateLimitCountdown > 0}
                        className={`flex-1 py-3 rounded-lg transition-colors font-medium shadow-md flex justify-center items-center gap-2 ${loading || rateLimitCountdown > 0
                          ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                          : btnClass
                          }`}
                      >
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : rateLimitCountdown > 0 ? `Wait ${rateLimitCountdown}s` : 'Submit Registration'}
                      </button>
                    </div>
                  </form>
                </div>
              )}

            </div>
          </div>
        </div>

        {/* SUCCESS MODAL FOR ADMIN REGISTRATION */}
        {registerSuccess && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 text-center transform transition-all animate-in zoom-in-95 duration-200">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Registration Submitted!</h3>
              <p className="text-gray-600 mb-6">
                Your school officer account has been created. Please wait for Super Admin approval before logging in.
              </p>
              <button
                onClick={() => {
                  setRegisterSuccess(false);
                  handleViewChange('selection');
                }}
                className="w-full py-3 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 transition-colors shadow-lg shadow-green-200"
              >
                Return to Portal
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
