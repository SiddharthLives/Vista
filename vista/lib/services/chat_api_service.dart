import '../models/api_response.dart';
import '../models/conversation.dart';
import '../models/user.dart';
import '../services/api_service.dart';
import '../services/logger_service.dart';

class ChatApiService {
  static final ChatApiService _instance = ChatApiService._internal();
  factory ChatApiService() => _instance;
  ChatApiService._internal();

  final ApiService _apiService = ApiService();

  /// Get user's conversations
  Future<ApiResponse<ConversationsFeedResponse>> getConversations({
    String? cursor,
    int limit = 20,
  }) async {
    try {
      final queryParams = <String, String>{
        'limit': limit.toString(),
      };

      if (cursor != null) queryParams['cursor'] = cursor;

      final response = await _apiService.get('/chat/conversations', queryParams: queryParams);

      if (response.success && response.data != null) {
        final feedResponse = ConversationsFeedResponse.fromJson(response.data!);
        return ApiResponse.success(feedResponse);
      } else {
        return ApiResponse.error(response.error!);
      }
    } catch (e, stackTrace) {
      LoggerService.error('Error getting conversations', e, stackTrace);
      return ApiResponse.error(
        const ApiError(
          code: 'GET_CONVERSATIONS_ERROR',
          message: 'Failed to get conversations',
        ),
      );
    }
  }

  /// Create or get conversation with another user
  Future<ApiResponse<Conversation>> createOrGetConversation(String otherStudentId) async {
    try {
      final response = await _apiService.post('/chat/conversations', {
        'participantStudentId': otherStudentId,
      });

      if (response.success && response.data != null) {
        final conversation = Conversation.fromJson(response.data!['conversation']);
        return ApiResponse.success(conversation, response.data!['message']);
      } else {
        return ApiResponse.error(response.error!);
      }
    } catch (e, stackTrace) {
      LoggerService.error('Error creating/getting conversation', e, stackTrace);
      return ApiResponse.error(
        const ApiError(
          code: 'CREATE_CONVERSATION_ERROR',
          message: 'Failed to create or get conversation',
        ),
      );
    }
  }

  /// Get messages for a conversation
  Future<ApiResponse<MessagesFeedResponse>> getMessages(
    String conversationId, {
    String? cursor,
    int limit = 50,
  }) async {
    try {
      final queryParams = <String, String>{
        'limit': limit.toString(),
      };

      if (cursor != null) queryParams['cursor'] = cursor;

      final response = await _apiService.get(
        '/chat/conversations/$conversationId/messages',
        queryParams: queryParams,
      );

      if (response.success && response.data != null) {
        final feedResponse = MessagesFeedResponse.fromJson(response.data!);
        return ApiResponse.success(feedResponse);
      } else {
        return ApiResponse.error(response.error!);
      }
    } catch (e, stackTrace) {
      LoggerService.error('Error getting messages', e, stackTrace);
      return ApiResponse.error(
        const ApiError(
          code: 'GET_MESSAGES_ERROR',
          message: 'Failed to get messages',
        ),
      );
    }
  }

  /// Send a message (HTTP fallback - real-time via Socket.IO)
  Future<ApiResponse<Message>> sendMessage(
    String conversationId,
    SendMessageRequest request,
  ) async {
    try {
      final response = await _apiService.post(
        '/chat/conversations/$conversationId/messages',
        request.toJson(),
      );

      if (response.success && response.data != null) {
        final message = Message.fromJson(response.data!['message']);
        return ApiResponse.success(message, response.data!['message']);
      } else {
        return ApiResponse.error(response.error!);
      }
    } catch (e, stackTrace) {
      LoggerService.error('Error sending message', e, stackTrace);
      return ApiResponse.error(
        const ApiError(
          code: 'SEND_MESSAGE_ERROR',
          message: 'Failed to send message',
        ),
      );
    }
  }

  /// Mark messages as read
  Future<ApiResponse<MarkMessagesReadResponse>> markMessagesAsRead(
    String conversationId,
    List<String> messageIds,
  ) async {
    try {
      final response = await _apiService.patch(
        '/chat/conversations/$conversationId/read',
        {'messageIds': messageIds},
      );

      if (response.success && response.data != null) {
        final readResponse = MarkMessagesReadResponse.fromJson(response.data!);
        return ApiResponse.success(readResponse);
      } else {
        return ApiResponse.error(response.error!);
      }
    } catch (e, stackTrace) {
      LoggerService.error('Error marking messages as read', e, stackTrace);
      return ApiResponse.error(
        const ApiError(
          code: 'MARK_MESSAGES_READ_ERROR',
          message: 'Failed to mark messages as read',
        ),
      );
    }
  }

  /// Delete a message
  Future<ApiResponse<void>> deleteMessage(
    String conversationId,
    String messageId,
  ) async {
    try {
      final response = await _apiService.delete(
        '/chat/conversations/$conversationId/messages/$messageId',
      );

      if (response.success) {
        return ApiResponse.success(null, response.data?['message']);
      } else {
        return ApiResponse.error(response.error!);
      }
    } catch (e, stackTrace) {
      LoggerService.error('Error deleting message', e, stackTrace);
      return ApiResponse.error(
        const ApiError(
          code: 'DELETE_MESSAGE_ERROR',
          message: 'Failed to delete message',
        ),
      );
    }
  }

  /// Get conversation details
  Future<ApiResponse<ConversationDetails>> getConversationDetails(String conversationId) async {
    try {
      final response = await _apiService.get('/chat/conversations/$conversationId');

      if (response.success && response.data != null) {
        final details = ConversationDetails.fromJson(response.data!['conversation']);
        return ApiResponse.success(details);
      } else {
        return ApiResponse.error(response.error!);
      }
    } catch (e, stackTrace) {
      LoggerService.error('Error getting conversation details', e, stackTrace);
      return ApiResponse.error(
        const ApiError(
          code: 'GET_CONVERSATION_DETAILS_ERROR',
          message: 'Failed to get conversation details',
        ),
      );
    }
  }

  /// Leave a conversation
  Future<ApiResponse<void>> leaveConversation(String conversationId) async {
    try {
      final response = await _apiService.delete('/chat/conversations/$conversationId/leave');

      if (response.success) {
        return ApiResponse.success(null, response.data?['message']);
      } else {
        return ApiResponse.error(response.error!);
      }
    } catch (e, stackTrace) {
      LoggerService.error('Error leaving conversation', e, stackTrace);
      return ApiResponse.error(
        const ApiError(
          code: 'LEAVE_CONVERSATION_ERROR',
          message: 'Failed to leave conversation',
        ),
      );
    }
  }
}

class ConversationsFeedResponse {
  final List<ConversationWithParticipants> conversations;
  final PaginationInfo pagination;

  const ConversationsFeedResponse({
    required this.conversations,
    required this.pagination,
  });

  factory ConversationsFeedResponse.fromJson(Map<String, dynamic> json) {
    return ConversationsFeedResponse(
      conversations: (json['conversations'] as List<dynamic>)
          .map((item) => ConversationWithParticipants.fromJson(item))
          .toList(),
      pagination: PaginationInfo.fromJson(json['pagination']),
    );
  }
}



class MessagesFeedResponse {
  final List<Message> messages;
  final PaginationInfo pagination;

  const MessagesFeedResponse({
    required this.messages,
    required this.pagination,
  });

  factory MessagesFeedResponse.fromJson(Map<String, dynamic> json) {
    return MessagesFeedResponse(
      messages: (json['messages'] as List<dynamic>)
          .map((item) => Message.fromJson(item))
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

class MarkMessagesReadResponse {
  final String message;
  final int updatedCount;

  const MarkMessagesReadResponse({
    required this.message,
    required this.updatedCount,
  });

  factory MarkMessagesReadResponse.fromJson(Map<String, dynamic> json) {
    return MarkMessagesReadResponse(
      message: json['message'] as String,
      updatedCount: json['updatedCount'] as int,
    );
  }
}

class ConversationDetails {
  final Conversation conversation;
  final List<User> participants;
  final int unreadCount;

  const ConversationDetails({
    required this.conversation,
    required this.participants,
    required this.unreadCount,
  });

  factory ConversationDetails.fromJson(Map<String, dynamic> json) {
    return ConversationDetails(
      conversation: Conversation.fromJson(json),
      participants: (json['participantDetails'] as List<dynamic>?)
              ?.map((item) => User.fromJson(item))
              .toList() ??
          [],
      unreadCount: json['unreadCount'] as int? ?? 0,
    );
  }
}