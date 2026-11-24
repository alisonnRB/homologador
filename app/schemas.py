from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UsuarioCadastroIn(BaseModel):
    email: EmailStr
    senha: str = Field(..., min_length=6, max_length=128)
    perfil: str = "usuario"


class UsuarioLoginIn(BaseModel):
    email: EmailStr
    senha: str = Field(..., min_length=1, max_length=128)


class UsuarioAutenticadoOut(BaseModel):
    id: int
    email: EmailStr
    perfil: str
    criado_em: datetime

    model_config = ConfigDict(from_attributes=True)


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    usuario: UsuarioAutenticadoOut


class AtributoCreateIn(BaseModel):
    nome: str = Field(..., min_length=2, max_length=150)
    descricao: str = Field(..., min_length=3, max_length=4000)


class AtributoRessubmissaoIn(BaseModel):
    nome: str = Field(..., min_length=2, max_length=150)
    descricao: str = Field(..., min_length=3, max_length=4000)
    observacao: str | None = Field(default=None, max_length=1000)


class HomologacaoCreateIn(BaseModel):
    atributo_id: int
    status: Literal["aprovado", "rejeitado", "pendente"]
    parecer: str | None = Field(default=None, max_length=4000)


class HomologarAtributoIn(BaseModel):
    status: Literal["aprovado", "rejeitado", "pendente"]
    parecer: str | None = Field(default=None, max_length=4000)


class StatusHomologacaoOut(BaseModel):
    id: int
    nome: str

    model_config = ConfigDict(from_attributes=True)


class HomologacaoHistoricoOut(BaseModel):
    id: int
    status: str
    parecer: str | None
    homologado_em: datetime
    tipo_evento: Literal["submissao", "avaliacao"]
    avaliado_por_mim: bool


class AtributoOut(BaseModel):
    id: int
    nome: str
    descricao: str
    criado_em: datetime
    status_atual: str
    ultimo_parecer: str | None
    ultima_atualizacao: datetime
    total_avaliacoes: int
    eh_proprietario: bool


class AtributoDetalheOut(AtributoOut):
    historico: list[HomologacaoHistoricoOut]


class ResumoContagemOut(BaseModel):
    total: int
    pendentes: int
    aprovados: int
    rejeitados: int


class ListaAtributosOut(BaseModel):
    resumo: ResumoContagemOut
    itens: list[AtributoOut]


class ListaMeusAtributosOut(BaseModel):
    resumo: ResumoContagemOut
    itens: list[AtributoDetalheOut]
