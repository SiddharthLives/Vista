class MediaSignRequest {
  final String filename;
  final String mimeType;
  final String studentId;

  const MediaSignRequest({
    required this.filename,
    required this.mimeType,
    required this.studentId,
  });

  Map<String, dynamic> toJson() {
    return {
      'filename': filename,
      'mimeType': mimeType,
      'studentId': studentId,
    };
  }
}

class MediaSignResponse {
  final String signature;
  final String apiKey;
  final int timestamp;
  final String folder;
  final String cloudName;
  final String uploadUrl;

  const MediaSignResponse({
    required this.signature,
    required this.apiKey,
    required this.timestamp,
    required this.folder,
    required this.cloudName,
    required this.uploadUrl,
  });

  factory MediaSignResponse.fromJson(Map<String, dynamic> json) {
    return MediaSignResponse(
      signature: json['signature'] as String,
      apiKey: json['api_key'] as String,
      timestamp: json['timestamp'] as int,
      folder: json['folder'] as String,
      cloudName: json['cloud_name'] as String,
      uploadUrl: json['upload_url'] as String,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'signature': signature,
      'api_key': apiKey,
      'timestamp': timestamp,
      'folder': folder,
      'cloud_name': cloudName,
      'upload_url': uploadUrl,
    };
  }
}

class CloudinaryUploadResponse {
  final String publicId;
  final String secureUrl;
  final int width;
  final int height;
  final String format;
  final int bytes;

  const CloudinaryUploadResponse({
    required this.publicId,
    required this.secureUrl,
    required this.width,
    required this.height,
    required this.format,
    required this.bytes,
  });

  factory CloudinaryUploadResponse.fromJson(Map<String, dynamic> json) {
    return CloudinaryUploadResponse(
      publicId: json['public_id'] as String,
      secureUrl: json['secure_url'] as String,
      width: json['width'] as int,
      height: json['height'] as int,
      format: json['format'] as String,
      bytes: json['bytes'] as int,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'public_id': publicId,
      'secure_url': secureUrl,
      'width': width,
      'height': height,
      'format': format,
      'bytes': bytes,
    };
  }
}