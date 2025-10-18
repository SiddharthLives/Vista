import 'package:flutter/foundation.dart';
import '../models/user.dart';
import '../services/api_client.dart';
import '../services/logger_service.dart';
import '../services/users_api_service.dart';

class UsersProvider extends ChangeNotifier {
  final ApiClient _apiClient = ApiClient();

  // Search state
  List<User> _searchResults = [];
  bool _isSearching = false;
  String? _searchError;
  String _currentQuery = '';
  Map<String, String> _currentFilters = {};

  // User profile cache
  Map<String, User> _userProfiles = {};
  Map<String, bool> _isLoadingProfile = {};
  Map<String, String?> _profileErrors = {};

  // Getters
  List<User> get searchResults => _searchResults;
  bool get isSearching => _isSearching;
  String? get searchError => _searchError;
  String get currentQuery => _currentQuery;
  Map<String, String> get currentFilters => _currentFilters;

  User? getUserProfile(String studentId) {
    return _userProfiles[studentId];
  }

  bool isLoadingProfile(String studentId) {
    return _isLoadingProfile[studentId] ?? false;
  }

  String? getProfileError(String studentId) {
    return _profileErrors[studentId];
  }

  /// Search users with filters
  Future<void> searchUsers({
    String? query,
    int? year,
    String? department,
    String? section,
    int limit = 50,
  }) async {
    // Avoid duplicate searches
    final newQuery = query ?? '';
    final newFilters = <String, String>{
      if (year != null) 'year': year.toString(),
      if (department != null) 'department': department,
      if (section != null) 'section': section,
    };

    if (newQuery == _currentQuery && 
        _mapsEqual(newFilters, _currentFilters) && 
        _searchError == null) {
      return;
    }

    setState(() {
      _isSearching = true;
      _searchError = null;
      _currentQuery = newQuery;
      _currentFilters = newFilters;
    });

    try {
      final result = await _apiClient.users.searchUsers(
        search: query?.isNotEmpty == true ? query : null,
        year: year,
        department: department,
        section: section,
        limit: limit,
      );

      if (result.success && result.data != null) {
        _searchResults = result.data!.users;
        _searchError = null;
        
        // Cache user profiles
        for (final user in _searchResults) {
          _userProfiles[user.studentId] = user;
        }
      } else {
        _searchResults.clear();
        _searchError = result.error?.message ?? 'Search failed';
        LoggerService.error('Failed to search users: ${result.error?.message}');
      }
    } catch (e, stackTrace) {
      _searchResults.clear();
      _searchError = 'Search failed: $e';
      LoggerService.error('Error searching users', e, stackTrace);
    } finally {
      setState(() {
        _isSearching = false;
      });
    }
  }

  /// Clear search results
  void clearSearch() {
    setState(() {
      _searchResults.clear();
      _currentQuery = '';
      _currentFilters.clear();
      _searchError = null;
    });
  }

  /// Load user profile by student ID
  Future<User?> loadUserProfile(String studentId) async {
    // Return cached profile if available
    if (_userProfiles.containsKey(studentId)) {
      return _userProfiles[studentId];
    }

    // Avoid duplicate requests
    if (_isLoadingProfile[studentId] == true) {
      return null;
    }

    setState(() {
      _isLoadingProfile[studentId] = true;
      _profileErrors[studentId] = null;
    });

    try {
      final result = await _apiClient.users.getUserProfile(studentId);

      if (result.success && result.data != null) {
        _userProfiles[studentId] = result.data!;
        _profileErrors[studentId] = null;
        notifyListeners();
        return result.data;
      } else {
        _profileErrors[studentId] = result.error?.message ?? 'Failed to load profile';
        LoggerService.error('Failed to load user profile: ${result.error?.message}');
        return null;
      }
    } catch (e, stackTrace) {
      _profileErrors[studentId] = 'Failed to load profile: $e';
      LoggerService.error('Error loading user profile', e, stackTrace);
      return null;
    } finally {
      setState(() {
        _isLoadingProfile[studentId] = false;
      });
    }
  }

  /// Update cached user profile
  void updateUserProfile(User user) {
    _userProfiles[user.studentId] = user;
    
    // Update in search results if present
    final searchIndex = _searchResults.indexWhere(
      (u) => u.studentId == user.studentId,
    );
    if (searchIndex != -1) {
      _searchResults[searchIndex] = user;
    }
    
    notifyListeners();
  }

  /// Get suggested users (people you may know)
  Future<void> loadSuggestedUsers() async {
    // For now, just search without filters to get a general list
    // In a real app, this would use a more sophisticated algorithm
    await searchUsers(limit: 20);
  }

  /// Clear all cached data
  void clear() {
    _searchResults.clear();
    _userProfiles.clear();
    _isLoadingProfile.clear();
    _profileErrors.clear();
    _currentQuery = '';
    _currentFilters.clear();
    _isSearching = false;
    _searchError = null;
    notifyListeners();
  }

  // Helper method to set state and notify listeners
  void setState(VoidCallback fn) {
    fn();
    notifyListeners();
  }

  // Helper method to compare maps
  bool _mapsEqual(Map<String, String> map1, Map<String, String> map2) {
    if (map1.length != map2.length) return false;
    for (final key in map1.keys) {
      if (map1[key] != map2[key]) return false;
    }
    return true;
  }
}