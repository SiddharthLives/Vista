import '../models/api_response.dart';
import '../models/post.dart';
import '../models/comment.dart';
import '../models/user.dart';
import '../services/api_service.dart';
import '../services/logger_service.dart';

class PostsApiService {
  static final PostsApiService _instance = PostsApiService._internal();
  factory PostsApiService() => _instance;
  PostsApiService._internal();

  final ApiService _apiService = ApiService();

  /// Get posts feed with pagination and filtering
  Future<ApiResponse<PostsFeedResponse>> getPosts({
    String? cursor,
    int limit = 20,
    String visibility = 'public',
    String? authorStudentId,
    List<String>? tags,
    String? search,
  }) async {
    try {
      final queryParams = <String, String>{
        'limit': limit.toString(),
        'visibility': visibility,
      };

      if (cursor != null) queryParams['cursor'] = cursor;
      if (authorStudentId != null) queryParams['authorStudentId'] = authorStudentId;
      if (tags != null && tags.isNotEmpty) queryParams['tags'] = tags.join(',');
      if (search != null && search.isNotEmpty) queryParams['search'] = search;

      final response = await _apiService.getPublic('/posts', queryParams: queryParams);

      if (response.success && response.data != null) {
        final feedResponse = PostsFeedResponse.fromJson(response.data!);
        return ApiResponse.success(feedResponse);
      } else {
        return ApiResponse.error(response.error!);
      }
    } catch (e, stackTrace) {
      LoggerService.error('Error getting posts feed', e, stackTrace);
      return ApiResponse.error(
        const ApiError(
          code: 'GET_POSTS_ERROR',
          message: 'Failed to get posts feed',
        ),
      );
    }
  }

  /// Create a new post
  Future<ApiResponse<Post>> createPost(CreatePostRequest request) async {
    try {
      final response = await _apiService.post('/posts', request.toJson());

      if (response.success && response.data != null) {
        final post = Post.fromJson(response.data!['post']);
        return ApiResponse.success(post, response.data!['message']);
      } else {
        return ApiResponse.error(response.error!);
      }
    } catch (e, stackTrace) {
      LoggerService.error('Error creating post', e, stackTrace);
      return ApiResponse.error(
        const ApiError(
          code: 'CREATE_POST_ERROR',
          message: 'Failed to create post',
        ),
      );
    }
  }

  /// Get a specific post by ID
  Future<ApiResponse<Post>> getPost(String postId) async {
    try {
      final response = await _apiService.getPublic('/posts/$postId');

      if (response.success && response.data != null) {
        final post = Post.fromJson(response.data!['post']);
        return ApiResponse.success(post);
      } else {
        return ApiResponse.error(response.error!);
      }
    } catch (e, stackTrace) {
      LoggerService.error('Error getting post', e, stackTrace);
      return ApiResponse.error(
        const ApiError(
          code: 'GET_POST_ERROR',
          message: 'Failed to get post',
        ),
      );
    }
  }

  /// Like or unlike a post
  Future<ApiResponse<LikePostResponse>> likePost(String postId) async {
    try {
      final response = await _apiService.post('/posts/$postId/like', {});

      if (response.success && response.data != null) {
        final likeResponse = LikePostResponse.fromJson(response.data!);
        return ApiResponse.success(likeResponse);
      } else {
        return ApiResponse.error(response.error!);
      }
    } catch (e, stackTrace) {
      LoggerService.error('Error liking post', e, stackTrace);
      return ApiResponse.error(
        const ApiError(
          code: 'LIKE_POST_ERROR',
          message: 'Failed to like post',
        ),
      );
    }
  }

  /// Add a comment to a post
  Future<ApiResponse<CommentResponse>> commentOnPost(
    String postId,
    CreateCommentRequest request,
  ) async {
    try {
      final response = await _apiService.post('/posts/$postId/comment', request.toJson());

      if (response.success && response.data != null) {
        final commentResponse = CommentResponse.fromJson(response.data!);
        return ApiResponse.success(commentResponse);
      } else {
        return ApiResponse.error(response.error!);
      }
    } catch (e, stackTrace) {
      LoggerService.error('Error commenting on post', e, stackTrace);
      return ApiResponse.error(
        const ApiError(
          code: 'COMMENT_POST_ERROR',
          message: 'Failed to comment on post',
        ),
      );
    }
  }

  /// Get comments for a post
  Future<ApiResponse<CommentsResponse>> getPostComments(
    String postId, {
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
        '/posts/$postId/comments',
        queryParams: queryParams,
      );

      if (response.success && response.data != null) {
        final commentsResponse = CommentsResponse.fromJson(response.data!);
        return ApiResponse.success(commentsResponse);
      } else {
        return ApiResponse.error(response.error!);
      }
    } catch (e, stackTrace) {
      LoggerService.error('Error getting post comments', e, stackTrace);
      return ApiResponse.error(
        const ApiError(
          code: 'GET_COMMENTS_ERROR',
          message: 'Failed to get post comments',
        ),
      );
    }
  }
}

class PostsFeedResponse {
  final List<Post> posts;
  final PaginationInfo pagination;

  const PostsFeedResponse({
    required this.posts,
    required this.pagination,
  });

  factory PostsFeedResponse.fromJson(Map<String, dynamic> json) {
    return PostsFeedResponse(
      posts: (json['posts'] as List<dynamic>)
          .map((item) => Post.fromJson(item))
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

class LikePostResponse {
  final String message;
  final int likesCount;

  const LikePostResponse({
    required this.message,
    required this.likesCount,
  });

  factory LikePostResponse.fromJson(Map<String, dynamic> json) {
    return LikePostResponse(
      message: json['message'] as String,
      likesCount: json['likesCount'] as int,
    );
  }
}

class CommentResponse {
  final String message;
  final Comment comment;
  final PostInfo post;

  const CommentResponse({
    required this.message,
    required this.comment,
    required this.post,
  });

  factory CommentResponse.fromJson(Map<String, dynamic> json) {
    return CommentResponse(
      message: json['message'] as String,
      comment: Comment.fromJson(json['comment']),
      post: PostInfo.fromJson(json['post']),
    );
  }
}

class PostInfo {
  final String id;
  final int commentsCount;

  const PostInfo({
    required this.id,
    required this.commentsCount,
  });

  factory PostInfo.fromJson(Map<String, dynamic> json) {
    return PostInfo(
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