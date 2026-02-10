import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, X, CheckCircle, AlertCircle } from 'lucide-react';

export function FileUpload({ onDataLoaded }) {
    const [acceptedFiles, setAcceptedFiles] = useState([]);
    const [error, setError] = useState(null);

    const onDrop = useCallback((droppedFiles) => {
        setError(null);
        const validFiles = droppedFiles.filter(file =>
            file.name.endsWith('.json') || file.name.endsWith('.txt') || file.name.endsWith('.csv')
        );

        if (validFiles.length !== droppedFiles.length) {
            setError("Alguns arquivos foram ignorados pois não são .json, .txt ou .csv");
        }

        setAcceptedFiles(validFiles);

        // Read all files
        const promises = validFiles.map(file => {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsText(file);
            });
        });

        Promise.all(promises)
            .then(contents => {
                // Concatenate all contents
                const combinedContent = contents.join('\n');
                onDataLoaded(combinedContent);
            })
            .catch(err => {
                console.error("Erro ao ler arquivos", err);
                setError("Falha ao ler o conteúdo dos arquivos.");
            });

    }, [onDataLoaded]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: { 'application/json': ['.json'], 'text/plain': ['.txt'], 'text/csv': ['.csv'] } });

    return (
        <div className="w-full">
            <div
                {...getRootProps()}
                className={`relative group cursor-pointer transition-all duration-300 ease-in-out border-2 border-dashed rounded-2xl p-12 text-center
            ${isDragActive
                        ? 'border-indigo-500 bg-indigo-500/10 scale-[1.02] shadow-2xl shadow-indigo-500/20'
                        : 'border-slate-700 bg-slate-900/50 hover:border-indigo-400 hover:bg-slate-800 hover:shadow-xl'
                    }`}
            >
                <input {...getInputProps()} />
                <div className="flex flex-col items-center justify-center space-y-4">
                    <div className={`p-5 rounded-full transition-all duration-300 ${isDragActive ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/50' : 'bg-slate-800 text-slate-400 group-hover:bg-slate-700 group-hover:text-indigo-400'}`}>
                        <Upload className="w-10 h-10" />
                    </div>

                    <div className="space-y-2">
                        {isDragActive ? (
                            <p className="text-xl font-bold text-indigo-400 animate-pulse">Solte os arquivos agora!</p>
                        ) : (
                            <>
                                <p className="text-lg font-semibold text-slate-200 group-hover:text-white transition-colors">
                                    Arraste e solte seus logs aqui
                                </p>
                                <p className="text-sm text-slate-500 group-hover:text-slate-400 transition-colors">
                                    Suporta múltiplos arquivos .json e .csv
                                </p>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Error Message */}
            {error && (
                <div className="mt-4 p-3 bg-rose-950/30 border border-rose-900/50 rounded-lg flex items-center gap-2 text-rose-300 text-sm animate-in slide-in-from-top-1">
                    <AlertCircle className="w-4 h-4" />
                    {error}
                </div>
            )}

            {/* File List */}
            {acceptedFiles.length > 0 && (
                <div className="mt-6 space-y-3">
                    <p className="text-sm font-medium text-slate-500 uppercase tracking-wider pl-1">Arquivos Selecionados</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {acceptedFiles.map(file => (
                            <div key={file.path} className="flex items-center justify-between bg-slate-800 border border-slate-700 text-slate-300 px-4 py-3 rounded-xl text-sm font-medium shadow-sm hover:border-slate-600 transition-colors">
                                <div className="flex items-center gap-3 overflow-hidden">
                                    <FileText className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                                    <span className="truncate">{file.name}</span>
                                </div>
                                <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
