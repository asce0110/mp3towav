"use client"

import type React from "react"
import Head from "next/head"

import { useState, useRef, useEffect, useCallback } from "react"
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
import { ShareButton } from './share-button'
import { useTranslations } from 'next-intl'
import { FileUpload } from './file-upload'
import { useRouter } from 'next/navigation'
import { FAQSection } from './faq-section'

// Mock function to simulate conversion process
const convertFile = async (file: File, settings: ConversionSettings, onProgress: (progressUpdater: (prev: number) => number) => void): Promise<{ fileId: string, shareId: string, originalName: string, ffmpegAvailable: boolean, url?: string, r2Success?: boolean, storedInR2?: boolean }> => {
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
}

// 添加FAQ组件
interface FAQItem {
  question: string;
  answer: string;
}

function FAQ({ items }: { items: FAQItem[] }) {
  const faqT = useTranslations('faq');
  
  return (
    <div className="w-full max-w-3xl mx-auto mt-12 bg-white dark:bg-slate-900 rounded-xl p-6">
      <h2 className="text-2xl font-bold mb-6 text-center">{faqT('title')}</h2>
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

// 添加FeatureCard组件
interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

function FeatureCard({ icon, title, description }: FeatureCardProps) {
  return (
    <Card className="transition-all hover:shadow-md">
      <CardContent className="pt-6">
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="p-2 rounded-full bg-primary/10">
            {icon}
          </div>
          <CardTitle className="text-xl">{title}</CardTitle>
          <p className="text-muted-foreground">{description}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// 额外功能组件
export function FeatureSection() {
  const t = useTranslations('features');

  return (
    <section id="features" className="py-16 bg-white dark:bg-neutral-950">
      <div className="container max-w-6xl px-4 mx-auto">
        <h2 className="mb-12 text-3xl font-bold text-center text-gray-900 dark:text-white">
          {t('title')}
        </h2>
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          <FeatureCard
            icon={<Shield className="w-10 h-10 text-primary" />}
            title={t('privacy.title')}
            description={t('privacy.description')}
          />
          <FeatureCard
            icon={<Zap className="w-10 h-10 text-primary" />}
            title={t('speed.title')}
            description={t('speed.description')}
          />
          <FeatureCard
            icon={<Settings className="w-10 h-10 text-primary" />}
            title={t('settings.title')}
            description={t('settings.description')}
          />
          </div>
        </div>
    </section>
  );
}

// 使用指南
function UsageGuide() {
  const guideT = useTranslations('usageGuide');
  
  return (
    <div className="w-full max-w-3xl mx-auto mt-12 bg-white dark:bg-slate-900 rounded-xl p-6">
      <h2 className="text-2xl font-bold mb-6 text-center">{guideT('title')}</h2>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row items-center gap-4">
          <div className="flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 text-blue-600 flex-shrink-0">
            <span className="font-bold">1</span>
          </div>
          <div>
            <h3 className="text-lg font-medium mb-1">{guideT('steps.upload.title')}</h3>
            <p className="text-gray-600 dark:text-gray-400">{guideT('steps.upload.description')}</p>
          </div>
        </div>
        <div className="flex flex-col md:flex-row items-center gap-4">
          <div className="flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 text-blue-600 flex-shrink-0">
            <span className="font-bold">2</span>
          </div>
          <div>
            <h3 className="text-lg font-medium mb-1">{guideT('steps.settings.title')}</h3>
            <p className="text-gray-600 dark:text-gray-400">{guideT('steps.settings.description')}</p>
          </div>
        </div>
        <div className="flex flex-col md:flex-row items-center gap-4">
          <div className="flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 text-blue-600 flex-shrink-0">
            <span className="font-bold">3</span>
          </div>
          <div>
            <h3 className="text-lg font-medium mb-1">{guideT('steps.convert.title')}</h3>
            <p className="text-gray-600 dark:text-gray-400">{guideT('steps.convert.description')}</p>
          </div>
        </div>
        <div className="flex flex-col md:flex-row items-center gap-4">
          <div className="flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 text-blue-600 flex-shrink-0">
            <span className="font-bold">4</span>
          </div>
          <div>
            <h3 className="text-lg font-medium mb-1">{guideT('steps.download.title')}</h3>
            <p className="text-gray-600 dark:text-gray-400">{guideT('steps.download.description')}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// 添加相关文章组件
function RelatedArticles() {
  const articlesT = useTranslations('relatedArticles');
  
  return (
    <div className="w-full max-w-3xl mx-auto mt-12 bg-white dark:bg-slate-900 rounded-xl p-6">
      <h2 className="text-2xl font-bold mb-6 text-center">{articlesT('title')}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="border rounded-lg overflow-hidden hover:shadow-md transition-shadow">
          <div className="h-40 bg-blue-100 flex items-center justify-center">
            <Volume2 className="h-12 w-12 text-blue-500" />
          </div>
          <div className="p-4">
            <h3 className="font-medium text-lg mb-2">{articlesT('articles.formats.title')}</h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">{articlesT('articles.formats.description')}</p>
            <Button variant="link" className="p-0 h-auto text-blue-600 dark:text-blue-400">{articlesT('articles.formats.readMore')}</Button>
          </div>
        </div>
        <div className="border rounded-lg overflow-hidden hover:shadow-md transition-shadow">
          <div className="h-40 bg-green-100 flex items-center justify-center">
            <Settings className="h-12 w-12 text-green-500" />
          </div>
          <div className="p-4">
            <h3 className="font-medium text-lg mb-2">{articlesT('articles.sampleRates.title')}</h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">{articlesT('articles.sampleRates.description')}</p>
            <Button variant="link" className="p-0 h-auto text-blue-600 dark:text-blue-400">{articlesT('articles.sampleRates.readMore')}</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// 添加其他转换工具导航
function OtherTools() {
  const toolsT = useTranslations('otherTools');
  
  return (
    <div className="w-full max-w-3xl mx-auto mt-12 bg-white dark:bg-slate-900 rounded-xl p-6">
      <h2 className="text-2xl font-bold mb-6 text-center">{toolsT('title')}</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        <div className="border rounded-lg p-4 text-center hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors cursor-pointer">
          <div className="h-12 w-12 mx-auto mb-2 flex items-center justify-center">
            <Headphones className="h-6 w-6 text-blue-500" />
          </div>
          <p className="text-sm font-medium">{toolsT('tools.wavToMp3')}</p>
        </div>
        <div className="border rounded-lg p-4 text-center hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors cursor-pointer">
          <div className="h-12 w-12 mx-auto mb-2 flex items-center justify-center">
            <Music className="h-6 w-6 text-blue-500" />
          </div>
          <p className="text-sm font-medium">{toolsT('tools.mp3ToFlac')}</p>
        </div>
        <div className="border rounded-lg p-4 text-center hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors cursor-pointer">
          <div className="h-12 w-12 mx-auto mb-2 flex items-center justify-center">
            <FileAudio className="h-6 w-6 text-blue-500" />
          </div>
          <p className="text-sm font-medium">{toolsT('tools.wavToOgg')}</p>
        </div>
        <div className="border rounded-lg p-4 text-center hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors cursor-pointer">
          <div className="h-12 w-12 mx-auto mb-2 flex items-center justify-center">
            <VideoIcon className="h-6 w-6 text-blue-500" />
          </div>
          <p className="text-sm font-medium">{toolsT('tools.mp4ToMp3')}</p>
        </div>
        <div className="border rounded-lg p-4 text-center hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors cursor-pointer">
          <div className="h-12 w-12 mx-auto mb-2 flex items-center justify-center">
            <Edit className="h-6 w-6 text-blue-500" />
          </div>
          <p className="text-sm font-medium">{toolsT('tools.audioEditor')}</p>
        </div>
        <div className="border rounded-lg p-4 text-center hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors cursor-pointer">
          <div className="h-12 w-12 mx-auto mb-2 flex items-center justify-center">
            <Scissors className="h-6 w-6 text-blue-500" />
          </div>
          <p className="text-sm font-medium">{toolsT('tools.audioTrimmer')}</p>
        </div>
        <div className="border rounded-lg p-4 text-center hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors cursor-pointer">
          <div className="h-12 w-12 mx-auto mb-2 flex items-center justify-center">
            <BarChart className="h-6 w-6 text-blue-500" />
          </div>
          <p className="text-sm font-medium">{toolsT('tools.audioNormalizer')}</p>
        </div>
        <div className="border rounded-lg p-4 text-center hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors cursor-pointer">
          <div className="h-12 w-12 mx-auto mb-2 flex items-center justify-center">
            <Plus className="h-6 w-6 text-blue-500" />
          </div>
          <p className="text-sm font-medium">{toolsT('tools.moreTools')}</p>
        </div>
      </div>
    </div>
  );
}

export function MP3toWAVConverter() {
  // 添加i18n支持
  const t = useTranslations('converter')
  const commonT = useTranslations('common')
  const router = useRouter()
  
  // 生成唯一ID的辅助函数
  const generateUniqueId = () => {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
  };

  // 处理文件选择
  const handleFileSelect = (files: File[]) => {
    if (files.length > 0) {
      // 为每个文件生成唯一ID和存储数据
      const fileIds = files.map(file => {
        const uploadId = generateUniqueId();
        
        // 存储文件到 sessionStorage (仅存储文件名和大小信息，不直接存储文件内容)
        sessionStorage.setItem(`upload_file_${uploadId}`, JSON.stringify({
          name: file.name,
          size: file.size,
          type: file.type,
          lastModified: file.lastModified
        }));
        
        // 使用 URL.createObjectURL 创建临时 URL 并存储
        const objectUrl = URL.createObjectURL(file);
        sessionStorage.setItem(`upload_url_${uploadId}`, objectUrl);
        
        return uploadId;
      });
      
      // 如果只有一个文件，直接跳转到上传页面
      if (fileIds.length === 1) {
        router.push(`/upload/${fileIds[0]}`);
      } else {
        // 多个文件情况下，存储批量上传ID列表
        sessionStorage.setItem('batch_upload_ids', JSON.stringify(fileIds));
        // 跳转到批量上传页面
        router.push(`/batch-upload`);
      }
    }
  };
  
  // 简化后的UI，只显示上传入口
  return (
    <>
      <Head>
        <title>{t('title')} | {commonT('title')}</title>
        <meta name="description" content={t('subtitle')} />
      </Head>

      <div className="flex flex-col items-center justify-center w-full max-w-4xl mx-auto bg-gray-50 dark:bg-slate-900 rounded-xl p-6">
        {/* 使用新的 FileUpload 组件 */}
        <div className="w-full max-w-3xl mb-8">
          <FileUpload 
            className="w-full"
            onChange={handleFileSelect}
            maxSize={500}
                  accept=".mp3,audio/mpeg"
            maxFiles={5} // 允许最多上传5个文件
          />
                    </div>

        {/* 功能特点部分 */}
        <FeatureSection />
        
        {/* 使用指南 */}
        <UsageGuide />

        {/* 将OtherTools组件移到FAQSection上面 */}
        <OtherTools />

        {/* 使用新的FAQSection组件 */}
        <FAQSection />

        <RelatedArticles />
        
        {/* 关于部分 - 添加更多SEO相关内容 */}
        <div className="w-full max-w-3xl mx-auto mt-12 bg-white dark:bg-slate-900 rounded-xl p-6">
          <h2 className="text-2xl font-bold mb-4" id="about-mp3-to-wav">About MP3 to WAV Conversion</h2>
          <div className="prose prose-blue max-w-none dark:prose-invert">
            <p>
              Converting MP3 files to WAV format is often necessary for professional audio production, sound editing, or when you need uncompressed audio quality. While MP3 is great for storage and sharing due to its compression, WAV provides lossless audio quality ideal for editing and production.
            </p>
            
            <h3>Understanding MP3 and WAV Formats</h3>
            <p>
              MP3 (MPEG Audio Layer III) is a compressed audio format that significantly reduces file size by removing audio data deemed less perceptible to human hearing. This compression makes MP3 files ideal for streaming, sharing, and storage where space is a concern. However, this compression is "lossy," meaning some audio information is permanently discarded during the compression process.
            </p>
            <p>
              WAV (Waveform Audio File Format), on the other hand, is an uncompressed audio format that preserves all original audio data. Developed by Microsoft and IBM, WAV files store audio in its raw form without sacrificing quality, making them the preferred choice for audio professionals. WAV files contain exact audio waveforms, providing superior sound quality at the cost of larger file sizes.
            </p>
            
            <h3>Why Convert MP3 to WAV?</h3>
            <ul>
              <li><strong>Audio Editing</strong> - WAV files offer better compatibility with professional audio editing software like Pro Tools, Logic Pro, and Adobe Audition.</li>
              <li><strong>Sound Quality</strong> - While converting doesn't recover lost data, working with WAV prevents further quality degradation during editing.</li>
              <li><strong>Music Production</strong> - Professional music producers prefer WAV format for its lossless properties when mixing and mastering tracks.</li>
              <li><strong>Sampling and Remixing</strong> - When isolating audio segments or creating remixes, WAV provides cleaner samples with fewer artifacts.</li>
              <li><strong>Archival Purposes</strong> - For long-term preservation of important audio, WAV format ensures no further quality loss over time.</li>
            </ul>
            
            <h3>Our MP3 to WAV Converter Advantages</h3>
            <p>
              Our online MP3 to WAV converter offers several benefits that set it apart from other conversion tools:
            </p>
            <ul>
              <li><strong>Browser-Based Processing</strong> - Convert files directly in your browser with no software installation required, making it accessible across all devices and operating systems.</li>
              <li><strong>Privacy-Focused</strong> - Your audio files remain on your device during conversion when possible, ensuring your personal or sensitive audio data stays private.</li>
              <li><strong>Customizable Settings</strong> - Adjust volume levels, sample rates, bit depth, and even trim audio before conversion for precise output control.</li>
              <li><strong>Fast Processing</strong> - Our optimized conversion engine delivers quick results, saving you valuable time.</li>
              <li><strong>No Registration Required</strong> - Start converting immediately without creating accounts or providing personal information.</li>
            </ul>
            
            <h3>Common Use Cases for MP3 to WAV Conversion</h3>
            <p>
              After converting your MP3 to WAV format, you can use the files for:
            </p>
            <ul>
              <li>Professional audio editing and production</li>
              <li>Music mastering and mixing processes</li>
              <li>Sound design for videos, games, or multimedia projects</li>
              <li>Creating high-quality audio CDs and physical media</li>
              <li>Removing background noise or enhancing audio quality</li>
              <li>Voice-over work and podcast production</li>
              <li>Academic research and audio analysis</li>
            </ul>
            
            <p>
              Whether you're a professional sound engineer, a musician, content creator, or simply someone who needs higher quality audio files, our MP3 to WAV converter provides the tools you need for successful audio format conversion.
            </p>
          </div>
        </div>

        {/* 添加HowTo结构化数据 */}
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

