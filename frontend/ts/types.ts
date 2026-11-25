export type PerfilUsuario = "usuario" | "homologador" | string;

export type StatusHomologacaoNome = "pendente" | "aprovado" | "rejeitado";

export type VisaoApp = "meus" | "catalogo" | "fila";

export type TipoToast = "info" | "success" | "error";

export interface UsuarioAutenticado {
  id: number;
  email: string;
  perfil: PerfilUsuario;
  criado_em: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  usuario: UsuarioAutenticado;
}

export interface HomologacaoHistorico {
  id: number;
  status: StatusHomologacaoNome;
  parecer: string | null;
  homologado_em: string;
  tipo_evento: "submissao" | "avaliacao";
  avaliado_por_mim: boolean;
}

export interface Atributo {
  id: number;
  nome: string;
  descricao: string;
  criado_em: string;
  status_atual: StatusHomologacaoNome;
  ultimo_parecer: string | null;
  ultima_atualizacao: string;
  total_avaliacoes: number;
  eh_proprietario: boolean;
}

export interface AtributoDetalhe extends Atributo {
  historico: HomologacaoHistorico[];
}

export interface ResumoContagem {
  total: number;
  pendentes: number;
  aprovados: number;
  rejeitados: number;
}

export interface ListaAtributosResponse {
  resumo: ResumoContagem;
  itens: Atributo[];
}

export interface ListaMeusAtributosResponse {
  resumo: ResumoContagem;
  itens: AtributoDetalhe[];
}

export interface FiltrosListagem {
  busca?: string;
  status?: string;
  apenasMeus?: boolean;
}

export interface NovoAtributoPayload {
  nome: string;
  descricao: string;
}

export interface RessubmissaoPayload {
  nome: string;
  descricao: string;
  observacao?: string;
}

export interface HomologacaoPayload {
  status: StatusHomologacaoNome;
  parecer: string;
}
