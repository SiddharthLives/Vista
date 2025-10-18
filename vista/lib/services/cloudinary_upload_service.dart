import 'dart:io';
import 'dart:typed_data';
import 'package:flutter/foundation.dart';
import 'package:image_picker/image_picker.dart';
import 'package:dio/dio.dart';

import '../models/api_response.dart';
import '../models/media_upload.dart';
import '../services/media_api_service.dart';
import '../services/logger_service.dart';

/// Comprehensive Cloudinary upload service with compression and validation
class CloudinaryUploadService {
  static final CloudinaryUploadService _instance = CloudinaryUploadService._internal();
  factory CloudinaryUploadService() => _instance;
  CloudinaryUploadService._internal();

  final MediaApiService _mediaApiService = MediaApiService();
  final ImagePicker _imagePicker = ImagePicker();

  // Upload configuration
  static const int maxImageSizeBytes = 10 * 1024 * 1024; // 10MB for images
  static const int maxVideoSizeBytes = 50 * 1024 * 1024; // 50MB for videos
  static const int imageCompressionQuality = 85;
  static const int maxImageDimension = 1920;

  /// Pick image from gallery with compression
  Future<ApiResponse<XFile?>> pickImageFromGallery({
    bool compress = true,
  }) async {
    try {
      LoggerService.info('Picking image from gallery');
      
      final XFile? image = await _imagePicker.pickImage(
        source: ImageSource.gallery,
        maxWidth: compress ? maxImageDimension.toDouble() : null,
        maxHeight: compress ? maxImageDimension.toDouble() : null,
        imageQuality: compress ? imageCompressionQuality : null,
      );

      if (image == null) {
        LoggerService.info('No image selected');
        return ApiResponse.success(null);
      }

      // Validate the picked image
      final validation = await _validateMediaFile(image);
      if (!validation.success) {
        return ApiResponse.error(validation.error!);
      }

      LoggerService.info('Image picked successfully: ${image.name}');
      return ApiResponse.success(image);
    } catch (e, stackTrace) {
      LoggerService.error('Error picking image from gallery', e, stackTrace);
      return ApiResponse.error(
        const ApiError(
          code: 'IMAGE_PICKER_ERROR',
          message: 'Failed to pick image from gallery',
        ),
      );
    }
  }

  /// Pick image from camera with compression
  Future<ApiResponse<XFile?>> pickImageFromCamera({
    bool compress = true,
  }) async {
    try {
      LoggerService.info('Taking photo with camera');
      
      final XFile? image = await _imagePicker.pickImage(
        source: ImageSource.camera,
        maxWidth: compress ? maxImageDimension.toDouble() : null,
        maxHeight: compress ? maxImageDimension.toDouble() : null,
        imageQuality: compress ? imageCompressionQuality : null,
      );

      if (image == null) {
        LoggerService.info('No photo taken');
        return ApiResponse.success(null);
      }

      // Validate the captured image
      final validation = await _validateMediaFile(image);
      if (!validation.success) {
        return ApiResponse.error(validation.error!);
      }

      LoggerService.info('Photo taken successfully: ${image.name}');
      return ApiResponse.success(image);
    } catch (e, stackTrace) {
      LoggerService.error('Error taking photo with camera', e, stackTrace);
      return ApiResponse.error(
        const ApiError(
          code: 'CAMERA_ERROR',
          message: 'Failed to take photo with camera',
        ),
      );
    }
  }

  /// Pick video from gallery
  Future<ApiResponse<XFile?>> pickVideoFromGallery() async {
    try {
      LoggerService.info('Picking video from gallery');
      
      final XFile? video = await _imagePicker.pickVideo(
        source: ImageSource.gallery,
        maxDuration: const Duration(minutes: 5), // 5 minute limit
      );

      if (video == null) {
        LoggerService.info('No video selected');
        return ApiResponse.success(null);
      }

      // Validate the picked video
      final validation = await _validateMediaFile(video);
      if (!validation.success) {
        return ApiResponse.error(validation.error!);
      }

      LoggerService.info('Video picked successfully: ${video.name}');
      return ApiResponse.success(video);
    } catch (e, stackTrace) {
      LoggerService.error('Error picking video from gallery', e, stackTrace);
      return ApiResponse.error(
        const ApiError(
          code: 'VIDEO_PICKER_ERROR',
          message: 'Failed to pick video from gallery',
        ),
      );
    }
  }

  /// Pick video from camera
  Future<ApiResponse<XFile?>> pickVideoFromCamera() async {
    try {
      LoggerService.info('Recording video with camera');
      
      final XFile? video = await _imagePicker.pickVideo(
        source: ImageSource.camera,
        maxDuration: const Duration(minutes: 5), // 5 minute limit
      );

      if (video == null) {
        LoggerService.info('No video recorded');
        return ApiResponse.success(null);
      }

      // Validate the recorded video
      final validation = await _validateMediaFile(video);
      if (!validation.success) {
        return ApiResponse.error(validation.error!);
      }

      LoggerService.info('Video recorded successfully: ${video.name}');
      return ApiResponse.success(video);
    } catch (e, stackTrace) {
      LoggerService.error('Error recording video with camera', e, stackTrace);
      return ApiResponse.error(
        const ApiError(
          code: 'VIDEO_CAMERA_ERROR',
          message: 'Failed to record video with camera',
        ),
      );
    }
  }

  /// Pick multiple images from gallery
  Future<ApiResponse<List<XFile>>> pickMultipleImages({
    int maxImages = 10,
    bool compress = true,
  }) async {
    try {
      LoggerService.info('Picking multiple images from gallery (max: $maxImages)');
      
      final List<XFile> images = await _imagePicker.pickMultiImage(
        maxWidth: compress ? maxImageDimension.toDouble() : null,
        maxHeight: compress ? maxImageDimension.toDouble() : null,
        imageQuality: compress ? imageCompressionQuality : null,
      );

      if (images.isEmpty) {
        LoggerService.info('No images selected');
        return ApiResponse.success([]);
      }

      // Limit the number of images
      final limitedImages = images.take(maxImages).toList();
      if (images.length > maxImages) {
        LoggerService.info('Limited selection to $maxImages images');
      }

      // Validate all picked images
      final List<XFile> validImages = [];
      for (final image in limitedImages) {
        final validation = await _validateMediaFile(image);
        if (validation.success) {
          validImages.add(image);
        } else {
          LoggerService.warning('Skipping invalid image: ${image.name}');
        }
      }

      LoggerService.info('${validImages.length} valid images selected');
      return ApiResponse.success(validImages);
    } catch (e, stackTrace) {
      LoggerService.error('Error picking multiple images', e, stackTrace);
      return ApiResponse.error(
        const ApiError(
          code: 'MULTIPLE_IMAGE_PICKER_ERROR',
          message: 'Failed to pick multiple images',
        ),
      );
    }
  }

  /// Upload single file to Cloudinary with progress tracking
  Future<ApiResponse<CloudinaryUploadResponse>> uploadFile(
    XFile file,
    String studentId, {
    Function(double progress)? onProgress,
    CancelToken? cancelToken,
  }) async {
    try {
      LoggerService.info('Starting upload for file: ${file.name}');

      // Validate file before upload
      final validation = await _validateMediaFile(file);
      if (!validation.success) {
        return ApiResponse.error(validation.error!);
      }

      // Use the existing media API service for upload
      final result = await _mediaApiService.uploadFile(
        file,
        studentId,
        onProgress: onProgress,
      );

      if (result.success) {
        LoggerService.info('File uploaded successfully: ${result.data!.publicId}');
      } else {
        LoggerService.error('File upload failed: ${result.error!.message}');
      }

      return result;
    } catch (e, stackTrace) {
      LoggerService.error('Error uploading file', e, stackTrace);
      return ApiResponse.error(
        const ApiError(
          code: 'UPLOAD_ERROR',
          message: 'Failed to upload file',
        ),
      );
    }
  }

  /// Upload multiple files to Cloudinary with progress tracking
  Future<ApiResponse<List<CloudinaryUploadResponse>>> uploadMultipleFiles(
    List<XFile> files,
    String studentId, {
    Function(int completed, int total, double overallProgress)? onProgress,
    CancelToken? cancelToken,
  }) async {
    try {
      LoggerService.info('Starting upload for ${files.length} files');

      final List<CloudinaryUploadResponse> uploadResults = [];
      int completedUploads = 0;

      for (int i = 0; i < files.length; i++) {
        if (cancelToken?.isCancelled == true) {
          LoggerService.info('Upload cancelled by user');
          return ApiResponse.error(
            const ApiError(
              code: 'UPLOAD_CANCELLED',
              message: 'Upload was cancelled',
            ),
          );
        }

        final file = files[i];
        LoggerService.info('Uploading file ${i + 1}/${files.length}: ${file.name}');

        final result = await uploadFile(
          file,
          studentId,
          onProgress: (fileProgress) {
            final overallProgress = (completedUploads + fileProgress) / files.length;
            onProgress?.call(completedUploads, files.length, overallProgress);
          },
          cancelToken: cancelToken,
        );

        if (result.success) {
          uploadResults.add(result.data!);
          completedUploads++;
          onProgress?.call(completedUploads, files.length, completedUploads / files.length);
        } else {
          LoggerService.error('Failed to upload file: ${file.name}');
          return ApiResponse.error(result.error!);
        }
      }

      LoggerService.info('All ${files.length} files uploaded successfully');
      return ApiResponse.success(uploadResults);
    } catch (e, stackTrace) {
      LoggerService.error('Error uploading multiple files', e, stackTrace);
      return ApiResponse.error(
        const ApiError(
          code: 'MULTIPLE_UPLOAD_ERROR',
          message: 'Failed to upload multiple files',
        ),
      );
    }
  }

  /// Validate media file (size, type, etc.)
  Future<ApiResponse<void>> _validateMediaFile(XFile file) async {
    try {
      // Check file size
      final fileSize = await file.length();
      final isImage = _isImageFile(file.name);
      final isVideo = _isVideoFile(file.name);

      if (isImage && fileSize > maxImageSizeBytes) {
        return ApiResponse.error(
          ApiError(
            code: 'IMAGE_TOO_LARGE',
            message: 'Image size exceeds ${_formatBytes(maxImageSizeBytes)} limit',
            details: {
              'fileSize': fileSize,
              'maxSize': maxImageSizeBytes,
              'fileSizeFormatted': _formatBytes(fileSize),
            },
          ),
        );
      }

      if (isVideo && fileSize > maxVideoSizeBytes) {
        return ApiResponse.error(
          ApiError(
            code: 'VIDEO_TOO_LARGE',
            message: 'Video size exceeds ${_formatBytes(maxVideoSizeBytes)} limit',
            details: {
              'fileSize': fileSize,
              'maxSize': maxVideoSizeBytes,
              'fileSizeFormatted': _formatBytes(fileSize),
            },
          ),
        );
      }

      // Check file type
      if (!isImage && !isVideo) {
        return ApiResponse.error(
          const ApiError(
            code: 'UNSUPPORTED_FILE_TYPE',
            message: 'File type not supported. Please select an image or video file.',
          ),
        );
      }

      return ApiResponse.success(null);
    } catch (e, stackTrace) {
      LoggerService.error('Error validating media file', e, stackTrace);
      return ApiResponse.error(
        const ApiError(
          code: 'FILE_VALIDATION_ERROR',
          message: 'Failed to validate file',
        ),
      );
    }
  }

  /// Check if file is an image
  bool _isImageFile(String filename) {
    final extension = filename.toLowerCase().split('.').last;
    return ['jpg', 'jpeg', 'png', 'gif', 'webp'].contains(extension);
  }

  /// Check if file is a video
  bool _isVideoFile(String filename) {
    final extension = filename.toLowerCase().split('.').last;
    return ['mp4', 'mov', 'avi', 'mkv', 'webm'].contains(extension);
  }

  /// Format bytes to human readable string
  String _formatBytes(int bytes) {
    if (bytes < 1024) return '$bytes B';
    if (bytes < 1024 * 1024) return '${(bytes / 1024).toStringAsFixed(1)} KB';
    if (bytes < 1024 * 1024 * 1024) return '${(bytes / (1024 * 1024)).toStringAsFixed(1)} MB';
    return '${(bytes / (1024 * 1024 * 1024)).toStringAsFixed(1)} GB';
  }

  /// Get media type from file
  MediaType getMediaType(XFile file) {
    if (_isImageFile(file.name)) return MediaType.image;
    if (_isVideoFile(file.name)) return MediaType.video;
    return MediaType.unknown;
  }

  /// Dispose resources
  void dispose() {
    // Clean up any resources if needed
    try {
      LoggerService.info('CloudinaryUploadService disposed');
    } catch (e) {
      // Logger might not be initialized in tests
      print('CloudinaryUploadService disposed');
    }
  }
}

/// Media type enumeration
enum MediaType {
  image,
  video,
  unknown,
}

/// Upload progress callback
typedef UploadProgressCallback = void Function(double progress);

/// Multiple upload progress callback
typedef MultipleUploadProgressCallback = void Function(
  int completed,
  int total,
  double overallProgress,
);