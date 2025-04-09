// 文件大小限制（50MB，考虑到内存限制）
export const MAX_FILE_SIZE = 50 * 1024 * 1024

// 分块上传的块大小（5MB）
export const CHUNK_SIZE = 5 * 1024 * 1024

// 允许的文件类型
export const ALLOWED_FILE_TYPES = [
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/wave',
  'audio/x-wav'
] 