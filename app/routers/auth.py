from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Usuario
from app.schemas import (
    TokenOut,
    UsuarioAutenticadoOut,
    UsuarioCadastroIn,
    UsuarioLoginIn,
)
from app.security import (
    criar_token_acesso,
    gerar_hash_senha,
    obter_usuario_atual,
    verificar_senha,
)

router = APIRouter(prefix="/api/auth", tags=["Autenticação"])


@router.post(
    "/cadastro",
    response_model=TokenOut,
    status_code=status.HTTP_201_CREATED,
)
def cadastrar_usuario(
    dados: UsuarioCadastroIn,
    db: Session = Depends(get_db),
) -> TokenOut:
    email_normalizado = dados.email.strip().lower()

    existente = db.execute(
        select(Usuario).where(Usuario.email == email_normalizado)
    ).scalar_one_or_none()
    if existente is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Já existe uma conta cadastrada com este e-mail.",
        )

    usuario = Usuario(
        email=email_normalizado,
        senha_hash=gerar_hash_senha(dados.senha),
        perfil=dados.perfil,
    )
    db.add(usuario)
    db.commit()
    db.refresh(usuario)

    token = criar_token_acesso(usuario.id, usuario.perfil)
    return TokenOut(
        access_token=token,
        usuario=UsuarioAutenticadoOut.model_validate(usuario),
    )


@router.post("/login", response_model=TokenOut)
def autenticar_usuario(
    dados: UsuarioLoginIn,
    db: Session = Depends(get_db),
) -> TokenOut:
    email_normalizado = dados.email.strip().lower()
    usuario = db.execute(
        select(Usuario).where(Usuario.email == email_normalizado)
    ).scalar_one_or_none()

    if usuario is None or not verificar_senha(dados.senha, usuario.senha_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="E-mail ou senha inválidos.",
        )

    token = criar_token_acesso(usuario.id, usuario.perfil)
    return TokenOut(
        access_token=token,
        usuario=UsuarioAutenticadoOut.model_validate(usuario),
    )


@router.get("/me", response_model=UsuarioAutenticadoOut)
def perfil_atual(
    usuario_atual: Usuario = Depends(obter_usuario_atual),
) -> UsuarioAutenticadoOut:
    return UsuarioAutenticadoOut.model_validate(usuario_atual)
