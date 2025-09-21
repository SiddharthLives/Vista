import 'package:flutter/foundation.dart';

import '../models/post.dart';
import '../services/posts_api_service.dart';
import '../services/logger_service.dart';

class FeedProvider extends ChangeNotifier {
  final PostsApiService _postsService = PostsApiService();

  List<Post> _posts = [];
  bool _isInitialLoading = false;
  bool _isLoadingMore = false;
  String? _error;
  String? _nextCursor;
  bool _hasMore = true;

  // Getters
  List<Post> get posts => _posts;
  bool get isInitialLoading => _isInitialLoading;
  bool get isLoadingMore => _isLoadingMore;
  String? get error => _error;
  bool get hasMore => _hasMore;

  /// Load initial posts
  Future<void> loadInitialPosts() async {
    if (_isInitialLoading) return;

    _isInitialLoading = true;
    _error = null;
    notifyListeners();

    try {
      final response = await _postsService.getPosts(
        limit: 20,
        visibility: 'public',
      );

      if (response.success && response.data != null) {
        _posts = response.data!.posts;
        _nextCursor = response.data!.pagination.nextCursor;
        _hasMore = response.data!.pagination.hasMore;
        LoggerService.info('Loaded ${_posts.length} initial posts');
      } else {
        _error = response.error?.message ?? 'Failed to load posts';
        LoggerService.error('Failed to load initial posts: $_error');
      }
    } catch (e, stackTrace) {
      _error = 'An unexpected error occurred';
      LoggerService.error('Error loading initial posts', e, stackTrace);
    } finally {
      _isInitialLoading = false;
      notifyListeners();
    }
  }

  /// Refresh posts (pull to refresh)
  Future<void> refreshPosts() async {
    try {
      final response = await _postsService.getPosts(
        limit: 20,
        visibility: 'public',
      );

      if (response.success && response.data != null) {
        _posts = response.data!.posts;
        _nextCursor = response.data!.pagination.nextCursor;
        _hasMore = response.data!.pagination.hasMore;
        _error = null;
        LoggerService.info('Refreshed feed with ${_posts.length} posts');
      } else {
        _error = response.error?.message ?? 'Failed to refresh posts';
        LoggerService.error('Failed to refresh posts: $_error');
      }
    } catch (e, stackTrace) {
      _error = 'An unexpected error occurred while refreshing';
      LoggerService.error('Error refreshing posts', e, stackTrace);
    }
    
    notifyListeners();
  }

  /// Load more posts (infinite scroll)
  Future<bool> loadMorePosts() async {
    if (_isLoadingMore || !_hasMore || _nextCursor == null) {
      return false;
    }

    _isLoadingMore = true;
    notifyListeners();

    try {
      final response = await _postsService.getPosts(
        cursor: _nextCursor,
        limit: 20,
        visibility: 'public',
      );

      if (response.success && response.data != null) {
        _posts.addAll(response.data!.posts);
        _nextCursor = response.data!.pagination.nextCursor;
        _hasMore = response.data!.pagination.hasMore;
        LoggerService.info('Loaded ${response.data!.posts.length} more posts');
        return _hasMore;
      } else {
        _error = response.error?.message ?? 'Failed to load more posts';
        LoggerService.error('Failed to load more posts: $_error');
        return false;
      }
    } catch (e, stackTrace) {
      _error = 'An unexpected error occurred while loading more posts';
      LoggerService.error('Error loading more posts', e, stackTrace);
      return false;
    } finally {
      _isLoadingMore = false;
      notifyListeners();
    }
  }

  /// Like a post
  Future<void> likePost(String postId) async {
    try {
      final response = await _postsService.likePost(postId);

      if (response.success && response.data != null) {
        // Update the post in the local list
        final postIndex = _posts.indexWhere((post) => post.id == postId);
        if (postIndex != -1) {
          final updatedPost = Post(
            id: _posts[postIndex].id,
            authorStudentId: _posts[postIndex].authorStudentId,
            type: _posts[postIndex].type,
            media: _posts[postIndex].media,
            text: _posts[postIndex].text,
            visibility: _posts[postIndex].visibility,
            tags: _posts[postIndex].tags,
            likesCount: response.data!.likesCount,
            commentsCount: _posts[postIndex].commentsCount,
            createdAt: _posts[postIndex].createdAt,
            author: _posts[postIndex].author,
          );
          _posts[postIndex] = updatedPost;
          notifyListeners();
        }
        LoggerService.info('Post liked successfully: $postId');
      } else {
        _error = response.error?.message ?? 'Failed to like post';
        LoggerService.error('Failed to like post: $_error');
        notifyListeners();
      }
    } catch (e, stackTrace) {
      _error = 'An unexpected error occurred while liking post';
      LoggerService.error('Error liking post', e, stackTrace);
      notifyListeners();
    }
  }

  /// Add a new post to the beginning of the feed
  void addNewPost(Post post) {
    _posts.insert(0, post);
    notifyListeners();
    LoggerService.info('New post added to feed: ${post.id}');
  }

  /// Update a post in the feed
  void updatePost(Post updatedPost) {
    final index = _posts.indexWhere((post) => post.id == updatedPost.id);
    if (index != -1) {
      _posts[index] = updatedPost;
      notifyListeners();
      LoggerService.info('Post updated in feed: ${updatedPost.id}');
    }
  }

  /// Remove a post from the feed
  void removePost(String postId) {
    _posts.removeWhere((post) => post.id == postId);
    notifyListeners();
    LoggerService.info('Post removed from feed: $postId');
  }

  /// Clear error
  void clearError() {
    _error = null;
    notifyListeners();
  }

  /// Reset feed state
  void reset() {
    _posts.clear();
    _nextCursor = null;
    _hasMore = true;
    _error = null;
    _isInitialLoading = false;
    _isLoadingMore = false;
    notifyListeners();
    LoggerService.info('Feed provider reset');
  }
}