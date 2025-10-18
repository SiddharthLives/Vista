import '../models/api_response.dart';
import '../models/notification.dart';
import '../services/api_service.dart';
import '../services/logger_service.dart';

class NotificationsApiService {
  static final NotificationsApiService _instance = NotificationsApiService._internal();
  factory NotificationsApiService() => _instance;
  NotificationsApiService._internal();

  final ApiService _apiService = ApiService();

  /// Get user's notifications
  Future<ApiResponse<NotificationsFeedResponse>> getNotifications({
    String? cursor,
    int limit = 20,
    bool? unreadOnly,
  }) async {
    try {
      final queryParams = <String, String>{
        'limit': limit.toString(),
      };

      if (cursor != null) queryParams['cursor'] = cursor;
      if (unreadOnly != null) queryParams['unreadOnly'] = unreadOnly.toString();

      final response = await _apiService.get('/notifications', queryParams: queryParams);

      if (response.success && response.data != null) {
        final feedResponse = NotificationsFeedResponse.fromJson(response.data!);
        return ApiResponse.success(feedResponse);
      } else {
        return ApiResponse.error(response.error!);
      }
    } catch (e, stackTrace) {
      LoggerService.error('Error getting notifications', e, stackTrace);
      return ApiResponse.error(
        const ApiError(
          code: 'GET_NOTIFICATIONS_ERROR',
          message: 'Failed to get notifications',
        ),
      );
    }
  }

  /// Mark notification as read
  Future<ApiResponse<void>> markNotificationAsRead(String notificationId) async {
    try {
      final response = await _apiService.patch('/notifications/$notificationId/read', {});

      if (response.success) {
        return ApiResponse.success(null, response.data?['message']);
      } else {
        return ApiResponse.error(response.error!);
      }
    } catch (e, stackTrace) {
      LoggerService.error('Error marking notification as read', e, stackTrace);
      return ApiResponse.error(
        const ApiError(
          code: 'MARK_NOTIFICATION_READ_ERROR',
          message: 'Failed to mark notification as read',
        ),
      );
    }
  }

  /// Mark all notifications as read
  Future<ApiResponse<MarkAllReadResponse>> markAllNotificationsAsRead() async {
    try {
      final response = await _apiService.patch('/notifications/read-all', {});

      if (response.success && response.data != null) {
        final markAllResponse = MarkAllReadResponse.fromJson(response.data!);
        return ApiResponse.success(markAllResponse);
      } else {
        return ApiResponse.error(response.error!);
      }
    } catch (e, stackTrace) {
      LoggerService.error('Error marking all notifications as read', e, stackTrace);
      return ApiResponse.error(
        const ApiError(
          code: 'MARK_ALL_NOTIFICATIONS_READ_ERROR',
          message: 'Failed to mark all notifications as read',
        ),
      );
    }
  }

  /// Delete notification
  Future<ApiResponse<void>> deleteNotification(String notificationId) async {
    try {
      final response = await _apiService.delete('/notifications/$notificationId');

      if (response.success) {
        return ApiResponse.success(null, response.data?['message']);
      } else {
        return ApiResponse.error(response.error!);
      }
    } catch (e, stackTrace) {
      LoggerService.error('Error deleting notification', e, stackTrace);
      return ApiResponse.error(
        const ApiError(
          code: 'DELETE_NOTIFICATION_ERROR',
          message: 'Failed to delete notification',
        ),
      );
    }
  }

  /// Get notification count (unread)
  Future<ApiResponse<NotificationCountResponse>> getNotificationCount() async {
    try {
      final response = await _apiService.get('/notifications/count');

      if (response.success && response.data != null) {
        final countResponse = NotificationCountResponse.fromJson(response.data!);
        return ApiResponse.success(countResponse);
      } else {
        return ApiResponse.error(response.error!);
      }
    } catch (e, stackTrace) {
      LoggerService.error('Error getting notification count', e, stackTrace);
      return ApiResponse.error(
        const ApiError(
          code: 'GET_NOTIFICATION_COUNT_ERROR',
          message: 'Failed to get notification count',
        ),
      );
    }
  }

  /// Update notification preferences
  Future<ApiResponse<void>> updateNotificationPreferences(
    NotificationPreferencesRequest request,
  ) async {
    try {
      final response = await _apiService.patch('/notifications/preferences', request.toJson());

      if (response.success) {
        return ApiResponse.success(null, response.data?['message']);
      } else {
        return ApiResponse.error(response.error!);
      }
    } catch (e, stackTrace) {
      LoggerService.error('Error updating notification preferences', e, stackTrace);
      return ApiResponse.error(
        const ApiError(
          code: 'UPDATE_NOTIFICATION_PREFERENCES_ERROR',
          message: 'Failed to update notification preferences',
        ),
      );
    }
  }

  /// Register FCM token for push notifications
  Future<ApiResponse<void>> registerFCMToken(String fcmToken) async {
    try {
      final response = await _apiService.post('/notifications/fcm-token', {
        'fcmToken': fcmToken,
      });

      if (response.success) {
        return ApiResponse.success(null, response.data?['message']);
      } else {
        return ApiResponse.error(response.error!);
      }
    } catch (e, stackTrace) {
      LoggerService.error('Error registering FCM token', e, stackTrace);
      return ApiResponse.error(
        const ApiError(
          code: 'REGISTER_FCM_TOKEN_ERROR',
          message: 'Failed to register FCM token',
        ),
      );
    }
  }
}

class NotificationsFeedResponse {
  final List<Notification> notifications;
  final PaginationInfo pagination;

  const NotificationsFeedResponse({
    required this.notifications,
    required this.pagination,
  });

  factory NotificationsFeedResponse.fromJson(Map<String, dynamic> json) {
    return NotificationsFeedResponse(
      notifications: (json['notifications'] as List<dynamic>)
          .map((item) => Notification.fromJson(item))
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

class MarkAllReadResponse {
  final String message;
  final int updatedCount;

  const MarkAllReadResponse({
    required this.message,
    required this.updatedCount,
  });

  factory MarkAllReadResponse.fromJson(Map<String, dynamic> json) {
    return MarkAllReadResponse(
      message: json['message'] as String,
      updatedCount: json['updatedCount'] as int,
    );
  }
}

class NotificationCountResponse {
  final int unreadCount;
  final int totalCount;

  const NotificationCountResponse({
    required this.unreadCount,
    required this.totalCount,
  });

  factory NotificationCountResponse.fromJson(Map<String, dynamic> json) {
    return NotificationCountResponse(
      unreadCount: json['unreadCount'] as int,
      totalCount: json['totalCount'] as int,
    );
  }
}

class NotificationPreferencesRequest {
  final bool? pushNotifications;
  final bool? emailNotifications;
  final bool? likeNotifications;
  final bool? commentNotifications;
  final bool? followNotifications;
  final bool? messageNotifications;

  const NotificationPreferencesRequest({
    this.pushNotifications,
    this.emailNotifications,
    this.likeNotifications,
    this.commentNotifications,
    this.followNotifications,
    this.messageNotifications,
  });

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
    if (pushNotifications != null) json['pushNotifications'] = pushNotifications;
    if (emailNotifications != null) json['emailNotifications'] = emailNotifications;
    if (likeNotifications != null) json['likeNotifications'] = likeNotifications;
    if (commentNotifications != null) json['commentNotifications'] = commentNotifications;
    if (followNotifications != null) json['followNotifications'] = followNotifications;
    if (messageNotifications != null) json['messageNotifications'] = messageNotifications;
    return json;
  }
}