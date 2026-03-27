# Contributing to Luna Loops

## Development Setup

### Prerequisites
- Node.js 20+
- npm 10+

### Getting Started
```bash
# Clone the repository
git clone https://github.com/Gbenro/loops.git
cd loops

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Start development server
npm run dev
```

## Code Standards

### Formatting
We use Prettier for consistent code formatting. Configuration is in `.prettierrc`.

```bash
# Format all files
npm run format

# Check formatting
npm run format:check
```

### Linting
We use ESLint with React-specific rules. Configuration is in `.eslintrc.cjs`.

```bash
# Run linter
npm run lint

# Auto-fix issues
npm run lint:fix
```

### Testing
We use Vitest with React Testing Library. Configuration is in `vitest.config.js`.

```bash
# Run tests
npm run test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage
```

## Project Structure

```
loops/
├── src/
│   ├── components/    # Reusable UI components
│   ├── lib/           # Utilities and API clients
│   ├── tabs/          # Main tab views (Sky, Loops, Echoes)
│   ├── data/          # Static data and constants
│   ├── test/          # Test utilities and setup
│   ├── App.jsx        # Root application component
│   └── main.jsx       # Entry point
├── supabase/
│   ├── functions/     # Edge functions
│   └── migrations/    # Database migrations
├── public/            # Static assets
├── android/           # Capacitor Android project
├── ios/               # Capacitor iOS project
└── .github/workflows/ # CI/CD pipelines
```

## Git Workflow

1. Create a feature branch from `main`
2. Make changes following code standards
3. Write/update tests as needed
4. Ensure CI passes (lint, test, build)
5. Open a PR using the template
6. Request review

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Auto-fix linting issues |
| `npm run format` | Format code with Prettier |
| `npm run format:check` | Check code formatting |
| `npm run test` | Run tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Generate test coverage |
| `npm run cap:sync` | Sync Capacitor platforms |
| `npm run cap:android` | Build and open Android |
| `npm run cap:ios` | Build and open iOS |
