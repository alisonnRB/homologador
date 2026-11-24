from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.models import StatusHomologacao, Usuario
from app.security import gerar_hash_senha

STATUS_PADRAO = ("pendente", "aprovado", "rejeitado")


def inicializar_dados_iniciais(db: Session) -> None:
    existentes = {
        nome
        for (nome,) in db.execute(select(StatusHomologacao.nome)).all()
    }
    for nome_status in STATUS_PADRAO:
        if nome_status not in existentes:
            db.add(StatusHomologacao(nome=nome_status))
    db.commit()

    email_admin = settings.admin_email.strip().lower()
    admin_existente = db.execute(
        select(Usuario).where(Usuario.email == email_admin)
    ).scalar_one_or_none()

    if admin_existente is None:
        novo_admin = Usuario(
            email=email_admin,
            senha_hash=gerar_hash_senha(settings.admin_password),
            perfil="homologador",
        )
        db.add(novo_admin)
        db.commit()
