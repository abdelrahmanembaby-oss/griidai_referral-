## GriidAi Referral Project – Implementation Guide

### 1. High-level Architecture

- **Frontend**: React (Vite, TypeScript, React Router)
  - Pages:
    - `/` – Chat-like home between user and “Griid AI”, with a top CTA “Invite your friend / Referral”.
    - `/referral` – Referral dashboard (Rewards / Invite / History tabs).
    - `/signup` – Signup / Login screen, understands `?ref=CODE`.
- **Backend**: FastAPI
  - Async SQLAlchemy + Alembic migrations.
  - Auth: Email + Password (JWT). Google OAuth ready via Authlib.
  - Referral tracking: unique referral code per user, referral rows, tiered rewards.
- **Database**: 
  - Local dev: SQLite (`sqlite+aiosqlite:///./dev.db`).
  - Production: can switch to Postgres by changing `DATABASE_URL`.

### 2. Data Model

#### `users` table

- `id` (UUID, primary key)
- `email` (string, unique, indexed)
- `password_hash` (string, nullable for Google-only accounts)
- `google_sub` (string, unique, nullable – Google user id)
- `referral_code` (string, unique, indexed) – the code in `?ref=CODE`
- `referred_by_user_id` (UUID, nullable, FK to `users.id`) – who invited this user
- `total_credits` (string, default `"0"`)
- `plan_type` (string, default `"free"`)
- `device_fingerprint` (string, nullable)
- `ip_address` (string, nullable)
- `created_at` (datetime)

#### `referrals` table

- `id` (UUID, primary key)
- `referrer_user_id` (UUID, FK to `users.id`) – inviter
- `referred_user_id` (UUID, FK to `users.id`) – invitee
- `status` (string, default `"pending"`) – e.g. `signed_up`, `verified`, `qualified`, `rewarded`
- `reward_granted` (bool, default `false`)
- `reward_type` (string, nullable)
- `created_at` (datetime)
- `qualified_at` (datetime, nullable)
- **Constraint**: unique on `referred_user_id` (one invitee counts only once).

#### `referral_reward_logs` table

- `id` (UUID, primary key)
- `user_id` (UUID, FK to `users.id`) – who received the reward
- `referral_id` (UUID, FK to `referrals.id`)
- `credits_added` (string, nullable)
- `reward_type` (string, e.g. `1_week_pro`, `50_credits`, `1_month_pro`, `early_access`)
- `created_at` (datetime)
- `expiry_date` (datetime, nullable)

### 3. Backend Implementation (FastAPI)

#### 3.1 Configuration and DB

- `app/core/config.py`
  - Loads `.env` from `backend/.env`.
  - Fields:
    - `DATABASE_URL`
    - `SECRET_KEY`
    - `ACCESS_TOKEN_EXPIRE_MINUTES`
    - `FRONTEND_URL` (e.g. `http://localhost:5173` for dev)
    - Google OAuth config (optional).

- `app/core/db.py`
  - Creates async engine with `create_async_engine(settings.DATABASE_URL)`.
  - `AsyncSessionLocal` with `sessionmaker`.
  - `Base = declarative_base()` for SQLAlchemy models.
  - `get_db` dependency: yields `AsyncSession`.

#### 3.2 Security & Auth Helpers

- `app/core/security.py`
  - `hash_password(password: str) -> str` using `passlib[bcrypt]`.
  - `verify_password(password: str, hash: str) -> bool`.
  - `create_access_token(subject: str, expires_minutes: Optional[int]) -> str` (HS256 JWT).
  - `decode_token(token: str) -> dict`.

- `app/core/auth.py`
  - HTTP Bearer scheme.
  - `get_current_user(...) -> User`:
    - Extracts token, decodes to get `sub` (user id).
    - Converts `sub` to `UUID`, queries DB for `User`.
    - Raises `401` if invalid/missing.

#### 3.3 Referral Service

- `app/services/referral_service.py`

Key functions:

```python
async def _generate_unique_referral_code(session: AsyncSession) -> str:
    # generate 6-char uppercase code, ensure uniqueness in DB
```

```python
async def create_user(
    session: AsyncSession,
    email: str,
    password: Optional[str] = None,
    google_sub: Optional[str] = None,
    referral_code: Optional[str] = None,
    device_fp: Optional[str] = None,
    ip_address: Optional[str] = None,
) -> User:
    # 1) generate new referral_code for the new user
    # 2) if referral_code is provided:
    #    - look up referrer
    #    - block self-referral (same email)
    #    - run anti-abuse checks (IP, device, domain)
    #    - set referred_by_user_id accordingly
    # 3) create User row
    # 4) if referred_by_user_id set, create Referral row with status="signed_up"
```

```python
async def get_referral_link(user: User) -> str:
    base = (settings.FRONTEND_URL or "https://app.griidai.com").rstrip("/")
    return f"{base}/signup?ref={user.referral_code}"
```

```python
TIERS = [
    {"referrals": 1, "reward": "1 week Pro", "key": "tier_1"},
    {"referrals": 3, "reward": "$50 credits", "key": "tier_3"},
    {"referrals": 5, "reward": "1 month Pro", "key": "tier_5"},
    {"referrals": 10, "reward": "Early feature access badge", "key": "tier_10"},
]

def compute_tiers(referral_count: int):
    # returns each tier with unlocked + progress
```

#### 3.4 API Routers

- `app/api/auth.py`
  - `POST /api/auth/signup`:
    - Body: `email`, `password`, optional `referral_code`.
    - Validates email uniqueness.
    - Calls `create_user(...)`.
    - Returns `AuthResponse` = `{ access_token, token_type, user }`.
  - `POST /api/auth/login`:
    - Validates credentials.
    - Returns JWT + user.
  - `GET /api/me`:
    - Returns current user based on Authorization header.
  - `GET /api/auth/google/start` + `/api/auth/google/callback`:
    - Google OAuth (optional; requires client id/secret).

- `app/api/referral.py`
  - `GET /api/referral/link`:
    - Returns `{ link }` with user’s referral link.
  - `GET /api/referral/validate?code=...`:
    - Returns `{ valid: true/false }`.
  - `GET /api/referral/me`:
    - Counts referrals for current user.
    - Returns:
      - `referral_code`
      - `referral_link`
      - `referral_count`
      - `tiers` (from `compute_tiers`).
  - `GET /api/referral/stats`:
    - High-level stats with optional Redis caching.
  - `GET /api/referral/list`:
    - Raw list of `Referral` rows for the user.
  - `GET /api/referral/history`:
    - Joins `Referral` and `User` to return invitee email + status + created_at.

#### 3.5 Main FastAPI App

- `backend/main.py`
  - Creates FastAPI app with CORS allowing `http://localhost:<any-port>`.
  - Includes routers: `auth`, `referral`, etc.
  - Startup event: creates tables via SQLAlchemy (in addition to Alembic for migrations).

### 4. Frontend Implementation (React)

#### 4.1 Setup

- Vite React + TypeScript in `app/`.
- React Router for navigation.
- `sonner` for toasts.
- `lucide-react` for icons.

`.env` in `app/`:

```env
VITE_API_URL=http://localhost:8000
```

#### 4.2 API Client

- `src/api/client.ts`:
  - `apiUrl(path)` builds URLs using `VITE_API_URL`.
  - `apiFetch(path, { method, body, token })` wraps `fetch`, adds JSON headers and Authorization.

#### 4.3 Auth Context

- `src/auth/AuthContext.tsx`:
  - Stores `token` in `localStorage` (`griidai_token`).
  - Fetches `/api/me` when token changes.
  - Exposes:
    - `token`
    - `user`
    - `setToken`
    - `refreshMe`
    - `logout`

#### 4.4 Layout / Routing

- `src/App.tsx`:
  - Wraps everything with `TopBar`.
  - Defines routes:
    - `/` → `ChatHome`
    - `/referral` → `ReferralPage`
    - `/signup` → `SignupPage`
    - `*` → redirect to `/`.

- `src/components/TopBar.tsx`:
  - Logo + title (“GriidAi”).
  - `Referral` button linking to `/referral`.
  - Shows current user email + Logout if signed in, otherwise a “Sign in” button.

#### 4.5 Chat Home Page (`/`)

- `src/pages/ChatHome.tsx`:
  - Header section:
    - “Invite your friend”
    - Subtext: “Earn tiered rewards (1 / 3 / 5 / 10 referrals)”
    - `Referral` button → `/referral`.
  - `chat-body`:
    - List of messages (`role: 'user' | 'ai'`).
    - Simple simulated reply from AI encouraging user to open the Referral page.
  - Input bar:
    - Text input + `Send` button (UI only).

#### 4.6 Referral Page (`/referral`)

- `src/pages/Referral.tsx`:
  - Fetches `/api/referral/me` using `token` from `AuthContext`.
  - Tabs:
    - **Rewards**:
      - Table with tiers from backend.
      - Shows “Unlocked” or progress `X / target`.
    - **Invite**:
      - Read-only input with `referral_link`.
      - `Copy` button (uses `navigator.clipboard.writeText`).
      - Shows underlying `referral_code`.
    - **History**:
      - Fetches `/api/referral/history` when tab is active.
      - Table of invitee email, status, created timestamp.

#### 4.7 Signup Page (`/signup`)

- `src/pages/Signup.tsx`:
  - Reads `ref` from `window.location.search`.
  - Stores it in localStorage (`griidai_ref_code`) to survive navigation.
  - Two modes: **Sign up** and **Login**.
  - On signup:
    - Calls `POST /api/auth/signup` with `{ email, password, referral_code }`.
    - Stores `access_token` via `setToken`.
    - Redirects to `/referral`.
  - On login:
    - Calls `POST /api/auth/login`.
    - Same token flow.
  - “Continue with Google” link:
    - Points to `/api/auth/google/start?ref=CODE` built from `apiUrl`.

### 5. Referral Attribution Rules

- **When is a referral counted?**
  - At **signup completion**:
    - If `referral_code` belongs to an existing user.
    - And `referred_by_user_id` for the new user is currently `null`.
    - Then:
      - Set `new_user.referred_by_user_id = inviter.id`.
      - Insert a `referrals` row with `status="signed_up"`.

- **First-ref-wins**:
  - Once `referred_by_user_id` is set, further signups/logins do not change it.

- **Self-referral block**:
  - If `referrer.email.lower() == new_user.email.lower()`, ignore the referral code.

- **Anti-abuse checks (basic)**:
  - Reject/flag referral when:
    - Same IP as referrer.
    - Same device fingerprint.
    - Same email domain or temp email domains.

### 6. Running the Project Locally

From the project root (where `start.bat` lives):

1. **Windows (recommended)**:

```bat
start.bat
```

This will:
- Install backend dependencies into `backend/venv` (if needed).
- Start FastAPI backend on `http://localhost:8000`.
- Install frontend dependencies in `app/` (if needed).
- Start Vite dev server on `http://localhost:5173`.

2. Open the frontend in a browser:

- `http://localhost:5173/` → Chat home.
- From the top bar, click **Referral** → Referral page.
- From Referral page, click your invite link to test `/signup?ref=CODE`.

### 7. Manual Test Plan

1. **Single referral**
   - Sign up as user A.
   - Copy A’s referral link from `/referral`.
   - Open it in incognito; sign up as user B.
   - Back as A, open `/referral`:
     - `referral_count` should be `1`.
     - Tier 1 (“1 week Pro”) should be unlocked.

2. **Reaching higher tiers**
   - Repeat the process to create users C, D, E… using A’s link.
   - At counts 3, 5, 10 the respective tiers should show as unlocked.

3. **Invalid / changed code**
   - Try signing up without `ref` or with a random code → no referral should be recorded.
   - Try reusing B’s account with a different referral link:
     - `referred_by_user_id` must not change (first-ref-wins).

4. **Self-referral**
   - Try opening your own link and signing up again with the same email:
     - The code should be ignored; no referral should be attributed.

