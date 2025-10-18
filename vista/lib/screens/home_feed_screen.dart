import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:pull_to_refresh/pull_to_refresh.dart';

import '../providers/auth_provider.dart';
import '../providers/feed_provider.dart';
import '../providers/stories_provider.dart';
import '../widgets/post_widget.dart';
import '../widgets/post_composer.dart';
import '../widgets/stories_carousel.dart';
import '../widgets/loading_widget.dart';
import '../widgets/error_widget.dart';
import '../widgets/notification_badge.dart';
import '../models/post.dart';

class HomeFeedScreen extends StatefulWidget {
  final bool showAppBar;
  
  const HomeFeedScreen({super.key, this.showAppBar = true});

  @override
  State<HomeFeedScreen> createState() => _HomeFeedScreenState();
}

class _HomeFeedScreenState extends State<HomeFeedScreen> {
  final RefreshController _refreshController = RefreshController(initialRefresh: false);
  final ScrollController _scrollController = ScrollController();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _loadInitialPosts();
    });
  }

  @override
  void dispose() {
    _refreshController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  Future<void> _loadInitialPosts() async {
    final feedProvider = Provider.of<FeedProvider>(context, listen: false);
    final storiesProvider = Provider.of<StoriesProvider>(context, listen: false);
    
    await Future.wait([
      feedProvider.loadInitialPosts(),
      storiesProvider.loadInitialStories(),
    ]);
  }

  Future<void> _onRefresh() async {
    final feedProvider = Provider.of<FeedProvider>(context, listen: false);
    final storiesProvider = Provider.of<StoriesProvider>(context, listen: false);
    
    await Future.wait([
      feedProvider.refreshPosts(),
      storiesProvider.refreshStories(),
    ]);
    _refreshController.refreshCompleted();
  }

  Future<void> _onLoading() async {
    final feedProvider = Provider.of<FeedProvider>(context, listen: false);
    final hasMore = await feedProvider.loadMorePosts();
    
    if (hasMore) {
      _refreshController.loadComplete();
    } else {
      _refreshController.loadNoData();
    }
  }

  void _showPostComposer() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => DraggableScrollableSheet(
        initialChildSize: 0.9,
        minChildSize: 0.5,
        maxChildSize: 0.95,
        builder: (context, scrollController) => Container(
          decoration: BoxDecoration(
            color: Theme.of(context).scaffoldBackgroundColor,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
          ),
          child: PostComposer(
            scrollController: scrollController,
            onPostCreated: (post) {
              Navigator.of(context).pop();
              final feedProvider = Provider.of<FeedProvider>(context, listen: false);
              feedProvider.addNewPost(post);
            },
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: widget.showAppBar ? AppBar(
        title: const Text('Vista'),
        centerTitle: true,
        elevation: 0,
        actions: [
          const NotificationBadge(),
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: () {
              Provider.of<AuthProvider>(context, listen: false).signOut();
            },
          ),
        ],
      ) : null,
      body: Consumer<FeedProvider>(
        builder: (context, feedProvider, child) {
          if (feedProvider.isInitialLoading) {
            return const LoadingWidget(message: 'Loading feed...');
          }

          if (feedProvider.error != null && feedProvider.posts.isEmpty) {
            return CustomErrorWidget(
              message: feedProvider.error!,
              onRetry: _loadInitialPosts,
            );
          }

          return SmartRefresher(
            controller: _refreshController,
            enablePullDown: true,
            enablePullUp: true,
            onRefresh: _onRefresh,
            onLoading: _onLoading,
            child: feedProvider.posts.isEmpty
                ? _buildEmptyState()
                : ListView.builder(
                    controller: _scrollController,
                    itemCount: feedProvider.posts.length + 1, // +1 for stories
                    itemBuilder: (context, index) {
                      if (index == 0) {
                        // Stories carousel at the top
                        return Column(
                          children: [
                            const StoriesCarousel(),
                            Container(
                              height: 8,
                              color: Theme.of(context).colorScheme.surfaceVariant.withOpacity(0.3),
                            ),
                          ],
                        );
                      }
                      
                      final post = feedProvider.posts[index - 1];
                      return PostWidget(
                        post: post,
                        onLike: () => feedProvider.likePost(post.id),
                        onComment: () => _showCommentsBottomSheet(post),
                      );
                    },
                  ),
          );
        },
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: _showPostComposer,
        child: const Icon(Icons.add),
      ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            Icons.feed_outlined,
            size: 64,
            color: Theme.of(context).colorScheme.onSurfaceVariant,
          ),
          const SizedBox(height: 16),
          Text(
            'No posts yet',
            style: Theme.of(context).textTheme.headlineSmall?.copyWith(
              color: Theme.of(context).colorScheme.onSurfaceVariant,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Be the first to share something!',
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: Theme.of(context).colorScheme.onSurfaceVariant,
            ),
          ),
          const SizedBox(height: 24),
          ElevatedButton.icon(
            onPressed: _showPostComposer,
            icon: const Icon(Icons.add),
            label: const Text('Create Post'),
          ),
        ],
      ),
    );
  }

  void _showCommentsBottomSheet(Post post) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => DraggableScrollableSheet(
        initialChildSize: 0.7,
        minChildSize: 0.3,
        maxChildSize: 0.9,
        builder: (context, scrollController) => Container(
          decoration: BoxDecoration(
            color: Theme.of(context).scaffoldBackgroundColor,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
          ),
          child: Column(
            children: [
              Container(
                width: 40,
                height: 4,
                margin: const EdgeInsets.symmetric(vertical: 12),
                decoration: BoxDecoration(
                  color: Theme.of(context).colorScheme.onSurfaceVariant.withOpacity(0.4),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Row(
                  children: [
                    Text(
                      'Comments',
                      style: Theme.of(context).textTheme.titleLarge?.copyWith(
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const Spacer(),
                    Text(
                      '${post.commentsCount}',
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: Theme.of(context).colorScheme.onSurfaceVariant,
                      ),
                    ),
                  ],
                ),
              ),
              const Divider(),
              Expanded(
                child: Center(
                  child: Text(
                    'Comments feature coming soon!',
                    style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                      color: Theme.of(context).colorScheme.onSurfaceVariant,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}