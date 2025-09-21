class AppConfig {
  static const String appName = 'Vista';
  static const String packageName = 'com.college.vista';
  
  // Environment-specific configurations
  static bool get isProduction => const bool.fromEnvironment('dart.vm.product');
  static bool get isDevelopment => !isProduction;
  
  // API Configuration
  static String get baseUrl {
    if (isProduction) {
      return const String.fromEnvironment('API_BASE_URL', 
          defaultValue: 'https://api.vista.college.edu');
    } else {
      return const String.fromEnvironment('API_BASE_URL', 
          defaultValue: 'http://localhost:3000');
    }
  }
  
  // Firebase Configuration
  static String get firebaseProjectId {
    return const String.fromEnvironment('FIREBASE_PROJECT_ID', 
        defaultValue: 'vista-college-dev');
  }
  
  // Cloudinary Configuration
  static String get cloudinaryCloudName {
    return const String.fromEnvironment('CLOUDINARY_CLOUD_NAME', 
        defaultValue: 'vista-college');
  }
  
  // Socket.IO Configuration
  static String get socketUrl {
    if (isProduction) {
      return const String.fromEnvironment('SOCKET_URL', 
          defaultValue: 'https://api.vista.college.edu');
    } else {
      return const String.fromEnvironment('SOCKET_URL', 
          defaultValue: 'http://localhost:3000');
    }
  }
  
  // Debug Configuration
  static bool get enableLogging => isDevelopment;
  static bool get enableNetworkLogging => isDevelopment;
}