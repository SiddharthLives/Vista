// Example usage of the API client services
// This file demonstrates how to use the various API services

import 'dart:io';
import '../services/api_client.dart';
import '../models/post.dart';
import '../models/story.dart';
import '../models/topic.dart';
import '../models/comment.dart';

class ApiClientUsageExamples {
  final ApiClient _apiClient = ApiClient();

  /// Initialize the API client
  Future<void> initializeClient() async {
    await _apiClient.initialize();
  }

  /// Authentication examples
  Future<void> authenticationExamples() async {
    // Sign in with Google
    final signInResult = await _apiClient.auth.signInWithGoogle();
    if (signInResult.success) {
      print('Sign-in successful: ${signInResult.data?.displayName}');
      
      // Set JWT token for API requests
      final token = await _apiClient.auth.getJwtToken();
      _apiClient.setJwtToken(token);
    } else {
      print('Sign-in failed: ${signInResult.error?.message}');
    }

    // Link student ID
    final linkResult = await _apiClient.auth.linkStudentId('2024CS001');
    if (linkResult.success) {
      print('Student ID linked successfully');
    }

    // Check authentication status
    final isAuthenticated = await _apiClient.isAuthenticated();
    print('Is authenticated: $isAuthenticated');

    // Get current user
    final currentUser = await _apiClient.getCurrentUser();
    if (currentUser != null) {
      print('Current user: ${currentUser.displayName}');
    }
  }

  /// Posts API examples
  Future<void> postsExamples() async {
    // Get posts feed
    final feedResult = await _apiClient.posts.getPosts(
      limit: 20,
      visibility: 'public',
      tags: ['campus', 'events'],
    );

    if (feedResult.success) {
      final posts = feedResult.data!.posts;
      print('Loaded ${posts.length} posts');
      
      for (final post in posts) {
        print('Post: ${post.text} by ${post.author?.displayName}');
      }

      // Load more posts with pagination
      final pagination = feedResult.data!.pagination;
      if (pagination.hasMore && pagination.nextCursor != null) {
        final nextPageResult = await _apiClient.posts.getPosts(
          cursor: pagination.nextCursor,
          limit: 20,
        );
        
        if (nextPageResult.success) {
          print('Loaded ${nextPageResult.data!.posts.length} more posts');
        }
      }
    }

    // Create a text post
    final createPostRequest = CreatePostRequest(
      type: PostType.text,
      text: 'Hello from the Flutter app! 🚀',
      visibility: PostVisibility.public,
      tags: ['flutter', 'mobile'],
    );

    final createResult = await _apiClient.posts.createPost(createPostRequest);
    if (createResult.success) {
      final newPost = createResult.data!;
      print('Created post: ${newPost.id}');

      // Like the post
      final likeResult = await _apiClient.posts.likePost(newPost.id);
      if (likeResult.success) {
        print('Post liked! New count: ${likeResult.data!.likesCount}');
      }

      // Add a comment
      final commentRequest = CreateCommentRequest(
        content: 'Great post! 👍',
      );

      final commentResult = await _apiClient.posts.commentOnPost(
        newPost.id,
        commentRequest,
      );

      if (commentResult.success) {
        print('Comment added: ${commentResult.data!.comment.content}');
      }
    }

    // Get specific post
    final postResult = await _apiClient.posts.getPost('post-id-here');
    if (postResult.success) {
      final post = postResult.data!;
      print('Post details: ${post.text}');

      // Get comments for the post
      final commentsResult = await _apiClient.posts.getPostComments(
        post.id,
        limit: 10,
        sortBy: 'newest',
      );

      if (commentsResult.success) {
        final comments = commentsResult.data!.comments;
        print('Post has ${comments.length} comments');
      }
    }
  }

  /// Stories API examples
  Future<void> storiesExamples() async {
    // Get stories feed
    final storiesResult = await _apiClient.stories.getStories(
      limit: 20,
      year: 3, // Third year students
      department: 'CS',
    );

    if (storiesResult.success) {
      final stories = storiesResult.data!.stories;
      print('Loaded ${stories.length} stories');

      for (final story in stories) {
        print('Story by ${story.author?.displayName}: ${story.media.url}');
        
        if (!story.isExpired) {
          // View the story
          final viewResult = await _apiClient.stories.viewStory(story.id);
          if (viewResult.success) {
            print('Story viewed! Total views: ${viewResult.data!.viewsCount}');
          }
        }
      }
    }

    // Create a story (after uploading media)
    // This would typically be done after media upload
    /*
    final createStoryRequest = CreateStoryRequest(
      media: StoryMedia(
        url: 'https://cloudinary-url.com/image.jpg',
        cloudinaryPublicId: 'college/2024-CS/dept-CS/section-A/student-2024CS001/story123',
        type: StoryMediaType.image,
        width: 1080,
        height: 1920,
      ),
    );

    final createResult = await _apiClient.stories.createStory(createStoryRequest);
    if (createResult.success) {
      print('Story created: ${createResult.data!.id}');
    }
    */
  }

  /// Topics API examples
  Future<void> topicsExamples() async {
    // Get topics feed
    final topicsResult = await _apiClient.topics.getTopics(
      limit: 20,
      sortBy: 'popular',
      tags: ['academics', 'campus-life'],
    );

    if (topicsResult.success) {
      final topics = topicsResult.data!.topics;
      print('Loaded ${topics.length} topics');

      for (final topic in topics) {
        print('Topic: ${topic.title} (${topic.votes} votes)');
      }
    }

    // Create a new topic
    final createTopicRequest = CreateTopicRequest(
      title: 'Best study spots on campus?',
      body: 'Looking for quiet places to study. Any recommendations?',
      tags: ['study', 'campus', 'recommendations'],
    );

    final createResult = await _apiClient.topics.createTopic(createTopicRequest);
    if (createResult.success) {
      final newTopic = createResult.data!;
      print('Created topic: ${newTopic.id}');

      // Vote on the topic
      final voteRequest = VoteTopicRequest(voteType: VoteType.up);
      final voteResult = await _apiClient.topics.voteTopic(newTopic.id, voteRequest);
      
      if (voteResult.success) {
        print('Voted! New vote count: ${voteResult.data!.votes}');
      }

      // Add a comment
      final commentRequest = CreateCommentRequest(
        content: 'The library on the 3rd floor is great!',
      );

      final commentResult = await _apiClient.topics.commentOnTopic(
        newTopic.id,
        commentRequest,
      );

      if (commentResult.success) {
        print('Comment added to topic');
      }
    }
  }

  /// Users API examples
  Future<void> usersExamples() async {
    // Get current user profile
    final currentUserResult = await _apiClient.users.getCurrentUserProfile();
    if (currentUserResult.success) {
      final user = currentUserResult.data!;
      print('Current user: ${user.displayName} (${user.studentId})');
    }

    // Search for users
    final searchResult = await _apiClient.users.searchUsers(
      search: 'john',
      year: 3,
      department: 'CS',
      limit: 10,
    );

    if (searchResult.success) {
      final users = searchResult.data!.users;
      print('Found ${users.length} users');

      for (final user in users) {
        print('User: ${user.displayName} (${user.year}${user.department})');
        
        // Get user profile
        final profileResult = await _apiClient.users.getUserProfile(user.studentId);
        if (profileResult.success) {
          final profile = profileResult.data!;
          print('Profile: ${profile.bio ?? "No bio"}');
        }
      }
    }

    // Update current user profile
    final updateRequest = UpdateUserProfileRequest(
      displayName: 'Updated Name',
      bio: 'Computer Science student passionate about mobile development',
    );

    final updateResult = await _apiClient.users.updateUserProfile(
      'current-user-id',
      updateRequest,
    );

    if (updateResult.success) {
      print('Profile updated successfully');
    }
  }

  /// Media upload examples
  Future<void> mediaExamples() async {
    // Example file upload
    final file = File('/path/to/image.jpg');
    
    // Validate file before upload
    final validationResult = await _apiClient.media.validateFile(file);
    if (!validationResult.success) {
      print('File validation failed: ${validationResult.error?.message}');
      return;
    }

    // Upload file with progress tracking
    final uploadResult = await _apiClient.media.uploadFile(
      file,
      '2024CS001', // Student ID
      onProgress: (progress) {
        print('Upload progress: ${(progress * 100).toStringAsFixed(1)}%');
      },
    );

    if (uploadResult.success) {
      final uploadResponse = uploadResult.data!;
      print('Upload successful!');
      print('Public ID: ${uploadResponse.publicId}');
      print('URL: ${uploadResponse.secureUrl}');
      print('Size: ${uploadResponse.width}x${uploadResponse.height}');

      // Use uploaded media in a post
      final mediaItem = MediaItem(
        url: uploadResponse.secureUrl,
        cloudinaryPublicId: uploadResponse.publicId,
        width: uploadResponse.width,
        height: uploadResponse.height,
      );

      final createPostRequest = CreatePostRequest(
        type: PostType.image,
        text: 'Check out this photo!',
        media: [mediaItem],
        visibility: PostVisibility.public,
      );

      final postResult = await _apiClient.posts.createPost(createPostRequest);
      if (postResult.success) {
        print('Post with media created successfully!');
      }
    } else {
      print('Upload failed: ${uploadResult.error?.message}');
    }
  }

  /// Notifications examples
  Future<void> notificationsExamples() async {
    // Get notifications
    final notificationsResult = await _apiClient.notifications.getNotifications(
      limit: 20,
      unreadOnly: true,
    );

    if (notificationsResult.success) {
      final notifications = notificationsResult.data!.notifications;
      print('You have ${notifications.length} unread notifications');

      for (final notification in notifications) {
        print('${notification.type.name}: ${notification.meta.fromStudentId}');
        
        // Mark as read
        final markReadResult = await _apiClient.notifications
            .markNotificationAsRead(notification.id);
        
        if (markReadResult.success) {
          print('Notification marked as read');
        }
      }
    }

    // Get notification count
    final countResult = await _apiClient.notifications.getNotificationCount();
    if (countResult.success) {
      final count = countResult.data!;
      print('Unread: ${count.unreadCount}, Total: ${count.totalCount}');
    }

    // Mark all as read
    final markAllResult = await _apiClient.notifications.markAllNotificationsAsRead();
    if (markAllResult.success) {
      print('All notifications marked as read');
    }
  }

  /// Chat examples
  Future<void> chatExamples() async {
    // Get conversations
    final conversationsResult = await _apiClient.chat.getConversations(limit: 20);
    
    if (conversationsResult.success) {
      final conversations = conversationsResult.data!.conversations;
      print('You have ${conversations.length} conversations');

      for (final conv in conversations) {
        print('Conversation with: ${conv.participants.join(", ")}');
        
        // Get messages for conversation
        final messagesResult = await _apiClient.chat.getMessages(
          conv.conversation.id,
          limit: 50,
        );

        if (messagesResult.success) {
          final messages = messagesResult.data!.messages;
          print('${messages.length} messages in conversation');
        }
      }
    }

    // Create or get conversation with another user
    final conversationResult = await _apiClient.chat
        .createOrGetConversation('2024CS002');
    
    if (conversationResult.success) {
      final conversation = conversationResult.data!;
      print('Conversation ready: ${conversation.id}');

      // Send a message
      final sendMessageRequest = SendMessageRequest(
        text: 'Hello! How are you doing?',
      );

      final sendResult = await _apiClient.chat.sendMessage(
        conversation.id,
        sendMessageRequest,
      );

      if (sendResult.success) {
        print('Message sent successfully');
      }
    }
  }

  /// Error handling examples
  Future<void> errorHandlingExamples() async {
    // Example of handling different types of errors
    final result = await _apiClient.posts.getPosts();
    
    if (!result.success && result.error != null) {
      final error = result.error!;
      
      switch (error.code) {
        case 'NETWORK_ERROR':
          print('Network error: Check your internet connection');
          break;
        case 'NO_AUTH_TOKEN':
          print('Authentication required: Please sign in');
          // Redirect to sign-in screen
          break;
        case 'INVALID_EMAIL_DOMAIN':
          print('Access denied: College email required');
          break;
        case 'RATE_LIMIT_EXCEEDED':
          print('Too many requests: Please wait and try again');
          break;
        default:
          print('Error: ${error.message}');
          if (error.details != null) {
            print('Details: ${error.details}');
          }
      }
    }
  }

  /// Cleanup resources
  void dispose() {
    _apiClient.dispose();
  }
}