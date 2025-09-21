import '../models/api_response.dart';
import '../models/story.dart';
import '../models/user.dart';
import '../services/api_service.dart';
import '../services/logger_service.dart';

class StoriesApiService {
  static final StoriesApiService _instance = StoriesApiService._internal();
  factory StoriesApiService() => _instance;
  StoriesApiService._internal();

  final ApiService _apiService = ApiService();

  /// Create a new story
  Future<ApiResponse<Story>> createStory(CreateStoryRequest request) async {
    try {
      final response = await _apiService.post('/stories', request.toJson());

      if (response.success && response.data != null) {
        final story = Story.fromJson(response.data!['story']);
        return ApiResponse.success(story, response.data!['message']);
      } else {
        return ApiResponse.error(response.error!);
      }
    } catch (e, stackTrace) {
      LoggerService.error('Error creating story', e, stackTrace);
      return ApiResponse.error(
        const ApiError(
          code: 'CREATE_STORY_ERROR',
          message: 'Failed to create story',
        ),
      );
    }
  }

  /// Get stories feed with filtering
  Future<ApiResponse<StoriesFeedResponse>> getStories({
    String? cursor,
    int limit = 20,
    int? year,
    String? department,
    String? section,
    String? authorStudentId,
  }) async {
    try {
      final queryParams = <String, String>{
        'limit': limit.toString(),
      };

      if (cursor != null) queryParams['cursor'] = cursor;
      if (year != null) queryParams['year'] = year.toString();
      if (department != null) queryParams['department'] = department;
      if (section != null) queryParams['section'] = section;
      if (authorStudentId != null) queryParams['authorStudentId'] = authorStudentId;

      final response = await _apiService.get('/stories', queryParams: queryParams);

      if (response.success && response.data != null) {
        final feedResponse = StoriesFeedResponse.fromJson(response.data!);
        return ApiResponse.success(feedResponse);
      } else {
        return ApiResponse.error(response.error!);
      }
    } catch (e, stackTrace) {
      LoggerService.error('Error getting stories feed', e, stackTrace);
      return ApiResponse.error(
        const ApiError(
          code: 'GET_STORIES_ERROR',
          message: 'Failed to get stories feed',
        ),
      );
    }
  }

  /// Get a specific story by ID
  Future<ApiResponse<Story>> getStory(String storyId) async {
    try {
      final response = await _apiService.get('/stories/$storyId');

      if (response.success && response.data != null) {
        final story = Story.fromJson(response.data!['story']);
        return ApiResponse.success(story);
      } else {
        return ApiResponse.error(response.error!);
      }
    } catch (e, stackTrace) {
      LoggerService.error('Error getting story', e, stackTrace);
      return ApiResponse.error(
        const ApiError(
          code: 'GET_STORY_ERROR',
          message: 'Failed to get story',
        ),
      );
    }
  }

  /// Mark a story as viewed
  Future<ApiResponse<ViewStoryResponse>> viewStory(String storyId) async {
    try {
      final response = await _apiService.post('/stories/$storyId/view', {});

      if (response.success && response.data != null) {
        final viewResponse = ViewStoryResponse.fromJson(response.data!);
        return ApiResponse.success(viewResponse);
      } else {
        return ApiResponse.error(response.error!);
      }
    } catch (e, stackTrace) {
      LoggerService.error('Error viewing story', e, stackTrace);
      return ApiResponse.error(
        const ApiError(
          code: 'VIEW_STORY_ERROR',
          message: 'Failed to view story',
        ),
      );
    }
  }

  /// Cleanup expired stories (admin function)
  Future<ApiResponse<CleanupResponse>> cleanupExpiredStories() async {
    try {
      final response = await _apiService.get('/stories/cleanup/expired');

      if (response.success && response.data != null) {
        final cleanupResponse = CleanupResponse.fromJson(response.data!);
        return ApiResponse.success(cleanupResponse);
      } else {
        return ApiResponse.error(response.error!);
      }
    } catch (e, stackTrace) {
      LoggerService.error('Error cleaning up expired stories', e, stackTrace);
      return ApiResponse.error(
        const ApiError(
          code: 'CLEANUP_STORIES_ERROR',
          message: 'Failed to cleanup expired stories',
        ),
      );
    }
  }
}

class StoriesFeedResponse {
  final List<Story> stories;
  final PaginationInfo pagination;

  const StoriesFeedResponse({
    required this.stories,
    required this.pagination,
  });

  factory StoriesFeedResponse.fromJson(Map<String, dynamic> json) {
    return StoriesFeedResponse(
      stories: (json['stories'] as List<dynamic>)
          .map((item) => Story.fromJson(item))
          .toList(),
      pagination: PaginationInfo.fromJson(json['pagination']),
    );
  }
}

class PaginationInfo {
  final String? nextCursor;
  final bool hasMore;
  final int limit;

  const PaginationInfo({
    this.nextCursor,
    required this.hasMore,
    required this.limit,
  });

  factory PaginationInfo.fromJson(Map<String, dynamic> json) {
    return PaginationInfo(
      nextCursor: json['nextCursor'] as String?,
      hasMore: json['hasMore'] as bool,
      limit: json['limit'] as int,
    );
  }
}

class ViewStoryResponse {
  final String message;
  final int viewsCount;

  const ViewStoryResponse({
    required this.message,
    required this.viewsCount,
  });

  factory ViewStoryResponse.fromJson(Map<String, dynamic> json) {
    return ViewStoryResponse(
      message: json['message'] as String,
      viewsCount: json['viewsCount'] as int,
    );
  }
}

class CleanupResponse {
  final String message;
  final int deletedCount;
  final String timestamp;

  const CleanupResponse({
    required this.message,
    required this.deletedCount,
    required this.timestamp,
  });

  factory CleanupResponse.fromJson(Map<String, dynamic> json) {
    return CleanupResponse(
      message: json['message'] as String,
      deletedCount: json['deletedCount'] as int,
      timestamp: json['timestamp'] as String,
    );
  }
}