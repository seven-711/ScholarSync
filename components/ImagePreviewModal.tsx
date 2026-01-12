import React, { useEffect } from 'react';
import { X, Eye } from 'lucide-react';

interface ImagePreviewModalProps {
    imageUrl: string;
    onClose: () => void;
    title?: string;
}

export const ImagePreviewModal: React.FC<ImagePreviewModalProps> = ({ imageUrl, onClose, title = "Image Preview" }) => {
    // Close on Escape key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    if (!imageUrl) return null;

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={onClose}
        >
            <div
                className="relative max-w-5xl w-full max-h-[95vh] flex flex-col items-center justify-center"
                onClick={(e) => e.stopPropagation()} // Prevent close when clicking content
            >
                <button
                    onClick={onClose}
                    className="absolute -top-12 right-0 md:right-0 p-2 text-white/70 hover:text-white transition-colors flex items-center gap-2 group"
                >
                    <span className="text-sm font-medium group-hover:underline">Close</span>
                    <div className="bg-white/10 rounded-full p-1 group-hover:bg-white/20">
                        <X className="w-6 h-6" />
                    </div>
                </button>

                <div className="relative w-full flex items-center justify-center overflow-hidden rounded-lg shadow-2xl bg-black">
                    <img
                        src={imageUrl}
                        alt={title}
                        className="max-w-full max-h-[85vh] object-contain transition-transform duration-300"
                    />
                </div>

                <div className="mt-4 text-white/80 text-sm font-medium flex items-center gap-2">
                    <Eye className="w-4 h-4" />
                    {title}
                </div>
            </div>
        </div>
    );
};
