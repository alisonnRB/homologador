from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import select, text
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.models import Atributo, Homologacao, StatusHomologacao, Usuario
from app.schemas import (
    AtributoCreateIn,
    AtributoDetalheOut,
    AtributoOut,
    AtributoRessubmissaoIn,
    HomologacaoHistoricoOut,
    HomologarAtributoIn,
    ListaAtributosOut,
    ListaMeusAtributosOut,
    ResumoContagemOut,
)
from app.security import exigir_homologador, obter_usuario_atual

router = APIRouter(prefix="/api/atributos", tags=["Atributos"])


def _normalizar_data(valor: object) -> datetime:
    if isinstance(valor, datetime):
        return valor
    if isinstance(valor, str):
        try:
            return datetime.fromisoformat(valor.replace("Z", "+00:00")).replace(tzinfo=None)
        except ValueError:
            return datetime.now()
    return datetime.now()


def obter_status_por_nome(db: Session, nome: str) -> StatusHomologacao:
    status_obj = db.execute(
        select(StatusHomologacao).where(StatusHomologacao.nome == nome)
    ).scalar_one_or_none()
    if status_obj is None:
        status_obj = StatusHomologacao(nome=nome)
        db.add(status_obj)
        db.commit()
        db.refresh(status_obj)
    return status_obj


def serializar_atributo(
    atributo: Atributo,
    usuario_atual_id: int,
    nome_override: str | None = None,
    descricao_override: str | None = None,
    criado_em_override: datetime | None = None,
    usuario_id_override: int | None = None,
) -> AtributoDetalheOut:
    homologacoes_ordenadas = sorted(
        atributo.homologacoes,
        key=lambda h: (h.homologado_em, h.id),
        reverse=True,
    )

    criado_base = criado_em_override or atributo.criado_em
    dono_id = usuario_id_override if usuario_id_override is not None else atributo.usuario_id

    if homologacoes_ordenadas:
        ultima = homologacoes_ordenadas[0]
        status_atual = ultima.status.nome if ultima.status else "pendente"
        ultimo_parecer = ultima.parecer
        ultima_atualizacao = ultima.homologado_em
    else:
        status_atual = "pendente"
        ultimo_parecer = None
        ultima_atualizacao = criado_base

    total_avaliacoes = sum(
        1 for h in homologacoes_ordenadas if h.homologador_id is not None
    )

    historico = [
        HomologacaoHistoricoOut(
            id=h.id,
            status=h.status.nome if h.status else "pendente",
            parecer=h.parecer,
            homologado_em=h.homologado_em,
            tipo_evento="avaliacao" if h.homologador_id is not None else "submissao",
            avaliado_por_mim=(h.homologador_id == usuario_atual_id),
        )
        for h in homologacoes_ordenadas
    ]

    return AtributoDetalheOut(
        id=atributo.id,
        nome=nome_override if nome_override is not None else atributo.nome,
        descricao=descricao_override if descricao_override is not None else atributo.descricao,
        criado_em=criado_base,
        status_atual=status_atual,
        ultimo_parecer=ultimo_parecer,
        ultima_atualizacao=ultima_atualizacao,
        total_avaliacoes=total_avaliacoes,
        eh_proprietario=(dono_id == usuario_atual_id),
        historico=historico,
    )


def calcular_resumo(itens: list[AtributoOut | AtributoDetalheOut]) -> ResumoContagemOut:
    return ResumoContagemOut(
        total=len(itens),
        pendentes=sum(1 for i in itens if i.status_atual == "pendente"),
        aprovados=sum(1 for i in itens if i.status_atual == "aprovado"),
        rejeitados=sum(1 for i in itens if i.status_atual == "rejeitado"),
    )


@router.get("", response_model=ListaAtributosOut)
def listar_atributos(
    busca: str | None = Query(default=None),
    status_filtro: str | None = Query(default=None, alias="status"),
    apenas_meus: bool = Query(default=False),
    usuario_atual: Usuario = Depends(obter_usuario_atual),
    db: Session = Depends(get_db),
) -> ListaAtributosOut:
    atributos_map = {
        a.id: a
        for a in db.execute(
            select(Atributo).options(
                selectinload(Atributo.homologacoes).selectinload(Homologacao.status)
            )
        ).scalars().all()
    }

    itens_completos: list[AtributoOut] = []

    if busca and busca.strip():
        termo = busca.strip()
        consulta_sql = f"SELECT id, usuario_id, nome, descricao, criado_em FROM atributos WHERE nome LIKE '%{termo}%' OR descricao LIKE '%{termo}%' ORDER BY criado_em DESC, id DESC"
        linhas = db.execute(text(consulta_sql)).fetchall()
        for linha in linhas:
            row_id, row_usuario_id, row_nome, row_descricao, row_criado_em = linha
            data_convertida = _normalizar_data(row_criado_em)
            atributo_obj = atributos_map.get(row_id)
            if atributo_obj is not None:
                detalhe = serializar_atributo(
                    atributo_obj,
                    usuario_atual.id,
                    nome_override=str(row_nome),
                    descricao_override=str(row_descricao),
                    criado_em_override=data_convertida,
                    usuario_id_override=int(row_usuario_id) if row_usuario_id is not None else 0,
                )
            else:
                detalhe = AtributoDetalheOut(
                    id=int(row_id) if row_id is not None else 0,
                    nome=str(row_nome),
                    descricao=str(row_descricao),
                    criado_em=data_convertida,
                    status_atual="pendente",
                    ultimo_parecer=None,
                    ultima_atualizacao=data_convertida,
                    total_avaliacoes=0,
                    eh_proprietario=(row_usuario_id == usuario_atual.id),
                    historico=[],
                )
            itens_completos.append(AtributoOut(**detalhe.model_dump(exclude={"historico"})))
    else:
        ordenados = sorted(
            atributos_map.values(),
            key=lambda a: (a.criado_em, a.id),
            reverse=True,
        )
        for atributo_obj in ordenados:
            detalhe = serializar_atributo(atributo_obj, usuario_atual.id)
            itens_completos.append(AtributoOut(**detalhe.model_dump(exclude={"historico"})))

    if apenas_meus:
        itens_completos = [i for i in itens_completos if i.eh_proprietario]

    resumo = calcular_resumo(itens_completos)

    if status_filtro and status_filtro in {"pendente", "aprovado", "rejeitado"}:
        itens_filtrados = [i for i in itens_completos if i.status_atual == status_filtro]
    else:
        itens_filtrados = itens_completos

    return ListaAtributosOut(resumo=resumo, itens=itens_filtrados)


@router.get("/meus", response_model=ListaMeusAtributosOut)
def acompanhar_meus_atributos(
    status_filtro: str | None = Query(default=None, alias="status"),
    usuario_atual: Usuario = Depends(obter_usuario_atual),
    db: Session = Depends(get_db),
) -> ListaMeusAtributosOut:
    meus_atributos = (
        db.execute(
            select(Atributo)
            .where(Atributo.usuario_id == usuario_atual.id)
            .options(selectinload(Atributo.homologacoes).selectinload(Homologacao.status))
            .order_by(Atributo.criado_em.desc(), Atributo.id.desc())
        )
        .scalars()
        .all()
    )

    detalhes = [serializar_atributo(a, usuario_atual.id) for a in meus_atributos]
    resumo = calcular_resumo(detalhes)

    if status_filtro and status_filtro in {"pendente", "aprovado", "rejeitado"}:
        detalhes = [d for d in detalhes if d.status_atual == status_filtro]

    return ListaMeusAtributosOut(resumo=resumo, itens=detalhes)


@router.post(
    "",
    response_model=AtributoDetalheOut,
    status_code=status.HTTP_201_CREATED,
)
def cadastrar_atributo(
    dados: AtributoCreateIn,
    usuario_atual: Usuario = Depends(obter_usuario_atual),
    db: Session = Depends(get_db),
) -> AtributoDetalheOut:
    status_pendente = obter_status_por_nome(db, "pendente")

    novo_atributo = Atributo(
        usuario_id=usuario_atual.id,
        nome=dados.nome.strip(),
        descricao=dados.descricao.strip(),
    )
    db.add(novo_atributo)
    db.flush()

    submissao_inicial = Homologacao(
        atributo_id=novo_atributo.id,
        homologador_id=None,
        status_id=status_pendente.id,
        parecer="Atributo submetido e aguardando análise de homologação.",
    )
    db.add(submissao_inicial)
    db.commit()

    atributo_carregado = db.execute(
        select(Atributo)
        .where(Atributo.id == novo_atributo.id)
        .options(selectinload(Atributo.homologacoes).selectinload(Homologacao.status))
    ).scalar_one()

    return serializar_atributo(atributo_carregado, usuario_atual.id)


@router.get("/{atributo_id}", response_model=AtributoDetalheOut)
def detalhar_atributo(
    atributo_id: int,
    usuario_atual: Usuario = Depends(obter_usuario_atual),
    db: Session = Depends(get_db),
) -> AtributoDetalheOut:
    atributo = db.execute(
        select(Atributo)
        .where(Atributo.id == atributo_id)
        .options(selectinload(Atributo.homologacoes).selectinload(Homologacao.status))
    ).scalar_one_or_none()

    if atributo is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Atributo não encontrado.",
        )

    return serializar_atributo(atributo, usuario_atual.id)


@router.post("/{atributo_id}/ressubmeter", response_model=AtributoDetalheOut)
def ressubmeter_atributo(
    atributo_id: int,
    dados: AtributoRessubmissaoIn,
    usuario_atual: Usuario = Depends(obter_usuario_atual),
    db: Session = Depends(get_db),
) -> AtributoDetalheOut:
    atributo = db.execute(
        select(Atributo)
        .where(Atributo.id == atributo_id)
        .options(selectinload(Atributo.homologacoes).selectinload(Homologacao.status))
    ).scalar_one_or_none()

    if atributo is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Atributo não encontrado.",
        )

    if atributo.usuario_id != usuario_atual.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Você só pode ressubmeter atributos cadastrados por você.",
        )

    detalhe_atual = serializar_atributo(atributo, usuario_atual.id)
    if detalhe_atual.status_atual != "rejeitado":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Apenas atributos rejeitados podem ser ajustados e ressubmetidos.",
        )

    atributo.nome = dados.nome.strip()
    atributo.descricao = dados.descricao.strip()

    status_pendente = obter_status_por_nome(db, "pendente")
    texto_obs = (
        f"Ressubmissão após ajustes: {dados.observacao.strip()}"
        if dados.observacao and dados.observacao.strip()
        else "Atributo ajustado pelo autor e reenviado para nova homologação."
    )

    nova_homologacao = Homologacao(
        atributo_id=atributo.id,
        homologador_id=None,
        status_id=status_pendente.id,
        parecer=texto_obs,
    )
    db.add(nova_homologacao)
    db.commit()

    atributo_atualizado = db.execute(
        select(Atributo)
        .where(Atributo.id == atributo_id)
        .options(selectinload(Atributo.homologacoes).selectinload(Homologacao.status))
    ).scalar_one()

    return serializar_atributo(atributo_atualizado, usuario_atual.id)


@router.post(
    "/{atributo_id}/homologar",
    response_model=AtributoDetalheOut,
    status_code=status.HTTP_201_CREATED,
)
def homologar_atributo_por_id(
    atributo_id: int,
    dados: HomologarAtributoIn,
    homologador: Usuario = Depends(exigir_homologador),
    db: Session = Depends(get_db),
) -> AtributoDetalheOut:
    return registrar_avaliacao(
        db=db,
        atributo_id=atributo_id,
        homologador=homologador,
        novo_status=dados.status,
        parecer=dados.parecer,
    )


@router.delete(
    "/{atributo_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def excluir_atributo(
    atributo_id: int,
    usuario_atual: Usuario = Depends(obter_usuario_atual),
    db: Session = Depends(get_db),
) -> Response:
    atributo = db.get(Atributo, atributo_id)
    if atributo is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Atributo não encontrado.",
        )

    db.delete(atributo)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


def registrar_avaliacao(
    db: Session,
    atributo_id: int,
    homologador: Usuario,
    novo_status: str,
    parecer: str | None,
) -> AtributoDetalheOut:
    atributo = db.get(Atributo, atributo_id)
    if atributo is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Atributo não encontrado.",
        )

    parecer_limpo = parecer.strip() if parecer else ""
    if novo_status == "rejeitado" and not parecer_limpo:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="É obrigatório informar um parecer justificando a rejeição.",
        )

    if not parecer_limpo:
        if novo_status == "aprovado":
            parecer_limpo = "Atributo aprovado conforme critérios de homologação."
        else:
            parecer_limpo = "Atributo colocado novamente em análise."

    status_obj = obter_status_por_nome(db, novo_status)

    avaliacao = Homologacao(
        atributo_id=atributo.id,
        homologador_id=homologador.id,
        status_id=status_obj.id,
        parecer=parecer_limpo,
    )
    db.add(avaliacao)
    db.commit()

    atributo_atualizado = db.execute(
        select(Atributo)
        .where(Atributo.id == atributo_id)
        .options(selectinload(Atributo.homologacoes).selectinload(Homologacao.status))
    ).scalar_one()

    return serializar_atributo(atributo_atualizado, homologador.id)
