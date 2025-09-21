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
  Future<ApiResponse<Map<String, dynamic>>> get(String endpoint) async {
    return _makeAuthenticatedRequest('GET', endpoint);
  }

  /// Make authenticated POST request
  Future<ApiResponse<Map<String, dynamic>>> post(
    String endpoint, 
    Map<String, dynamic> data,
  ) async {
    return _makeAuthenticatedRequest('POST', endpoint, data);
  }

  /// Make authenticated PUT request
  Future<ApiResponse<Map<String, dynamic>>> put(
    String endpoint, 
    Map<String, dynamic> data,
  ) async {
    return _makeAuthenticatedRequest('PUT', endpoint, data);
  }

  /// Make authenticated DELETE request
  Future<ApiResponse<Map<String, dynamic>>> delete(String endpoint) async {
    return _makeAuthenticatedRequest('DELETE', endpoint);
  }

  /// Make authenticated HTTP request
  Future<ApiResponse<Map<String, dynamic>>> _makeAuthenticatedRequest(
    String method,
    String endpoint, [
    Map<String, dynamic>? data,
  ]) async {
    try {
      if (_jwtToken == null) {
        return ApiResponse.error(
          const ApiError(
            code: 'NO_AUTH_TOKEN',
            message: 'Authentication token not found',
          ),
        );
      }

      final headers = {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $_jwtToken',
      };

      final uri = Uri.parse('$_baseUrl$endpoint');
      late http.Response response;

      if (AppConfig.enableNetworkLogging) {
        LoggerService.debug('$method $uri');
        if (data != null) {
          LoggerService.debug('Request body: ${jsonEncode(data)}');
        }
      }

      switch (method.toUpperCase()) {
        case 'GET':
          response = await _client.get(uri, headers: headers);
          break;
        case 'POST':
          response = await _client.post(
            uri,
            headers: headers,
            body: data != null ? jsonEncode(data) : null,
          );
          break;
        case 'PUT':
          response = await _client.put(
            uri,
            headers: headers,
            body: data != null ? jsonEncode(data) : null,
          );
          break;
        case 'DELETE':
          response = await _client.delete(uri, headers: headers);
          break;
        default:
          throw ArgumentError('Unsupported HTTP method: $method');
      }

      if (AppConfig.enableNetworkLogging) {
        LoggerService.debug('Response status: ${response.statusCode}');
        LoggerService.debug('Response body: ${response.body}');
      }

      if (response.statusCode >= 200 && response.statusCode < 300) {
        final responseData = jsonDecode(response.body) as Map<String, dynamic>;
        return ApiResponse.success(responseData);
      } else {
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