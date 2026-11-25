import type {
  AtributoDetalhe,
  FiltrosListagem,
  HomologacaoPayload,
  ListaAtributosResponse,
  ListaMeusAtributosResponse,
  NovoAtributoPayload,
  RessubmissaoPayload,
  TokenResponse,
  UsuarioAutenticado,
} from "./types.js";

const TOKEN_KEY = "homologador_token";

export class ErroApi extends Error {
  status: number;

  constructor(mensagem: string, status: number) {
    super(mensagem);
    this.name = "ErroApi";
    this.status = status;
  }
}

export function obterToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function salvarToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function limparToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

interface DetalheValidacao {
  msg: string;
}

interface CorpoErroApi {
  detail?: string | DetalheValidacao[];
}

async function requisitar<T>(caminho: string, opcoes: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(opcoes.headers as Record<string, string> | undefined),
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
    return undefined as T;
  }

  let dados: unknown = null;
  try {
    dados = await resposta.json();
  } catch {
    dados = null;
  }

  if (!resposta.ok) {
    const corpo = dados as CorpoErroApi | null;
    const detalhe =
      typeof corpo?.detail === "string"
        ? corpo.detail
        : Array.isArray(corpo?.detail)
          ? corpo.detail.map((e) => e.msg).join("; ")
          : "Não foi possível concluir a operação.";
    throw new ErroApi(detalhe, resposta.status);
  }

  return dados as T;
}

export const api = {
  cadastrar(email: string, senha: string): Promise<TokenResponse> {
    return requisitar<TokenResponse>("/api/auth/cadastro", {
      method: "POST",
      body: JSON.stringify({ email, senha }),
    });
  },

  login(email: string, senha: string): Promise<TokenResponse> {
    return requisitar<TokenResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, senha }),
    });
  },

  me(): Promise<UsuarioAutenticado> {
    return requisitar<UsuarioAutenticado>("/api/auth/me");
  },

  listarAtributos({
    busca = "",
    status = "",
    apenasMeus = false,
  }: FiltrosListagem = {}): Promise<ListaAtributosResponse> {
    const params = new URLSearchParams();
    if (busca) params.set("busca", busca);
    if (status) params.set("status", status);
    if (apenasMeus) params.set("apenas_meus", "true");
    const qs = params.toString();
    return requisitar<ListaAtributosResponse>(`/api/atributos${qs ? `?${qs}` : ""}`);
  },

  meusAtributos(status = ""): Promise<ListaMeusAtributosResponse> {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    const qs = params.toString();
    return requisitar<ListaMeusAtributosResponse>(`/api/atributos/meus${qs ? `?${qs}` : ""}`);
  },

  detalharAtributo(id: number): Promise<AtributoDetalhe> {
    return requisitar<AtributoDetalhe>(`/api/atributos/${id}`);
  },

  criarAtributo(payload: NovoAtributoPayload): Promise<AtributoDetalhe> {
    return requisitar<AtributoDetalhe>("/api/atributos", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  ressubmeterAtributo(id: number, payload: RessubmissaoPayload): Promise<AtributoDetalhe> {
    return requisitar<AtributoDetalhe>(`/api/atributos/${id}/ressubmeter`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  homologarAtributo(id: number, payload: HomologacaoPayload): Promise<AtributoDetalhe> {
    return requisitar<AtributoDetalhe>(`/api/atributos/${id}/homologar`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  excluirAtributo(id: number): Promise<void> {
    return requisitar<void>(`/api/atributos/${id}`, {
      method: "DELETE",
    });
  },
};
