"""JWT authentication for the FastAPI backend."""

from datetime import datetime, timedelta, timezone

from jose import jwt, JWTError
from fastapi import Depends, HTTPException, APIRouter
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel

from backend.config import APP_USERNAME, APP_PASSWORD, JWT_SECRET

router = APIRouter()
security = HTTPBearer(auto_error=False)

ALGORITHM = 'HS256'
TOKEN_EXPIRE_HOURS = 24


class LoginRequest(BaseModel):
    username: str
    password: str


def create_token(username: str) -> str:
    """Create a JWT token for the given username."""
    expire = datetime.now(timezone.utc) + timedelta(hours=TOKEN_EXPIRE_HOURS)
    payload = {'username': username, 'exp': expire}
    return jwt.encode(payload, JWT_SECRET, algorithm=ALGORITHM)


def verify_token(token: str) -> dict | None:
    """Verify and decode a JWT token. Returns the payload or None."""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
) -> dict:
    """FastAPI dependency that extracts and validates the current user from the Bearer token."""
    if not credentials:
        raise HTTPException(status_code=401, detail='Não autorizado')
    payload = verify_token(credentials.credentials)
    if not payload:
        raise HTTPException(status_code=401, detail='Não autorizado')
    return payload


@router.post('/api/auth/login')
async def login(body: LoginRequest):
    """Authenticate a user and return a JWT token."""
    if not APP_USERNAME or not APP_PASSWORD:
        raise HTTPException(
            status_code=500,
            detail='Configuração de autenticação ausente no servidor',
        )
    if body.username == APP_USERNAME and body.password == APP_PASSWORD:
        token = create_token(body.username)
        return {'token': token}
    raise HTTPException(status_code=401, detail='Credenciais inválidas')
