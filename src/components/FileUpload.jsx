import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload } from 'lucide-react';

export function FileUpload({ onDataLoaded }) {
    const onDrop = useCallback((acceptedFiles) => {
        const readers = acceptedFiles.map(file => {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsText(file);
            });
        });

        Promise.all(readers).then(contents => {
            const combinedContent = contents.join('\n');
            onDataLoaded(combinedContent);
        });
    }, [onDataLoaded]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: { 'application/json': ['.json', '.txt', '.log'], 'text/plain': ['.txt', '.log'] } });

    return (
        <div {...getRootProps()} className={`p-10 border-2 border-dashed rounded-lg text-center cursor-pointer transition-colors ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}`}>
            <input {...getInputProps()} />
            <div className="flex flex-col items-center justify-center space-y-4">
                <Upload className="w-12 h-12 text-gray-400" />
                {isDragActive ? (
                    <p className="text-lg text-blue-500">Solte os arquivos aqui...</p>
                ) : (
                    <div className="text-gray-600">
                        <p className="text-lg font-medium">Arraste e solte arquivos de log aqui</p>
                        <p className="text-sm text-gray-400">Suporta múltiplos arquivos (.json, .txt)</p>
                    </div>
                )}
            </div>
        </div>
    );
}
