import { useState, useRef } from 'react';
import { toast } from 'react-hot-toast';

const AudioRecord = () => {
  const [activeTab, setActiveTab] = useState('url');
  const [url, setUrl] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [response, setResponse] = useState(null);
  const [urlresponse, setUrlResponse] = useState(null);
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
      toast.error('Could not access microphone. Please check permissions.');
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
      toast.error('Please enter a URL');
      return;
    }
    setIsLoading(true);
    setUrlResponse(null);

    try {
      const res = await fetch('http://127.0.0.1:8000/audio_upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });

      if (!res.ok) {
        throw new Error('Request failed');
      }
      const data = await res.json();

      if (data.status === "Success") {
        toast.success(`🎵 Song uploaded: ${data.title}`);
      } else {
        toast.error('Song already exists');
      }
      setUrlResponse(data);
    } catch (error) {
      toast.error(error.message || 'Something went wrong');
      setUrlResponse(null);
    } finally {
      setIsLoading(false);
    }
  };


  const handleAudioSubmit = async () => {
    if (!audioBlob) {
      toast.error('Please record audio first');
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
      setResponse(data);
    } catch (error) {
      toast.error(`Error: ${error.message}`);
      setResponse(null);
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getYouTubeEmbedUrl = (url) => {
    const videoId = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/)?.[1];
    return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
  };

  const handleTabChange = (tabName) => {
    setActiveTab(tabName);
    setResponse(null);
    setUrlResponse(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 p-4 sm:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            🎵 Audio Identifier
          </h1>
          <p className="text-gray-600">Submit a URL or record audio to identify songs</p>
        </div>

        {/* Tab Selector */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => handleTabChange('url')}
            className={`flex-1 py-3 px-6 rounded-lg font-semibold transition-all ${activeTab === 'url'
                ? 'bg-blue-600 text-white shadow-lg'
                : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
          >
            Submit URL
          </button>
          <button
            onClick={() => handleTabChange('audio')}
            className={`flex-1 py-3 px-6 rounded-lg font-semibold transition-all ${activeTab === 'audio'
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
                placeholder="https://www.youtube.com/watch?v=yLWRxxxxxxx"
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

        {/* Results Area */}
        {response && response.match_found && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-800 mb-2">🎉 Matches Found!</h2>
              <p className="text-gray-600">Top 3 matching songs</p>
            </div>

            {[response.match_1, response.match_2, response.match_3].map((match, index) => {
              if (!match) return null;

              const embedUrl = getYouTubeEmbedUrl(match.url);
              const maxScore = Math.max(
                response.match_1?.score || 0,
                response.match_2?.score || 0,
                response.match_3?.score || 0
              );
              const confidence = ((match.score / maxScore) * 100).toFixed(1);

              return (
                <div
                  key={match.song_id}
                  className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow"
                >
                  <div className="p-4 bg-gradient-to-r from-purple-500 to-blue-500 text-white">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white text-purple-600 rounded-full flex items-center justify-center font-bold text-lg">
                          #{index + 1}
                        </div>
                        <div>
                          <h3 className="font-bold text-lg">{match.title}</h3>
                          <p className="text-purple-100 text-sm">{match.channel}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold">{confidence}%</div>
                        <div className="text-xs text-purple-100">Confidence</div>
                      </div>
                    </div>
                  </div>

                  {embedUrl && (
                    <div className="aspect-video">
                      <iframe
                        src={embedUrl}
                        className="w-full h-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                  )}

                  <div className="p-4 bg-gray-50 flex items-center justify-between text-sm text-gray-600">
                    <div className="flex items-center gap-4">
                      <span>⏱ Time Offset: {match.time_diff}s</span>
                      <span>📊 Score: {match.score.toLocaleString()}</span>
                    </div>
                    <a
                      href={match.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
                    >
                      Open in YouTube →
                    </a>
                  </div>

                  {/* Confidence Bar */}
                  <div className="h-2 bg-gray-200">
                    <div
                      className="h-full bg-gradient-to-r from-green-400 to-blue-500 transition-all duration-500"
                      style={{ width: `${confidence}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {activeTab !== "url" && response && !response.match_found && (
          <div className="bg-white rounded-xl shadow-xl p-8 text-center">
            <div className="text-6xl mb-4">😔</div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">No Matches Found</h2>
            <p className="text-gray-600">Try recording a longer audio clip or different part of the song</p>
          </div>
        )}

        {urlresponse && urlresponse.status && (
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 text-center transition-all hover:shadow-xl">
            {/* Status Badge */}
            <div className={`inline-block px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-4 ${
              urlresponse.status.toLowerCase() === 'success' 
                ? 'bg-green-100 text-green-700' 
                : 'bg-blue-100 text-blue-700'
            }`}>
              {urlresponse.status}
            </div>

            {/* Title & Info */}
            <h2 className="text-2xl font-extrabold text-gray-900 mb-1">
              {urlresponse.title || "Unknown Title"}
            </h2>
            
            <div className="flex flex-col items-center gap-1 mt-4">
              <span className="text-sm text-gray-400 font-medium uppercase tracking-tight">Song ID</span>
              <code className="bg-gray-50 px-3 py-1 rounded text-gray-600 font-mono text-sm border border-gray-200">
                {urlresponse.song_id}
              </code>
            </div>
          </div>
        )}

        {response && response.error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
            <div className="text-4xl mb-2">⚠️</div>
            <h3 className="text-lg font-bold text-red-800 mb-2">Error</h3>
            <p className="text-red-600">{response.error}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AudioRecord;
