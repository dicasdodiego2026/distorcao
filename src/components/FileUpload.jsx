import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, CheckCircle } from 'lucide-react';

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

    const { getRootProps, getInputProps, isDragActive, acceptedFiles } = useDropzone({
        onDrop,
        accept: {
            'application/json': ['.json'],
            'text/plain': ['.txt', '.log']
        }
    });

    return (
        <div
            {...getRootProps()}
            className={`relative group cursor-pointer transition-all duration-300 ease-in-out border-2 border-dashed rounded-xl p-10 text-center
        ${isDragActive
                    ? 'border-blue-500 bg-blue-50 scale-[1.02] shadow-xl'
                    : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50 hover:shadow-md'
                }`}
        >
            <input {...getInputProps()} />
            <div className="flex flex-col items-center justify-center space-y-4">
                <div className={`p-4 rounded-full transition-colors duration-300 ${isDragActive ? 'bg-blue-100' : 'bg-slate-100 group-hover:bg-blue-50'}`}>
                    <Upload className={`w-10 h-10 transition-colors duration-300 ${isDragActive ? 'text-blue-600' : 'text-slate-400 group-hover:text-blue-500'}`} />
                </div>

                <div className="space-y-2">
                    {isDragActive ? (
                        <p className="text-xl font-semibold text-blue-600">Solte os arquivos agora!</p>
                    ) : (
                        <>
                            <p className="text-lg font-medium text-slate-700">
                                Arraste e solte arquivos de log aqui
                            </p>
                            <p className="text-sm text-slate-500">
                                Aceita múltiplos arquivos .json ou .txt
                            </p>
                        </>
                    )}
                </div>

                {acceptedFiles.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-slate-200 w-full">
                        <p className="text-sm font-medium text-slate-600 mb-2 text-left">Arquivos selecionados:</p>
                        <div className="flex flex-wrap gap-2">
                            {acceptedFiles.map(file => (
                                <div key={file.path} className="flex items-center bg-green-50 text-green-700 px-3 py-1 rounded-full text-xs font-medium border border-green-100">
                                    <CheckCircle className="w-3 h-3 mr-1" />
                                    {file.name}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
