from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import StatusHomologacao, Usuario
from app.routers.atributos import registrar_avaliacao
from app.schemas import (
    AtributoDetalheOut,
    HomologacaoCreateIn,
    StatusHomologacaoOut,
)
from app.security import exigir_homologador, obter_usuario_atual

router = APIRouter(prefix="/api/homologacoes", tags=["Homologações"])


@router.get("/status", response_model=list[StatusHomologacaoOut])
def listar_status_homologacao(
    _: Usuario = Depends(obter_usuario_atual),
    db: Session = Depends(get_db),
) -> list[StatusHomologacaoOut]:
    status_lista = (
        db.execute(select(StatusHomologacao).order_by(StatusHomologacao.id))
        .scalars()
        .all()
    )
    return [StatusHomologacaoOut.model_validate(s) for s in status_lista]


@router.post(
    "",
    response_model=AtributoDetalheOut,
    status_code=status.HTTP_201_CREATED,
)
def criar_homologacao(
    dados: HomologacaoCreateIn,
    homologador: Usuario = Depends(exigir_homologador),
    db: Session = Depends(get_db),
) -> AtributoDetalheOut:
    return registrar_avaliacao(
        db=db,
        atributo_id=dados.atributo_id,
        homologador=homologador,
        novo_status=dados.status,
        parecer=dados.parecer,
    )
