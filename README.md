# 🏍️ RPMVault Backend

A minimal, secure, and serverless-friendly REST API for motorcycle catalog and details. Built with Express 5, MongoDB, and deployable on Vercel.

## ✨ Features

- **Express 5** with async error handling
- **Security hardened**: Helmet, CORS allowlist, HPP, compression, rate limiting, slow down
- **Bot protection**: User-Agent and IP denylist
- **Input validation**: express-validator & Zod
- **API Documentation**: OpenAPI spec at `/openapi.json` and Swagger UI at `/docs`
- **Serverless ready**: Single codebase for local server and Vercel runtime

## 📋 Requirements

- Node.js 20+
- MongoDB (Atlas or self-hosted)

## 🚀 Getting Started

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment
Create `.env` in project root:
```bash
PORT=3001
CORS_ORIGINS=http://localhost:3000,https://your-frontend.example.com
MONGO_URI=mongodb+srv://<username>:<password>@<cluster>/rpm-vault-db?retryWrites=true&w=majority

# Optional: Rate limiting (defaults shown)
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_GET_MAX=2000
RATE_LIMIT_WRITE_MAX=300

# Optional: Slow down (defaults shown)
SLOWDOWN_GET_AFTER=1000
SLOWDOWN_GET_DELAY_MS=10
SLOWDOWN_WRITE_AFTER=50
SLOWDOWN_WRITE_DELAY_MS=250

# Optional: Bot controls
BLOCKED_UA=AhrefsBot,BadBot
BLOCKED_IPS=
```

### 3. Start the server
```bash
# Development (with hot reload)
npm run dev

# Production
npm run start:prod
```

### 4. Verify
| Endpoint | Description |
|----------|-------------|
| `GET http://localhost:3001/health` | Health check |
| `http://localhost:3001/docs` | Swagger UI |
| `http://localhost:3001/openapi.json` | OpenAPI spec |

## 📚 API Endpoints

### Bikes
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/bikes` | List all bikes with pagination |
| `GET` | `/bikes/:id` | Get bike details by ID |

**Query Parameters for `/bikes`:**
| Param | Type | Description |
|-------|------|-------------|
| `brand` | string | Filter by brand name |
| `model` | string | Filter by model name |
| `category` | string | Filter by category |
| `page` | int | Page number (default: 1) |
| `limit` | int | Items per page (1-200, default: 20) |

**Response:**
```json
{
  "page": 1,
  "limit": 20,
  "total": 150,
  "bikes": [...]
}
```

### Brands
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/brands` | List all motorcycle brands |

### Categories
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/categories` | List all motorcycle categories |

> 📖 See the full OpenAPI spec at `/openapi.json`

## 📁 Project Structure

```
.
├── api/                  # Vercel serverless entry
│   └── index.js
├── routes/               # Route handlers
│   ├── bikes.js          # Bikes listing with filters
│   ├── bikeDetails.js    # Single bike details
│   ├── brands.js         # Brands listing
│   ├── categories.js     # Categories listing
│   └── db.js             # MongoDB connection helper
├── src/
│   ├── app.js            # Express app factory with security
│   └── openapi.js        # OpenAPI specification
├── server.js             # Local server bootstrap
├── vercel.json           # Vercel configuration
└── package.json
```

## 🔒 Security

| Feature | Description |
|---------|-------------|
| **Helmet** | Secure HTTP headers |
| **CORS** | Allowlist via `CORS_ORIGINS` (comma-separated) |
| **HPP** | Prevents HTTP parameter pollution |
| **Compression** | Gzip responses |
| **Rate Limiting** | GET: 2000 req/15min, Write: 300 req/15min per IP |
| **Slow Down** | GET: +10ms delay after 1000 req, Write: +250ms after 50 req |
| **Bot Controls** | Block by User-Agent (`BLOCKED_UA`) and IPs (`BLOCKED_IPS`) |

## ☁️ Deployment (Vercel)

1. Import repo into Vercel
2. Set Environment Variables:
   - `MONGO_URI` (required)
   - `CORS_ORIGINS` (required)
   - `BLOCKED_UA`, `BLOCKED_IPS` (optional)
3. Deploy — Vercel routes all requests to `api/index.js`

## 🧪 Testing

```bash
# Install test dependencies (already included)
npm i -D jest supertest

# Run tests
npm test
```

## 🛠️ Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start with nodemon (hot reload) |
| `npm start` | Start production server |
| `npm run start:prod` | Start with NODE_ENV=production |
| `npm run docs` | Show docs URLs |
| `npm run open:docs` | Open Swagger UI in browser |
| `npm run check:env` | Verify required env variables |
| `npm run vercel:dev` | Run Vercel dev server |

## 🔧 Troubleshooting

| Problem | Solution |
|---------|----------|
| CORS errors | Confirm frontend origin is in `CORS_ORIGINS` |
| 500 errors on DB | Verify `MONGO_URI` and cluster IP allowlist |
| Rate-limited | Increase limits in `.env` or `src/app.js` |
| Bot blocked | Check `BLOCKED_UA` and `BLOCKED_IPS` settings |

## 📄 License

ISC
