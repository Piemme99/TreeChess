import { useCallback, useRef, useState } from 'react';
import { Loading } from '../../../../shared/components/UI';
import type { Color } from '../../../../types';

interface FileUploaderProps {
  selectedColor: Color;
  onColorChange: (color: Color) => void;
  onUpload: (file: File) => Promise<void>;
  uploading?: boolean;
}

export function FileUploader({
  selectedColor,
  onColorChange,
  onUpload,
  uploading = false
}: FileUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFileUpload = useCallback(
    async (file: File) => {
      if (!file.name.toLowerCase().endsWith('.pgn')) {
        return;
      }
      await onUpload(file);
    },
    [onUpload]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleFileUpload(file);
      }
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    [handleFileUpload]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) {
        handleFileUpload(file);
      }
    },
    [handleFileUpload]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  return (
    <div>
      <div className="mb-6">
        <label className="block mb-2 font-medium text-text-muted">Analyze against:</label>
        <div className="flex gap-2">
          <button
            className={`flex-1 flex items-center justify-center gap-2 p-4 bg-bg border-2 rounded-md text-base cursor-pointer transition-all duration-150 ${selectedColor === 'white' ? 'border-primary bg-primary-light' : 'border-border hover:border-primary'}`}
            onClick={() => onColorChange('white')}
          >
            <span className="text-2xl">{'\u2654'}</span> White
          </button>
          <button
            className={`flex-1 flex items-center justify-center gap-2 p-4 bg-bg border-2 rounded-md text-base cursor-pointer transition-all duration-150 ${selectedColor === 'black' ? 'border-primary bg-primary-light' : 'border-border hover:border-primary'}`}
            onClick={() => onColorChange('black')}
          >
            <span className="text-2xl">{'\u265A'}</span> Black
          </button>
        </div>
      </div>

      <div
        className={`border-2 border-dashed rounded-lg py-12 text-center cursor-pointer transition-all duration-150 ${dragOver ? 'border-primary bg-primary-light' : 'border-border hover:border-primary hover:bg-primary-light'} ${uploading ? 'pointer-events-none opacity-70' : ''}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => !uploading && fileInputRef.current?.click()}
      >
        {uploading ? (
          <Loading text="Uploading and analyzing..." />
        ) : (
          <>
            <div className="text-5xl mb-4">&#128193;</div>
            <p className="text-lg text-text mb-1">Choose file or drag and drop</p>
            <p className="text-text-muted text-sm">.pgn files only</p>
          </>
        )}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept=".pgn"
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />
    </div>
  );
}
