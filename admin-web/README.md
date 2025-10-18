# College Social Media Admin Interface

A Next.js-based administrative interface for managing the College Social Media Platform.

## Features

- **Dashboard**: Overview of platform statistics and activity
- **Roster Upload**: CSV-based student roster management
- **Content Moderation**: Review and moderate reported content
- **User Management**: Manage user accounts and permissions
- **Analytics**: Platform usage metrics and reporting

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Running backend API server

### Installation

1. Install dependencies:

```bash
npm install
```

2. Set up environment variables:

```bash
cp .env.example .env.local
```

Edit `.env.local` with your configuration:

- `NEXT_PUBLIC_API_URL`: Backend API URL (default: http://localhost:3000)

3. Start the development server:

```bash
npm run dev
```

The admin interface will be available at http://localhost:3001

### Building for Production

```bash
npm run build
npm start
```

## Project Structure

```
admin-web/
├── src/
│   ├── app/                 # Next.js 13+ app directory
│   │   ├── dashboard/       # Dashboard pages
│   │   ├── globals.css      # Global styles
│   │   ├── layout.tsx       # Root layout
│   │   └── page.tsx         # Login page
│   ├── components/          # Reusable components
│   │   ├── LoginForm.tsx    # Authentication form
│   │   └── Sidebar.tsx      # Navigation sidebar
│   ├── services/            # API services
│   │   ├── authService.ts   # Authentication service
│   │   └── apiService.ts    # API client
│   └── utils/               # Utility functions
├── public/                  # Static assets
└── tests/                   # Test files
```

## Authentication

The admin interface uses JWT-based authentication. Administrators must log in with valid credentials to access the dashboard.

### Default Admin Account

For development, you may need to create an admin account through the backend API or database directly.

## API Integration

The admin interface communicates with the backend API for:

- Authentication (`/admin/auth/login`)
- Roster management (`/admin/roster`)
- Content moderation (`/admin/reports`, `/admin/moderate`)
- User management (`/admin/users`)
- Analytics (`/admin/stats`, `/admin/metrics`)

## CSV Roster Format

When uploading student rosters, use the following CSV format:

```csv
studentId,email,year,department,section
2025CS1001,john.doe@college.edu,1,CS,A
2025CS1002,jane.smith@college.edu,1,CS,A
```

Required columns:

- `studentId`: Unique student identifier
- `email`: Student email address (must match college domain)
- `year`: Academic year (1-4)
- `department`: Department code
- `section`: Section identifier

## Testing

Run the test suite:

```bash
npm test
```

Run tests in watch mode:

```bash
npm run test:watch
```

## Deployment

### Docker Deployment

1. Build the Docker image:

```bash
docker build -t college-social-admin .
```

2. Run the container:

```bash
docker run -p 3001:3001 -e NEXT_PUBLIC_API_URL=https://api.yourdomain.com college-social-admin
```

### Environment Variables

- `NEXT_PUBLIC_API_URL`: Backend API URL
- `PORT`: Server port (default: 3001)

## Security Considerations

- All API requests include JWT authentication
- Input validation on all forms
- CSRF protection enabled
- Secure headers configured
- Rate limiting on authentication endpoints

## Contributing

1. Follow the existing code style and patterns
2. Add tests for new features
3. Update documentation as needed
4. Ensure all tests pass before submitting

## License

This project is part of the College Social Media Platform.
