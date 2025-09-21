import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../models/story.dart';
import '../models/api_response.dart';
import '../services/stories_api_service.dart';
import '../services/media_api_service.dart';
import '../services/logger_service.dart';

class StoriesProvider extends ChangeNotifier {
  final StoriesApiService _storiesApiService = StoriesApiService();
  final MediaApiService _mediaApiService = MediaApiService();
  final ImagePicker _imagePicker = ImagePicker();

  List<Story> _stories = [];
  bool _isLoading = false;
  bool _isCreatingStory = false;
  String? _error;
  String? _nextCursor;
  bool _hasMore = true;

  List<Story> get stories => _stories;
  bool get isLoading => _isLoading;
  bool get isCreatingStory => _isCreatingStory;
  String? get error => _error;
  bool get hasMore => _hasMore;

  /// Load initial stories
  Future<void> loadInitialStories() async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final response = await _storiesApiService.getStories(limit: 20);
      
      if (response.success && response.data != null) {
        _stories = response.data!.stories;
        _nextCursor = response.data!.pagination.nextCursor;
        _hasMore = response.data!.pagination.hasMore;
        _error = null;
      } else {
        _error = response.error?.message ?? 'Failed to load stories';
        LoggerService.error('Failed to load stories', response.error);
      }
    } catch (e, stackTrace) {
      _error = 'Failed to load stories';
      LoggerService.error('Error loading stories', e, stackTrace);
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Refresh stories
  Future<void> refreshStories() async {
    _nextCursor = null;
    _hasMore = true;
    await loadInitialStories();
  }

  /// Load more stories
  Future<bool> loadMoreStories() async {
    if (!_hasMore || _isLoading) return false;

    try {
      final response = await _storiesApiService.getStories(
        cursor: _nextCursor,
        limit: 20,
      );
      
      if (response.success && response.data != null) {
        _stories.addAll(response.data!.stories);
        _nextCursor = response.data!.pagination.nextCursor;
        _hasMore = response.data!.pagination.hasMore;
        notifyListeners();
        return true;
      } else {
        LoggerService.error('Failed to load more stories', response.error);
        return false;
      }
    } catch (e, stackTrace) {
      LoggerService.error('Error loading more stories', e, stackTrace);
      return false;
    }
  }

  /// Create a new story from camera
  Future<void> createStoryFromCamera() async {
    try {
      final XFile? image = await _imagePicker.pickImage(
        source: ImageSource.camera,
        maxWidth: 1080,
        maxHeight: 1920,
        imageQuality: 85,
      );

      if (image != null) {
        await _createStoryFromFile(image, StoryMediaType.image);
      }
    } catch (e, stackTrace) {
      _error = 'Failed to capture image';
      LoggerService.error('Error capturing image for story', e, stackTrace);
      notifyListeners();
    }
  }

  /// Create a new story from gallery
  Future<void> createStoryFromGallery() async {
    try {
      final XFile? file = await _imagePicker.pickImage(
        source: ImageSource.gallery,
        maxWidth: 1080,
        maxHeight: 1920,
        imageQuality: 85,
      );

      if (file != null) {
        await _createStoryFromFile(file, StoryMediaType.image);
      }
    } catch (e, stackTrace) {
      _error = 'Failed to select image';
      LoggerService.error('Error selecting image for story', e, stackTrace);
      notifyListeners();
    }
  }

  /// Create a new story from video
  Future<void> createStoryFromVideo() async {
    try {
      final XFile? video = await _imagePicker.pickVideo(
        source: ImageSource.gallery,
        maxDuration: const Duration(seconds: 30),
      );

      if (video != null) {
        await _createStoryFromFile(video, StoryMediaType.video);
      }
    } catch (e, stackTrace) {
      _error = 'Failed to select video';
      LoggerService.error('Error selecting video for story', e, stackTrace);
      notifyListeners();
    }
  }

  /// Create story from file
  Future<void> _createStoryFromFile(XFile file, StoryMediaType mediaType) async {
    _isCreatingStory = true;
    _error = null;
    notifyListeners();

    try {
      // Get signed upload parameters
      final signResponse = await _mediaApiService.getSignedUploadParams(
        filename: file.name,
        mimeType: file.mimeType ?? 'image/jpeg',
        studentId: 'TEMP_STUDENT_ID', // TODO: Get from auth provider
      );

      if (!signResponse.success || signResponse.data == null) {
        throw Exception(signResponse.error?.message ?? 'Failed to get upload parameters');
      }

      // Upload to Cloudinary
      final uploadResponse = await _mediaApiService.uploadToCloudinary(
        file,
        signResponse.data!,
      );

      if (!uploadResponse.success || uploadResponse.data == null) {
        throw Exception(uploadResponse.error?.message ?? 'Failed to upload media');
      }

      // Create story media object
      final storyMedia = StoryMedia(
        url: uploadResponse.data!.secureUrl,
        cloudinaryPublicId: uploadResponse.data!.publicId,
        width: uploadResponse.data!.width,
        height: uploadResponse.data!.height,
        duration: mediaType == StoryMediaType.video ? 15.0 : null,
        type: mediaType,
      );

      // Create story
      final createRequest = CreateStoryRequest(media: storyMedia);
      final createResponse = await _storiesApiService.createStory(createRequest);

      if (createResponse.success && createResponse.data != null) {
        // Add new story to the beginning of the list
        _stories.insert(0, createResponse.data!);
        _error = null;
      } else {
        throw Exception(createResponse.error?.message ?? 'Failed to create story');
      }
    } catch (e, stackTrace) {
      _error = e.toString();
      LoggerService.error('Error creating story', e, stackTrace);
    } finally {
      _isCreatingStory = false;
      notifyListeners();
    }
  }

  /// Mark a story as viewed
  Future<void> viewStory(String storyId) async {
    try {
      final response = await _storiesApiService.viewStory(storyId);
      
      if (response.success) {
        // Update the story in the list with new view count
        final storyIndex = _stories.indexWhere((story) => story.id == storyId);
        if (storyIndex != -1) {
          final updatedStory = Story(
            id: _stories[storyIndex].id,
            authorStudentId: _stories[storyIndex].authorStudentId,
            media: _stories[storyIndex].media,
            createdAt: _stories[storyIndex].createdAt,
            expiresAt: _stories[storyIndex].expiresAt,
            viewsCount: response.data?.viewsCount ?? _stories[storyIndex].viewsCount,
            viewedBy: _stories[storyIndex].viewedBy,
            author: _stories[storyIndex].author,
          );
          _stories[storyIndex] = updatedStory;
          notifyListeners();
        }
      }
    } catch (e, stackTrace) {
      LoggerService.error('Error viewing story', e, stackTrace);
    }
  }

  /// Clear error
  void clearError() {
    _error = null;
    notifyListeners();
  }

  /// Get stories grouped by author
  Map<String, List<Story>> get storiesByAuthor {
    final Map<String, List<Story>> grouped = {};
    
    for (final story in _stories) {
      if (!grouped.containsKey(story.authorStudentId)) {
        grouped[story.authorStudentId] = [];
      }
      grouped[story.authorStudentId]!.add(story);
    }
    
    return grouped;
  }
}