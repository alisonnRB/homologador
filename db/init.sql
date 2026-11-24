-- Inicialização do banco de dados PostgreSQL - Homologador de Atributos

CREATE TABLE IF NOT EXISTS usuarios (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    senha_hash VARCHAR(255) NOT NULL,
    perfil VARCHAR(50) NOT NULL DEFAULT 'usuario',
    criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS status_homologacao (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS atributos (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    nome VARCHAR(150) NOT NULL,
    descricao TEXT NOT NULL,
    criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS homologacoes (
    id SERIAL PRIMARY KEY,
    atributo_id INTEGER NOT NULL REFERENCES atributos(id) ON DELETE CASCADE,
    homologador_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    status_id INTEGER NOT NULL REFERENCES status_homologacao(id) ON DELETE RESTRICT,
    parecer TEXT,
    homologado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_atributos_usuario_id ON atributos(usuario_id);
CREATE INDEX IF NOT EXISTS idx_homologacoes_atributo_id ON homologacoes(atributo_id);
CREATE INDEX IF NOT EXISTS idx_homologacoes_status_id ON homologacoes(status_id);

INSERT INTO status_homologacao (nome) VALUES
    ('pendente'),
    ('aprovado'),
    ('rejeitado')
ON CONFLICT (nome) DO NOTHING;
