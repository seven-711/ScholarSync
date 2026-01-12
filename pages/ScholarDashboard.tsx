
import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { Announcement, Profile } from '../types';
import { Bell, Calendar, BookOpen, Clock, ArrowRight, CheckCircle2, Megaphone, Pin, Volume2, StopCircle, Loader2, Play, Pause, X, SkipForward, AlertCircle } from 'lucide-react';
import { generateSpeech } from '../services/geminiService';
import { LiveInterviewCoach } from '../components/ScholarAiFeatures';

interface Props {
  profile: Profile;
  onNavigate: (tab: string) => void;
  onUpdate?: () => void;
}

export const ScholarDashboard: React.FC<Props> = ({ profile, onNavigate, onUpdate }) => {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [sdpAlert, setSdpAlert] = useState<{ show: boolean, msg: string }>({ show: false, msg: '' }); // New

  // Audio State
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [audioLoadingId, setAudioLoadingId] = useState<string | null>(null);

  // Auto-Play Briefing State
  const [showAutoPlayModal, setShowAutoPlayModal] = useState(false);
  const [autoPlayQueue, setAutoPlayQueue] = useState<Announcement[]>([]);
  const [currentAutoPlayIndex, setCurrentAutoPlayIndex] = useState(0);
  const [isBriefingActive, setIsBriefingActive] = useState(false);
  const [isBriefingPaused, setIsBriefingPaused] = useState(false);

  // Web Audio Refs
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const autoPlayTimeoutRef = useRef<any>(null);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.from('announcements').select('*').order('created_at', { ascending: false }).limit(10);
      const fetchedAnnouncements = data as Announcement[] || [];
      setAnnouncements(fetchedAnnouncements);

      // Check for assignments
      const { data: assignments } = await supabase.from('assignments').select('id');
      const { data: submissions } = await supabase.from('submissions').select('assignment_id').eq('scholar_id', profile.id);

      const total = assignments?.length || 0;
      const submitted = submissions?.length || 0;
      setPendingCount(Math.max(0, total - submitted));

      // AUTO-PLAY CHECK: Recent (< 24 hrs) announcements
      const recent = fetchedAnnouncements.filter(a => isNew(a.created_at));
      if (recent.length > 0) {
        setAutoPlayQueue(recent);
        setShowAutoPlayModal(true);
      }

      // CHECK SDP STATUS
      checkSDPStatus();
    };
    fetch();

    return () => {
      stopAudio();
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        audioCtxRef.current.close();
      }
      if (autoPlayTimeoutRef.current) clearTimeout(autoPlayTimeoutRef.current);
    };
  }, []);

  const checkSDPStatus = async () => {
    // 1. Get Requirements
    const { data: reqs } = await supabase.from('sdp_requirements').select('required_hours').eq('year_level', profile.year_level || '1st Year');
    // 2. Get Completed Hours
    const { data: recs } = await supabase.from('sdp_records').select('hours_rendered').eq('scholar_id', profile.id).eq('status', 'approved');

    if (reqs && reqs.length > 0) {
      const totalRequired = reqs.reduce((sum, r) => sum + (r.required_hours || 0), 0);
      const totalDone = recs?.reduce((sum, r) => sum + (Number(r.hours_rendered) || 0), 0) || 0;

      if (totalRequired > 0) {
        const progress = (totalDone / totalRequired) * 100;
        if (progress < 50) {
          setSdpAlert({
            show: true,
            msg: `You are falling behind on SDP Requirements (${Math.round(progress)}% completed). Please submit activities soon.`
          });
        }
      }
    }
  };

  const isNew = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= 1; // Changed to 1 day as per request (24 hrs)
  };

  const stopAudio = () => {
    if (audioSourceRef.current) {
      try { audioSourceRef.current.stop(); } catch (e) { }
      audioSourceRef.current = null;
    }
    setPlayingId(null);
  };

  // --- AUDIO HELPERS ---

  const initAudioContext = async () => {
    if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioCtxRef.current.state === 'suspended') {
      await audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  };

  const playTone = async (ctx: AudioContext) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    // Nice "Ding" sound
    osc.type = 'sine';
    osc.frequency.setValueAtTime(500, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1000, ctx.currentTime + 0.1);

    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);

    osc.start();
    osc.stop(ctx.currentTime + 0.6);

    return new Promise(resolve => setTimeout(resolve, 800)); // Wait for tone
  };

  const playPcmAudio = (base64Audio: string, ctx: AudioContext, onEnded?: () => void) => {
    // Decode raw PCM
    const binaryString = atob(base64Audio);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const int16Data = new Int16Array(bytes.buffer);
    // Ensure we have an even buffer for float conversion if needed, though Int16Array handles it
    // Create Float32 buffer manually for Web Audio
    const float32Data = new Float32Array(int16Data.length);
    for (let i = 0; i < int16Data.length; i++) {
      float32Data[i] = int16Data[i] / 32768.0;
    }

    const buffer = ctx.createBuffer(1, float32Data.length, 24000);
    buffer.copyToChannel(float32Data, 0);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);

    source.onended = () => {
      if (onEnded) onEnded();
    };

    source.start(0);
    return source;
  };

  // --- MANUAL PLAYBACK (Button Click) ---
  const handlePlayTts = async (announcement: Announcement) => {
    // If playing briefing, stop it
    if (isBriefingActive) {
      setIsBriefingActive(false);
      setShowAutoPlayModal(false);
    }

    if (playingId === announcement.id) {
      stopAudio();
      return;
    }

    stopAudio();
    setAudioLoadingId(announcement.id);

    try {
      const base64Audio = await generateSpeech(`${announcement.title}. ${announcement.content}`);
      if (base64Audio) {
        const ctx = await initAudioContext();
        const source = playPcmAudio(base64Audio, ctx, () => setPlayingId(null));
        audioSourceRef.current = source;
        setPlayingId(announcement.id);
      }
    } catch (e) {
      console.error(e);
      alert("Audio error");
    } finally {
      setAudioLoadingId(null);
    }
  };

  // --- BRIEFING LOGIC ---
  const startBriefing = async () => {
    setIsBriefingActive(true);
    setIsBriefingPaused(false);
    const ctx = await initAudioContext(); // User gesture trigger
    processBriefingQueue(currentAutoPlayIndex, ctx);
  };

  const pauseBriefing = () => {
    stopAudio();
    setIsBriefingPaused(true);
  };

  const resumeBriefing = async () => {
    if (!isBriefingPaused) return;
    setIsBriefingPaused(false);
    const ctx = await initAudioContext();
    processBriefingQueue(currentAutoPlayIndex, ctx);
  };

  const skipBriefingItem = async () => {
    stopAudio();
    const nextIdx = currentAutoPlayIndex + 1;
    if (nextIdx < autoPlayQueue.length) {
      setCurrentAutoPlayIndex(nextIdx);
      const ctx = await initAudioContext();
      processBriefingQueue(nextIdx, ctx);
    } else {
      closeBriefing();
    }
  };

  const closeBriefing = () => {
    stopAudio();
    setIsBriefingActive(false);
    setShowAutoPlayModal(false);
    setIsBriefingPaused(false);
  };

  const processBriefingQueue = async (index: number, ctx: AudioContext) => {
    if (index >= autoPlayQueue.length) {
      closeBriefing();
      return;
    }

    // 1. Play Tone
    await playTone(ctx);
    if (!isBriefingActive && !isBriefingPaused) return; // Check if stopped during tone

    // 2. Generate Speech
    const ann = autoPlayQueue[index];
    try {
      // Assuming generateSpeech is fast enough or we preload. 
      // For now, generate on fly.
      const base64Audio = await generateSpeech(`New Announcement: ${ann.title}. ${ann.content}`);

      if (!isBriefingActive && !isBriefingPaused) return; // Check again

      if (base64Audio) {
        const source = playPcmAudio(base64Audio, ctx, () => {
          // On Ended -> Next
          const nextIdx = index + 1;
          setCurrentAutoPlayIndex(nextIdx);
          // Small delay between items
          autoPlayTimeoutRef.current = setTimeout(() => {
            if (isBriefingActive && !isBriefingPaused) {
              processBriefingQueue(nextIdx, ctx);
            }
          }, 1000);
        });
        audioSourceRef.current = source;
      } else {
        // Skip if fail
        processBriefingQueue(index + 1, ctx);
      }
    } catch (e) {
      console.error(e);
      processBriefingQueue(index + 1, ctx);
    }
  };

  return (
    <div className="space-y-8 relative">
      {/* AUTO PLAY MODAL */}
      {showAutoPlayModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-gray-100 relative">
            <button onClick={closeBriefing} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 z-10">
              <X className="w-5 h-5" />
            </button>

            {/* Header */}
            <div className="bg-gradient-to-r from-rose-900 to-pink-900 p-6 text-white text-center">
              <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-md">
                {isBriefingActive && !isBriefingPaused ? (
                  <Volume2 className="w-8 h-8 animate-pulse" />
                ) : (
                  <Megaphone className="w-8 h-8" />
                )}
              </div>
              <h3 className="text-xl font-bold">Daily Briefing</h3>
              <p className="text-white/80 text-sm">{autoPlayQueue.length} new announcements today</p>
            </div>

            {/* Content */}
            <div className="p-6 text-center">
              {!isBriefingActive && !isBriefingPaused ? (
                // Initial State
                <div className="space-y-4">
                  <p className="text-gray-600">Would you like to hear the latest updates?</p>
                  <button
                    onClick={startBriefing}
                    className="w-full py-3 bg-rose-600 text-white rounded-xl font-bold hover:bg-rose-700 flex items-center justify-center gap-2 shadow-lg shadow-rose-200"
                  >
                    <Play className="w-5 h-5 fill-current" /> Start Briefing
                  </button>
                  <button onClick={closeBriefing} className="text-sm text-gray-400 hover:text-gray-600 font-medium">
                    No thanks, I'll read them later
                  </button>
                </div>
              ) : (
                // Playing State
                <div className="space-y-6">
                  <div className="text-left bg-gray-50 p-4 rounded-xl border border-gray-100 min-h-[100px] flex items-center justify-center">
                    {currentAutoPlayIndex < autoPlayQueue.length ? (
                      <div>
                        <h4 className="font-bold text-gray-900 mb-1 line-clamp-1">
                          {autoPlayQueue[currentAutoPlayIndex].title}
                        </h4>
                        <p className="text-sm text-gray-500 line-clamp-2">
                          {autoPlayQueue[currentAutoPlayIndex].content}
                        </p>
                      </div>
                    ) : (
                      <p className="text-gray-500 font-medium">All caught up!</p>
                    )}
                  </div>

                  {/* Controls */}
                  <div className="flex items-center justify-center gap-6">
                    {isBriefingPaused ? (
                      <button onClick={resumeBriefing} className="p-4 bg-rose-600 text-white rounded-full hover:bg-rose-700 shadow-lg">
                        <Play className="w-6 h-6 fill-current" />
                      </button>
                    ) : (
                      <button onClick={pauseBriefing} className="p-4 bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200">
                        <Pause className="w-6 h-6 fill-current" />
                      </button>
                    )}

                    <button onClick={skipBriefingItem} className="p-3 bg-gray-50 text-gray-400 rounded-full hover:bg-gray-100 hover:text-gray-600 border border-gray-200">
                      <SkipForward className="w-5 h-5 fill-current" />
                    </button>
                  </div>

                  <p className="text-xs text-gray-400 font-medium uppercase tracking-widest">
                    Playing {Math.min(currentAutoPlayIndex + 1, autoPlayQueue.length)} of {autoPlayQueue.length}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}



      {/* SDP ALERT MODAL / BANNER */}
      {
        sdpAlert.show && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-xl shadow-sm flex items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-full text-red-600">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-red-900">SDP Requirement Alert</h3>
                <p className="text-sm text-red-700">{sdpAlert.msg}</p>
              </div>
            </div>
            <button
              onClick={() => onNavigate('sdp')}
              className="px-4 py-2 bg-red-600 text-white text-sm font-bold rounded-lg hover:bg-red-700 whitespace-nowrap"
            >
              Go to SDP
            </button>
          </div>
        )
      }

      {/* Welcome Banner */}
      <div className="bg-white rounded-2xl p-8 border border-gray-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
        <div className="relative z-10">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome back, {profile.full_name.split(' ')[0]}!</h1>
          <p className="text-gray-500 max-w-lg">
            You have <span className="font-bold text-rose-700">{pendingCount} assignments</span> waiting for completion.
            Stay on top of your tasks to maintain your scholarship status.
          </p>
        </div>
        <div className="hidden md:block relative z-10">
          <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center">
            <BookOpen className="w-8 h-8 text-rose-700" />
          </div>
        </div>
        <div className="absolute top-0 right-0 w-64 h-full bg-gradient-to-l from-rose-50/50 to-transparent pointer-events-none"></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Left Column: Stats & Quick Actions */}
        <div className="space-y-6">
          {/* Live Coach */}
          <LiveInterviewCoach />

          <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
            <h3 className="font-bold text-gray-900 mb-4">My Progress</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-rose-50 rounded-lg text-center border border-rose-100">
                <p className="text-3xl font-bold text-rose-700">{pendingCount}</p>
                <p className="text-xs text-rose-800 font-medium uppercase mt-1">To Do</p>
              </div>
              <div className="p-4 bg-green-50 rounded-lg text-center border border-green-100">
                <p className="text-3xl font-bold text-green-700">Active</p>
                <p className="text-xs text-green-600 font-medium uppercase mt-1">Status</p>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-red-900 to-rose-800 p-6 rounded-xl shadow-lg text-white relative overflow-hidden">
            <div className="relative z-10">
              <h3 className="font-bold text-lg mb-2">Need Help?</h3>
              <p className="text-white/80 text-sm mb-4">Contact your scholarship coordinator if you have questions about assignments.</p>
              <button
                onClick={() => onNavigate('inquiries')}
                className="text-xs bg-white text-rose-900 px-3 py-2 rounded-lg font-bold hover:bg-rose-50 transition-colors"
              >
                Contact Support
              </button>
            </div>
            <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-white/10 rounded-full blur-xl"></div>
          </div>
        </div>

        {/* Right Column: Announcements Feed */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-rose-100 rounded-lg text-rose-700">
                <Bell className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Program Board</h2>
            </div>
            <span className="text-xs font-medium text-gray-500">Latest Updates</span>
          </div>

          <div className="space-y-4">
            {announcements.length === 0 ? (
              <div className="bg-white p-12 rounded-xl border border-dashed border-gray-200 text-center flex flex-col items-center">
                <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-3">
                  <Megaphone className="w-6 h-6 text-gray-400" />
                </div>
                <h3 className="text-gray-900 font-bold">No Announcements</h3>
                <p className="text-gray-500 text-sm">Check back later for program updates.</p>
              </div>
            ) : (
              announcements.map((ann, index) => {
                const recent = isNew(ann.created_at);
                const isPlaying = playingId === ann.id;
                const isLoadingAudio = audioLoadingId === ann.id;

                return (
                  <div key={ann.id} className="relative bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-all group">
                    {/* Cover Image */}
                    {ann.image_data && (
                      <div className="w-full h-40 overflow-hidden relative border-b border-gray-100">
                        <img src={ann.image_data} alt={ann.title} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                        <div className="absolute bottom-3 left-6 text-white text-lg font-bold drop-shadow-md">
                          {ann.title}
                        </div>
                      </div>
                    )}

                    {/* Left Accent Bar (Only if no image, otherwise the image handles visual weight) */}
                    {!ann.image_data && <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-rose-900"></div>}

                    <div className="p-6 pl-8">
                      {/* Header */}
                      <div className="flex justify-between items-start mb-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            {index === 0 && !ann.image_data && (
                              <Pin className="w-3.5 h-3.5 text-rose-600 fill-current" />
                            )}
                            {/* Hide title here if shown in image */}
                            {!ann.image_data && (
                              <h3 className="text-lg font-bold text-gray-900 group-hover:text-rose-800 transition-colors">
                                {ann.title}
                              </h3>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-gray-500">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {new Date(ann.created_at).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                            </span>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          {recent && (
                            <span className="flex h-6 w-auto items-center justify-center rounded-full bg-rose-100 px-3 py-1 text-xs font-bold text-rose-700 border border-rose-200 shadow-sm animate-pulse">
                              NEW
                            </span>
                          )}

                          {/* TTS BUTTON */}
                          <button
                            onClick={() => handlePlayTts(ann)}
                            disabled={isLoadingAudio}
                            className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${isPlaying
                              ? 'bg-rose-100 text-rose-700'
                              : 'bg-gray-100 text-gray-500 hover:bg-rose-50 hover:text-rose-600'
                              }`}
                            title="Read Aloud"
                          >
                            {isLoadingAudio ? <Loader2 className="w-4 h-4 animate-spin" /> : isPlaying ? <StopCircle className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      {/* Divider (Only if no image, to separate header from content) */}
                      {!ann.image_data && <div className="h-px w-full bg-gray-100 mb-4"></div>}

                      {/* Content */}
                      <div className="prose prose-sm max-w-none text-gray-600 leading-relaxed">
                        <p className="whitespace-pre-wrap">{ann.content}</p>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div >
  );
};
