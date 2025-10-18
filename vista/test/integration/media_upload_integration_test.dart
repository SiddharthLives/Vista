import 'package:flutter_test/flutter_test.dart';
import 'package:image_picker/image_picker.dart';

import 'package:vista/services/cloudinary_upload_service.dart';
import 'package:vista/models/api_response.dart';
import 'package:vista/models/media_upload.dart';

void main() {
  group('Media Upload Integration Tests', () {
    late CloudinaryUploadService uploadService;

    setUp(() {
      uploadService = CloudinaryUploadService();
    });

    group('Media Type Detection', () {
      test('should correctly identify image files', () {
        final imageFiles = [
          'photo.jpg',
          'image.jpeg',
          'picture.png',
          'animation.gif',
          'modern.webp',
        ];

        for (final filename in imageFiles) {
          final file = XFile(filename);
          expect(
            uploadService.getMediaType(file),
            equals(MediaType.image),
            reason: 'Failed to identify $filename as image',
          );
        }
      });

      test('should correctly identify video files', () {
        final videoFiles = [
          'movie.mp4',
          'clip.mov',
          'video.avi',
          'film.mkv',
          'web.webm',
        ];

        for (final filename in videoFiles) {
          final file = XFile(filename);
          expect(
            uploadService.getMediaType(file),
            equals(MediaType.video),
            reason: 'Failed to identify $filename as video',
          );
        }
      });

      test('should handle case insensitive file extensions', () {
        final mixedCaseFiles = [
          'IMAGE.JPG',
          'Video.MP4',
          'Photo.PNG',
          'Movie.MOV',
        ];

        final expectedTypes = [
          MediaType.image,
          MediaType.video,
          MediaType.image,
          MediaType.video,
        ];

        for (int i = 0; i < mixedCaseFiles.length; i++) {
          final file = XFile(mixedCaseFiles[i]);
          expect(
            uploadService.getMediaType(file),
            equals(expectedTypes[i]),
            reason: 'Failed to handle case for ${mixedCaseFiles[i]}',
          );
        }
      });

      test('should return unknown for unsupported file types', () {
        final unsupportedFiles = [
          'document.pdf',
          'spreadsheet.xlsx',
          'presentation.pptx',
          'text.txt',
          'archive.zip',
        ];

        for (final filename in unsupportedFiles) {
          final file = XFile(filename);
          expect(
            uploadService.getMediaType(file),
            equals(MediaType.unknown),
            reason: 'Failed to identify $filename as unknown',
          );
        }
      });
    });

    group('Service Configuration', () {
      test('should have correct size limits', () {
        expect(CloudinaryUploadService.maxImageSizeBytes, equals(10 * 1024 * 1024)); // 10MB
        expect(CloudinaryUploadService.maxVideoSizeBytes, equals(50 * 1024 * 1024)); // 50MB
        expect(CloudinaryUploadService.imageCompressionQuality, equals(85));
        expect(CloudinaryUploadService.maxImageDimension, equals(1920));
      });

      test('should create singleton instance', () {
        final service1 = CloudinaryUploadService();
        final service2 = CloudinaryUploadService();
        expect(identical(service1, service2), isTrue);
      });

      test('should dispose without errors', () {
        expect(() => uploadService.dispose(), returnsNormally);
      });
    });

    group('Media Type Enum', () {
      test('should have correct enum values', () {
        expect(MediaType.values.length, equals(3));
        expect(MediaType.values, contains(MediaType.image));
        expect(MediaType.values, contains(MediaType.video));
        expect(MediaType.values, contains(MediaType.unknown));
      });

      test('should have correct string representations', () {
        expect(MediaType.image.toString(), equals('MediaType.image'));
        expect(MediaType.video.toString(), equals('MediaType.video'));
        expect(MediaType.unknown.toString(), equals('MediaType.unknown'));
      });
    });

    group('File Extension Handling', () {
      test('should handle files without extensions', () {
        final file = XFile('filename_without_extension');
        expect(uploadService.getMediaType(file), equals(MediaType.unknown));
      });

      test('should handle empty filenames', () {
        final file = XFile('');
        expect(uploadService.getMediaType(file), equals(MediaType.unknown));
      });

      test('should handle files with multiple dots', () {
        final file = XFile('my.file.name.jpg');
        expect(uploadService.getMediaType(file), equals(MediaType.image));
      });

      test('should handle files starting with dots', () {
        final file = XFile('.hidden.jpg');
        expect(uploadService.getMediaType(file), equals(MediaType.image));
      });
    });

    group('Callback Types', () {
      test('should define correct callback types', () {
        // Test that callback types are properly defined
        UploadProgressCallback? progressCallback;
        MultipleUploadProgressCallback? multipleProgressCallback;

        progressCallback = (double progress) {
          expect(progress, isA<double>());
          expect(progress, greaterThanOrEqualTo(0.0));
          expect(progress, lessThanOrEqualTo(1.0));
        };

        multipleProgressCallback = (int completed, int total, double overallProgress) {
          expect(completed, isA<int>());
          expect(total, isA<int>());
          expect(overallProgress, isA<double>());
          expect(completed, lessThanOrEqualTo(total));
          expect(overallProgress, greaterThanOrEqualTo(0.0));
          expect(overallProgress, lessThanOrEqualTo(1.0));
        };

        // Test callback execution
        progressCallback(0.5);
        multipleProgressCallback(2, 5, 0.4);

        expect(progressCallback, isNotNull);
        expect(multipleProgressCallback, isNotNull);
      });
    });
  });
}