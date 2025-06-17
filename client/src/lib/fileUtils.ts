export function getFileIcon(mimeType: string | null | undefined): string {
  if (!mimeType) {
    return 'file-icon-default';
  }
  
  if (mimeType.startsWith('image/')) {
    return 'file-icon-img';
  }
  
  if (mimeType === 'application/pdf') {
    return 'file-icon-pdf';
  }
  
  if (
    mimeType === 'application/msword' ||
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    return 'file-icon-doc';
  }
  
  if (
    mimeType === 'application/vnd.ms-excel' ||
    mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ) {
    return 'file-icon-xls';
  }
  
  return 'file-icon-default';
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function getFileExtension(filename: string): string {
  return filename.slice((filename.lastIndexOf(".") - 1 >>> 0) + 2);
}

export function isImageFile(mimeType: string | null | undefined): boolean {
  return mimeType ? mimeType.startsWith('image/') : false;
}

export function isDocumentFile(mimeType: string | null | undefined): boolean {
  if (!mimeType) return false;
  const documentTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'text/csv',
  ];
  
  return documentTypes.includes(mimeType);
}

export function canPreview(mimeType: string | null | undefined): boolean {
  if (!mimeType) return false;
  return isImageFile(mimeType) || mimeType === 'application/pdf' || mimeType.startsWith('text/');
}

export function generateThumbnailUrl(fileId: string, size: 'small' | 'medium' | 'large' = 'medium'): string {
  return `/api/files/${fileId}/thumbnail?size=${size}`;
}
