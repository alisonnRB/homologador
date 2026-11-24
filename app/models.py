from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class Usuario(Base):
    __tablename__ = "usuarios"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    senha_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    perfil: Mapped[str] = mapped_column(String(50), nullable=False, default="usuario")
    criado_em: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=utc_now)

    atributos: Mapped[list["Atributo"]] = relationship(
        "Atributo",
        back_populates="usuario",
        cascade="all, delete-orphan",
    )
    homologacoes_realizadas: Mapped[list["Homologacao"]] = relationship(
        "Homologacao",
        back_populates="homologador",
        foreign_keys="Homologacao.homologador_id",
    )


class StatusHomologacao(Base):
    __tablename__ = "status_homologacao"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    nome: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)

    homologacoes: Mapped[list["Homologacao"]] = relationship(
        "Homologacao",
        back_populates="status",
    )


class Atributo(Base):
    __tablename__ = "atributos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    usuario_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("usuarios.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    nome: Mapped[str] = mapped_column(String(150), nullable=False)
    descricao: Mapped[str] = mapped_column(Text, nullable=False)
    criado_em: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=utc_now)

    usuario: Mapped["Usuario"] = relationship("Usuario", back_populates="atributos")
    homologacoes: Mapped[list["Homologacao"]] = relationship(
        "Homologacao",
        back_populates="atributo",
        cascade="all, delete-orphan",
        order_by="desc(Homologacao.homologado_em), desc(Homologacao.id)",
    )


class Homologacao(Base):
    __tablename__ = "homologacoes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    atributo_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("atributos.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    homologador_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("usuarios.id", ondelete="SET NULL"),
        nullable=True,
    )
    status_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("status_homologacao.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    parecer: Mapped[str | None] = mapped_column(Text, nullable=True)
    homologado_em: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=utc_now)

    atributo: Mapped["Atributo"] = relationship("Atributo", back_populates="homologacoes")
    homologador: Mapped["Usuario | None"] = relationship(
        "Usuario",
        back_populates="homologacoes_realizadas",
        foreign_keys=[homologador_id],
    )
    status: Mapped["StatusHomologacao"] = relationship(
        "StatusHomologacao",
        back_populates="homologacoes",
    )
