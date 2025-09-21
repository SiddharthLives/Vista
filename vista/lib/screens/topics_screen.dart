import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/topics_provider.dart';
import '../providers/auth_provider.dart';
import '../widgets/topic_card.dart';
import '../widgets/loading_widget.dart';
import '../widgets/error_widget.dart';
import 'topic_detail_screen.dart';
import 'create_topic_screen.dart';

class TopicsScreen extends StatefulWidget {
  const TopicsScreen({super.key});

  @override
  State<TopicsScreen> createState() => _TopicsScreenState();
}

class _TopicsScreenState extends State<TopicsScreen>
    with AutomaticKeepAliveClientMixin {
  final ScrollController _scrollController = ScrollController();
  final TextEditingController _searchController = TextEditingController();

  @override
  bool get wantKeepAlive => true;

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
    
    // Load topics when screen initializes
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<TopicsProvider>().loadTopics(refresh: true);
    });
  }

  @override
  void dispose() {
    _scrollController.dispose();
    _searchController.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (_scrollController.position.pixels >=
        _scrollController.position.maxScrollExtent - 200) {
      // Load more topics when near bottom
      context.read<TopicsProvider>().loadTopics();
    }
  }

  void _onSearch(String query) {
    context.read<TopicsProvider>().setSearchQuery(query);
  }

  void _onSortChanged(String? sortBy) {
    if (sortBy != null) {
      context.read<TopicsProvider>().setSortBy(sortBy);
    }
  }

  void _onRefresh() {
    context.read<TopicsProvider>().loadTopics(refresh: true);
  }

  void _navigateToCreateTopic() {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (context) => const CreateTopicScreen(),
      ),
    );
  }

  void _navigateToTopicDetail(String topicId) {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (context) => TopicDetailScreen(topicId: topicId),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);
    
    return Scaffold(
      appBar: AppBar(
        title: const Text('Topics'),
        elevation: 0,
        actions: [
          PopupMenuButton<String>(
            onSelected: _onSortChanged,
            itemBuilder: (context) => [
              const PopupMenuItem(
                value: 'recent',
                child: Text('Most Recent'),
              ),
              const PopupMenuItem(
                value: 'votes',
                child: Text('Most Voted'),
              ),
              const PopupMenuItem(
                value: 'comments',
                child: Text('Most Discussed'),
              ),
            ],
            child: const Padding(
              padding: EdgeInsets.all(16.0),
              child: Icon(Icons.sort),
            ),
          ),
        ],
      ),
      body: Column(
        children: [
          // Search bar
          Padding(
            padding: const EdgeInsets.all(16.0),
            child: TextField(
              controller: _searchController,
              decoration: InputDecoration(
                hintText: 'Search topics...',
                prefixIcon: const Icon(Icons.search),
                suffixIcon: _searchController.text.isNotEmpty
                    ? IconButton(
                        icon: const Icon(Icons.clear),
                        onPressed: () {
                          _searchController.clear();
                          _onSearch('');
                        },
                      )
                    : null,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
                filled: true,
                fillColor: Theme.of(context).colorScheme.surface,
              ),
              onChanged: _onSearch,
            ),
          ),
          
          // Topics list
          Expanded(
            child: Consumer<TopicsProvider>(
              builder: (context, topicsProvider, child) {
                if (topicsProvider.topics.isEmpty && topicsProvider.isLoadingTopics) {
                  return const Center(child: LoadingWidget());
                }

                if (topicsProvider.topics.isEmpty && topicsProvider.error != null) {
                  return Center(
                    child: CustomErrorWidget(
                      message: topicsProvider.error!,
                      onRetry: _onRefresh,
                    ),
                  );
                }

                if (topicsProvider.topics.isEmpty) {
                  return Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(
                          Icons.topic_outlined,
                          size: 64,
                          color: Theme.of(context).colorScheme.outline,
                        ),
                        const SizedBox(height: 16),
                        Text(
                          'No topics found',
                          style: Theme.of(context).textTheme.titleMedium?.copyWith(
                            color: Theme.of(context).colorScheme.outline,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          'Be the first to start a discussion!',
                          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            color: Theme.of(context).colorScheme.outline,
                          ),
                        ),
                      ],
                    ),
                  );
                }

                return RefreshIndicator(
                  onRefresh: () async => _onRefresh(),
                  child: ListView.builder(
                    controller: _scrollController,
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    itemCount: topicsProvider.topics.length + 
                        (topicsProvider.hasMoreTopics ? 1 : 0),
                    itemBuilder: (context, index) {
                      if (index >= topicsProvider.topics.length) {
                        // Loading indicator for pagination
                        return const Padding(
                          padding: EdgeInsets.all(16.0),
                          child: Center(child: LoadingWidget()),
                        );
                      }

                      final topic = topicsProvider.topics[index];
                      return TopicCard(
                        topic: topic,
                        onTap: () => _navigateToTopicDetail(topic.id),
                        onVote: (voteType) => topicsProvider.voteTopic(topic.id, voteType),
                      );
                    },
                  ),
                );
              },
            ),
          ),
        ],
      ),
      floatingActionButton: Consumer<AuthProvider>(
        builder: (context, authProvider, child) {
          if (!authProvider.isAuthenticated) {
            return const SizedBox.shrink();
          }
          
          return FloatingActionButton(
            onPressed: _navigateToCreateTopic,
            child: const Icon(Icons.add),
          );
        },
      ),
    );
  }
}