import React, { useState, useEffect, useRef } from 'react';
import { 
  Camera, 
  Mic, 
  MicOff, 
  Power, 
  Loader2, 
  Volume2, 
  ShieldAlert, 
  Sparkles, 
  Info,
  CheckCircle,
  VideoOff
} from 'lucide-react';

interface LiveAVSessionProps {
  instructions: string;
  scenarioGoal: string;
}

export default function LiveAVSession({ instructions, scenarioGoal }: LiveAVSessionProps) {
  // Session connection states
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState<boolean>(false);
  const [micLevel, setMicLevel] = useState<number>(0);

  // Subtitles / Transcriptions
  const [botSubtitles, setBotSubtitles] = useState<string>("");
  const [userSubtitles, setUserSubtitles] = useState<string>("");

  // Devices info
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");

  // Refs for Web Audio API & Media Elements
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const processorNodeRef = useRef<ScriptProcessorNode | null>(null);
  const mediaStreamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const videoIntervalRef = useRef<any>(null);

  // Audio queue refs to handle interruption cleanups
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const nextStartTimeRef = useRef<number>(0);

  // Track muted in a ref so onaudioprocess callback can read the latest value
  const isMutedRef = useRef<boolean>(false);
  useEffect(() => {
    isMutedRef.current = muted;
  }, [muted]);

  // Enumerate cameras on component load
  useEffect(() => {
    const getDevices = async () => {
      try {
        // Prompt permissions briefly if needed to enumerate devices properly
        await navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then((s) => {
          // Release initial test stream immediately
          s.getTracks().forEach(t => t.stop());
        }).catch(() => {});

        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoIns = devices.filter(d => d.kind === 'videoinput');
        setVideoDevices(videoIns);
        if (videoIns.length > 0) {
          setSelectedDeviceId(videoIns[0].deviceId);
        }
      } catch (err) {
        console.warn('Could not enumerate audio/video devices:', err);
      }
    };
    getDevices();

    return () => {
      stopSession();
    };
  }, []);

  // Convert Float32Array PCM to base64 16-bit little-endian PCM
  const pcmToBase64 = (float32Array: Float32Array): string => {
    const buffer = new ArrayBuffer(float32Array.length * 2);
    const view = new DataView(buffer);
    let offset = 0;
    for (let i = 0; i < float32Array.length; i++, offset += 2) {
      const s = Math.max(-1, Math.min(1, float32Array[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }
    const bytes = new Uint8Array(buffer);
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  };

  // Play back 24kHz raw PCM chunk
  const playAudioChunk = async (audioCtx: AudioContext, base64Data: string) => {
    try {
      if (audioCtx.state === 'suspended') {
        await audioCtx.resume().catch(() => {});
      }
      const binary = atob(base64Data);
      const len = binary.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const int16Array = new Int16Array(bytes.buffer);

      // Convert Int16 PCM to Float32
      const float32Array = new Float32Array(int16Array.length);
      for (let i = 0; i < int16Array.length; i++) {
        float32Array[i] = int16Array[i] / 32768.0;
      }

      const buffer = audioCtx.createBuffer(1, float32Array.length, 24000);
      buffer.getChannelData(0).set(float32Array);

      const source = audioCtx.createBufferSource();
      source.buffer = buffer;
      source.connect(audioCtx.destination);

      activeSourcesRef.current.push(source);
      source.onended = () => {
        activeSourcesRef.current = activeSourcesRef.current.filter(src => src !== source);
      };

      const now = audioCtx.currentTime;
      if (nextStartTimeRef.current < now) {
        nextStartTimeRef.current = now;
      }
      source.start(nextStartTimeRef.current);
      nextStartTimeRef.current += buffer.duration;
    } catch (err) {
      console.error('Error scheduling audio playback chunk:', err);
    }
  };

  // Clear playback queue on model interruption
  const clearPlaybackQueue = () => {
    console.log('Interruption: clearing playback queue');
    activeSourcesRef.current.forEach(source => {
      try {
        source.stop();
      } catch (_) {}
    });
    activeSourcesRef.current = [];
    if (outputAudioContextRef.current) {
      nextStartTimeRef.current = outputAudioContextRef.current.currentTime;
    }
    setBotSubtitles(prev => prev ? prev + " [Interrupted]" : "");
  };

  // Start the Live Interaction session
  const startSession = async () => {
    if (isConnecting || isConnected) return;
    setIsConnecting(true);
    setError(null);
    setBotSubtitles("Connecting to Gemini Live...");
    setUserSubtitles("");

    try {
      // 1. Create and resume both AudioContexts immediately during user gesture to prevent browser suspension
      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      
      if (inputCtx.state === 'suspended') {
        await inputCtx.resume().catch(() => {});
      }
      if (outputCtx.state === 'suspended') {
        await outputCtx.resume().catch(() => {});
      }

      inputAudioContextRef.current = inputCtx;
      outputAudioContextRef.current = outputCtx;

      // 2. Capture microphone and selected camera stream
      const videoConstraints: MediaTrackConstraints = selectedDeviceId 
        ? { deviceId: { exact: selectedDeviceId }, width: 640, height: 480 }
        : { width: 640, height: 480 };

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: videoConstraints
      });

      cameraStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(e => console.warn("Video play failed", e));
      }

      // 3. Establish custom Live WebSocket connection to server
      const isSecure = window.location.protocol === 'https:';
      const wsUrl = `${isSecure ? 'wss:' : 'ws:'}//${window.location.host}`;
      console.log('Connecting Live WS to:', wsUrl);
      const socket = new WebSocket(wsUrl);
      wsRef.current = socket;

      socket.onopen = () => {
        socket.send(JSON.stringify({
          type: 'init',
          instructions,
          scenarioGoal
        }));
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.status === 'connected') {
            setIsConnected(true);
            setIsConnecting(false);
            setBotSubtitles("Connected! Speak to the Safety Inspector.");
            
            // Start audio harvesting and 1 FPS video snapshots
            startAudioAndVideoHarvesting(stream);
          } else if (data.error) {
            setError(data.error);
            stopSession();
          } else if (data.audio) {
            if (outputAudioContextRef.current) {
              playAudioChunk(outputAudioContextRef.current, data.audio);
            }
          } else if (data.text) {
            // Append spoken transcriptions in a streaming subtitle style
            setBotSubtitles(data.text);
          } else if (data.userText) {
            setUserSubtitles(data.userText);
          } else if (data.interrupted) {
            clearPlaybackQueue();
          }
        } catch (err) {
          console.error('Error handling live message:', err);
        }
      };

      socket.onclose = () => {
        console.log('WebSocket stream closed');
        stopSession();
      };

      socket.onerror = (err) => {
        console.error('WebSocket connection error:', err);
        setError('WebSocket error. Ensure server is running and GEMINI_API_KEY is configured.');
        stopSession();
      };

    } catch (err: any) {
      console.error('Failed to start Live session:', err);
      setError(err.message || 'Permission denied. Could not acquire microphone or camera feed.');
      setIsConnecting(false);
      setBotSubtitles("");
    }
  };

  // Start audio recording & 1 FPS video frame sending
  const startAudioAndVideoHarvesting = (stream: MediaStream) => {
    try {
      const inputCtx = inputAudioContextRef.current;
      if (!inputCtx) return;

      const source = inputCtx.createMediaStreamSource(stream);
      mediaStreamSourceRef.current = source;

      const processor = inputCtx.createScriptProcessor(4096, 1, 1);
      processorNodeRef.current = processor;

      source.connect(processor);
      processor.connect(inputCtx.destination);

      processor.onaudioprocess = (e) => {
        const channelData = e.inputBuffer.getChannelData(0);
        
        // Calculate real-time input mic level for visual feedback
        let sum = 0;
        for (let i = 0; i < channelData.length; i++) {
          sum += channelData[i] * channelData[i];
        }
        const rms = Math.sqrt(sum / channelData.length);
        const level = Math.min(100, Math.round(rms * 400)); // Scale to 0-100%
        setMicLevel(isMutedRef.current ? 0 : level);

        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && !isMutedRef.current) {
          const base64Audio = pcmToBase64(channelData);
          wsRef.current.send(JSON.stringify({ audio: base64Audio }));
        }
      };

      // 3. Video frames snapshots sending at 1 FPS (1000ms) to inspect in real-time
      videoIntervalRef.current = setInterval(() => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && videoRef.current) {
          const canvas = document.createElement('canvas');
          canvas.width = 640;
          canvas.height = 480;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
            // Grab JPEG snapshot
            const dataUrl = canvas.toDataURL('image/jpeg', 0.65);
            const base64Video = dataUrl.split(',')[1];
            if (base64Video) {
              wsRef.current.send(JSON.stringify({ video: base64Video }));
            }
          }
        }
      }, 1000);

    } catch (err) {
      console.error('Failed to configure audio context harvesting:', err);
    }
  };

  // Stop the session
  const stopSession = () => {
    setIsConnected(false);
    setIsConnecting(false);
    setMicLevel(0);

    // Stop video frame interval
    if (videoIntervalRef.current) {
      clearInterval(videoIntervalRef.current);
      videoIntervalRef.current = null;
    }

    // Stop and close camera/mic media tracks
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach(track => {
        track.stop();
      });
      cameraStreamRef.current = null;
    }

    // Stop and close input AudioContext
    if (processorNodeRef.current) {
      try {
        processorNodeRef.current.disconnect();
      } catch (_) {}
      processorNodeRef.current = null;
    }
    if (mediaStreamSourceRef.current) {
      try {
        mediaStreamSourceRef.current.disconnect();
      } catch (_) {}
      mediaStreamSourceRef.current = null;
    }
    if (inputAudioContextRef.current) {
      try {
        inputAudioContextRef.current.close();
      } catch (_) {}
      inputAudioContextRef.current = null;
    }

    // Stop and close output AudioContext
    activeSourcesRef.current.forEach(source => {
      try {
        source.stop();
      } catch (_) {}
    });
    activeSourcesRef.current = [];
    if (outputAudioContextRef.current) {
      try {
        outputAudioContextRef.current.close();
      } catch (_) {}
      outputAudioContextRef.current = null;
    }

    // Close WebSocket
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch (_) {}
      wsRef.current = null;
    }
  };

  // Change camera on the fly
  const handleCameraChange = async (deviceId: string) => {
    setSelectedDeviceId(deviceId);
    if (!isConnected && !isConnecting) return;

    try {
      // Release old video track
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getVideoTracks().forEach(track => track.stop());
        
        const newStream = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: { exact: deviceId }, width: 640, height: 480 }
        });

        const newVideoTrack = newStream.getVideoTracks()[0];
        cameraStreamRef.current.addTrack(newVideoTrack);
        
        if (videoRef.current) {
          videoRef.current.srcObject = cameraStreamRef.current;
        }
      }
    } catch (err) {
      console.error('Failed to switch camera device:', err);
    }
  };

  return (
    <div className="bg-slate-900 text-slate-100 rounded-xl overflow-hidden border border-slate-700 shadow-xl flex flex-col h-full">
      {/* Session Status Bar */}
      <div className="bg-slate-950/80 px-5 py-4 flex flex-wrap items-center justify-between border-b border-slate-800 gap-3">
        <div className="flex items-center gap-2.5">
          <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-red-500 animate-pulse' : 'bg-slate-500'}`} />
          <div>
            <span className="font-bold text-xs uppercase tracking-wider text-slate-300">
              {isConnected ? 'LIVE AUDIO-VIDEO SESSION' : 'LIVE CONVERSATIONAL INSPECTOR'}
            </span>
            <p className="text-[10px] text-slate-400 mt-0.5">Stream live video &amp; talk to the safety inspector in real time</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Camera device selection */}
          <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700 px-2.5 py-1 rounded-lg text-xs">
            <Camera className="w-3.5 h-3.5 text-slate-400" />
            <select 
              value={selectedDeviceId}
              onChange={(e) => handleCameraChange(e.target.value)}
              className="bg-transparent text-slate-200 outline-none cursor-pointer border-none p-0 focus:ring-0 max-w-[130px] sm:max-w-[200px]"
            >
              {videoDevices.map((dev) => (
                <option key={dev.deviceId} value={dev.deviceId} className="bg-slate-900 text-slate-200 text-xs">
                  {dev.label || `Camera ${dev.deviceId.slice(0, 5)}`}
                </option>
              ))}
              {videoDevices.length === 0 && <option value="">No Camera Found</option>}
            </select>
          </div>
        </div>
      </div>

      {/* Main Streaming Panel */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5 p-5 flex-1 min-h-[380px]">
        {/* Left Side: Video Stream Window */}
        <div className="md:col-span-7 bg-black rounded-lg overflow-hidden border border-slate-800 relative aspect-video md:aspect-auto flex items-center justify-center">
          {isConnected || isConnecting ? (
            <video 
              ref={videoRef}
              autoPlay 
              playsInline 
              muted 
              className="w-full h-full object-cover scale-x-[-1]"
            />
          ) : (
            <div className="flex flex-col items-center gap-3 text-slate-500 p-6 text-center">
              <VideoOff className="w-12 h-12 text-slate-600" />
              <div>
                <p className="text-sm font-semibold text-slate-400">Live Camera Stream Offline</p>
                <p className="text-xs text-slate-500 max-w-sm mt-1">
                  Start the interaction session to stream your device camera feed to the AI safety auditor.
                </p>
              </div>
            </div>
          )}

          {/* Live Indicator Overlay */}
          {isConnected && (
            <div className="absolute top-3 left-3 bg-red-600/90 text-white text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5 shadow-md">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
              LIVE FEED
            </div>
          )}

          {isConnected && (
            <div className="absolute top-3 right-3 bg-slate-950/80 text-emerald-400 text-[10px] font-mono px-2.5 py-1 rounded-full flex items-center gap-1 shadow-md">
              <CheckCircle className="w-3 h-3 text-emerald-400" />
              1 FPS ANALYZER
            </div>
          )}
        </div>

        {/* Right Side: Conversation Subtitles & Info */}
        <div className="md:col-span-5 flex flex-col justify-between gap-4 h-full">
          {/* Guide card */}
          <div className="bg-slate-950/40 border border-slate-800 rounded-lg p-4">
            <div className="flex gap-2 text-slate-300 text-xs font-semibold mb-2 items-center">
              <Info className="w-4 h-4 text-slate-400 shrink-0" />
              <span>Inspection Scope</span>
            </div>
            <div className="space-y-1.5 font-sans">
              <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">Goal</div>
              <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">{scenarioGoal}</p>
            </div>
          </div>

          {/* Real-time speech interaction displays */}
          <div className="flex-1 bg-slate-950/60 border border-slate-800 rounded-lg p-4 flex flex-col gap-3 min-h-[160px] justify-end">
            <div className="flex-1 overflow-y-auto space-y-3.5 flex flex-col justify-end">
              {/* User transcript */}
              {userSubtitles && (
                <div className="space-y-1">
                  <div className="text-[9px] text-indigo-400 font-bold uppercase tracking-wider">You Spoke</div>
                  <div className="bg-indigo-950/40 border border-indigo-900/50 p-2.5 rounded-lg text-xs text-slate-200">
                    "{userSubtitles}"
                  </div>
                </div>
              )}

              {/* Bot transcript */}
              <div className="space-y-1">
                <div className="text-[9px] text-emerald-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <Volume2 className="w-3 h-3 text-emerald-400" />
                  <span>AI Inspector Spoke</span>
                </div>
                <div className="bg-slate-900/80 border border-slate-800 p-3 rounded-lg text-xs font-medium text-slate-100 leading-relaxed min-h-[48px]">
                  {botSubtitles || "Press 'Start Session' below to initiate real-time inspection."}
                </div>
              </div>
            </div>
          </div>

          {/* Controls Bar */}
          <div className="flex items-center gap-3">
            {!isConnected && !isConnecting ? (
              <button
                onClick={startSession}
                className="flex-1 py-3 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-lg"
              >
                <Power className="w-4 h-4" />
                Start Live Session
              </button>
            ) : (
              <button
                onClick={stopSession}
                disabled={isConnecting}
                className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 border border-slate-600"
              >
                {isConnecting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <Power className="w-4 h-4 text-red-500" />
                    End Session
                  </>
                )}
              </button>
            )}

            {isConnected && (
              <div className="flex items-center gap-2 bg-slate-950/40 border border-slate-800 p-1.5 rounded-lg">
                {/* Visual mic indicator */}
                <div className="flex flex-col gap-1 items-center px-1">
                  <div className="flex gap-[2px] h-3 items-end w-12 bg-slate-900 rounded px-[2px] overflow-hidden">
                    <div className="bg-emerald-500 w-[10px] rounded-t transition-all duration-75" style={{ height: `${Math.min(100, micLevel * 1.5)}%` }} />
                    <div className="bg-emerald-400 w-[10px] rounded-t transition-all duration-75" style={{ height: `${Math.max(0, Math.min(100, (micLevel - 15) * 1.5))}%` }} />
                    <div className="bg-yellow-400 w-[10px] rounded-t transition-all duration-75" style={{ height: `${Math.max(0, Math.min(100, (micLevel - 35) * 1.5))}%` }} />
                    <div className="bg-red-400 w-[10px] rounded-t transition-all duration-75" style={{ height: `${Math.max(0, Math.min(100, (micLevel - 60) * 1.5))}%` }} />
                  </div>
                  <span className="text-[8px] text-slate-400 font-mono">Mic Input</span>
                </div>

                <button
                  onClick={() => setMuted(!muted)}
                  className={`p-3 rounded-lg border transition-all ${
                    muted 
                      ? 'bg-red-950/60 border-red-800 text-red-400' 
                      : 'bg-slate-800 hover:bg-slate-700 border-slate-600 text-slate-300'
                  }`}
                  title={muted ? "Unmute Microphone" : "Mute Microphone"}
                >
                  {muted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Connection Errors info */}
      {error && (
        <div className="bg-red-950/80 border-t border-red-900 p-3.5 px-5 flex items-start gap-3">
          <ShieldAlert className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1 text-xs">
            <span className="font-semibold text-red-300">Auditor Stream Error:</span>
            <p className="text-red-400/90 mt-0.5 leading-relaxed">{error}</p>
          </div>
        </div>
      )}
    </div>
  );
}
