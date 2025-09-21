import '../models/api_response.dart';
import '../models/user.dart';
import '../services/api_service.dart';
import '../services/logger_service.dart';

class UsersApiService {
  static final UsersApiService _instance = UsersApiService._internal();
  factory UsersApiService() => _instance;
  UsersApiService._internal();

  final ApiService _apiService = ApiService();

  /// Get user profile by student ID
  Future<ApiResponse<User>> getUserProfile(String studentId) async {
    try {
      final response = await _apiService.getPublic('/users/$studentId');

      if (response.success && response.data != null) {
        final user = User.fromJson(response.data!['user']);
        return ApiResponse.success(user);
      } else {
        return ApiResponse.error(response.error!);
      }
    } catch (e, stackTrace) {
      LoggerService.error('Error getting user profile', e, stackTrace);
      return ApiResponse.error(
        const ApiError(
          code: 'GET_USER_PROFILE_ERROR',
          message: 'Failed to get user profile',
        ),
      );
    }
  }

  /// Update user profile (owner only)
  Future<ApiResponse<User>> updateUserProfile(
    String studentId,
    UpdateUserProfileRequest request,
  ) async {
    try {
      final response = await _apiService.patch('/users/$studentId', request.toJson());

      if (response.success && response.data != null) {
        final user = User.fromJson(response.data!['user']);
        return ApiResponse.success(user, response.data!['message']);
      } else {
        return ApiResponse.error(response.error!);
      }
    } catch (e, stackTrace) {
      LoggerService.error('Error updating user profile', e, stackTrace);
      return ApiResponse.error(
        const ApiError(
          code: 'UPDATE_USER_PROFILE_ERROR',
          message: 'Failed to update user profile',
        ),
      );
    }
  }

  /// Search users with filtering
  Future<ApiResponse<UsersSearchResponse>> searchUsers({
    String? search,
    int? year,
    String? department,
    String? section,
    int limit = 20,
    int offset = 0,
  }) async {
    try {
      final queryParams = <String, String>{
        'limit': limit.toString(),
        'offset': offset.toString(),
      };

      if (search != null && search.isNotEmpty) queryParams['search'] = search;
      if (year != null) queryParams['year'] = year.toString();
      if (department != null) queryParams['department'] = department;
      if (section != null) queryParams['section'] = section;

      final response = await _apiService.getPublic('/users', queryParams: queryParams);

      if (response.success && response.data != null) {
        final searchResponse = UsersSearchResponse.fromJson(response.data!);
        return ApiResponse.success(searchResponse);
      } else {
        return ApiResponse.error(response.error!);
      }
    } catch (e, stackTrace) {
      LoggerService.error('Error searching users', e, stackTrace);
      return ApiResponse.error(
        const ApiError(
          code: 'SEARCH_USERS_ERROR',
          message: 'Failed to search users',
        ),
      );
    }
  }

  /// Get current user's profile
  Future<ApiResponse<User>> getCurrentUserProfile() async {
    try {
      final response = await _apiService.get('/users/me');

      if (response.success && response.data != null) {
        final user = User.fromJson(response.data!['user']);
        return ApiResponse.success(user);
      } else {
        return ApiResponse.error(response.error!);
      }
    } catch (e, stackTrace) {
      LoggerService.error('Error getting current user profile', e, stackTrace);
      return ApiResponse.error(
        const ApiError(
          code: 'GET_CURRENT_USER_ERROR',
          message: 'Failed to get current user profile',
        ),
      );
    }
  }

  /// Update FCM token for push notifications
  Future<ApiResponse<void>> updateFcmToken(String fcmToken) async {
    try {
      final response = await _apiService.post('/users/fcm-token', {
        'fcmToken': fcmToken,
      });

      if (response.success) {
        return ApiResponse.success(null, response.data?['message']);
      } else {
        return ApiResponse.error(response.error!);
      }
    } catch (e, stackTrace) {
      LoggerService.error('Error updating FCM token', e, stackTrace);
      return ApiResponse.error(
        const ApiError(
          code: 'UPDATE_FCM_TOKEN_ERROR',
          message: 'Failed to update FCM token',
        ),
      );
    }
  }

  /// Remove FCM token
  Future<ApiResponse<void>> removeFcmToken(String fcmToken) async {
    try {
      final response = await _apiService.delete('/users/fcm-token/$fcmToken');

      if (response.success) {
        return ApiResponse.success(null, response.data?['message']);
      } else {
        return ApiResponse.error(response.error!);
      }
    } catch (e, stackTrace) {
      LoggerService.error('Error removing FCM token', e, stackTrace);
      return ApiResponse.error(
        const ApiError(
          code: 'REMOVE_FCM_TOKEN_ERROR',
          message: 'Failed to remove FCM token',
        ),
      );
    }
  }
}

class UpdateUserProfileRequest {
  final String? displayName;
  final String? photoUrl;
  final String? bio;
  final UserSettings? settings;

  const UpdateUserProfileRequest({
    this.displayName,
    this.photoUrl,
    this.bio,
    this.settings,
  });

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
    if (displayName != null) json['displayName'] = displayName;
    if (photoUrl != null) json['photoUrl'] = photoUrl;
    if (bio != null) json['bio'] = bio;
    if (settings != null) json['settings'] = settings!.toJson();
    return json;
  }
}

class UsersSearchResponse {
  final List<User> users;
  final SearchPaginationInfo pagination;

  const UsersSearchResponse({
    required this.users,
    required this.pagination,
  });

  factory UsersSearchResponse.fromJson(Map<String, dynamic> json) {
    return UsersSearchResponse(
      users: (json['users'] as List<dynamic>)
          .map((item) => User.fromJson(item))
          .toList(),
      pagination: SearchPaginationInfo.fromJson(json['pagination']),
    );
  }
}

class SearchPaginationInfo {
  final int total;
  final int limit;
  final int offset;
  final bool hasMore;

  const SearchPaginationInfo({
    required this.total,
    required this.limit,
    required this.offset,
    required this.hasMore,
  });

  factory SearchPaginationInfo.fromJson(Map<String, dynamic> json) {
    return SearchPaginationInfo(
      total: json['total'] as int,
      limit: json['limit'] as int,
      offset: json['offset'] as int,
      hasMore: json['hasMore'] as bool,
    );
  }
}