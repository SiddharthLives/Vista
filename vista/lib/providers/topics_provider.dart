import 'package:flutter/foundation.dart';
import '../models/topic.dart';
import '../models/comment.dart';
import '../services/topics_api_service.dart';
import '../services/logger_service.dart';

class TopicsProvider extends ChangeNotifier {
  final TopicsApiService _topicsApiService = TopicsApiService();

  // Topics list state
  List<Topic> _topics = [];
  bool _isLoadingTopics = false;
  bool _hasMoreTopics = true;
  String? _nextCursor;
  String? _error;

  // Current topic state
  Topic? _currentTopic;
  List<Comment> _currentTopicComments = [];
  bool _isLoadingTopic = false;
  bool _isLoadingComments = false;

  // Filters
  String _sortBy = 'recent';
  List<String> _selectedTags = [];
  String _searchQuery = '';

  // Getters
  List<Topic> get topics => _topics;
  bool get isLoadingTopics => _isLoadingTopics;
  bool get hasMoreTopics => _hasMoreTopics;
  String? get error => _error;

  Topic? get currentTopic => _currentTopic;
  List<Comment> get currentTopicComments => _currentTopicComments;
  bool get isLoadingTopic => _isLoadingTopic;
  bool get isLoadingComments => _isLoadingComments;

  String get sortBy => _sortBy;
  List<String> get selectedTags => _selectedTags;
  String get searchQuery => _searchQuery;

  /// Load topics with current filters
  Future<void> loadTopics({bool refresh = false}) async {
    if (_isLoadingTopics) return;

    if (refresh) {
      _topics.clear();
      _nextCursor = null;
      _hasMoreTopics = true;
      _error = null;
    }

    if (!_hasMoreTopics) return;

    _isLoadingTopics = true;
    _error = null;
    notifyListeners();

    try {
      final response = await _topicsApiService.getTopics(
        cursor: _nextCursor,
        sortBy: _sortBy,
        tags: _selectedTags.isNotEmpty ? _selectedTags : null,
        search: _searchQuery.isNotEmpty ? _searchQuery : null,
      );

      if (response.success && response.data != null) {
        final feedResponse = response.data!;
        
        if (refresh) {
          _topics = feedResponse.topics;
        } else {
          _topics.addAll(feedResponse.topics);
        }
        
        _nextCursor = feedResponse.pagination.nextCursor;
        _hasMoreTopics = feedResponse.pagination.hasMore;
      } else {
        _error = response.error?.message ?? 'Failed to load topics';
        LoggerService.error('Failed to load topics', response.error);
      }
    } catch (e, stackTrace) {
      _error = 'Failed to load topics';
      LoggerService.error('Error loading topics', e, stackTrace);
    } finally {
      _isLoadingTopics = false;
      notifyListeners();
    }
  }

  /// Create a new topic
  Future<bool> createTopic(CreateTopicRequest request) async {
    try {
      final response = await _topicsApiService.createTopic(request);

      if (response.success && response.data != null) {
        // Add the new topic to the beginning of the list
        _topics.insert(0, response.data!);
        notifyListeners();
        return true;
      } else {
        _error = response.error?.message ?? 'Failed to create topic';
        LoggerService.error('Failed to create topic', response.error);
        notifyListeners();
        return false;
      }
    } catch (e, stackTrace) {
      _error = 'Failed to create topic';
      LoggerService.error('Error creating topic', e, stackTrace);
      notifyListeners();
      return false;
    }
  }

  /// Load a specific topic
  Future<void> loadTopic(String topicId) async {
    if (_isLoadingTopic) return;

    _isLoadingTopic = true;
    _error = null;
    notifyListeners();

    try {
      final response = await _topicsApiService.getTopic(topicId);

      if (response.success && response.data != null) {
        _currentTopic = response.data!;
      } else {
        _error = response.error?.message ?? 'Failed to load topic';
        LoggerService.error('Failed to load topic', response.error);
      }
    } catch (e, stackTrace) {
      _error = 'Failed to load topic';
      LoggerService.error('Error loading topic', e, stackTrace);
    } finally {
      _isLoadingTopic = false;
      notifyListeners();
    }
  }

  /// Vote on a topic
  Future<bool> voteTopic(String topicId, VoteType voteType) async {
    try {
      final request = VoteTopicRequest(voteType: voteType);
      final response = await _topicsApiService.voteTopic(topicId, request);

      if (response.success && response.data != null) {
        final newVotes = response.data!.votes;
        
        // Update the topic in the list
        final topicIndex = _topics.indexWhere((topic) => topic.id == topicId);
        if (topicIndex != -1) {
          _topics[topicIndex] = Topic(
            id: _topics[topicIndex].id,
            title: _topics[topicIndex].title,
            body: _topics[topicIndex].body,
            authorStudentId: _topics[topicIndex].authorStudentId,
            votes: newVotes,
            tags: _topics[topicIndex].tags,
            commentsCount: _topics[topicIndex].commentsCount,
            createdAt: _topics[topicIndex].createdAt,
            author: _topics[topicIndex].author,
          );
        }

        // Update current topic if it's the same
        if (_currentTopic?.id == topicId) {
          _currentTopic = Topic(
            id: _currentTopic!.id,
            title: _currentTopic!.title,
            body: _currentTopic!.body,
            authorStudentId: _currentTopic!.authorStudentId,
            votes: newVotes,
            tags: _currentTopic!.tags,
            commentsCount: _currentTopic!.commentsCount,
            createdAt: _currentTopic!.createdAt,
            author: _currentTopic!.author,
          );
        }

        notifyListeners();
        return true;
      } else {
        _error = response.error?.message ?? 'Failed to vote on topic';
        LoggerService.error('Failed to vote on topic', response.error);
        notifyListeners();
        return false;
      }
    } catch (e, stackTrace) {
      _error = 'Failed to vote on topic';
      LoggerService.error('Error voting on topic', e, stackTrace);
      notifyListeners();
      return false;
    }
  }

  /// Load comments for current topic
  Future<void> loadTopicComments(String topicId) async {
    if (_isLoadingComments) return;

    _isLoadingComments = true;
    _error = null;
    notifyListeners();

    try {
      final response = await _topicsApiService.getTopicComments(topicId);

      if (response.success && response.data != null) {
        _currentTopicComments = response.data!.comments;
      } else {
        _error = response.error?.message ?? 'Failed to load comments';
        LoggerService.error('Failed to load comments', response.error);
      }
    } catch (e, stackTrace) {
      _error = 'Failed to load comments';
      LoggerService.error('Error loading comments', e, stackTrace);
    } finally {
      _isLoadingComments = false;
      notifyListeners();
    }
  }

  /// Add comment to current topic
  Future<bool> addComment(String topicId, CreateCommentRequest request) async {
    try {
      final response = await _topicsApiService.commentOnTopic(topicId, request);

      if (response.success && response.data != null) {
        // Add the new comment to the list
        _currentTopicComments.insert(0, response.data!.comment);
        
        // Update the topic's comment count
        final topicIndex = _topics.indexWhere((topic) => topic.id == topicId);
        if (topicIndex != -1) {
          _topics[topicIndex] = Topic(
            id: _topics[topicIndex].id,
            title: _topics[topicIndex].title,
            body: _topics[topicIndex].body,
            authorStudentId: _topics[topicIndex].authorStudentId,
            votes: _topics[topicIndex].votes,
            tags: _topics[topicIndex].tags,
            commentsCount: response.data!.topic.commentsCount,
            createdAt: _topics[topicIndex].createdAt,
            author: _topics[topicIndex].author,
          );
        }

        // Update current topic if it's the same
        if (_currentTopic?.id == topicId) {
          _currentTopic = Topic(
            id: _currentTopic!.id,
            title: _currentTopic!.title,
            body: _currentTopic!.body,
            authorStudentId: _currentTopic!.authorStudentId,
            votes: _currentTopic!.votes,
            tags: _currentTopic!.tags,
            commentsCount: response.data!.topic.commentsCount,
            createdAt: _currentTopic!.createdAt,
            author: _currentTopic!.author,
          );
        }

        notifyListeners();
        return true;
      } else {
        _error = response.error?.message ?? 'Failed to add comment';
        LoggerService.error('Failed to add comment', response.error);
        notifyListeners();
        return false;
      }
    } catch (e, stackTrace) {
      _error = 'Failed to add comment';
      LoggerService.error('Error adding comment', e, stackTrace);
      notifyListeners();
      return false;
    }
  }

  /// Update sort order
  void setSortBy(String sortBy) {
    if (_sortBy != sortBy) {
      _sortBy = sortBy;
      loadTopics(refresh: true);
    }
  }

  /// Update selected tags filter
  void setSelectedTags(List<String> tags) {
    _selectedTags = tags;
    loadTopics(refresh: true);
  }

  /// Update search query
  void setSearchQuery(String query) {
    _searchQuery = query;
    loadTopics(refresh: true);
  }

  /// Clear current topic and comments
  void clearCurrentTopic() {
    _currentTopic = null;
    _currentTopicComments.clear();
    notifyListeners();
  }

  /// Clear error
  void clearError() {
    _error = null;
    notifyListeners();
  }
}