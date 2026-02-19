# Loops App - Cross-Device Persistence

## Architecture Overview
- Backend: FastAPI with SQLAlchemy ORM
- Database: PostgreSQL 
- Authentication: JWT with Passlib
- Frontend: React with Axios for API calls
- Deployment: Docker, Railway, GitHub Actions

## Key Features
- Secure user authentication
- Cross-device loop synchronization
- Full CRUD operations for loops
- Seamless localStorage migration

## Development Setup
1. Backend: Python 3.10+, FastAPI
2. Frontend: React 18+
3. Database: PostgreSQL 13+

## Security Considerations
- JWT token-based authentication
- Password hashing with bcrypt
- HTTPS-only API endpoints
- CORS and security headers