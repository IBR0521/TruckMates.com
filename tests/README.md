# Test Coverage

This directory contains tests for the TruckMates platform.

## Test Structure

```
tests/
├── unit/           # Unit tests for individual functions
├── integration/    # Integration tests for API routes
├── e2e/            # End-to-end tests (if applicable)
└── fixtures/       # Test data and fixtures
```

## Running Tests

### Unit Tests
```bash
npm run test:unit
```

### Integration Tests
```bash
npm run test:integration
```

### All Tests
```bash
npm run test
```

## Test Coverage Goals

- **Unit Tests**: 80% coverage for business logic
- **Integration Tests**: All API routes and server actions
- **E2E Tests**: Critical user flows

## Writing Tests

### Unit Test Example
```typescript
import { describe, it, expect } from 'vitest'
import { calculateIFTA } from '@/app/actions/ifta'

describe('IFTA Calculation', () => {
  it('should calculate tax correctly', () => {
    const result = calculateIFTA({
      miles: 1000,
      gallons: 100,
      taxRate: 0.25
    })
    expect(result.taxDue).toBe(250)
  })
})
```

### Integration Test Example
```typescript
import { describe, it, expect } from 'vitest'
import { GET } from '@/app/api/loads/route'

describe('GET /api/loads', () => {
  it('should return loads for authenticated user', async () => {
    const response = await GET(new Request('http://localhost/api/loads'), {
      headers: { Authorization: 'Bearer token' }
    })
    expect(response.status).toBe(200)
  })
})
```

## Test Data

Use fixtures in `tests/fixtures/` for consistent test data.

## CI/CD

Tests run automatically on:
- Pull requests
- Commits to main branch
- Before deployment

## Coverage Reports

Coverage reports are generated in `coverage/` directory after running tests.

