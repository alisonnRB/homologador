const TOKEN_KEY = "homologador_token";

export function obterToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function salvarToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function limparToken() {
  localStorage.removeItem(TOKEN_KEY);
}

async function requisitar(caminho, opcoes = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(opcoes.headers || {}),
  };

  const token = obterToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const resposta = await fetch(caminho, {
    ...opcoes,
    headers,
  });

  if (resposta.status === 204) {
    return null;
  }

  let dados = null;
  try {
    dados = await resposta.json();
  } catch {
    dados = null;
  }

  if (!resposta.ok) {
    const detalhe =
      dados?.detail && typeof dados.detail === "string"
        ? dados.detail
        : Array.isArray(dados?.detail)
          ? dados.detail.map((e) => e.msg).join("; ")
          : "Não foi possível concluir a operação.";
    const erro = new Error(detalhe);
    erro.status = resposta.status;
    throw erro;
  }

  return dados;
}

export const api = {
  cadastrar(email, senha) {
    return requisitar("/api/auth/cadastro", {
      method: "POST",
      body: JSON.stringify({ email, senha }),
    });
  },

  login(email, senha) {
    return requisitar("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, senha }),
    });
  },

  me() {
    return requisitar("/api/auth/me");
  },

  listarAtributos({ busca = "", status = "", apenasMeus = false } = {}) {
    const params = new URLSearchParams();
    if (busca) params.set("busca", busca);
    if (status) params.set("status", status);
    if (apenasMeus) params.set("apenas_meus", "true");
    const qs = params.toString();
    return requisitar(`/api/atributos${qs ? `?${qs}` : ""}`);
  },

  meusAtributos({ status = "" } = {}) {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    const qs = params.toString();
    return requisitar(`/api/atributos/meus${qs ? `?${qs}` : ""}`);
  },

  detalharAtributo(id) {
    return requisitar(`/api/atributos/${id}`);
  },

  criarAtributo({ nome, descricao }) {
    return requisitar("/api/atributos", {
      method: "POST",
      body: JSON.stringify({ nome, descricao }),
    });
  },

  ressubmeterAtributo(id, { nome, descricao, observacao }) {
    return requisitar(`/api/atributos/${id}/ressubmeter`, {
      method: "POST",
      body: JSON.stringify({ nome, descricao, observacao }),
    });
  },

  homologarAtributo(id, { status, parecer }) {
    return requisitar(`/api/atributos/${id}/homologar`, {
      method: "POST",
      body: JSON.stringify({ status, parecer }),
    });
  },

  excluirAtributo(id) {
    return requisitar(`/api/atributos/${id}`, {
      method: "DELETE",
    });
  },
};
