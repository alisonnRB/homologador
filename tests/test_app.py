import os
from pathlib import Path

TEST_DB_PATH = Path("/tmp/test_homologador.sqlite3")
if TEST_DB_PATH.exists():
    TEST_DB_PATH.unlink()

os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB_PATH}"
os.environ["ADMIN_EMAIL"] = "homologador@sistema.com"
os.environ["ADMIN_PASSWORD"] = "Homologador@123"

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.database import Base, SessionLocal, engine
from app.main import app
from app.models import Usuario
from app.seed import inicializar_dados_iniciais


@pytest.fixture(autouse=True)
def preparar_banco():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        inicializar_dados_iniciais(db)
    yield


@pytest.fixture()
def client():
    return TestClient(app)


def headers_auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_cadastro_login_e_hash_senha(client: TestClient):
    resp_cad = client.post(
        "/api/auth/cadastro",
        json={"email": "alice@exemplo.com", "senha": "SenhaSegura123"},
    )
    assert resp_cad.status_code == 201
    dados = resp_cad.json()
    assert dados["usuario"]["email"] == "alice@exemplo.com"
    assert dados["usuario"]["perfil"] == "usuario"
    assert "access_token" in dados

    with SessionLocal() as db:
        usuario_db = db.execute(
            select(Usuario).where(Usuario.email == "alice@exemplo.com")
        ).scalar_one()
        assert usuario_db.senha_hash != "SenhaSegura123"
        assert usuario_db.senha_hash.startswith("$2b$")

    resp_login = client.post(
        "/api/auth/login",
        json={"email": "alice@exemplo.com", "senha": "SenhaSegura123"},
    )
    assert resp_login.status_code == 200
    token = resp_login.json()["access_token"]

    resp_me = client.get("/api/auth/me", headers=headers_auth(token))
    assert resp_me.status_code == 200
    assert resp_me.json()["email"] == "alice@exemplo.com"


def test_fluxo_completo_homologacao_acompanhamento_e_privacidade(client: TestClient):
    # Usuário A cadastra um atributo
    cad_a = client.post(
        "/api/auth/cadastro",
        json={"email": "autor@privado.com", "senha": "123456"},
    ).json()
    token_a = cad_a["access_token"]

    novo_attr = client.post(
        "/api/atributos",
        headers=headers_auth(token_a),
        json={
            "nome": "cpf_titular",
            "descricao": "Documento numérico de 11 dígitos sem máscara.",
        },
    )
    assert novo_attr.status_code == 201
    attr_id = novo_attr.json()["id"]
    assert novo_attr.json()["status_atual"] == "pendente"

    # Usuário B consulta atributos (RF04) e não deve ver e-mail de A (RNF01)
    cad_b = client.post(
        "/api/auth/cadastro",
        json={"email": "outro@privado.com", "senha": "123456"},
    ).json()
    token_b = cad_b["access_token"]

    lista_b = client.get("/api/atributos", headers=headers_auth(token_b))
    assert lista_b.status_code == 200
    texto_resposta = lista_b.text
    assert "autor@privado.com" not in texto_resposta
    assert lista_b.json()["itens"][0]["eh_proprietario"] is False

    # Usuário comum B tenta homologar e recebe 403 (RF05)
    tentativa_homologar = client.post(
        f"/api/atributos/{attr_id}/homologar",
        headers=headers_auth(token_b),
        json={"status": "aprovado", "parecer": "Tentativa indevida"},
    )
    assert tentativa_homologar.status_code == 403

    # Homologador autorizado rejeita inicialmente com parecer
    login_homologador = client.post(
        "/api/auth/login",
        json={"email": "homologador@sistema.com", "senha": "Homologador@123"},
    ).json()
    token_h = login_homologador["access_token"]

    rejeicao = client.post(
        f"/api/atributos/{attr_id}/homologar",
        headers=headers_auth(token_h),
        json={
            "status": "rejeitado",
            "parecer": "Especificar regra de validação dos dígitos verificadores.",
        },
    )
    assert rejeicao.status_code == 201
    assert rejeicao.json()["status_atual"] == "rejeitado"

    # Autor acompanha (RF06), não vê e-mail do homologador (RNF01) e ressubmete
    meus_a = client.get("/api/atributos/meus", headers=headers_auth(token_a))
    assert meus_a.status_code == 200
    assert "homologador@sistema.com" not in meus_a.text
    assert meus_a.json()["resumo"]["rejeitados"] == 1

    ressub = client.post(
        f"/api/atributos/{attr_id}/ressubmeter",
        headers=headers_auth(token_a),
        json={
            "nome": "cpf_titular",
            "descricao": "Documento de 11 dígitos com validação módulo 11 dos DVs.",
            "observacao": "Adicionada regra módulo 11.",
        },
    )
    assert ressub.status_code == 200
    assert ressub.json()["status_atual"] == "pendente"

    # Homologador aprova na nova avaliação, preservando o histórico
    aprovacao = client.post(
        f"/api/atributos/{attr_id}/homologar",
        headers=headers_auth(token_h),
        json={"status": "aprovado", "parecer": "Especificação completa e aprovada."},
    )
    assert aprovacao.status_code == 201
    detalhe_final = aprovacao.json()
    assert detalhe_final["status_atual"] == "aprovado"
    assert detalhe_final["total_avaliacoes"] == 2
    assert len(detalhe_final["historico"]) == 4

