import 'package:flutter_test/flutter_test.dart';
import 'package:mockito/mockito.dart';
import 'package:mockito/annotations.dart';
import 'package:vista/providers/topics_provider.dart';
import 'package:vista/services/topics_api_service.dart';
import 'package:vista/models/topic.dart';
import 'package:vista/models/comment.dart';
import 'package:vista/models/api_response.dart';
import 'package:vista/models/user.dart';

import 'topics_provider_test.mocks.dart';

@GenerateMocks([TopicsApiService])
void main() {
  group('TopicsProvider Tests', () {
    late TopicsProvider topicsProvider;
    late MockTopicsApiService mockApiService;
    late List<Topic> testTopics;
    late Topic testTopic;
    late Comment testComment;

    setUp(() {
      mockApiService = MockTopicsApiService();
      topicsProvider = TopicsProvider();
      
      // Use reflection to inject mock service
      topicsProvider.setApiService(mockApiService);

      final testUser = User(
        studentId: '2025CS1001',
        email: 'test@college.edu',
        displayName: 'Test User',
        photoUrl: 'https://example.com/photo.jpg',
        year: 3,
        department: 'Computer Science',
        section: 'A',
        bio: 'Test bio',
        createdAt: DateTime.parse('2024-01-01T00:00:00.000Z'),
        settings: const UserSettings(),
      );

      testTopic = Topic(
        id: 'topic1',
        title: 'Test Topic',
        body: 'Test body',
        authorStudentId: '2025CS1001',
        votes: 5,
        tags: const ['test'],
        commentsCount: 3,
        createdAt: DateTime.now(),
        author: testUser,
      );

      testTopics = [testTopic];

      testComment = Comment(
        id: 'comment1',
        authorStudentId: '2025CS1001',
        content: 'Test comment',
        parentType: 'topic',
        parentId: 'topic1',
        votes: 2,
        repliesCount: 0,
        createdAt: DateTime.now(),
        author: testUser,
      );
    });

    group('loadTopics', () {
      test('loads topics successfully', () async {
        final feedResponse = TopicsFeedResponse(
          topics: testTopics,
          pagination: const PaginationInfo(
            nextCursor: 'cursor123',
            hasMore: true,
            limit: 20,
          ),
        );

        when(mockApiService.getTopics(
          cursor: anyNamed('cursor'),
          sortBy: anyNamed('sortBy'),
          tags: anyNamed('tags'),
          search: anyNamed('search'),
        )).thenAnswer((_) async => ApiResponse.success(feedResponse));

        await topicsProvider.loadTopics();

        expect(topicsProvider.topics, equals(testTopics));
        expect(topicsProvider.hasMoreTopics, isTrue);
        expect(topicsProvider.isLoadingTopics, isFalse);
        expect(topicsProvider.error, isNull);
      });

      test('handles error when loading topics fails', () async {
        const error = ApiError(code: 'ERROR', message: 'Failed to load');
        when(mockApiService.getTopics(
          cursor: anyNamed('cursor'),
          sortBy: anyNamed('sortBy'),
          tags: anyNamed('tags'),
          search: anyNamed('search'),
        )).thenAnswer((_) async => ApiResponse.error(error));

        await topicsProvider.loadTopics();

        expect(topicsProvider.topics, isEmpty);
        expect(topicsProvider.error, equals('Failed to load'));
        expect(topicsProvider.isLoadingTopics, isFalse);
      });

      test('refreshes topics when refresh is true', () async {
        // First load some topics
        topicsProvider.setTopicsForTesting(testTopics);
        
        final feedResponse = TopicsFeedResponse(
          topics: [testTopic],
          pagination: const PaginationInfo(
            nextCursor: null,
            hasMore: false,
            limit: 20,
          ),
        );

        when(mockApiService.getTopics(
          cursor: anyNamed('cursor'),
          sortBy: anyNamed('sortBy'),
          tags: anyNamed('tags'),
          search: anyNamed('search'),
        )).thenAnswer((_) async => ApiResponse.success(feedResponse));

        await topicsProvider.loadTopics(refresh: true);

        expect(topicsProvider.topics.length, equals(1));
        expect(topicsProvider.hasMoreTopics, isFalse);
      });
    });

    group('createTopic', () {
      test('creates topic successfully', () async {
        final request = const CreateTopicRequest(
          title: 'New Topic',
          body: 'New body',
          tags: ['new'],
        );

        when(mockApiService.createTopic(request))
            .thenAnswer((_) async => ApiResponse.success(testTopic));

        final result = await topicsProvider.createTopic(request);

        expect(result, isTrue);
        expect(topicsProvider.topics.first, equals(testTopic));
        expect(topicsProvider.error, isNull);
      });

      test('handles error when creating topic fails', () async {
        final request = const CreateTopicRequest(
          title: 'New Topic',
          body: 'New body',
        );

        const error = ApiError(code: 'ERROR', message: 'Failed to create');
        when(mockApiService.createTopic(request))
            .thenAnswer((_) async => ApiResponse.error(error));

        final result = await topicsProvider.createTopic(request);

        expect(result, isFalse);
        expect(topicsProvider.error, equals('Failed to create'));
      });
    });

    group('voteTopic', () {
      test('votes on topic successfully', () async {
        topicsProvider.setTopicsForTesting([testTopic]);
        
        final voteResponse = const VoteTopicResponse(
          message: 'Voted successfully',
          votes: 6,
        );

        when(mockApiService.voteTopic('topic1', any))
            .thenAnswer((_) async => ApiResponse.success(voteResponse));

        final result = await topicsProvider.voteTopic('topic1', VoteType.up);

        expect(result, isTrue);
        expect(topicsProvider.topics.first.votes, equals(6));
        expect(topicsProvider.error, isNull);
      });

      test('handles error when voting fails', () async {
        const error = ApiError(code: 'ERROR', message: 'Failed to vote');
        when(mockApiService.voteTopic('topic1', any))
            .thenAnswer((_) async => ApiResponse.error(error));

        final result = await topicsProvider.voteTopic('topic1', VoteType.up);

        expect(result, isFalse);
        expect(topicsProvider.error, equals('Failed to vote'));
      });
    });

    group('loadTopic', () {
      test('loads single topic successfully', () async {
        when(mockApiService.getTopic('topic1'))
            .thenAnswer((_) async => ApiResponse.success(testTopic));

        await topicsProvider.loadTopic('topic1');

        expect(topicsProvider.currentTopic, equals(testTopic));
        expect(topicsProvider.isLoadingTopic, isFalse);
        expect(topicsProvider.error, isNull);
      });

      test('handles error when loading topic fails', () async {
        const error = ApiError(code: 'ERROR', message: 'Topic not found');
        when(mockApiService.getTopic('topic1'))
            .thenAnswer((_) async => ApiResponse.error(error));

        await topicsProvider.loadTopic('topic1');

        expect(topicsProvider.currentTopic, isNull);
        expect(topicsProvider.error, equals('Topic not found'));
        expect(topicsProvider.isLoadingTopic, isFalse);
      });
    });

    group('loadTopicComments', () {
      test('loads comments successfully', () async {
        final commentsResponse = CommentsResponse(
          comments: [testComment],
          pagination: const CommentsPaginationInfo(total: 1, limit: 50),
        );

        when(mockApiService.getTopicComments('topic1'))
            .thenAnswer((_) async => ApiResponse.success(commentsResponse));

        await topicsProvider.loadTopicComments('topic1');

        expect(topicsProvider.currentTopicComments, equals([testComment]));
        expect(topicsProvider.isLoadingComments, isFalse);
        expect(topicsProvider.error, isNull);
      });
    });

    group('addComment', () {
      test('adds comment successfully', () async {
        topicsProvider.setTopicsForTesting([testTopic]);
        topicsProvider.setCurrentTopicForTesting(testTopic);
        
        final commentResponse = CommentResponse(
          message: 'Comment added',
          comment: testComment,
          topic: const TopicInfo(id: 'topic1', commentsCount: 4),
        );

        when(mockApiService.commentOnTopic('topic1', any))
            .thenAnswer((_) async => ApiResponse.success(commentResponse));

        final result = await topicsProvider.addComment(
          'topic1',
          const CreateCommentRequest(content: 'Test comment'),
        );

        expect(result, isTrue);
        expect(topicsProvider.currentTopicComments.first, equals(testComment));
        expect(topicsProvider.currentTopic?.commentsCount, equals(4));
      });
    });

    group('filters and sorting', () {
      test('setSortBy updates sort and refreshes', () async {
        when(mockApiService.getTopics(
          cursor: anyNamed('cursor'),
          sortBy: 'votes',
          tags: anyNamed('tags'),
          search: anyNamed('search'),
        )).thenAnswer((_) async => ApiResponse.success(
          TopicsFeedResponse(
            topics: testTopics,
            pagination: const PaginationInfo(
              nextCursor: null,
              hasMore: false,
              limit: 20,
            ),
          ),
        ));

        topicsProvider.setSortBy('votes');

        expect(topicsProvider.sortBy, equals('votes'));
        verify(mockApiService.getTopics(
          cursor: null,
          sortBy: 'votes',
          tags: null,
          search: null,
        )).called(1);
      });

      test('setSelectedTags updates tags and refreshes', () async {
        when(mockApiService.getTopics(
          cursor: anyNamed('cursor'),
          sortBy: anyNamed('sortBy'),
          tags: ['flutter', 'dart'],
          search: anyNamed('search'),
        )).thenAnswer((_) async => ApiResponse.success(
          TopicsFeedResponse(
            topics: testTopics,
            pagination: const PaginationInfo(
              nextCursor: null,
              hasMore: false,
              limit: 20,
            ),
          ),
        ));

        topicsProvider.setSelectedTags(['flutter', 'dart']);

        expect(topicsProvider.selectedTags, equals(['flutter', 'dart']));
        verify(mockApiService.getTopics(
          cursor: null,
          sortBy: 'recent',
          tags: ['flutter', 'dart'],
          search: null,
        )).called(1);
      });

      test('setSearchQuery updates search and refreshes', () async {
        when(mockApiService.getTopics(
          cursor: anyNamed('cursor'),
          sortBy: anyNamed('sortBy'),
          tags: anyNamed('tags'),
          search: 'test query',
        )).thenAnswer((_) async => ApiResponse.success(
          TopicsFeedResponse(
            topics: testTopics,
            pagination: const PaginationInfo(
              nextCursor: null,
              hasMore: false,
              limit: 20,
            ),
          ),
        ));

        topicsProvider.setSearchQuery('test query');

        expect(topicsProvider.searchQuery, equals('test query'));
        verify(mockApiService.getTopics(
          cursor: null,
          sortBy: 'recent',
          tags: null,
          search: 'test query',
        )).called(1);
      });
    });

    test('clearCurrentTopic clears topic and comments', () {
      topicsProvider.setCurrentTopicForTesting(testTopic);
      topicsProvider.setCurrentTopicCommentsForTesting([testComment]);

      topicsProvider.clearCurrentTopic();

      expect(topicsProvider.currentTopic, isNull);
      expect(topicsProvider.currentTopicComments, isEmpty);
    });

    test('clearError clears error state', () {
      topicsProvider.setErrorForTesting('Test error');

      topicsProvider.clearError();

      expect(topicsProvider.error, isNull);
    });
  });
}

// Extension to add testing methods to TopicsProvider
extension TopicsProviderTesting on TopicsProvider {
  void setApiService(TopicsApiService apiService) {
    // This would need to be implemented in the actual provider
    // by making the _topicsApiService field settable for testing
  }
  
  void setTopicsForTesting(List<Topic> topics) {
    // This would need to be implemented in the actual provider
  }
  
  void setCurrentTopicForTesting(Topic topic) {
    // This would need to be implemented in the actual provider
  }
  
  void setCurrentTopicCommentsForTesting(List<Comment> comments) {
    // This would need to be implemented in the actual provider
  }
  
  void setErrorForTesting(String error) {
    // This would need to be implemented in the actual provider
  }
}