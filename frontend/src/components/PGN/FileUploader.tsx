import { useCallback, useRef, useState } from 'react';
import { Loading } from '../UI';
import type { Color } from '../../types';

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
    <div className="file-uploader">
      <div className="color-selector">
        <label>Analyze against:</label>
        <div className="color-buttons">
          <button
            className={`color-btn ${selectedColor === 'white' ? 'active' : ''}`}
            onClick={() => onColorChange('white')}
          >
            <span className="color-icon">♔</span> White
          </button>
          <button
            className={`color-btn ${selectedColor === 'black' ? 'active' : ''}`}
            onClick={() => onColorChange('black')}
          >
            <span className="color-icon">♚</span> Black
          </button>
        </div>
      </div>

      <div
        className={`drop-zone ${dragOver ? 'drag-over' : ''} ${uploading ? 'uploading' : ''}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => !uploading && fileInputRef.current?.click()}
      >
        {uploading ? (
          <Loading text="Uploading and analyzing..." />
        ) : (
          <>
            <div className="drop-zone-icon">📁</div>
            <p className="drop-zone-text">Choose file or drag and drop</p>
            <p className="drop-zone-hint">.pgn files only</p>
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
