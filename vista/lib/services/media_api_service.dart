import 'dart:io';
import 'package:dio/dio.dart';
import 'package:http/http.dart' as http;
import 'package:image_picker/image_picker.dart';

import '../models/api_response.dart';
import '../models/media_upload.dart';
import '../services/api_service.dart';
import '../services/logger_service.dart';

class MediaApiService {
  static final MediaApiService _instance = MediaApiService._internal();
  factory MediaApiService() => _instance;
  MediaApiService._internal();

  final ApiService _apiService = ApiService();
  final Dio _dio = Dio();

  /// Get signed upload parameters for Cloudinary (with individual params)
  Future<ApiResponse<MediaSignResponse>> getSignedUploadParams({
    required String filename,
    required String mimeType,
    required String studentId,
  }) async {
    final request = MediaSignRequest(
      filename: filename,
      mimeType: mimeType,
      studentId: studentId,
    );
    return await _getSignedUploadParams(request);
  }

  /// Get signed upload parameters for Cloudinary (with request object)
  Future<ApiResponse<MediaSignResponse>> _getSignedUploadParams(
    MediaSignRequest request,
  ) async {
    try {
      final response = await _apiService.post('/media/sign', request.toJson());

      if (response.success && response.data != null) {
        final signResponse = MediaSignResponse.fromJson(response.data!);
        return ApiResponse.success(signResponse);
      } else {
        return ApiResponse.error(response.error!);
      }
    } catch (e, stackTrace) {
      LoggerService.error('Error getting signed upload params', e, stackTrace);
      return ApiResponse.error(
        const ApiError(
          code: 'GET_SIGNED_PARAMS_ERROR',
          message: 'Failed to get signed upload parameters',
        ),
      );
    }
  }

  /// Upload XFile directly to Cloudinary using signed parameters
  Future<ApiResponse<CloudinaryUploadResponse>> uploadToCloudinary(
    XFile file,
    MediaSignResponse signParams, {
    Function(double)? onProgress,
  }) async {
    try {
      LoggerService.info('Starting Cloudinary upload for file: ${file.path}');

      final formData = FormData.fromMap({
        'file': await MultipartFile.fromFile(file.path, filename: file.name),
        'api_key': signParams.apiKey,
        'timestamp': signParams.timestamp.toString(),
        'signature': signParams.signature,
        'folder': signParams.folder,
      });

      final response = await _dio.post(
        signParams.uploadUrl,
        data: formData,
        onSendProgress: (sent, total) {
          if (onProgress != null && total > 0) {
            onProgress(sent / total);
          }
        },
        options: Options(
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          sendTimeout: const Duration(minutes: 5),
          receiveTimeout: const Duration(minutes: 5),
        ),
      );

      if (response.statusCode == 200) {
        final uploadResponse = CloudinaryUploadResponse.fromJson(response.data);
        LoggerService.info('Cloudinary upload successful: ${uploadResponse.publicId}');
        return ApiResponse.success(uploadResponse);
      } else {
        LoggerService.error('Cloudinary upload failed with status: ${response.statusCode}');
        return ApiResponse.error(
          ApiError(
            code: 'CLOUDINARY_UPLOAD_ERROR',
            message: 'Upload failed with status ${response.statusCode}',
            details: response.data,
          ),
        );
      }
    } on DioException catch (e, stackTrace) {
      LoggerService.error('Dio error during Cloudinary upload', e, stackTrace);
      
      if (e.type == DioExceptionType.connectionTimeout ||
          e.type == DioExceptionType.sendTimeout ||
          e.type == DioExceptionType.receiveTimeout) {
        return ApiResponse.error(
          const ApiError(
            code: 'UPLOAD_TIMEOUT',
            message: 'Upload timed out. Please check your connection and try again.',
          ),
        );
      } else if (e.type == DioExceptionType.connectionError) {
        return ApiResponse.error(
          const ApiError(
            code: 'UPLOAD_CONNECTION_ERROR',
            message: 'Connection error during upload. Please check your internet connection.',
          ),
        );
      } else {
        return ApiResponse.error(
          ApiError(
            code: 'UPLOAD_ERROR',
            message: e.message ?? 'Upload failed',
            details: {'type': e.type.toString()},
          ),
        );
      }
    } catch (e, stackTrace) {
      LoggerService.error('Unexpected error during Cloudinary upload', e, stackTrace);
      return ApiResponse.error(
        const ApiError(
          code: 'UNEXPECTED_UPLOAD_ERROR',
          message: 'An unexpected error occurred during upload',
        ),
      );
    }
  }

  /// Complete upload flow: get signed params and upload file
  Future<ApiResponse<CloudinaryUploadResponse>> uploadFile(
    XFile file,
    String studentId, {
    Function(double)? onProgress,
  }) async {
    try {
      // Extract file info
      final filename = file.name;
      final mimeType = _getMimeType(filename);

      // Get signed upload parameters
      final signResponse = await getSignedUploadParams(
        filename: filename,
        mimeType: mimeType,
        studentId: studentId,
      );
      if (!signResponse.success) {
        return ApiResponse.error(signResponse.error!);
      }

      // Upload to Cloudinary
      return await uploadToCloudinary(
        file,
        signResponse.data!,
        onProgress: onProgress,
      );
    } catch (e, stackTrace) {
      LoggerService.error('Error in complete upload flow', e, stackTrace);
      return ApiResponse.error(
        const ApiError(
          code: 'UPLOAD_FLOW_ERROR',
          message: 'Failed to complete upload flow',
        ),
      );
    }
  }

  /// Validate file before upload
  Future<ApiResponse<void>> validateFile(XFile file) async {
    try {
      // Check file size (max 50MB)
      const maxSizeBytes = 50 * 1024 * 1024; // 50MB
      final fileSize = await file.length();
      if (fileSize > maxSizeBytes) {
        return ApiResponse.error(
          ApiError(
            code: 'FILE_TOO_LARGE',
            message: 'File size exceeds 50MB limit',
            details: {
              'fileSize': fileSize,
              'maxSize': maxSizeBytes,
            },
          ),
        );
      }

      // Check file type
      final filename = file.name;
      final mimeType = _getMimeType(filename);
      final allowedTypes = [
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'video/mp4',
        'video/quicktime',
        'video/x-msvideo',
      ];

      if (!allowedTypes.contains(mimeType)) {
        return ApiResponse.error(
          ApiError(
            code: 'INVALID_FILE_TYPE',
            message: 'File type not supported',
            details: {
              'detectedType': mimeType,
              'allowedTypes': allowedTypes,
            },
          ),
        );
      }

      return ApiResponse.success(null);
    } catch (e, stackTrace) {
      LoggerService.error('Error validating file', e, stackTrace);
      return ApiResponse.error(
        const ApiError(
          code: 'FILE_VALIDATION_ERROR',
          message: 'Failed to validate file',
        ),
      );
    }
  }

  /// Get MIME type from filename
  String _getMimeType(String filename) {
    final extension = filename.toLowerCase().split('.').last;
    switch (extension) {
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'png':
        return 'image/png';
      case 'gif':
        return 'image/gif';
      case 'webp':
        return 'image/webp';
      case 'mp4':
        return 'video/mp4';
      case 'mov':
        return 'video/quicktime';
      case 'avi':
        return 'video/x-msvideo';
      default:
        return 'application/octet-stream';
    }
  }

  /// Dispose resources
  void dispose() {
    _dio.close();
  }
}