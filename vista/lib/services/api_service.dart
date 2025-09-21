import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;

import '../config/app_config.dart';
import '../models/api_response.dart';
import '../services/logger_service.dart';

class ApiService {
  static final ApiService _instance = ApiService._internal();
  factory ApiService() => _instance;
  ApiService._internal();

  final http.Client _client = http.Client();
  final String _baseUrl = AppConfig.baseUrl;
  
  // JWT token for authenticated requests
  String? _jwtToken;

  /// Set JWT token for authenticated requests
  void setJwtToken(String? token) {
    _jwtToken = token;
  }

  /// Make authenticated GET request
  Future<ApiResponse<Map<String, dynamic>>> get(
    String endpoint, {
    Map<String, String>? queryParams,
  }) async {
    return _makeAuthenticatedRequest('GET', endpoint, null, queryParams);
  }

  /// Make authenticated POST request
  Future<ApiResponse<Map<String, dynamic>>> post(
    String endpoint, 
    Map<String, dynamic>? data,
  ) async {
    return _makeAuthenticatedRequest('POST', endpoint, data);
  }

  /// Make authenticated PUT request
  Future<ApiResponse<Map<String, dynamic>>> put(
    String endpoint, 
    Map<String, dynamic>? data,
  ) async {
    return _makeAuthenticatedRequest('PUT', endpoint, data);
  }

  /// Make authenticated PATCH request
  Future<ApiResponse<Map<String, dynamic>>> patch(
    String endpoint, 
    Map<String, dynamic>? data,
  ) async {
    return _makeAuthenticatedRequest('PATCH', endpoint, data);
  }

  /// Make authenticated DELETE request
  Future<ApiResponse<Map<String, dynamic>>> delete(String endpoint) async {
    return _makeAuthenticatedRequest('DELETE', endpoint);
  }

  /// Make unauthenticated GET request
  Future<ApiResponse<Map<String, dynamic>>> getPublic(
    String endpoint, {
    Map<String, String>? queryParams,
  }) async {
    return _makeRequest('GET', endpoint, null, queryParams, false);
  }

  /// Make unauthenticated POST request
  Future<ApiResponse<Map<String, dynamic>>> postPublic(
    String endpoint, 
    Map<String, dynamic>? data,
  ) async {
    return _makeRequest('POST', endpoint, data, null, false);
  }

  /// Make authenticated HTTP request
  Future<ApiResponse<Map<String, dynamic>>> _makeAuthenticatedRequest(
    String method,
    String endpoint, [
    Map<String, dynamic>? data,
    Map<String, String>? queryParams,
  ]) async {
    if (_jwtToken == null) {
      return ApiResponse.error(
        const ApiError(
          code: 'NO_AUTH_TOKEN',
          message: 'Authentication token not found',
        ),
      );
    }
    return _makeRequest(method, endpoint, data, queryParams, true);
  }

  /// Make HTTP request with optional authentication
  Future<ApiResponse<Map<String, dynamic>>> _makeRequest(
    String method,
    String endpoint,
    Map<String, dynamic>? data,
    Map<String, String>? queryParams,
    bool requireAuth,
  ) async {
    try {
      final headers = <String, String>{
        'Content-Type': 'application/json',
      };

      if (requireAuth && _jwtToken != null) {
        headers['Authorization'] = 'Bearer $_jwtToken';
      }

      // Build URI with query parameters
      Uri uri = Uri.parse('$_baseUrl$endpoint');
      if (queryParams != null && queryParams.isNotEmpty) {
        uri = uri.replace(queryParameters: {
          ...uri.queryParameters,
          ...queryParams,
        });
      }

      late http.Response response;

      if (AppConfig.enableNetworkLogging) {
        LoggerService.debug('$method $uri');
        if (data != null) {
          LoggerService.debug('Request body: ${jsonEncode(data)}');
        }
      }

      // Add retry logic for network requests
      int retryCount = 0;
      const maxRetries = 3;
      const retryDelay = Duration(seconds: 1);

      while (retryCount <= maxRetries) {
        try {
          switch (method.toUpperCase()) {
            case 'GET':
              response = await _client.get(uri, headers: headers)
                  .timeout(const Duration(seconds: 30));
              break;
            case 'POST':
              response = await _client.post(
                uri,
                headers: headers,
                body: data != null ? jsonEncode(data) : null,
              ).timeout(const Duration(seconds: 30));
              break;
            case 'PUT':
              response = await _client.put(
                uri,
                headers: headers,
                body: data != null ? jsonEncode(data) : null,
              ).timeout(const Duration(seconds: 30));
              break;
            case 'PATCH':
              response = await _client.patch(
                uri,
                headers: headers,
                body: data != null ? jsonEncode(data) : null,
              ).timeout(const Duration(seconds: 30));
              break;
            case 'DELETE':
              response = await _client.delete(uri, headers: headers)
                  .timeout(const Duration(seconds: 30));
              break;
            default:
              throw ArgumentError('Unsupported HTTP method: $method');
          }
          break; // Success, exit retry loop
        } on SocketException catch (e) {
          retryCount++;
          if (retryCount > maxRetries) {
            rethrow;
          }
          LoggerService.warning('Network error, retrying ($retryCount/$maxRetries): $e');
          await Future.delayed(retryDelay * retryCount);
        } on http.ClientException catch (e) {
          retryCount++;
          if (retryCount > maxRetries) {
            rethrow;
          }
          LoggerService.warning('HTTP client error, retrying ($retryCount/$maxRetries): $e');
          await Future.delayed(retryDelay * retryCount);
        }
      }

      if (AppConfig.enableNetworkLogging) {
        LoggerService.debug('Response status: ${response.statusCode}');
        LoggerService.debug('Response body: ${response.body}');
      }

      if (response.statusCode >= 200 && response.statusCode < 300) {
        if (response.body.isEmpty) {
          return ApiResponse.success(<String, dynamic>{});
        }
        final responseData = jsonDecode(response.body) as Map<String, dynamic>;
        return ApiResponse.success(responseData);
      } else {
        if (response.body.isEmpty) {
          return ApiResponse.error(
            ApiError(
              code: 'HTTP_${response.statusCode}',
              message: 'Request failed with status ${response.statusCode}',
            ),
          );
        }
        final errorData = jsonDecode(response.body) as Map<String, dynamic>;
        return ApiResponse.error(ApiError.fromJson(errorData['error']));
      }

    } on SocketException catch (e, stackTrace) {
      LoggerService.error('Network error during API request', e, stackTrace);
      return ApiResponse.error(
        const ApiError(
          code: 'NETWORK_ERROR',
          message: 'Unable to connect to server. Please check your internet connection.',
        ),
      );
    } on FormatException catch (e, stackTrace) {
      LoggerService.error('Invalid response format from API', e, stackTrace);
      return ApiResponse.error(
        const ApiError(
          code: 'INVALID_RESPONSE',
          message: 'Invalid response from server',
        ),
      );
    } on http.ClientException catch (e, stackTrace) {
      LoggerService.error('HTTP client error during API request', e, stackTrace);
      return ApiResponse.error(
        const ApiError(
          code: 'HTTP_CLIENT_ERROR',
          message: 'HTTP client error occurred',
        ),
      );
    } catch (e, stackTrace) {
      LoggerService.error('Unexpected error during API request', e, stackTrace);
      return ApiResponse.error(
        const ApiError(
          code: 'UNEXPECTED_ERROR',
          message: 'An unexpected error occurred',
        ),
      );
    }
  }

  /// Dispose resources
  void dispose() {
    _client.close();
  }
}