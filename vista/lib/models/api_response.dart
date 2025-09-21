class ApiResponse<T> {
  final bool success;
  final T? data;
  final String? message;
  final ApiError? error;

  const ApiResponse({
    required this.success,
    this.data,
    this.message,
    this.error,
  });

  factory ApiResponse.success(T data, [String? message]) {
    return ApiResponse(
      success: true,
      data: data,
      message: message,
    );
  }

  factory ApiResponse.error(ApiError error) {
    return ApiResponse(
      success: false,
      error: error,
    );
  }

  factory ApiResponse.fromJson(
    Map<String, dynamic> json,
    T Function(dynamic)? fromJsonT,
  ) {
    if (json.containsKey('error')) {
      return ApiResponse.error(ApiError.fromJson(json['error']));
    }

    return ApiResponse.success(
      fromJsonT != null ? fromJsonT(json['data']) : json['data'] as T,
      json['message'] as String?,
    );
  }
}

class ApiError {
  final String code;
  final String message;
  final Map<String, dynamic>? details;

  const ApiError({
    required this.code,
    required this.message,
    this.details,
  });

  factory ApiError.fromJson(Map<String, dynamic> json) {
    return ApiError(
      code: json['code'] as String,
      message: json['message'] as String,
      details: json['details'] as Map<String, dynamic>?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'code': code,
      'message': message,
      'details': details,
    };
  }

  @override
  String toString() {
    return 'ApiError(code: $code, message: $message, details: $details)';
  }
}