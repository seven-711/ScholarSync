
import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { Announcement } from '../types';
import { generateAnnouncementDraft, generateImage } from '../services/geminiService';
import { Send, Loader2, Sparkles, Trash2, Image, Ratio, Wand2, AlertCircle, CheckCircle, X } from 'lucide-react';

export const AdminAnnouncements: React.FC = () => {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Flash Message State
  const [flashMessage, setFlashMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  
  // AI State
  const [generatingText, setGeneratingText] = useState(false);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [aspectRatio, setAspectRatio] = useState("16:9");

  const fetchAnnouncements = async () => {
    const { data } = await supabase.from('announcements').select('*').order('created_at', { ascending: false });
    setAnnouncements(data as Announcement[] || []);
  };

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const handlePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !content) return;
    
    setLoading(true);
    setFlashMessage(null);
    
    try {
      const { error } = await supabase.from('announcements').insert([{ 
        title, 
        content,
        image_data: generatedImage // Save the image!
      }]);
      
      if (error) throw error;
      
      setTitle('');
      setContent('');
      setGeneratedImage(null);
      setFlashMessage({ type: 'success', text: "Announcement posted successfully!" });
      fetchAnnouncements();
      
      // Auto-dismiss success message
      setTimeout(() => setFlashMessage(null), 3000);

    } catch (err: any) {
      console.error(err);
      setFlashMessage({ type: 'error', text: "Failed to post announcement. " + (err.message || "") });
    } finally {
      setLoading(false);
    }
  };

  const handleAiGenerateText = async () => {
    setFlashMessage(null);
    if (!title) {
      setFlashMessage({ type: 'error', text: "Please enter a title/topic first to generate text." });
      return;
    }
    setGeneratingText(true);
    try {
      const draft = await generateAnnouncementDraft(title);
      setContent(draft);
      setFlashMessage({ type: 'success', text: "Draft generated!" });
    } catch (e) {
      setFlashMessage({ type: 'error', text: "Failed to generate draft." });
    } finally {
      setGeneratingText(false);
    }
  };

  const handleAiGenerateImage = async () => {
    setFlashMessage(null);
    if (!title) {
        setFlashMessage({ type: 'error', text: "Please enter a title first to generate an image." });
        return;
    }
    setGeneratingImage(true);
    try {
      const imgData = await generateImage(`Professional cover image for announcement about: ${title}`, aspectRatio);
      
      if (!imgData) {
        throw new Error("AI service returned no image data. Please check your API key or try again.");
      }
      
      setGeneratedImage(imgData);
      setFlashMessage({ type: 'success', text: "Image generated successfully!" });
    } catch (e: any) {
      console.error(e);
      setFlashMessage({ type: 'error', text: "Image generation failed. " + (e.message || "Unknown error") });
    } finally {
      setGeneratingImage(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this announcement?")) {
      await supabase.from('announcements').delete().eq('id', id);
      fetchAnnouncements();
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Create Form */}
      <div className="lg:col-span-1">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 sticky top-8">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Post Announcement</h2>
          
          {/* FLASH MESSAGE BANNER */}
          {flashMessage && (
            <div className={`mb-4 p-3 rounded-lg flex items-start gap-2 text-sm border animate-in fade-in slide-in-from-top-2 ${
              flashMessage.type === 'error' 
                ? 'bg-red-50 border-red-200 text-red-800' 
                : 'bg-green-50 border-green-200 text-green-800'
            }`}>
              {flashMessage.type === 'error' ? (
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
              ) : (
                <CheckCircle className="w-5 h-5 flex-shrink-0" />
              )}
              <div className="flex-1 pt-0.5">{flashMessage.text}</div>
              <button onClick={() => setFlashMessage(null)} className="text-current opacity-60 hover:opacity-100">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          <form onSubmit={handlePost} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title / Topic</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="e.g. Monthly Meeting"
              />
            </div>
            
            {/* AI Image Generation Section */}
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
               <div className="flex justify-between items-center mb-2">
                 <label className="text-xs font-bold text-gray-700 flex items-center gap-1">
                   <Image className="w-3 h-3" /> AI Cover Image
                 </label>
                 <select 
                   value={aspectRatio}
                   onChange={e => setAspectRatio(e.target.value)}
                   className="text-xs border border-gray-300 rounded px-1 py-0.5"
                 >
                   <option value="1:1">1:1 Square</option>
                   <option value="16:9">16:9 Landscape</option>
                   <option value="3:4">3:4 Portrait</option>
                   <option value="4:3">4:3 Landscape</option>
                 </select>
               </div>
               
               {generatedImage ? (
                  <div className="relative group">
                    <img src={generatedImage} alt="Generated" className="w-full h-32 object-cover rounded-lg border border-gray-200" />
                    <button 
                      type="button" 
                      onClick={() => setGeneratedImage(null)}
                      className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
               ) : (
                  <button
                    type="button"
                    onClick={handleAiGenerateImage}
                    disabled={generatingImage}
                    className="w-full py-2 bg-white border border-indigo-200 text-indigo-700 rounded-lg hover:bg-indigo-50 text-xs font-bold flex items-center justify-center gap-2 transition-colors"
                  >
                    {generatingImage ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                    Generate Image (Gemini 2.5)
                  </button>
               )}
            </div>

            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-1 flex justify-between">
                Content
                <button
                  type="button"
                  onClick={handleAiGenerateText}
                  disabled={generatingText}
                  className="text-xs text-purple-600 font-semibold flex items-center gap-1 hover:text-purple-700 disabled:opacity-50"
                >
                  {generatingText ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                  AI Draft
                </button>
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={6}
                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Write your announcement here..."
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Post Announcement
            </button>
          </form>
        </div>
      </div>

      {/* List */}
      <div className="lg:col-span-2 space-y-4">
        <h2 className="text-lg font-bold text-gray-900">Recent Announcements</h2>
        {announcements.length === 0 ? (
          <div className="bg-white p-8 rounded-xl border border-gray-100 text-center text-gray-500">
            No announcements posted yet.
          </div>
        ) : (
          announcements.map((announcement) => (
            <div key={announcement.id} className="bg-white rounded-xl shadow-sm border border-gray-100 group overflow-hidden">
               {announcement.image_data && (
                  <div className="w-full h-32 md:h-48 overflow-hidden relative border-b border-gray-100">
                    <img 
                      src={announcement.image_data} 
                      alt={announcement.title} 
                      className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-500" 
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>
                    <div className="absolute bottom-3 left-4 text-white font-bold text-lg drop-shadow-md">
                      {announcement.title}
                    </div>
                  </div>
               )}
              <div className="p-6">
                {!announcement.image_data && (
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-gray-900 text-lg">{announcement.title}</h3>
                  </div>
                )}
                <div className="flex justify-between items-start">
                   <p className="text-gray-600 whitespace-pre-wrap flex-1">{announcement.content}</p>
                   <div className="flex items-center gap-3 ml-4 flex-shrink-0">
                      <span className="text-xs text-gray-400">
                        {new Date(announcement.created_at).toLocaleDateString()}
                      </span>
                      <button 
                        onClick={() => handleDelete(announcement.id)}
                        className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
