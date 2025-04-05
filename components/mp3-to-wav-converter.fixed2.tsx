"use client"

import type React from "react"
import Head from "next/head"

import { useState, useRef, useEffect } from "react"
import { Upload, Settings, Play, Download, Share2, ChevronDown, ChevronUp, Volume2, AlertTriangle, InfoIcon, Loader2, Shield, Zap, Headphones, Music, FileAudio, VideoIcon, Edit, Scissors, BarChart, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { toast } from "@/components/ui/use-toast"
import { ToastAction } from "@/components/ui/toast"
import { cn } from "@/lib/utils"

// Mock function to simulate conversion process
const convertFile = async (file: File, settings: ConversionSettings, onProgress: (progressUpdater: (prev: number) => number) => void): Promise<{ fileId: string, shareId: string, originalName: string, ffmpegAvailable: boolean, url?: string }> => {
  try {
    console.log('Preparing to send conversion request, file size:', file.size, 'file type:', file.type);
    
    // Create FormData object
    const formData = new FormData();
    formData.append('file', file);
    formData.append('volume', settings.volume.toString());
    formData.append('sampleRate', settings.sampleRate);
    formData.append('channels', settings.channels);
    formData.append('bitDepth', settings.bitDepth);
    formData.append('trimStart', settings.trimStart.toString());
    formData.append('trimEnd', settings.trimEnd.toString());
    
    console.log('Conversion parameters:', {
      volume: settings.volume,
      sampleRate: settings.sampleRate,
      channels: settings.channels,
      bitDepth: settings.bitDepth,
      trimStart: settings.trimStart,
      trimEnd: settings.trimEnd
    });
    
    // Simulate progress updates
    const progressUpdater = setInterval(() => {
      onProgress((prev: number) => Math.min(prev + 5, 95));
    }, 500);
    
    // Call API
    console.log('Sending conversion request...');
    let response;
    try {
      response = await fetch('/api/convert', {
        method: 'POST',
        body: formData
      });
    } catch (fetchError) {
      console.error('Network request error:', fetchError);
      throw new Error(`Network request error: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}`);
    }
    
    clearInterval(progressUpdater);
    
    // Check HTTP status
    if (!response.ok) {
      let errorText = '';
      let errorData = {};
      
      try {
        // Try to parse error response
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          errorData = await response.json();
          console.error('API returned JSON error:', errorData);
        } else {
          errorText = await response.text();
          console.error('API returned text error:', errorText);
        }
      } catch (responseError) {
        console.error('Unable to parse error response:', responseError);
      }
      
      let errorMessageStr = '';
      
      if (errorData && typeof errorData === 'object') {
        if ('error' in errorData && errorData.error) {
          errorMessageStr = String(errorData.error);
        } else if ('details' in errorData && errorData.details) {
          errorMessageStr = String(errorData.details);
        }
      }
      
      if (!errorMessageStr && errorText) {
        errorMessageStr = errorText;
      }
      
      if (!errorMessageStr) {
        errorMessageStr = `Server returned error status code: ${response.status}`;
      }
      
      console.error('Final error message:', errorMessageStr);
      throw new Error(errorMessageStr);
    }
    
    console.log('Conversion request successful');
    onProgress((prev: number) => 100);
    
    // Play completion sound
    try {
      const audio = new Audio("/complete.mp3");
      audio.play().catch(err => console.error("Error playing completion sound:", err));
    } catch (error) {
      console.error("Audio playback error:", error);
    }
    
    // Parse JSON response
    let data;
    try {
      data = await response.json();
    } catch (parseError) {
      console.error('Failed to parse response JSON:', parseError);
      throw new Error('Unable to parse server response');
    }
    
    console.log('Conversion successful:', data);

    // Update state won't execute here as this is outside component function
    // but we return the data to be handled by the component
    
    // If a sample audio file was created, notify user
    if (data.isSampleAudio) {
      toast({
        title: "Sample audio generated",
        description: "Since FFmpeg is not available, we created a sample WAV file instead of converting your MP3.",
      });
    }
    
    return data;
  } catch (error) {
    console.error('API call error:', error);
    throw error;
  }
}

interface ConversionSettings {
  volume: number
  sampleRate: string
  channels: string
  bitDepth: string
  trimStart: number
  trimEnd: number
  useSimpleConversion: boolean
}

// 娣诲姞FAQ缁勪欢
interface FAQItem {
  question: string;
  answer: string;
}

function FAQ({ items }: { items: FAQItem[] }) {
  return (
    <div className="w-full max-w-3xl mx-auto mt-12 bg-white dark:bg-slate-900 rounded-xl p-6">
      <h2 className="text-2xl font-bold mb-6 text-center">Frequently Asked Questions</h2>
      <div className="space-y-4">
        {items.map((item, index) => (
          <Collapsible key={index} className="border rounded-lg overflow-hidden">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="flex w-full justify-between p-4 text-left">
                <span className="font-medium">{item.question}</span>
                <ChevronDown className="h-5 w-5 shrink-0 transition-transform duration-200 ui-open:rotate-180" />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="p-4 pt-0 border-t">
              <p className="text-gray-700 dark:text-gray-300">{item.answer}</p>
            </CollapsibleContent>
          </Collapsible>
        ))}
      </div>
    </div>
  );
}

// 棰濆鍔熻兘缁勪欢
function FeatureSection() {
  return (
    <div className="w-full max-w-3xl mx-auto mt-8 mb-12">
      <h2 className="text-2xl font-bold mb-6 text-center">Why Choose Our MP3 to WAV Converter</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm">
          <div className="flex items-center justify-center mb-4 h-12 w-12 rounded-full bg-blue-100 text-blue-600 mx-auto">
            <Shield className="h-6 w-6" />
          </div>
          <h3 className="text-lg font-medium text-center mb-2">Privacy-Focused</h3>
          <p className="text-gray-600 dark:text-gray-400 text-center text-sm">Your files are processed locally without being uploaded to any server unless necessary.</p>
        </div>
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm">
          <div className="flex items-center justify-center mb-4 h-12 w-12 rounded-full bg-green-100 text-green-600 mx-auto">
            <Zap className="h-6 w-6" />
          </div>
          <h3 className="text-lg font-medium text-center mb-2">Lightning Fast</h3>
          <p className="text-gray-600 dark:text-gray-400 text-center text-sm">Convert your MP3 files to WAV format in seconds with our optimized processing engine.</p>
        </div>
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm">
          <div className="flex items-center justify-center mb-4 h-12 w-12 rounded-full bg-purple-100 text-purple-600 mx-auto">
            <Settings className="h-6 w-6" />
          </div>
          <h3 className="text-lg font-medium text-center mb-2">Advanced Options</h3>
          <p className="text-gray-600 dark:text-gray-400 text-center text-sm">Fine-tune your audio with adjustable sample rate, bit depth, channels, and volume controls.</p>
        </div>
      </div>
    </div>
  );
}

// 浣跨敤鎸囧崡
function UsageGuide() {
  return (
    <div className="w-full max-w-3xl mx-auto mt-12 bg-white dark:bg-slate-900 rounded-xl p-6">
      <h2 className="text-2xl font-bold mb-6 text-center">How to Convert MP3 to WAV</h2>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row items-center gap-4">
          <div className="flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 text-blue-600 flex-shrink-0">
            <span className="font-bold">1</span>
          </div>
          <div>
            <h3 className="text-lg font-medium mb-1">Upload your MP3 file</h3>
            <p className="text-gray-600 dark:text-gray-400">Drag and drop your MP3 file into the upload area or click to browse your files.</p>
          </div>
        </div>
        <div className="flex flex-col md:flex-row items-center gap-4">
          <div className="flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 text-blue-600 flex-shrink-0">
            <span className="font-bold">2</span>
          </div>
          <div>
            <h3 className="text-lg font-medium mb-1">Adjust settings (optional)</h3>
            <p className="text-gray-600 dark:text-gray-400">Customize the volume, sample rate, channels, bit depth, and trim the audio if needed.</p>
          </div>
        </div>
        <div className="flex flex-col md:flex-row items-center gap-4">
          <div className="flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 text-blue-600 flex-shrink-0">
            <span className="font-bold">3</span>
          </div>
          <div>
            <h3 className="text-lg font-medium mb-1">Convert to WAV</h3>
            <p className="text-gray-600 dark:text-gray-400">Click the convert button and wait for the process to complete.</p>
          </div>
        </div>
        <div className="flex flex-col md:flex-row items-center gap-4">
          <div className="flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 text-blue-600 flex-shrink-0">
            <span className="font-bold">4</span>
          </div>
          <div>
            <h3 className="text-lg font-medium mb-1">Download or share</h3>
            <p className="text-gray-600 dark:text-gray-400">Download your converted WAV file or share the link with others.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// 娣诲姞鐩稿叧鏂囩珷缁勪欢
function RelatedArticles() {
  return (
    <div className="w-full max-w-3xl mx-auto mt-12 bg-white dark:bg-slate-900 rounded-xl p-6">
      <h2 className="text-2xl font-bold mb-6 text-center">Related Articles</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="border rounded-lg overflow-hidden hover:shadow-md transition-shadow">
          <div className="h-40 bg-blue-100 flex items-center justify-center">
            <Volume2 className="h-12 w-12 text-blue-500" />
          </div>
          <div className="p-4">
            <h3 className="font-medium text-lg mb-2">MP3 vs WAV: Understanding Audio Formats</h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">Learn about the key differences between MP3 and WAV audio formats and when to use each one.</p>
            <Button variant="link" className="p-0 h-auto text-blue-600 dark:text-blue-400">Read Article</Button>
          </div>
        </div>
        <div className="border rounded-lg overflow-hidden hover:shadow-md transition-shadow">
          <div className="h-40 bg-green-100 flex items-center justify-center">
            <Settings className="h-12 w-12 text-green-500" />
          </div>
          <div className="p-4">
            <h3 className="font-medium text-lg mb-2">Best Sample Rates for Audio Production</h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">Discover the optimal sample rates for different audio production scenarios and how they affect quality.</p>
            <Button variant="link" className="p-0 h-auto text-blue-600 dark:text-blue-400">Read Article</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// 娣诲姞鍏朵粬杞崲宸ュ叿瀵艰埅
function OtherTools() {
  return (
    <div className="w-full max-w-3xl mx-auto mt-12 bg-white dark:bg-slate-900 rounded-xl p-6">
      <h2 className="text-2xl font-bold mb-6 text-center">Other Audio Conversion Tools</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        <div className="border rounded-lg p-4 text-center hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors cursor-pointer">
          <div className="h-12 w-12 mx-auto mb-2 flex items-center justify-center">
            <Headphones className="h-6 w-6 text-blue-500" />
          </div>
          <p className="text-sm font-medium">WAV to MP3</p>
        </div>
        <div className="border rounded-lg p-4 text-center hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors cursor-pointer">
          <div className="h-12 w-12 mx-auto mb-2 flex items-center justify-center">
            <Music className="h-6 w-6 text-blue-500" />
          </div>
          <p className="text-sm font-medium">MP3 to FLAC</p>
        </div>
        <div className="border rounded-lg p-4 text-center hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors cursor-pointer">
          <div className="h-12 w-12 mx-auto mb-2 flex items-center justify-center">
            <FileAudio className="h-6 w-6 text-blue-500" />
          </div>
          <p className="text-sm font-medium">WAV to OGG</p>
        </div>
        <div className="border rounded-lg p-4 text-center hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors cursor-pointer">
          <div className="h-12 w-12 mx-auto mb-2 flex items-center justify-center">
            <VideoIcon className="h-6 w-6 text-blue-500" />
          </div>
          <p className="text-sm font-medium">MP4 to MP3</p>
        </div>
        <div className="border rounded-lg p-4 text-center hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors cursor-pointer">
          <div className="h-12 w-12 mx-auto mb-2 flex items-center justify-center">
            <Edit className="h-6 w-6 text-blue-500" />
          </div>
          <p className="text-sm font-medium">Audio Editor</p>
        </div>
        <div className="border rounded-lg p-4 text-center hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors cursor-pointer">
          <div className="h-12 w-12 mx-auto mb-2 flex items-center justify-center">
            <Scissors className="h-6 w-6 text-blue-500" />
          </div>
          <p className="text-sm font-medium">Audio Trimmer</p>
        </div>
        <div className="border rounded-lg p-4 text-center hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors cursor-pointer">
          <div className="h-12 w-12 mx-auto mb-2 flex items-center justify-center">
            <BarChart className="h-6 w-6 text-blue-500" />
          </div>
          <p className="text-sm font-medium">Audio Normalizer</p>
        </div>
        <div className="border rounded-lg p-4 text-center hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors cursor-pointer">
          <div className="h-12 w-12 mx-auto mb-2 flex items-center justify-center">
            <Plus className="h-6 w-6 text-blue-500" />
          </div>
          <p className="text-sm font-medium">More Tools</p>
        </div>
      </div>
    </div>
  );
}

export function MP3toWAVConverter() {
  const [file, setFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isConverting, setIsConverting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [audioDuration, setAudioDuration] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [waveformData, setWaveformData] = useState<number[]>([])
  const [fileId, setFileId] = useState<string | null>(null)
  const [shareId, setShareId] = useState<string | null>(null)
  const [originalName, setOriginalName] = useState<string | null>(null)
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null)
  const [gainNode, setGainNode] = useState<GainNode | null>(null)
  const [mediaSource, setMediaSource] = useState<MediaElementAudioSourceNode | null>(null)
  const [ffmpegAvailable, setFfmpegAvailable] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const [settings, setSettings] = useState<ConversionSettings>({
    volume: 100,
    sampleRate: "44100",
    channels: "stereo",
    bitDepth: "16",
    trimStart: 0,
    trimEnd: 100,
  })

  // Preload audio
  useEffect(() => {
    const completionSound = new Audio("/complete.mp3")
    completionSound.preload = "auto"

    return () => {
      // Clean up
      completionSound.src = ""
    }
  }, [])

  // 淇敼isValidMP3File鍑芥暟锛屼娇鍏舵洿涓ユ牸
  const isValidMP3File = (file: File): boolean => {
    console.log("Validating file:", file.name, file.type);
    
    // 妫€鏌IME绫诲瀷
    const isMimeValid = file.type === "audio/mpeg";
    
    // 妫€鏌ユ枃浠舵墿灞曞悕
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    const isExtensionValid = fileExtension === 'mp3';
    
    const isValid = isMimeValid || isExtensionValid;
    console.log("File validation result:", isValid, "MIME:", isMimeValid, "Extension:", isExtensionValid);
    
    return isValid;
  };

  // 淇敼handleDrop鍑芥暟锛屾坊鍔犳洿鏄庢樉鐨勯敊璇棩锟?  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFile = e.dataTransfer.files[0];
    if (!droppedFile) {
      console.error("No file detected during drop");
      toast({
        title: "No file detected",
        description: "Please drop a valid MP3 file.",
        variant: "destructive",
      });
      return;
    }
    
    console.log("Dropped file:", droppedFile.name, droppedFile.type);
    
    if (!isValidMP3File(droppedFile)) {
      console.error("File type invalid:", droppedFile.type, droppedFile.name);
      toast({
        title: "Invalid file format",
        description: "Only MP3 files are supported. Please upload an MP3 file.",
        variant: "destructive",
      });
      
      // 娣诲姞瑙嗚閿欒鎻愮ず
      setErrorMessage("Invalid file format. Only MP3 files are supported.");
      setTimeout(() => setErrorMessage(null), 5000);
      return;
    }
    
    if (droppedFile.size > 500 * 1024 * 1024) {
      console.error("File too large:", droppedFile.size);
      toast({
        title: "File too large",
        description: "Maximum file size is 500MB. Please upload a smaller file or compress your audio.",
        variant: "destructive",
      });
      
      // 娣诲姞瑙嗚閿欒鎻愮ず
      setErrorMessage("File too large. Maximum size is 500MB.");
      setTimeout(() => setErrorMessage(null), 5000);
      return;
    }

    handleFileSelected(droppedFile);
  };

  // 绠€鍖杊andleFileSelected鍑芥暟锛岀Щ闄ら噸澶嶇殑澶у皬楠岃瘉
  const handleFileSelected = (selectedFile: File) => {
    setFile(selectedFile);
    setIsSettingsOpen(true);
    setDownloadUrl(null);

    // Create audio element to get duration and generate waveform
    const audioUrl = URL.createObjectURL(selectedFile);
    if (audioRef.current) {
      audioRef.current.src = audioUrl;

      audioRef.current.onloadedmetadata = () => {
        if (audioRef.current) {
          setAudioDuration(audioRef.current.duration);
          setSettings((prev) => ({
            ...prev,
            trimStart: 0,
            trimEnd: audioRef.current ? audioRef.current.duration : 100,
          }));
          generateWaveform(audioUrl);
        }
      };

      audioRef.current.onerror = (e) => {
        console.error("Error loading audio:", e);
        toast({
          title: "Audio loading error",
          description: "Could not load the audio file. Please ensure it's a valid MP3 file and try again.",
          variant: "destructive",
        });
        setFile(null);
      };
    }
  };

  // Generate mock waveform data
  const generateWaveform = (audioUrl: string) => {
    // Create a mock waveform data with more data points for a smoother appearance
    const mockWaveform = Array.from({ length: 200 }, (_, i) => {
      // Use sine function to create a more realistic waveform pattern
      return (Math.sin(i * 0.1) * 0.3 + 0.5) * 0.8 + Math.random() * 0.2;
    });
    
    setWaveformData(mockWaveform);
    drawWaveform(mockWaveform);
  }

  // Draw waveform on canvas
  const drawWaveform = (data: number[]) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return
    
    // Only proceed if we have data
    if (!data || data.length === 0) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

    const width = canvas.width
    const height = canvas.height

    ctx.clearRect(0, 0, width, height)
    
    // Adjust waveform height based on current volume
    const volumeAdjustedData = data.map(value => {
      // Apply volume scaling factor (100% = original size)
      return value * (settings.volume / 100);
    });

    // Draw waveform
    ctx.fillStyle = "#2A6FDB"
    const barWidth = width / data.length
    volumeAdjustedData.forEach((value, index) => {
      const barHeight = value * height
      const x = index * barWidth
      const y = (height - barHeight) / 2
      ctx.fillRect(x, y, barWidth - 1, barHeight)
    })

    // Draw trim area and markers - increase width and interaction area
    if (audioDuration > 0) {
      const startX = (settings.trimStart / audioDuration) * width
      const endX = (settings.trimEnd / audioDuration) * width
      
      // Add semi-transparent background for trim area
      ctx.fillStyle = "rgba(42, 111, 219, 0.1)" // Blue semi-transparent
      ctx.fillRect(startX, 0, endX - startX, height)
      
      // Increase trim marker width
      const markerWidth = 6
      
      // Draw start marker (green)
      ctx.fillStyle = "#4ade80"
      ctx.fillRect(startX - markerWidth/2, 0, markerWidth, height)
      
      // Draw end marker (red)
      ctx.fillStyle = "#ef4444"
      ctx.fillRect(endX - markerWidth/2, 0, markerWidth, height)
      
      // Add drag indicators
      ctx.fillStyle = "#ffffff"
      
      // Start marker drag indicator
      ctx.beginPath()
      ctx.arc(startX, height/2, 8, 0, Math.PI * 2)
      ctx.fill()
      
      ctx.fillStyle = "#4ade80"
      ctx.beginPath()
      ctx.arc(startX, height/2, 6, 0, Math.PI * 2)
      ctx.fill()
      
      // End marker drag indicator
      ctx.fillStyle = "#ffffff"
      ctx.beginPath()
      ctx.arc(endX, height/2, 8, 0, Math.PI * 2)
      ctx.fill()
      
      ctx.fillStyle = "#ef4444"
      ctx.beginPath()
      ctx.arc(endX, height/2, 6, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  // Update waveform when settings change or trim positions
  useEffect(() => {
    if (waveformData.length > 0 && file) {
      drawWaveform(waveformData);
    }
  }, [settings.volume, settings.trimStart, settings.trimEnd, waveformData, audioDuration, file])

  // Handle conversion
  const handleConvert = async () => {
    if (!file) return;
    
    setIsConverting(true);
    setProgress(0);
    
    // First try client-side conversion
    try {
      await handleClientSideConversion();
    } catch (error) {
      console.error('Client-side conversion failed, falling back to server conversion:', error);
      try {
        await handleServerConversion();
      } catch (serverError) {
        console.error('Server conversion also failed:', serverError);
        toast({
          title: "Conversion Failed",
          description: "Could not complete conversion. Please try another file.",
          variant: "destructive",
        });
      }
    } finally {
      setIsConverting(false);
    }
  };

  // Add client-side conversion function that doesn't depend on server-side conversion
  const handleClientSideConversion = async () => {
    if (!file) return;
    
    try {
      setIsConverting(true);
      setProgress(10);
      
      // 璁剧疆鍘熷鏂囦欢锟?- 娣诲姞杩欎竴琛屼互淇涓嬭浇鏂囦欢鍚嶉棶锟?      setOriginalName(file.name);
      
      // Create a new audio context
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      setProgress(20);
      
      // Read the file data
      const arrayBuffer = await file.arrayBuffer();
      setProgress(30);
      
      // Decode the audio data
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      setProgress(50);
      
      // Apply trimming and volume adjustment
      const numberOfChannels = audioBuffer.numberOfChannels;
      const sampleRate = audioBuffer.sampleRate;
      const duration = audioBuffer.duration;
      
      // Calculate samples after trimming
      const startSample = Math.floor(settings.trimStart * sampleRate);
      const endSample = Math.floor(settings.trimEnd * sampleRate);
      const sampleCount = endSample - startSample;
      
      // Create a buffer for the trimmed audio
      const offlineContext = new OfflineAudioContext(
        numberOfChannels,
        sampleCount,
        sampleRate
      );
      
      // Create a new buffer source
      const bufferSource = offlineContext.createBufferSource();
      bufferSource.buffer = audioBuffer;
      
      // Apply volume adjustment
      const gainNode = offlineContext.createGain();
      gainNode.gain.value = settings.volume / 100;
      
      // Connect the nodes
      bufferSource.connect(gainNode);
      gainNode.connect(offlineContext.destination);
      
      // Start playback at the trim point
      bufferSource.start(0, settings.trimStart, settings.trimEnd - settings.trimStart);
      
      setProgress(60);
      
      // Render the audio
      const renderedBuffer = await offlineContext.startRendering();
      
      setProgress(70);
      
      // Convert to WAV format
      const wavBuffer = audioBufferToWav(renderedBuffer);
      
      setProgress(80);
      
      // Create Blob and URL
      const blob = new Blob([wavBuffer], { type: 'audio/wav' });
      const url = URL.createObjectURL(blob);
      
      setProgress(100);
      
      // Set download URL
      setDownloadUrl(url);
      
      // Create temporary audio element to verify WAV file
      const tempAudio = new Audio(url);
      tempAudio.preload = 'auto';
      
      // Play success completion sound
      if (audioRef.current) {
        audioRef.current.src = url;
      }
      
      // Notify user
      toast({
        title: "Conversion Complete",
        description: "MP3 has been converted to WAV. You can download it now.",
      });
      
      // Update state
      setIsConverting(false);
      
    } catch (error) {
      console.error("Client-side conversion failed:", error);
      
      // If client-side conversion fails, fall back to server conversion
      toast({
        title: "Error",
        description: "File upload failed. Please try again.",
      });
      
      handleServerConversion();
    }
  };

  // Convert AudioBuffer to WAV format
  function audioBufferToWav(buffer: AudioBuffer): ArrayBuffer {
    const numOfChannels = buffer.numberOfChannels;
    const length = buffer.length * numOfChannels * 2; // 16-bit = 2 bytes
    const sampleRate = buffer.sampleRate;
    
    // Create WAV buffer, including header (44 bytes) and data
    const wavBuffer = new ArrayBuffer(44 + length);
    const view = new DataView(wavBuffer);
    
    // Write WAV header
    // RIFF identifier
    writeString(view, 0, 'RIFF');
    // File length
    view.setUint32(4, 36 + length, true);
    // WAVE identifier
    writeString(view, 8, 'WAVE');
    // fmt subchunk
    writeString(view, 12, 'fmt ');
    // Subchunk size
    view.setUint32(16, 16, true);
    // Audio format (1 for PCM)
    view.setUint16(20, 1, true);
    // Number of channels
    view.setUint16(22, numOfChannels, true);
    // Sample rate
    view.setUint32(24, sampleRate, true);
    // Byte rate (sample rate * bytes per sample)
    view.setUint32(28, sampleRate * numOfChannels * 2, true);
    // Block align (bytes per sample)
    view.setUint16(32, numOfChannels * 2, true);
    // Bit depth
    view.setUint16(34, 16, true);
    // data subchunk header
    writeString(view, 36, 'data');
    // Data length
    view.setUint32(40, length, true);
    
    // For simplicity, assume at most two channels (stereo)
    const channelData = [];
    for (let i = 0; i < numOfChannels; i++) {
      channelData.push(buffer.getChannelData(i));
    }
    
    // Write samples to WAV file
    let offset = 44;
    const volume = 0.8; // Prevent clipping
    
    for (let i = 0; i < buffer.length; i++) {
      for (let channel = 0; channel < numOfChannels; channel++) {
        // Convert float to 16-bit int
        const sample = Math.max(-1, Math.min(1, channelData[channel][i])) * volume;
        const int = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
        
        view.setInt16(offset, int, true);
        offset += 2;
      }
    }
    
    return wavBuffer;
  }

  // Helper function: Write string to DataView
  function writeString(view: DataView, offset: number, string: string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  // Modify server-side conversion function
  const handleServerConversion = async () => {
    if (!file) return;
    
    try {
      setIsConverting(true);
      setProgress(0);
      
      // Call conversion API
      const data = await convertFile(file, settings, (updater) => {
        setProgress(updater(progress));
      });
      
      console.log('Server conversion complete, returned data:', data);
      
      // Update download URL and other states
      if (data) {
        setFileId(data.fileId);
        setShareId(data.shareId);
        setOriginalName(file.name);
        setDownloadUrl(data.url || `/api/convert?fileId=${data.fileId}`);
        setFfmpegAvailable(data.ffmpegAvailable);
        setProgress(100);
      }
    } catch (error) {
      console.error('Server conversion failed:', error);
      toast({
        title: "Conversion Failed",
        description: String(error) || "Please try again or try another file.",
        variant: "destructive",
      });
      setProgress(0);
    } finally {
      setIsConverting(false);
    }
  };

  // Fallback sound function using Web Audio API
  const playCompletionBeep = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) {
        console.error("Web Audio API not supported");
        return;
      }
      
      const audioContext = new AudioContextClass();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.type = "sine";
      oscillator.frequency.value = 880; // A5 note
      gainNode.gain.value = 0.1;

      oscillator.start();

      // Short beep
      setTimeout(() => {
        oscillator.stop();
        audioContext.close();
      }, 200);
    } catch (error) {
      console.error("Web Audio API error:", error);
    }
  }

  const handlePreviewClip = () => {
    if (!audioRef.current) return

    // If current is playing, stop playing
    if (isPlaying) {
      if (audioRef.current) {
        audioRef.current.pause();
        setIsPlaying(false);
      }
      return;
    }

    try {
      // Set audio start playback position
      audioRef.current.currentTime = settings.trimStart;
      
      // Use Web Audio API to process volume gain
      // First play time create audio context and gain node
      if (!audioContext) {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const gain = ctx.createGain();
        const source = ctx.createMediaElementSource(audioRef.current);
        
        // Connect audio processing pipeline: source -> gain node -> output
        source.connect(gain);
        gain.connect(ctx.destination);
        
        // Save reference for later use
        setAudioContext(ctx);
        setGainNode(gain);
        setMediaSource(source);
      }
      
      // Set gain value (volume/100) - now allow values greater than 1.0
      if (gainNode) {
        gainNode.gain.value = settings.volume / 100;
      }

      // Play audio
      audioRef.current.play()
        .then(() => {
          setIsPlaying(true);
        })
        .catch((err) => {
          console.error("Playback error:", err);
          toast({
            title: "Playback failed",
            description: "Could not play the converted audio. Try downloading the file first.",
            variant: "destructive",
          });
          setIsPlaying(false);
        });

      // When playback reaches trim end point, stop
      const checkTimeUpdate = () => {
        if (audioRef.current && audioRef.current.currentTime >= settings.trimEnd) {
          audioRef.current.pause();
          setIsPlaying(false);
          audioRef.current.removeEventListener("timeupdate", checkTimeUpdate);
        }
      };

      audioRef.current.addEventListener("timeupdate", checkTimeUpdate);
      
      // Ensure to clean up playback state when audio ends
      audioRef.current.addEventListener("ended", () => {
        setIsPlaying(false);
      });
    } catch (error) {
      console.error("Audio preview error:", error);
      setIsPlaying(false);
      toast({
        title: "Playback error",
        description: "Could not play the audio preview.",
        variant: "destructive",
      });
    }
  };

  // Ensure playback state is false on component initialization
  useEffect(() => {
    setIsPlaying(false)
    
    return () => {
      // Clean up on component unmount
      if (audioRef.current) {
        audioRef.current.pause()
      }
    }
  }, [])

  // Reset playback state on file change
  useEffect(() => {
    setIsPlaying(false)
  }, [file])

  // 淇敼handleDownload鍑芥暟锛岃烦杞埌涓嬭浇椤甸潰
  const handleDownload = () => {
    if (!downloadUrl) return;
    
    // 鐢熸垚鍞竴ID
    const downloadId = generateUniqueId();
    
    // 瀛樺偍涓嬭浇淇℃伅鍒皊essionStorage
    const downloadData = {
      fileName: originalName || 'converted.wav',
      url: downloadUrl
    };
    
    sessionStorage.setItem(`download_${downloadId}`, JSON.stringify(downloadData));
    
    // 璺宠浆鍒颁笅杞介〉锟?    window.location.href = `/download/${downloadId}`;
  };
  
  // 鐢熸垚鍞竴ID鐨勮緟鍔╁嚱锟?  const generateUniqueId = () => {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
  };

  // Modify share function, remove social media share options
  const handleShare = () => {
    try {
      navigator.clipboard.writeText(window.location.href);
      toast({
        title: "Link copied",
        description: "Link has been copied to your clipboard.",
      });
    } catch (error) {
      console.error('Copy failed:', error);
      toast({
        title: "Copy failed",
        description: "Could not copy the link. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Add check for FFmpeg availability useEffect
  useEffect(() => {
    const checkFfmpeg = async () => {
      try {
        const response = await fetch('/api/test-ffmpeg');
        
        // Verify response success
        if (!response.ok) {
          console.error('FFmpeg check failed with status:', response.status);
          setFfmpegAvailable(false);
          return;
        }
        
        // Verify content type is JSON
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          console.error('FFmpeg check returned non-JSON response:', contentType);
          setFfmpegAvailable(false);
          return;
        }
        
        // Safely parse JSON
        let data;
        try {
          data = await response.json();
        } catch (jsonError) {
          console.error('Failed to parse FFmpeg check response as JSON:', jsonError);
          setFfmpegAvailable(false);
          return;
        }
        
        // Set state
        setFfmpegAvailable(!!data.ffmpegAvailable);
      } catch (error) {
        console.error('Error checking FFmpeg status:', error);
        setFfmpegAvailable(false);
      }
    };
    
    // Only run on client
    if (typeof window !== 'undefined') {
      checkFfmpeg();
    }
  }, []);

  const handleUploadError = (error: any) => {
    console.error("Upload error:", error);
    setIsConverting(false);
    toast({
      title: "Upload Failed",
      description: "Please try again with a smaller MP3 file.",
    });
  };

  const handleSubmit = async () => {
    if (!file) {
      toast({
        title: "Error",
        description: "Please select a file first.",
      });
      return;
    }
    
    setIsConverting(true);

    try {
      // First try client-side conversion
      await handleClientSideConversion();
    } catch (error) {
      console.error("Conversion error:", error);
      setIsConverting(false);
      toast({
        title: "Conversion Failed",
        description: "Unable to convert the file. Please try again.",
      });
    }
  };

  // 娣诲姞椤甸潰鍐呭
  return (
    <>
      <Head>
        <title>MP3 to WAV Converter | Free Online Audio Tool | High Quality</title>
        <meta name="description" content="Free MP3 to WAV converter. Transform audio files online with custom sample rate, bit depth and volume settings. No installation needed for perfect audio quality." />
        <meta name="keywords" content="mp3 to wav, convert mp3 to wav, audio converter, mp3 converter, wav converter, online converter" />
        
        {/* Open Graph / Social Media Meta Tags */}
        <meta property="og:title" content="MP3 to WAV Converter | Free Online Audio Tool" />
        <meta property="og:description" content="Free MP3 to WAV converter online. Customize audio settings and download high-quality WAV files without any software installation." />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="/og-image.png" />
        <meta property="og:url" content="https://mp3towav.net" />
        
        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="MP3 to WAV Converter | Free Online Audio Tool" />
        <meta name="twitter:description" content="Convert MP3 to WAV online for free. Adjust audio settings for perfect quality. No downloads or registration required." />
        
        {/* Canonical URL */}
        <link rel="canonical" href="https://mp3towav.net" />
      </Head>

      <div className="flex flex-col items-center justify-center w-full max-w-4xl mx-auto bg-gray-50 dark:bg-slate-900 rounded-xl p-6">
        {/* 闈㈠寘灞戝锟?*/}
        <nav className="w-full max-w-3xl mb-4" aria-label="Breadcrumb">
          <ol className="flex text-sm text-gray-500 space-x-1">
            <li><a href="/" className="hover:text-[#2A6FDB]">MP3 to WAV</a></li>
            <li className="flex items-center space-x-1">
              <span>/</span>
              <span className="text-gray-700 font-medium">Converter</span>
            </li>
          </ol>
        </nav>

        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">MP3 to WAV Converter | Free Online Audio Tool</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Convert your MP3 files to WAV format with professional audio settings
          </p>
        </div>

        {/* 鏍稿績杞崲宸ュ叿锟?- 绉诲埌椤甸潰椤堕儴浼樺厛浣嶇疆 */}
        <Card className="w-full max-w-3xl bg-white shadow-lg mb-8">
          <CardHeader className="bg-[#2A6FDB] text-white">
            <CardTitle className="text-2xl font-bold flex items-center justify-center gap-2">
              <Volume2 className="h-6 w-6" />
              MP3 to WAV Converter
            </CardTitle>
          </CardHeader>

          <CardContent className="p-6">
            <audio ref={audioRef} className="hidden" />

            {!file ? (
              <div
                className={cn(
                  "border-2 border-dashed border-gray-300 rounded-lg p-12 text-center cursor-pointer transition-colors",
                  isDragging ? "border-primary bg-secondary" : "",
                  isConverting ? "opacity-50 cursor-not-allowed" : "hover:border-primary hover:bg-secondary/50",
                  errorMessage ? "border-red-500" : "" // 娣诲姞閿欒鐘舵€佹牱锟?                )}
                onDragOver={(e) => {
                  e.preventDefault()
                  setIsDragging(true)
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept=".mp3,audio/mpeg"
                  onChange={(e) => {
                    const selectedFile = e.target.files?.[0];
                    if (!selectedFile) return;
                    
                    console.log("Selected file:", selectedFile.name, selectedFile.type);
                    
                    if (!isValidMP3File(selectedFile)) {
                      console.error("Selected invalid file type:", selectedFile.type);
                      toast({
                        title: "Invalid file format",
                        description: "Only MP3 files are supported. Please upload an MP3 file.",
                        variant: "destructive",
                      });
                      
                      // 娣诲姞瑙嗚閿欒鎻愮ず
                      setErrorMessage("Invalid file format. Only MP3 files are supported.");
                      setTimeout(() => setErrorMessage(null), 5000);
                      return;
                    }
                    
                    if (selectedFile.size > 500 * 1024 * 1024) {
                      toast({
                        title: "File too large",
                        description: "Maximum file size is 500MB. Please upload a smaller file or compress your audio.",
                        variant: "destructive",
                      });
                      
                      // 娣诲姞瑙嗚閿欒鎻愮ず
                      setErrorMessage("File too large. Maximum size is 500MB.");
                      setTimeout(() => setErrorMessage(null), 5000);
                      return;
                    }
                    
                    setErrorMessage(null); // 娓呴櫎閿欒
                    handleFileSelected(selectedFile);
                  }}
                />
                <div className="flex flex-col items-center justify-center gap-2">
                  <Upload className="h-16 w-16 text-[#2A6FDB] mb-2" />
                  <p className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-1">
                    Drop your MP3 file here or click to browse
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Supports MP3 files up to 500MB
                  </p>
                  
                  {/* 鏄剧ず閿欒娑堟伅 */}
                  {errorMessage && (
                    <div className="mt-4 p-3 bg-red-50 text-red-600 rounded-md border border-red-200 flex items-center">
                      <AlertTriangle className="h-5 w-5 mr-2 flex-shrink-0" />
                      <p>{errorMessage}</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">{file.name}</h3>
                    <p className="text-sm text-gray-500">
                      {(file.size / (1024 * 1024)).toFixed(2)} MB 锟?{audioDuration.toFixed(2)}s
                    </p>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => {
                      // First clean up audio object to avoid errors
                      if (audioRef.current) {
                        try {
                          audioRef.current.pause();
                          audioRef.current.removeAttribute('src');
                          audioRef.current.load();
                        } catch (e) {
                          console.log("Cleaning up audio error:", e);
                        }
                      }
                      
                      // Clean up canvas
                      if (canvasRef.current) {
                        const ctx = canvasRef.current.getContext('2d');
                        if (ctx) {
                          ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
                        }
                      }
                      
                      // Reset state
                      setFile(null);
                      setDownloadUrl(null);
                      setFileId(null);
                      setShareId(null);
                      setOriginalName(null);
                      setWaveformData([]);
                      setAudioDuration(0);
                      setSettings({
                        volume: 100,
                        sampleRate: "44100",
                        channels: "stereo",
                        bitDepth: "16",
                        trimStart: 0,
                        trimEnd: 100,
                      });
                    }} 
                    disabled={isConverting}
                    className="rounded-full h-8 w-8 p-0 flex items-center justify-center"
                  >
                    <span className="text-gray-500 text-lg font-medium">脳</span>
                  </Button>
                </div>

                <Collapsible open={isSettingsOpen} onOpenChange={setIsSettingsOpen} className="border rounded-lg">
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" className="flex w-full justify-between p-4">
                      <div className="flex items-center">
                        <Settings className="h-5 w-5 mr-2" />
                        <span>Conversion Settings</span>
                      </div>
                      {isSettingsOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                    </Button>
                  </CollapsibleTrigger>

                  <CollapsibleContent className="p-4 space-y-4 border-t">
                    <div className="space-y-2">
                      <Label htmlFor="volume">Volume ({settings.volume}%)</Label>
                      <Slider
                        id="volume"
                        min={0}
                        max={200}
                        step={1}
                        value={[settings.volume]}
                        onValueChange={(value) => {
                          // Update state
                          setSettings({ ...settings, volume: value[0] });
                          
                          // If using Web Audio API, update gain node value
                          if (gainNode) {
                            gainNode.gain.value = value[0] / 100;
                          } else if (audioRef.current) {
                            // If not using Web Audio API (not previewing), still use standard method
                            // But this can only limit to 0-1 range
                            audioRef.current.volume = Math.min(1.0, value[0] / 100);
                          }
                        }}
                        disabled={isConverting}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="sample-rate">Sample Rate</Label>
                        <Select
                          value={settings.sampleRate}
                          onValueChange={(value) => setSettings({ ...settings, sampleRate: value })}
                          disabled={isConverting}
                        >
                          <SelectTrigger id="sample-rate">
                            <SelectValue placeholder="Select sample rate" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="22050">22050 Hz</SelectItem>
                            <SelectItem value="32000">32000 Hz</SelectItem>
                            <SelectItem value="44100">44100 Hz</SelectItem>
                            <SelectItem value="48000">48000 Hz</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Channels</Label>
                        <RadioGroup
                          value={settings.channels}
                          onValueChange={(value) => setSettings({ ...settings, channels: value })}
                          className="flex space-x-4"
                          disabled={isConverting}
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="mono" id="mono" />
                            <Label htmlFor="mono">Mono</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="stereo" id="stereo" />
                            <Label htmlFor="stereo">Stereo</Label>
                          </div>
                        </RadioGroup>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="bit-depth">Bit Depth</Label>
                        <Select
                          value={settings.bitDepth}
                          onValueChange={(value) => setSettings({ ...settings, bitDepth: value })}
                          disabled={isConverting}
                        >
                          <SelectTrigger id="bit-depth">
                            <SelectValue placeholder="Select bit depth" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="16">16-bit</SelectItem>
                            <SelectItem value="24">24-bit</SelectItem>
                            <SelectItem value="32">32-bit</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between mb-2">
                      <Label>Audio Trimming</Label>
                      <div className="text-sm text-gray-500">
                        {settings.trimStart.toFixed(1)}s - {settings.trimEnd.toFixed(1)}s (Duration:{" "}
                        {(settings.trimEnd - settings.trimStart).toFixed(1)}s)
                      </div>
                    </div>

                    <div className="relative">
                      <canvas ref={canvasRef} className="w-full h-24 bg-gray-50 rounded-lg" width={600} height={100} />

                      <div className="mt-4 space-y-4">
                        <div className="w-full">
                          <div className="flex justify-between mb-1">
                            <Label className="text-xs text-green-600">Start: {settings.trimStart.toFixed(1)}s</Label>
                            <Label className="text-xs text-red-600">End: {settings.trimEnd.toFixed(1)}s</Label>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <input
                              type="range"
                              min={0}
                              max={audioDuration}
                              step={0.1}
                              value={settings.trimStart}
                              onChange={(e) => {
                                const value = Number.parseFloat(e.target.value)
                                if (value < settings.trimEnd - 0.5) {
                                  setSettings({ ...settings, trimStart: value })
                                }
                              }}
                              className="w-full h-2 accent-green-600"
                              disabled={isConverting}
                            />
                            <input
                              type="range"
                              min={0}
                              max={audioDuration}
                              step={0.1}
                              value={settings.trimEnd}
                              onChange={(e) => {
                                const value = Number.parseFloat(e.target.value)
                                if (value > settings.trimStart + 0.5) {
                                  setSettings({ ...settings, trimEnd: value })
                                }
                              }}
                              className="w-full h-2 accent-red-600"
                              disabled={isConverting}
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      onClick={handlePreviewClip}
                      disabled={isConverting}
                    >
                      {isPlaying ? (
                        <>
                          <span className="h-4 w-4 mr-2 flex items-center justify-center">锟?/span>
                          Stop Preview
                        </>
                      ) : (
                        <>
                          <Play className="h-4 w-4 mr-2" />
                          Preview Clip
                        </>
                      )}
                    </Button>
                  </div>

                  {!downloadUrl ? (
                    <div className="space-y-4">
                      {isConverting ? (
                        <div className="text-center space-y-4">
                          <div className="relative w-24 h-24 mx-auto">
                            <svg className="w-24 h-24" viewBox="0 0 100 100">
                              <circle
                                className="text-gray-200"
                                strokeWidth="8"
                                stroke="currentColor"
                                fill="transparent"
                                r="42"
                                cx="50"
                                cy="50"
                              />
                              <circle
                                className="text-[#2A6FDB]"
                                strokeWidth="8"
                                strokeLinecap="round"
                                stroke="currentColor"
                                fill="transparent"
                                r="42"
                                cx="50"
                                cy="50"
                                strokeDasharray={264}
                                strokeDashoffset={264 - (progress / 100) * 264}
                              />
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center">
                              <span className="text-xl font-medium">{progress}%</span>
                            </div>
                          </div>
                          <p className="text-sm text-gray-500">Converting your file...</p>
                        </div>
                      ) : (
                        <Button 
                          className="w-full bg-[#2A6FDB] hover:bg-[#2A6FDB]/90" 
                          size="lg" 
                          onClick={handleConvert}
                        >
                          Convert to WAV
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="mt-8 flex flex-col items-center">
                      <div className="flex flex-wrap gap-4 justify-center">
                        <Button
                          variant="default"
                          onClick={handleDownload}
                          className="gap-2"
                        >
                          <Download className="h-4 w-4" /> Download WAV
                        </Button>
                        
                        <Button
                          variant="outline"
                          onClick={() => {
                            // Directly copy link to clipboard
                            navigator.clipboard.writeText(window.location.href);
                            toast({
                              title: "Link copied",
                              description: "Link has been copied to your clipboard.",
                            });
                          }}
                          className="gap-2"
                        >
                          <Share2 className="h-4 w-4" /> Copy Share Link
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {isConverting && (
              <div className="flex items-center justify-center mt-4">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                <span>Converting...</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 鍔熻兘鐗圭偣閮ㄥ垎 - 绉诲埌杞崲鍣ㄤ笅锟?*/}
        <FeatureSection />
        
        {/* 浣跨敤鎸囧崡 - 淇濇寔鍦ㄥ師浣嶇疆 */}
        <UsageGuide />

        {/* 甯歌闂 - 娣诲姞缁撴瀯鍖栨暟锟?*/}
        <section className="w-full max-w-3xl mx-auto mt-8" itemScope itemType="https://schema.org/FAQPage">
          <h2 className="text-2xl font-bold mb-6 text-center">Frequently Asked Questions</h2>
          <div className="space-y-4">
            {[
              {
                question: "How to convert MP3 to WAV?",
                answer: "To convert MP3 to WAV, simply upload your MP3 file by dragging and dropping it into the upload area or clicking to browse your files. Then click the 'Convert to WAV' button. Once the conversion is complete, you can download your WAV file with the same name as the original but with the .wav extension."
              },
              {
                question: "How to change MP3 to WAV format online?",
                answer: "Changing MP3 to WAV format online is easy with our converter. Upload your MP3 file, adjust any settings if desired (like volume, sample rate, etc.), and click convert. The process happens quickly in your browser, and you'll get a high-quality WAV file to download. Our tool preserves the original audio quality while transforming it to the uncompressed WAV format."
              },
              {
                question: "How do I convert from MP3 to WAV without losing quality?",
                answer: "Converting from MP3 to WAV without losing additional quality is simple with our tool. First, upload your MP3 file to our converter. Next, you can customize settings like volume and sample rate if needed. Finally, click the convert button and wait for the process to complete. While the original MP3 may have already lost some quality due to compression, our converter ensures no further quality degradation occurs during the conversion to WAV format."
              },
              {
                question: "How do you convert MP3 to WAV for free?",
                answer: "Converting MP3 to WAV for free is easy with our online converter. Simply upload your MP3 file, adjust audio settings if desired, and click the convert button. Our free tool handles the technical aspects of conversion for you, providing a high-quality WAV file that's ready to download. No registration, subscription, or software installation is required."
              },
              {
                question: "How to make MP3 into WAV for audio editing?",
                answer: "To make an MP3 into a WAV file for audio editing, use our online converter tool. Upload your MP3, adjust settings like volume, sample rate, channels, and bit depth based on your editing requirements, then click convert. For professional audio editing, consider selecting 44.1kHz or 48kHz sample rates and 24-bit depth for optimal quality. The resulting WAV file will be compatible with all major audio editing software."
              },
              {
                question: "How to convert MP3 to WAV format for music production?",
                answer: "Converting MP3 to WAV format for music production involves uploading your MP3 file to our converter, selecting optimal settings (we recommend 44.1kHz/48kHz sample rate, 24-bit depth, and stereo channels for music production), and clicking the convert button. Our tool handles the technical conversion process, delivering a high-quality WAV file that's perfect for professional music production software like Ableton, Logic Pro, or FL Studio."
              },
              {
                question: "How to turn MP3 into WAV for CD burning?",
                answer: "To turn an MP3 into a WAV file for CD burning, upload your MP3 to our converter tool, set the sample rate to 44.1kHz (CD standard), select stereo channels and 16-bit depth, then click convert. The process happens right in your browser, ensuring privacy and fast conversion. The resulting WAV file will be in the correct format for burning to audio CDs, which require uncompressed audio in the Red Book standard (44.1kHz, 16-bit, stereo)."
              },
              {
                question: "How to convert a MP3 to WAV without software installation?",
                answer: "Converting a MP3 to WAV without installing software is straightforward with our browser-based tool. Simply upload your MP3 file, customize audio settings if desired, and click the convert button. The conversion happens entirely in your web browser using advanced web technologies. No downloads, installations, or plugins are needed, making it accessible on any device with a modern web browser."
              },
              {
                question: "What is the best MP3 to WAV converter online?",
                answer: "The best MP3 to WAV converter online should offer high-quality conversion, privacy protection, and useful audio adjustment features. Our converter tool provides all these benefits, with browser-based conversion that doesn't upload your files to servers (unless necessary), advanced settings for volume, sample rate, bit depth, and audio trimming, plus the ability to preserve your original file names. It works on all devices without requiring software installation."
              },
              {
                question: "How to batch convert multiple MP3 files to WAV?",
                answer: "Currently, our tool processes one file at a time for optimal quality and performance. For converting multiple MP3 files to WAV, we recommend converting them sequentially. Simply upload each file, convert it, download the WAV, and then proceed with the next file. Each conversion retains your settings, making the process more efficient with each subsequent file."
              }
            ].map((item, index) => (
              <div key={index} className="border rounded-lg overflow-hidden" itemScope itemProp="mainEntity" itemType="https://schema.org/Question">
                <Collapsible>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" className="flex w-full justify-between p-4 text-left">
                      <span className="font-medium" itemProp="name">{item.question}</span>
                      <ChevronDown className="h-5 w-5 shrink-0 transition-transform duration-200 ui-open:rotate-180" />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="p-4 pt-0 border-t" itemScope itemProp="acceptedAnswer" itemType="https://schema.org/Answer">
                    <p className="text-gray-700 dark:text-gray-300" itemProp="text">{item.answer}</p>
                  </CollapsibleContent>
                </Collapsible>
              </div>
            ))}
          </div>
        </section>

        <RelatedArticles />
        
        <OtherTools />

        {/* 鍏充簬閮ㄥ垎 - 娣诲姞鏇村鍏抽敭锟?*/}
        <div className="w-full max-w-3xl mx-auto mt-12 bg-white dark:bg-slate-900 rounded-xl p-6">
          <h2 className="text-2xl font-bold mb-4" id="about-mp3-to-wav">About MP3 to WAV Conversion</h2>
          <div className="prose prose-blue max-w-none dark:prose-invert">
            <p>
              Converting MP3 files to WAV format is often necessary for professional audio production, sound editing, or when you need uncompressed audio quality. While MP3 is great for storage and sharing due to its compression, WAV provides lossless audio quality ideal for editing and production.
            </p>
            <h3>Why Convert MP3 to WAV?</h3>
            <ul>
              <li><strong>Better Quality</strong> - WAV files are uncompressed, providing better audio quality for production.</li>
              <li><strong>Editing Compatibility</strong> - Many audio editing programs work better with WAV files.</li>
              <li><strong>Lossless Format</strong> - WAV preserves all audio data without compression artifacts.</li>
              <li><strong>Professional Use</strong> - WAV is the standard format for professional audio production.</li>
            </ul>
            <h3>Technical Differences Between MP3 and WAV</h3>
            <p>
              MP3 files use lossy compression to reduce file size, which means some audio data is permanently removed. WAV files are typically uncompressed, preserving all audio data. This makes WAV files much larger but with perfect audio quality.
            </p>
            <p>
              Our MP3 to WAV converter tool allows you to easily transform your MP3 files to high-quality WAV format with customizable settings, all within your browser for maximum convenience and privacy.
            </p>
            <h3>Common Uses for WAV Files</h3>
            <p>
              After converting your MP3 to WAV format, you can use the files for:
            </p>
            <ul>
              <li>Professional audio editing and production</li>
              <li>Music mastering and mixing</li>
              <li>Sound design for videos, games, or multimedia projects</li>
              <li>Creating high-quality audio CDs</li>
              <li>Archiving audio in lossless format</li>
            </ul>
          </div>
        </div>

        {/* 娣诲姞HowTo缁撴瀯鍖栨暟锟?*/}
        <div itemScope itemType="https://schema.org/HowTo" className="hidden">
          <meta itemProp="name" content="How to Convert MP3 to WAV" />
          <meta itemProp="description" content="A guide to converting MP3 audio files to WAV format using our online converter tool." />
          
          <div itemProp="step" itemScope itemType="https://schema.org/HowToStep">
            <meta itemProp="name" content="Upload your MP3 file" />
            <meta itemProp="text" content="Drag and drop your MP3 file into the upload area or click to browse your files." />
            <meta itemProp="position" content="1" />
          </div>
          
          <div itemProp="step" itemScope itemType="https://schema.org/HowToStep">
            <meta itemProp="name" content="Adjust settings (optional)" />
            <meta itemProp="text" content="Customize the volume, sample rate, channels, bit depth, and trim the audio if needed." />
            <meta itemProp="position" content="2" />
          </div>
          
          <div itemProp="step" itemScope itemType="https://schema.org/HowToStep">
            <meta itemProp="name" content="Convert to WAV" />
            <meta itemProp="text" content="Click the convert button and wait for the process to complete." />
            <meta itemProp="position" content="3" />
          </div>
          
          <div itemProp="step" itemScope itemType="https://schema.org/HowToStep">
            <meta itemProp="name" content="Download or share" />
            <meta itemProp="text" content="Download your converted WAV file or share the link with others." />
            <meta itemProp="position" content="4" />
          </div>
        </div>
      </div>
    </>
  )
}





