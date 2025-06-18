import React, { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';

interface OptimizedImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  placeholder?: string;
  loading?: 'lazy' | 'eager';
  quality?: number;
  format?: 'webp' | 'jpeg' | 'png' | 'auto';
  sizes?: string;
  priority?: boolean;
  onLoad?: () => void;
  onError?: () => void;
  fallback?: string;
}

interface ImageFormat {
  webp: string;
  jpeg: string;
  png: string;
}

export function OptimizedImage({
  src,
  alt,
  width,
  height,
  className,
  placeholder = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZGRkIi8+PC9zdmc+',
  loading = 'lazy',
  quality = 80,
  format = 'auto',
  sizes,
  priority = false,
  onLoad,
  onError,
  fallback,
}: OptimizedImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isError, setIsError] = useState(false);
  const [isInView, setIsInView] = useState(!loading || loading === 'eager' || priority);
  const [currentSrc, setCurrentSrc] = useState(placeholder);
  const imgRef = useRef<HTMLImageElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Generate responsive image URLs
  const generateImageUrls = useCallback((baseSrc: string): ImageFormat => {
    const baseUrl = baseSrc.split('?')[0];
    const params = new URLSearchParams();
    
    if (width) params.set('w', width.toString());
    if (height) params.set('h', height.toString());
    params.set('q', quality.toString());

    return {
      webp: `${baseUrl}?${params.toString()}&f=webp`,
      jpeg: `${baseUrl}?${params.toString()}&f=jpeg`,
      png: `${baseUrl}?${params.toString()}&f=png`,
    };
  }, [width, height, quality]);

  // Intersection Observer for lazy loading
  useEffect(() => {
    if (loading === 'lazy' && !priority && imgRef.current) {
      observerRef.current = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            observerRef.current?.disconnect();
          }
        },
        {
          rootMargin: '50px', // Start loading 50px before the image comes into view
          threshold: 0.1,
        }
      );

      observerRef.current.observe(imgRef.current);
    }

    return () => {
      observerRef.current?.disconnect();
    };
  }, [loading, priority]);

  // Load image when in view
  useEffect(() => {
    if (isInView && !isLoaded && !isError) {
      const img = new Image();
      
      img.onload = () => {
        setCurrentSrc(src);
        setIsLoaded(true);
        onLoad?.();
      };
      
      img.onerror = () => {
        setIsError(true);
        if (fallback) {
          setCurrentSrc(fallback);
        }
        onError?.();
      };

      // Set up responsive image loading
      if (format === 'auto' && 'HTMLPictureElement' in window) {
        // Browser supports picture element, let it handle format selection
        img.src = src;
      } else {
        // Use specific format
        const urls = generateImageUrls(src);
        switch (format) {
          case 'webp':
            img.src = urls.webp;
            break;
          case 'jpeg':
            img.src = urls.jpeg;
            break;
          case 'png':
            img.src = urls.png;
            break;
          default:
            img.src = src;
        }
      }
    }
  }, [isInView, isLoaded, isError, src, format, generateImageUrls, onLoad, onError, fallback]);

  // Generate srcSet for responsive images
  const generateSrcSet = useCallback((baseSrc: string, format: string) => {
    if (!width) return '';
    
    const breakpoints = [0.5, 1, 1.5, 2]; // Different density ratios
    return breakpoints
      .map(ratio => {
        const scaledWidth = Math.round(width * ratio);
        const params = new URLSearchParams();
        params.set('w', scaledWidth.toString());
        if (height) params.set('h', Math.round(height * ratio).toString());
        params.set('q', quality.toString());
        params.set('f', format);
        
        return `${baseSrc.split('?')[0]}?${params.toString()} ${ratio}x`;
      })
      .join(', ');
  }, [width, height, quality]);

  // Blur effect for loading
  const getBlurDataURL = (w: number, h: number) => {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#f0f0f0';
      ctx.fillRect(0, 0, w, h);
    }
    return canvas.toDataURL();
  };

  if (isError && !fallback) {
    return (
      <div
        className={cn(
          'flex items-center justify-center bg-gray-200 text-gray-500',
          className
        )}
        style={{ width, height }}
      >
        <span className="text-sm">Failed to load image</span>
      </div>
    );
  }

  return (
    <div className={cn('relative overflow-hidden', className)} style={{ width, height }}>
      {format === 'auto' && isInView ? (
        <picture>
          <source
            srcSet={generateSrcSet(src, 'webp')}
            type="image/webp"
            sizes={sizes}
          />
          <source
            srcSet={generateSrcSet(src, 'jpeg')}
            type="image/jpeg"
            sizes={sizes}
          />
          <img
            ref={imgRef}
            src={currentSrc}
            alt={alt}
            width={width}
            height={height}
            loading={loading}
            sizes={sizes}
            className={cn(
              'w-full h-full object-cover transition-opacity duration-300',
              {
                'opacity-0': !isLoaded && isInView,
                'opacity-100': isLoaded,
              }
            )}
            onLoad={() => {
              setIsLoaded(true);
              onLoad?.();
            }}
            onError={() => {
              setIsError(true);
              onError?.();
            }}
          />
        </picture>
      ) : (
        <img
          ref={imgRef}
          src={currentSrc}
          alt={alt}
          width={width}
          height={height}
          loading={loading}
          sizes={sizes}
          className={cn(
            'w-full h-full object-cover transition-opacity duration-300',
            {
              'opacity-0': !isLoaded && isInView,
              'opacity-100': isLoaded,
            }
          )}
          onLoad={() => {
            setIsLoaded(true);
            onLoad?.();
          }}
          onError={() => {
            setIsError(true);
            onError?.();
          }}
        />
      )}
      
      {/* Loading placeholder */}
      {!isLoaded && isInView && (
        <div className="absolute inset-0 bg-gray-200 animate-pulse flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
        </div>
      )}
      
      {/* Blur placeholder */}
      {!isInView && (
        <div 
          className="absolute inset-0 bg-gray-200"
          style={{
            backgroundImage: `url(${getBlurDataURL(20, 20)})`,
            backgroundSize: 'cover',
            filter: 'blur(10px)',
          }}
        />
      )}
    </div>
  );
}

// Image gallery component with lazy loading
interface ImageGalleryProps {
  images: Array<{
    id: string;
    src: string;
    alt: string;
    width?: number;
    height?: number;
  }>;
  className?: string;
  columns?: number;
}

export function ImageGallery({ 
  images, 
  className, 
  columns = 3 
}: ImageGalleryProps) {
  const [loadedImages, setLoadedImages] = useState<Set<string>>(new Set());

  const handleImageLoad = useCallback((imageId: string) => {
    setLoadedImages(prev => new Set(prev).add(imageId));
  }, []);

  return (
    <div 
      className={cn(
        'grid gap-4',
        `grid-cols-1 md:grid-cols-${Math.min(columns, 3)} lg:grid-cols-${columns}`,
        className
      )}
    >
      {images.map((image, index) => (
        <OptimizedImage
          key={image.id}
          src={image.src}
          alt={image.alt}
          width={image.width || 300}
          height={image.height || 200}
          loading={index < 6 ? 'eager' : 'lazy'} // Load first 6 images eagerly
          priority={index < 2} // Prioritize first 2 images
          className="rounded-lg shadow-md hover:shadow-lg transition-shadow"
          onLoad={() => handleImageLoad(image.id)}
        />
      ))}
    </div>
  );
}

// Progressive image component with multiple quality levels
interface ProgressiveImageProps extends OptimizedImageProps {
  lowQualitySrc?: string;
}

export function ProgressiveImage({
  src,
  lowQualitySrc,
  ...props
}: ProgressiveImageProps) {
  const [currentSrc, setCurrentSrc] = useState(lowQualitySrc || props.placeholder);
  const [isHighQualityLoaded, setIsHighQualityLoaded] = useState(false);

  useEffect(() => {
    // Load low quality first
    if (lowQualitySrc && !isHighQualityLoaded) {
      const lowQualityImg = new Image();
      lowQualityImg.onload = () => {
        setCurrentSrc(lowQualitySrc);
        
        // Then load high quality
        const highQualityImg = new Image();
        highQualityImg.onload = () => {
          setCurrentSrc(src);
          setIsHighQualityLoaded(true);
        };
        highQualityImg.src = src;
      };
      lowQualityImg.src = lowQualitySrc;
    } else {
      // Load high quality directly
      const img = new Image();
      img.onload = () => {
        setCurrentSrc(src);
        setIsHighQualityLoaded(true);
      };
      img.src = src;
    }
  }, [src, lowQualitySrc, isHighQualityLoaded]);

  return (
    <img
      {...props}
      src={currentSrc}
      className={cn(
        props.className,
        !isHighQualityLoaded && lowQualitySrc && 'filter blur-sm',
        'transition-all duration-500'
      )}
    />
  );
}