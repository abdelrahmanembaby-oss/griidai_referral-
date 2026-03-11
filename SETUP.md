# GriidAi Referral Program

A full-stack application with React frontend and FastAPI backend.

## Project Structure

```
├── app/                    # React frontend (TypeScript + Vite)
│   ├── src/
│   ├── package.json
│   └── vite.config.ts
├── backend/               # Python FastAPI backend
│   ├── main.py
│   ├── requirements.txt
│   └── .env
├── start.bat             # Windows startup script
└── start.sh              # Linux/Mac startup script
```

## Prerequisites

- **Python 3.8+** - [Download](https://www.python.org/downloads/)
- **Node.js 18+** - [Download](https://nodejs.org/)

## Installation & Running

### Option 1: Automated (Recommended)

**Windows:**
```bash
start.bat
```

**Linux/Mac:**
```bash
chmod +x start.sh
./start.sh
```

### Option 2: Manual

**Start Backend:**
```bash
cd backend
python -m venv venv
venv\Scripts\activate  # Windows
# source venv/bin/activate  # Linux/Mac
pip install -r requirements.txt
python main.py
```

The backend will run on `http://localhost:8000`

**Start Frontend (in another terminal):**
```bash
cd app
npm install
npm run dev
```

The frontend will run on `http://localhost:5173`

## API Endpoints

- `GET /` - Welcome message
- `GET /api/health` - Health check
- `GET /api/referral-program` - Get referral program details
- `POST /api/referrals` - Create a new referral
- `GET /api/referrals/{user_id}` - Get user's referrals

## Frontend

Built with:
- React 19
- TypeScript
- Vite
- Tailwind CSS
- Radix UI Components

## Backend

Built with:
- FastAPI
- Python 3
- Uvicorn

## Environment Variables

**Backend (.env):**
```
FASTAPI_ENV=development
API_PORT=8000
```

**Frontend (.env):**
```
VITE_API_URL=http://localhost:8000
```

## Development

Both servers support hot reload during development.

## Build for Production

**Frontend:**
```bash
cd app
npm run build
```

**Backend:**
- Ensure all requirements are installed
- Run with production-grade ASGI server like Gunicorn

---

Happy coding! 🚀
