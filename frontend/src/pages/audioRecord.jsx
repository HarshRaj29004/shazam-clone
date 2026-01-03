import { useState, useRef } from 'react';
import toast from 'react-hot-toast';

const AudioRecord = () => {
  const [activeTab, setActiveTab] = useState('url');
  const [url, setUrl] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [response, setResponse] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setRecordingTime(0);
      
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('Error accessing microphone:', error);
      alert('Could not access microphone. Please check permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(timerRef.current);
    }
  };

  const handleUrlSubmit = async () => {
    if (!url.trim()) {
      alert('Please enter a URL');
      return;
    }

    setIsLoading(true);
    setResponse('');

    try {
      const res = await fetch('http://127.0.0.1:8000/audio_upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });

      const data = await res.json();
      toast.success(data.message);
      setResponse(JSON.stringify(data, null, 2));
    } catch (error) {
      setResponse(`Error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAudioSubmit = async () => {
    if (!audioBlob) {
      alert('Please record audio first');
      return;
    }

    setIsLoading(true);
    setResponse('');

    try {
      const formData = new FormData();
      formData.append('file', audioBlob, 'recording.webm');

      const res = await fetch('http://127.0.0.1:8000/identify', {
        method: 'POST',
        body: formData
      });

      const data = await res.json();
      setResponse(JSON.stringify(data, null, 2));
    } catch (error) {
      setResponse(`Error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-8 text-center">
          Audio & URL Processor
        </h1>

        {/* Tab Selector */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('url')}
            className={`flex-1 py-3 px-6 rounded-lg font-semibold transition-all ${
              activeTab === 'url'
                ? 'bg-blue-600 text-white shadow-lg'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            Submit URL
          </button>
          <button
            onClick={() => setActiveTab('audio')}
            className={`flex-1 py-3 px-6 rounded-lg font-semibold transition-all ${
              activeTab === 'audio'
                ? 'bg-purple-600 text-white shadow-lg'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            Record Audio
          </button>
        </div>

        {/* Content Area */}
        <div className="bg-white rounded-xl shadow-xl p-8 mb-6">
          {activeTab === 'url' ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Enter URL
              </label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
              />
              <button
                onClick={handleUrlSubmit}
                disabled={isLoading}
                className="w-full mt-4 bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all"
              >
                {isLoading ? 'Processing...' : 'Submit URL'}
              </button>
            </div>
          ) : (
            <div>
              <div className="text-center mb-6">
                {isRecording && (
                  <div className="mb-4">
                    <div className="inline-flex items-center gap-2 bg-red-100 text-red-600 px-4 py-2 rounded-full">
                      <div className="w-3 h-3 bg-red-600 rounded-full animate-pulse" />
                      <span className="font-mono font-bold">{formatTime(recordingTime)}</span>
                    </div>
                  </div>
                )}
                
                {!isRecording && !audioBlob && (
                  <button
                    onClick={startRecording}
                    className="bg-purple-600 text-white px-8 py-4 rounded-full font-semibold hover:bg-purple-700 transition-all shadow-lg hover:shadow-xl"
                  >
                    🎤 Start Recording
                  </button>
                )}

                {isRecording && (
                  <button
                    onClick={stopRecording}
                    className="bg-red-600 text-white px-8 py-4 rounded-full font-semibold hover:bg-red-700 transition-all shadow-lg hover:shadow-xl"
                  >
                    ⏹ Stop Recording
                  </button>
                )}

                {audioBlob && !isRecording && (
                  <div className="space-y-4">
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <p className="text-green-700 font-semibold">✓ Recording Complete</p>
                      <audio 
                        controls 
                        src={URL.createObjectURL(audioBlob)}
                        className="w-full mt-3"
                      />
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={() => {
                          setAudioBlob(null);
                          setRecordingTime(0);
                        }}
                        className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-300 transition-all"
                      >
                        Record Again
                      </button>
                      <button
                        onClick={handleAudioSubmit}
                        disabled={isLoading}
                        className="flex-1 bg-purple-600 text-white py-3 rounded-lg font-semibold hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all"
                      >
                        {isLoading ? 'Processing...' : 'Submit Audio'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Response Area */}
        {response && (
          <div className="bg-white rounded-xl shadow-xl p-8">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Response</h2>
            <pre className="bg-gray-50 p-4 rounded-lg overflow-auto max-h-96 text-sm text-gray-700 border border-gray-200">
              {response}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};

export default AudioRecord;