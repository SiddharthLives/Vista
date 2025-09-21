import '../models/api_response.dart';
import '../models/topic.dart';
import '../models/comment.dart';
import '../models/user.dart';
import '../services/api_service.dart';
import '../services/logger_service.dart';

class TopicsApiService {
  static final TopicsApiService _instance = TopicsApiService._internal();
  factory TopicsApiService() => _instance;
  TopicsApiService._internal();

  final ApiService _apiService = ApiService();

  /// Get topics with filtering and pagination
  Future<ApiResponse<TopicsFeedResponse>> getTopics({
    String? cursor,
    int limit = 20,
    String sortBy = 'recent',
    String? authorStudentId,
    List<String>? tags,
    String? search,
  }) async {
    try {
      final queryParams = <String, String>{
        'limit': limit.toString(),
        'sortBy': sortBy,
      };

      if (cursor != null) queryParams['cursor'] = cursor;
      if (authorStudentId != null) queryParams['authorStudentId'] = authorStudentId;
      if (tags != null && tags.isNotEmpty) queryParams['tags'] = tags.join(',');
      if (search != null && search.isNotEmpty) queryParams['search'] = search;

      final response = await _apiService.getPublic('/topics', queryParams: queryParams);

      if (response.success && response.data != null) {
        final feedResponse = TopicsFeedResponse.fromJson(response.data!);
        return ApiResponse.success(feedResponse);
      } else {
        return ApiResponse.error(response.error!);
      }
    } catch (e, stackTrace) {
      LoggerService.error('Error getting topics feed', e, stackTrace);
      return ApiResponse.error(
        const ApiError(
          code: 'GET_TOPICS_ERROR',
          message: 'Failed to get topics feed',
        ),
      );
    }
  }

  /// Create a new topic
  Future<ApiResponse<Topic>> createTopic(CreateTopicRequest request) async {
    try {
      final response = await _apiService.post('/topics', request.toJson());

      if (response.success && response.data != null) {
        final topic = Topic.fromJson(response.data!['topic']);
        return ApiResponse.success(topic, response.data!['message']);
      } else {
        return ApiResponse.error(response.error!);
      }
    } catch (e, stackTrace) {
      LoggerService.error('Error creating topic', e, stackTrace);
      return ApiResponse.error(
        const ApiError(
          code: 'CREATE_TOPIC_ERROR',
          message: 'Failed to create topic',
        ),
      );
    }
  }

  /// Get a specific topic by ID
  Future<ApiResponse<Topic>> getTopic(String topicId) async {
    try {
      final response = await _apiService.getPublic('/topics/$topicId');

      if (response.success && response.data != null) {
        final topic = Topic.fromJson(response.data!['topic']);
        return ApiResponse.success(topic);
      } else {
        return ApiResponse.error(response.error!);
      }
    } catch (e, stackTrace) {
      LoggerService.error('Error getting topic', e, stackTrace);
      return ApiResponse.error(
        const ApiError(
          code: 'GET_TOPIC_ERROR',
          message: 'Failed to get topic',
        ),
      );
    }
  }

  /// Vote on a topic
  Future<ApiResponse<VoteTopicResponse>> voteTopic(
    String topicId,
    VoteTopicRequest request,
  ) async {
    try {
      final response = await _apiService.post('/topics/$topicId/vote', request.toJson());

      if (response.success && response.data != null) {
        final voteResponse = VoteTopicResponse.fromJson(response.data!);
        return ApiResponse.success(voteResponse);
      } else {
        return ApiResponse.error(response.error!);
      }
    } catch (e, stackTrace) {
      LoggerService.error('Error voting on topic', e, stackTrace);
      return ApiResponse.error(
        const ApiError(
          code: 'VOTE_TOPIC_ERROR',
          message: 'Failed to vote on topic',
        ),
      );
    }
  }

  /// Add a comment to a topic
  Future<ApiResponse<CommentResponse>> commentOnTopic(
    String topicId,
    CreateCommentRequest request,
  ) async {
    try {
      final response = await _apiService.post('/topics/$topicId/comment', request.toJson());

      if (response.success && response.data != null) {
        final commentResponse = CommentResponse.fromJson(response.data!);
        return ApiResponse.success(commentResponse);
      } else {
        return ApiResponse.error(response.error!);
      }
    } catch (e, stackTrace) {
      LoggerService.error('Error commenting on topic', e, stackTrace);
      return ApiResponse.error(
        const ApiError(
          code: 'COMMENT_TOPIC_ERROR',
          message: 'Failed to comment on topic',
        ),
      );
    }
  }

  /// Get comments for a topic
  Future<ApiResponse<CommentsResponse>> getTopicComments(
    String topicId, {
    int limit = 50,
    String sortBy = 'newest',
    String? parentCommentId,
  }) async {
    try {
      final queryParams = <String, String>{
        'limit': limit.toString(),
        'sortBy': sortBy,
      };

      if (parentCommentId != null) {
        queryParams['parentCommentId'] = parentCommentId;
      }

      final response = await _apiService.getPublic(
        '/topics/$topicId/comments',
        queryParams: queryParams,
      );

      if (response.success && response.data != null) {
        final commentsResponse = CommentsResponse.fromJson(response.data!);
        return ApiResponse.success(commentsResponse);
      } else {
        return ApiResponse.error(response.error!);
      }
    } catch (e, stackTrace) {
      LoggerService.error('Error getting topic comments', e, stackTrace);
      return ApiResponse.error(
        const ApiError(
          code: 'GET_TOPIC_COMMENTS_ERROR',
          message: 'Failed to get topic comments',
        ),
      );
    }
  }
}

class TopicsFeedResponse {
  final List<Topic> topics;
  final PaginationInfo pagination;

  const TopicsFeedResponse({
    required this.topics,
    required this.pagination,
  });

  factory TopicsFeedResponse.fromJson(Map<String, dynamic> json) {
    return TopicsFeedResponse(
      topics: (json['topics'] as List<dynamic>)
          .map((item) => Topic.fromJson(item))
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

class VoteTopicResponse {
  final String message;
  final int votes;

  const VoteTopicResponse({
    required this.message,
    required this.votes,
  });

  factory VoteTopicResponse.fromJson(Map<String, dynamic> json) {
    return VoteTopicResponse(
      message: json['message'] as String,
      votes: json['votes'] as int,
    );
  }
}

class CommentResponse {
  final String message;
  final Comment comment;
  final TopicInfo topic;

  const CommentResponse({
    required this.message,
    required this.comment,
    required this.topic,
  });

  factory CommentResponse.fromJson(Map<String, dynamic> json) {
    return CommentResponse(
      message: json['message'] as String,
      comment: Comment.fromJson(json['comment']),
      topic: TopicInfo.fromJson(json['topic']),
    );
  }
}

class TopicInfo {
  final String id;
  final int commentsCount;

  const TopicInfo({
    required this.id,
    required this.commentsCount,
  });

  factory TopicInfo.fromJson(Map<String, dynamic> json) {
    return TopicInfo(
      id: json['id'] as String,
      commentsCount: json['commentsCount'] as int,
    );
  }
}

class CommentsResponse {
  final List<Comment> comments;
  final CommentsPaginationInfo pagination;

  const CommentsResponse({
    required this.comments,
    required this.pagination,
  });

  factory CommentsResponse.fromJson(Map<String, dynamic> json) {
    return CommentsResponse(
      comments: (json['comments'] as List<dynamic>)
          .map((item) => Comment.fromJson(item))
          .toList(),
      pagination: CommentsPaginationInfo.fromJson(json['pagination']),
    );
  }
}

class CommentsPaginationInfo {
  final int total;
  final int limit;

  const CommentsPaginationInfo({
    required this.total,
    required this.limit,
  });

  factory CommentsPaginationInfo.fromJson(Map<String, dynamic> json) {
    return CommentsPaginationInfo(
      total: json['total'] as int,
      limit: json['limit'] as int,
    );
  }
}