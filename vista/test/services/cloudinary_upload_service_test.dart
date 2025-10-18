import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:image_picker/image_picker.dart';

import 'package:vista/services/cloudinary_upload_service.dart';
import 'package:vista/models/api_response.dart';
import 'package:vista/models/media_upload.dart';

void main() {
  group('CloudinaryUploadService', () {
    late CloudinaryUploadService service;

    setUp(() {
      service = CloudinaryUploadService();
    });

    group('getMediaType', () {
      test('should return image type for image files', () {
        expect(service.getMediaType(XFile('test.jpg')), equals(MediaType.image));
        expect(service.getMediaType(XFile('test.JPG')), equals(MediaType.image));
        expect(service.getMediaType(XFile('test.png')), equals(MediaType.image));
        expect(service.getMediaType(XFile('test.gif')), equals(MediaType.image));
        expect(service.getMediaType(XFile('test.webp')), equals(MediaType.image));
        expect(service.getMediaType(XFile('test.jpeg')), equals(MediaType.image));
      });

      test('should return video type for video files', () {
        expect(service.getMediaType(XFile('test.mp4')), equals(MediaType.video));
        expect(service.getMediaType(XFile('test.MP4')), equals(MediaType.video));
        expect(service.getMediaType(XFile('test.mov')), equals(MediaType.video));
        expect(service.getMediaType(XFile('test.avi')), equals(MediaType.video));
        expect(service.getMediaType(XFile('test.mkv')), equals(MediaType.video));
        expect(service.getMediaType(XFile('test.webm')), equals(MediaType.video));
      });

      test('should return unknown type for unsupported files', () {
        expect(service.getMediaType(XFile('test.txt')), equals(MediaType.unknown));
        expect(service.getMediaType(XFile('test.pdf')), equals(MediaType.unknown));
        expect(service.getMediaType(XFile('test.doc')), equals(MediaType.unknown));
        expect(service.getMediaType(XFile('test')), equals(MediaType.unknown));
      });
    });

    group('MediaType enum', () {
      test('should have correct enum values', () {
        expect(MediaType.values.length, equals(3));
        expect(MediaType.values, contains(MediaType.image));
        expect(MediaType.values, contains(MediaType.video));
        expect(MediaType.values, contains(MediaType.unknown));
      });
    });

    group('Constants', () {
      test('should have correct size limits', () {
        expect(CloudinaryUploadService.maxImageSizeBytes, equals(10 * 1024 * 1024)); // 10MB
        expect(CloudinaryUploadService.maxVideoSizeBytes, equals(50 * 1024 * 1024)); // 50MB
        expect(CloudinaryUploadService.imageCompressionQuality, equals(85));
        expect(CloudinaryUploadService.maxImageDimension, equals(1920));
      });
    });

    group('Service initialization', () {
      test('should create singleton instance', () {
        final service1 = CloudinaryUploadService();
        final service2 = CloudinaryUploadService();
        expect(identical(service1, service2), isTrue);
      });

      test('should dispose without errors', () {
        expect(() => service.dispose(), returnsNormally);
      });
    });
  });
}