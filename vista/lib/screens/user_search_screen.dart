import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../providers/chat_provider.dart';
import '../providers/auth_provider.dart';
import '../providers/users_provider.dart';
import '../widgets/loading_widget.dart';
import '../widgets/error_widget.dart';
import '../widgets/user_card.dart';
import '../models/user.dart';
import 'chat_screen.dart';
import 'user_profile_screen.dart';

class UserSearchScreen extends StatefulWidget {
  final String title;
  final bool showStartChatButton;
  final bool showFilters;

  const UserSearchScreen({
    super.key,
    this.title = 'Search Users',
    this.showStartChatButton = false,
    this.showFilters = true,
  });

  @override
  State<UserSearchScreen> createState() => _UserSearchScreenState();
}

class _UserSearchScreenState extends State<UserSearchScreen> {
  final TextEditingController _searchController = TextEditingController();
  
  // Filter controllers
  int? _selectedYear;
  String? _selectedDepartment;
  String? _selectedSection;
  bool _showFilters = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      // Load suggested users on initial load
      if (_searchController.text.isEmpty) {
        _loadSuggestedUsers();
      }
    });
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _loadSuggestedUsers() async {
    final usersProvider = Provider.of<UsersProvider>(context, listen: false);
    await usersProvider.loadSuggestedUsers();
  }

  Future<void> _performSearch() async {
    final usersProvider = Provider.of<UsersProvider>(context, listen: false);
    
    await usersProvider.searchUsers(
      query: _searchController.text.trim().isEmpty ? null : _searchController.text.trim(),
      year: _selectedYear,
      department: _selectedDepartment,
      section: _selectedSection,
      limit: 50,
    );
  }

  void _clearFilters() {
    setState(() {
      _selectedYear = null;
      _selectedDepartment = null;
      _selectedSection = null;
    });
    _performSearch();
  }

  void _toggleFilters() {
    setState(() {
      _showFilters = !_showFilters;
    });
  }

  Future<void> _startConversation(User user) async {
    final chatProvider = Provider.of<ChatProvider>(context, listen: false);
    
    // Show loading dialog
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => const AlertDialog(
        content: Row(
          children: [
            CircularProgressIndicator(),
            SizedBox(width: 16),
            Text('Starting conversation...'),
          ],
        ),
      ),
    );

    try {
      final conversation = await chatProvider.createOrGetConversation(user.studentId);
      
      if (mounted) {
        Navigator.of(context).pop(); // Close loading dialog
        
        if (conversation != null) {
          // Navigate to chat screen
          Navigator.of(context).pushReplacement(
            MaterialPageRoute(
              builder: (context) => ChatScreen(
                conversation: conversation,
                participants: [user], // We'll load full participants in ChatScreen
              ),
            ),
          );
        } else {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Failed to start conversation'),
              backgroundColor: Colors.red,
            ),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        Navigator.of(context).pop(); // Close loading dialog
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to start conversation: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  void _viewProfile(User user) {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (context) => UserProfileScreen(user: user),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.title),
        elevation: 0,
        actions: widget.showFilters
            ? [
                IconButton(
                  icon: Icon(_showFilters ? Icons.filter_list_off : Icons.filter_list),
                  onPressed: _toggleFilters,
                  tooltip: _showFilters ? 'Hide Filters' : 'Show Filters',
                ),
                if (_selectedYear != null || _selectedDepartment != null || _selectedSection != null)
                  IconButton(
                    icon: const Icon(Icons.clear_all),
                    onPressed: _clearFilters,
                    tooltip: 'Clear Filters',
                  ),
              ]
            : null,
      ),
      body: Column(
        children: [
          // Search bar
          Container(
            padding: const EdgeInsets.all(16),
            child: TextField(
              controller: _searchController,
              decoration: InputDecoration(
                hintText: 'Search by name, student ID, or department...',
                prefixIcon: const Icon(Icons.search),
                suffixIcon: _searchController.text.isNotEmpty
                    ? IconButton(
                        icon: const Icon(Icons.clear),
                        onPressed: () {
                          _searchController.clear();
                          _performSearch();
                        },
                      )
                    : null,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
                filled: true,
                fillColor: Theme.of(context).colorScheme.surfaceVariant,
              ),
              onChanged: (value) {
                // Debounce search
                Future.delayed(const Duration(milliseconds: 500), () {
                  if (_searchController.text == value) {
                    _performSearch();
                  }
                });
              },
              textInputAction: TextInputAction.search,
              onSubmitted: (_) => _performSearch(),
            ),
          ),

          // Filters section
          if (widget.showFilters && _showFilters) _buildFiltersSection(),
          
          // Search results
          Expanded(
            child: _buildSearchResults(),
          ),
        ],
      ),
    );
  }

  Widget _buildSearchResults() {
    return Consumer<UsersProvider>(
      builder: (context, usersProvider, child) {
        if (usersProvider.isSearching) {
          return const LoadingWidget(message: 'Searching...');
        }

        if (usersProvider.searchError != null && usersProvider.searchResults.isEmpty) {
          return CustomErrorWidget(
            message: usersProvider.searchError!,
            onRetry: _performSearch,
          );
        }

        if (usersProvider.searchResults.isEmpty && usersProvider.currentQuery.isEmpty) {
          return _buildEmptyState();
        }

        if (usersProvider.searchResults.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.search_off,
              size: 64,
              color: Theme.of(context).colorScheme.onSurfaceVariant,
            ),
            const SizedBox(height: 16),
            Text(
              'No users found',
              style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                color: Theme.of(context).colorScheme.onSurfaceVariant,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Try searching with different keywords',
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: Theme.of(context).colorScheme.onSurfaceVariant,
              ),
            ),
          ],
        ),
      );
    }

        return ListView.builder(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          itemCount: usersProvider.searchResults.length,
          itemBuilder: (context, index) {
            final user = usersProvider.searchResults[index];
            return UserCard(
              user: user,
              showStartChatButton: widget.showStartChatButton,
              onStartChat: () => _startConversation(user),
              onViewProfile: () => _viewProfile(user),
            );
          },
        );
      },
    );
  }

  Widget _buildFiltersSection() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Filters',
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: DropdownButtonFormField<int>(
                      value: _selectedYear,
                      decoration: const InputDecoration(
                        labelText: 'Year',
                        border: OutlineInputBorder(),
                        isDense: true,
                      ),
                      items: [1, 2, 3, 4, 5]
                          .map((year) => DropdownMenuItem(
                                value: year,
                                child: Text('Year $year'),
                              ))
                          .toList(),
                      onChanged: (value) {
                        setState(() {
                          _selectedYear = value;
                        });
                        _performSearch();
                      },
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: TextFormField(
                      decoration: const InputDecoration(
                        labelText: 'Department',
                        border: OutlineInputBorder(),
                        isDense: true,
                      ),
                      onChanged: (value) {
                        _selectedDepartment = value.isEmpty ? null : value;
                        _performSearch();
                      },
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              TextFormField(
                decoration: const InputDecoration(
                  labelText: 'Section',
                  border: OutlineInputBorder(),
                  isDense: true,
                ),
                onChanged: (value) {
                  _selectedSection = value.isEmpty ? null : value;
                  _performSearch();
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            Icons.people_outline,
            size: 64,
            color: Theme.of(context).colorScheme.onSurfaceVariant,
          ),
          const SizedBox(height: 16),
          Text(
            'Search for classmates',
            style: Theme.of(context).textTheme.headlineSmall?.copyWith(
              color: Theme.of(context).colorScheme.onSurfaceVariant,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Enter a name, student ID, or department to find users',
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: Theme.of(context).colorScheme.onSurfaceVariant,
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }
}

