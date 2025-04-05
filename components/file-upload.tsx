"use client"

import { useState, useRef, useEffect } from "react"
import { cn } from "@/lib/utils"
import { useTranslations } from 'next-intl'

interface FileUploadProps extends React.HTMLAttributes<HTMLDivElement> {
  onChange?: (files: File[]) => void
  maxSize?: number // 最大文件大小（MB）
  accept?: string // 接受的文件类型
  maxFiles?: number // 最大文件数量
  disabled?: boolean
}

export function FileUpload({
  className,
  onChange,
  maxSize = 500,
  accept = ".mp3,audio/mpeg",
  maxFiles = 1,
  disabled = false,
  ...props
}: FileUploadProps) {
  const t = useTranslations('converter')
  const [isDragging, setIsDragging] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const [error, setError] = useState<string | null>(null)
  const [cardStyle, setCardStyle] = useState({
    transform: "perspective(1000px) rotateX(0deg) rotateY(0deg)",
    transition: "transform 0.2s ease-out"
  })
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  
  // 处理鼠标移动，创建3D效果
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (disabled) return
    if (!containerRef.current) return
    
    const rect = containerRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    
    const centerX = rect.width / 2
    const centerY = rect.height / 2
    
    const rotateY = ((x - centerX) / centerX) * 5 // 最大旋转5度
    const rotateX = -((y - centerY) / centerY) * 5 // 反转Y轴旋转方向
    
    setCardStyle({
      transform: `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`,
      transition: "transform 0.1s ease-out"
    })
  }
  
  // 处理鼠标离开，恢复原始状态
  const handleMouseLeave = () => {
    setCardStyle({
      transform: "perspective(1000px) rotateX(0deg) rotateY(0deg)",
      transition: "transform 0.5s ease-out"
    })
  }
  
  // 处理文件选择
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files)
  }
  
  // 处理拖放
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    
    if (disabled) return
    
    handleFiles(e.dataTransfer.files)
  }
  
  // 处理文件验证和状态更新
  const handleFiles = (fileList: FileList | null) => {
    if (!fileList) return
    
    setError(null)
    
    const newFiles = Array.from(fileList)
    
    // 验证文件数量
    if (newFiles.length > maxFiles) {
      setError(t('error.maxFiles').replace('{{count}}', maxFiles.toString()))
      return
    }
    
    // 验证文件类型
    const invalidFiles = newFiles.filter(file => {
      if (accept) {
        const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase()
        const acceptTypes = accept.split(',').map(type => type.trim().toLowerCase())
        
        // 检查MIME类型或文件扩展名
        return !acceptTypes.some(type => 
          type === file.type.toLowerCase() || 
          (type.startsWith('.') && type === fileExtension)
        )
      }
      return false
    })
    
    if (invalidFiles.length > 0) {
      setError(t('error.fileType').replace('{{types}}', accept))
      return
    }
    
    // 验证文件大小
    const oversizedFiles = newFiles.filter(file => file.size > maxSize * 1024 * 1024)
    
    if (oversizedFiles.length > 0) {
      setError(t('error.fileSize').replace('{{size}}', maxSize.toString()))
      return
    }
    
    setFiles(newFiles)
    
    // 触发onChange回调
    if (onChange) {
      onChange(newFiles)
    }
  }
  
  // 清除选中文件
  const clearFiles = () => {
    setFiles([])
    
    // 重置文件输入
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    
    // 触发onChange回调
    if (onChange) {
      onChange([])
    }
  }
  
  // 删除单个文件
  const removeFile = (index: number) => {
    const newFiles = [...files]
    newFiles.splice(index, 1)
    setFiles(newFiles)
    
    // 触发onChange回调
    if (onChange) {
      onChange(newFiles)
    }
    
    // 如果移除所有文件，重置文件输入
    if (newFiles.length === 0 && fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }
  
  return (
    <div
      ref={containerRef}
      className={cn(
        "relative rounded-xl overflow-hidden bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-slate-900 dark:to-indigo-950 border border-blue-100 dark:border-blue-900/30 shadow-lg",
        className
      )}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={cardStyle}
      {...props}
    >
      <FileUploadGrid className="absolute inset-0 pointer-events-none" />
      
      <div 
        className={cn(
          "relative z-10 p-6 md:p-8 flex flex-col items-center justify-center min-h-[200px] md:min-h-[300px] transition-colors",
          isDragging && !disabled ? "bg-blue-100/50 dark:bg-blue-900/20" : "",
          disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer"
        )}
        onDragOver={(e) => {
          e.preventDefault()
          if (!disabled) setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => {
          if (!disabled && fileInputRef.current) {
            fileInputRef.current.click()
          }
        }}
      >
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept={accept}
          onChange={handleFileChange}
          multiple={maxFiles > 1}
          disabled={disabled}
        />
        
        <div className="relative mb-4 w-24 h-24 flex items-center justify-center">
          <div className="absolute inset-0 bg-blue-100 dark:bg-blue-900/50 rounded-full animate-pulse-slow" />
          <div className="absolute inset-1 bg-white dark:bg-slate-800 rounded-full shadow-md" />
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor" 
            className="w-12 h-12 text-blue-600 dark:text-blue-400 relative"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        
        <h3 className="text-xl font-semibold text-center text-gray-800 dark:text-gray-100 mb-2">
          {files.length > 0 ? `${files.length} ${t('dropzone.selected').replace('{{count}}', files.length.toString()).replace(`${files.length} `, '')}` : t('dropzone.title')}
        </h3>
        
        <p className="text-gray-600 dark:text-gray-400 text-center max-w-md mb-3">
          {t('dropzone.subtitle')}
        </p>
        
        <div className="text-sm text-gray-500 dark:text-gray-500">
          {t('dropzone.hint')}
        </div>
        
        {error && (
          <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-md border border-red-200 dark:border-red-800 flex items-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              className="w-5 h-5 mr-2 flex-shrink-0"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <p>{error}</p>
          </div>
        )}
        
        {files.length > 0 && (
          <div className="mt-4 w-full">
            {files.map((file, index) => (
              <div key={index} className="flex items-center justify-between bg-white dark:bg-slate-800 rounded-lg p-3 shadow-sm mb-2">
                <div className="flex items-center max-w-[80%]">
                  <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center flex-shrink-0 mr-3">
                    <svg 
                      xmlns="http://www.w3.org/2000/svg" 
                      viewBox="0 0 24 24" 
                      fill="none" 
                      stroke="currentColor" 
                      className="w-4 h-4 text-blue-600 dark:text-blue-400"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                    </svg>
                  </div>
                  <div className="truncate">
                    <p className="font-medium text-gray-900 dark:text-gray-100 truncate">{file.name}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    removeFile(index)
                  }}
                  className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-500 dark:text-gray-400"
                >
                  <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    className="w-5 h-5"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export function FileUploadGrid({
  className,
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div 
      className={cn(
        "w-full h-full opacity-30 dark:opacity-10", 
        className
      )}
      style={{
        backgroundImage: `
          linear-gradient(to right, rgba(59, 130, 246, 0.1) 1px, transparent 1px),
          linear-gradient(to bottom, rgba(59, 130, 246, 0.1) 1px, transparent 1px)
        `,
        backgroundSize: '20px 20px'
      }}
    />
  )
} 