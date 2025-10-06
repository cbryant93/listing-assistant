import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/tauri';

interface PhotoThumbnailProps {
  photoPath: string;
  alt: string;
}

export default function PhotoThumbnail({ photoPath, alt }: PhotoThumbnailProps) {
  const [imageData, setImageData] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadImage() {
      try {
        setIsLoading(true);
        setError(null);

        // Call Rust command to get base64 image data
        const base64Data = await invoke<string>('read_image_as_base64', {
          filePath: photoPath,
        });

        if (isMounted) {
          setImageData(base64Data);
          setIsLoading(false);
        }
      } catch (err) {
        console.error('Failed to load image:', photoPath, err);
        if (isMounted) {
          setError((err as Error).toString());
          setIsLoading(false);
        }
      }
    }

    loadImage();

    return () => {
      isMounted = false;
    };
  }, [photoPath]);

  // Extract filename from path
  const filename = photoPath.split('/').pop() || photoPath.split('\\').pop() || photoPath;

  if (isLoading) {
    return (
      <div className="aspect-square bg-gray-100 rounded overflow-hidden flex items-center justify-center">
        <div className="text-center">
          <svg
            className="animate-spin h-8 w-8 mx-auto text-gray-400"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <p className="text-xs text-gray-500 mt-2">Loading...</p>
        </div>
      </div>
    );
  }

  if (error || !imageData) {
    return (
      <div className="aspect-square bg-gray-100 rounded overflow-hidden flex items-center justify-center p-2">
        <div className="text-center">
          <svg
            className="w-8 h-8 mx-auto mb-1 text-red-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p className="text-xs text-red-600 truncate w-full" title={filename}>
            {filename}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="aspect-square bg-gray-100 rounded overflow-hidden">
      <img
        src={imageData}
        alt={alt}
        className="w-full h-full object-cover"
      />
    </div>
  );
}
