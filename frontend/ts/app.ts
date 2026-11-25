import { ErroApi, api, limparToken, obterToken, salvarToken } from "./api.js";
import type {
  Atributo,
  AtributoDetalhe,
  ResumoContagem,
  StatusHomologacaoNome,
  TipoToast,
  UsuarioAutenticado,
  VisaoApp,
} from "./types.js";

interface EstadoAplicacao {
  usuario: UsuarioAutenticado | null;
  visaoAtual: VisaoApp;
  filtroStatus: string;
  termoBusca: string;
  atributoSelecionado: AtributoDetalhe | null;
}

const estado: EstadoAplicacao = {
  usuario: null,
  visaoAtual: "meus",
  filtroStatus: "",
  termoBusca: "",
  atributoSelecionado: null,
};

function buscarElemento<T extends HTMLElement>(id: string): T {
  const elemento = document.getElementById(id);
  if (!elemento) {
    throw new Error(`Elemento DOM #${id} não encontrado.`);
  }
  return elemento as T;
}

const el = {
  authScreen: buscarElemento<HTMLElement>("auth-screen"),
  appScreen: buscarElemento<HTMLElement>("app-screen"),
  tabLogin: buscarElemento<HTMLButtonElement>("tab-login"),
  tabRegister: buscarElemento<HTMLButtonElement>("tab-register"),
  loginForm: buscarElemento<HTMLFormElement>("login-form"),
  registerForm: buscarElemento<HTMLFormElement>("register-form"),
  authAlert: buscarElemento<HTMLElement>("auth-alert"),
  userEmailDisplay: buscarElemento<HTMLElement>("user-email-display"),
  userRoleBadge: buscarElemento<HTMLElement>("user-role-badge"),
  navFila: buscarElemento<HTMLButtonElement>("nav-fila-homologacao"),
  viewTitle: buscarElemento<HTMLElement>("view-title"),
  viewDescription: buscarElemento<HTMLElement>("view-description"),
  statTotal: buscarElemento<HTMLElement>("stat-total"),
  statPendentes: buscarElemento<HTMLElement>("stat-pendentes"),
  statAprovados: buscarElemento<HTMLElement>("stat-aprovados"),
  statRejeitados: buscarElemento<HTMLElement>("stat-rejeitados"),
  searchForm: buscarElemento<HTMLFormElement>("search-form"),
  searchInput: buscarElemento<HTMLInputElement>("search-input"),
  btnLimparBusca: buscarElemento<HTMLButtonElement>("btn-limpar-busca"),
  attributesList: buscarElemento<HTMLElement>("attributes-list"),
  modalFormBackdrop: buscarElemento<HTMLElement>("modal-form-backdrop"),
  modalFormTitle: buscarElemento<HTMLElement>("modal-form-title"),
  atributoForm: buscarElemento<HTMLFormElement>("atributo-form"),
  atributoEditId: buscarElemento<HTMLInputElement>("atributo-edit-id"),
  atributoNome: buscarElemento<HTMLInputElement>("atributo-nome"),
  atributoDescricao: buscarElemento<HTMLTextAreaElement>("atributo-descricao"),
  grupoObservacao: buscarElemento<HTMLElement>("grupo-observacao-ressubmissao"),
  atributoObservacao: buscarElemento<HTMLInputElement>("atributo-observacao"),
  btnSubmitForm: buscarElemento<HTMLButtonElement>("btn-submit-form"),
  modalDetailBackdrop: buscarElemento<HTMLElement>("modal-detail-backdrop"),
  detailNome: buscarElemento<HTMLElement>("detail-nome"),
  detailStatusBadge: buscarElemento<HTMLElement>("detail-status-badge"),
  detailMeta: buscarElemento<HTMLElement>("detail-meta"),
  detailDescricao: buscarElemento<HTMLElement>("detail-descricao"),
  homologacaoPanel: buscarElemento<HTMLElement>("homologacao-panel"),
  homologacaoForm: buscarElemento<HTMLFormElement>("homologacao-form"),
  homologacaoParecer: buscarElemento<HTMLTextAreaElement>("homologacao-parecer"),
  detailTimeline: buscarElemento<HTMLElement>("detail-timeline"),
  detailOwnerActions: buscarElemento<HTMLElement>("detail-owner-actions"),
  toastContainer: buscarElemento<HTMLElement>("toast-container"),
};

function mostrarToast(mensagem: string, tipo: TipoToast = "info"): void {
  const toast = document.createElement("div");
  toast.className = `toast ${tipo}`;
  toast.textContent = mensagem;
  el.toastContainer.appendChild(toast);
  window.setTimeout(() => toast.remove(), 3600);
}

function escaparTexto(valor: string | null | undefined): string {
  const div = document.createElement("div");
  div.textContent = valor ?? "";
  return div.innerHTML;
}

function formatarData(isoString: string | null | undefined): string {
  if (!isoString) return "-";
  const data = new Date(isoString.endsWith("Z") ? isoString : `${isoString}Z`);
  if (Number.isNaN(data.getTime())) return isoString;
  return data.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function rotuloStatus(status: string): string {
  const mapa: Record<string, string> = {
    pendente: "Pendente",
    aprovado: "Aprovado",
    rejeitado: "Rejeitado",
  };
  return mapa[status] || status;
}

function extrairMensagemErro(erro: unknown): string {
  if (erro instanceof Error) return erro.message;
  return "Ocorreu um erro inesperado.";
}

function definirAlertaAuth(mensagem = ""): void {
  if (!mensagem) {
    el.authAlert.classList.add("hidden");
    el.authAlert.textContent = "";
    return;
  }
  el.authAlert.textContent = mensagem;
  el.authAlert.classList.remove("hidden");
}

function alternarAbaAuth(modo: "login" | "register"): void {
  definirAlertaAuth("");
  const ehLogin = modo === "login";
  el.tabLogin.classList.toggle("active", ehLogin);
  el.tabRegister.classList.toggle("active", !ehLogin);
  el.loginForm.classList.toggle("hidden", !ehLogin);
  el.registerForm.classList.toggle("hidden", ehLogin);
}

function configurarSessao(usuario: UsuarioAutenticado): void {
  estado.usuario = usuario;
  el.authScreen.classList.add("hidden");
  el.appScreen.classList.remove("hidden");

  el.userEmailDisplay.textContent = usuario.email;
  const ehHomologador = usuario.perfil === "homologador";
  el.userRoleBadge.textContent = ehHomologador ? "Homologador" : "Usuário";
  el.userRoleBadge.className = `role-badge ${ehHomologador ? "role-homologador" : "role-usuario"}`;
  el.navFila.classList.toggle("hidden", !ehHomologador);

  mudarVisao(ehHomologador ? "fila" : "meus");
}

function encerrarSessao(): void {
  limparToken();
  estado.usuario = null;
  el.appScreen.classList.add("hidden");
  el.authScreen.classList.remove("hidden");
  el.loginForm.reset();
  el.registerForm.reset();
}

function atualizarCabecalhoVisao(): void {
  document.querySelectorAll<HTMLButtonElement>(".view-tab").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.view === estado.visaoAtual);
  });

  if (estado.visaoAtual === "meus") {
    el.viewTitle.textContent = "Meus Atributos — Acompanhamento";
    el.viewDescription.textContent =
      "Acompanhe o status, consulte pareceres de homologação e ajuste atributos rejeitados.";
  } else if (estado.visaoAtual === "fila") {
    el.viewTitle.textContent = "Fila de Homologação";
    el.viewDescription.textContent =
      "Avalie atributos submetidos, registre seu parecer técnico e aprove ou rejeite solicitações.";
  } else {
    el.viewTitle.textContent = "Consulta Geral de Atributos";
    el.viewDescription.textContent =
      "Visualize todos os atributos cadastrados na plataforma e seus respectivos status.";
  }
}

function mudarVisao(novaVisao: VisaoApp): void {
  estado.visaoAtual = novaVisao;
  estado.filtroStatus = novaVisao === "fila" ? "pendente" : "";
  atualizarBotoesFiltro();
  atualizarCabecalhoVisao();
  void carregarListaAtributos();
}

function atualizarBotoesFiltro(): void {
  document.querySelectorAll<HTMLButtonElement>(".filter-pill").forEach((pill) => {
    pill.classList.toggle("active", (pill.dataset.status ?? "") === estado.filtroStatus);
  });
}

function atualizarResumo(resumo: ResumoContagem): void {
  el.statTotal.textContent = String(resumo.total);
  el.statPendentes.textContent = String(resumo.pendentes);
  el.statAprovados.textContent = String(resumo.aprovados);
  el.statRejeitados.textContent = String(resumo.rejeitados);
}

function renderizarLista(itens: Atributo[]): void {
  el.attributesList.innerHTML = "";

  if (!itens.length) {
    el.attributesList.innerHTML = `
      <div class="empty-state">
        <h3>Nenhum atributo encontrado</h3>
        <p>Cadastre um novo atributo ou altere os filtros de consulta.</p>
      </div>
    `;
    return;
  }

  itens.forEach((item) => {
    const card = document.createElement("article");
    card.className = "attr-card";

    const ehHomologador = estado.usuario?.perfil === "homologador";
    const textoBotao =
      ehHomologador && item.status_atual === "pendente"
        ? "Avaliar / Homologar"
        : "Ver Histórico e Detalhes";

    card.innerHTML = `
      <div>
        <div class="attr-card-header">
          <div>
            <div class="attr-title">${escaparTexto(item.nome)}</div>
            ${item.eh_proprietario ? '<span class="owner-tag">Submetido por mim</span>' : ""}
          </div>
          <span class="status-badge status-${item.status_atual}">
            ${rotuloStatus(item.status_atual)}
          </span>
        </div>
        <div class="attr-desc" style="margin-top: 0.65rem;">${item.descricao}</div>
        ${
          item.ultimo_parecer
            ? `<div class="parecer-preview" style="margin-top: 0.75rem;">
                 <strong>Último registro:</strong> ${item.ultimo_parecer}
               </div>`
            : ""
        }
      </div>
      <div class="attr-card-footer">
        <span>Atualizado em ${formatarData(item.ultima_atualizacao)}</span>
        <button type="button" class="btn btn-secondary btn-detalhe" data-id="${item.id}">
          ${textoBotao}
        </button>
      </div>
    `;

    const btnDetalhe = card.querySelector<HTMLButtonElement>(".btn-detalhe");
    btnDetalhe?.addEventListener("click", () => {
      void abrirDetalhesAtributo(item.id);
    });

    el.attributesList.appendChild(card);
  });
}

async function carregarListaAtributos(): Promise<void> {
  try {
    const usarApenasMeus = estado.visaoAtual === "meus";
    const dados = await api.listarAtributos({
      busca: estado.termoBusca,
      status: estado.filtroStatus,
      apenasMeus: usarApenasMeus,
    });
    atualizarResumo(dados.resumo);
    renderizarLista(dados.itens);
  } catch (erro) {
    if (erro instanceof ErroApi && erro.status === 401) {
      encerrarSessao();
      return;
    }
    mostrarToast(extrairMensagemErro(erro), "error");
  }
}

function abrirModalCadastro(atributoParaRessubmeter: AtributoDetalhe | null = null): void {
  el.atributoForm.reset();
  if (atributoParaRessubmeter) {
    el.modalFormTitle.textContent = "Ajustar e Ressubmeter Atributo";
    el.atributoEditId.value = String(atributoParaRessubmeter.id);
    el.atributoNome.value = atributoParaRessubmeter.nome;
    el.atributoDescricao.value = atributoParaRessubmeter.descricao;
    el.grupoObservacao.classList.remove("hidden");
    el.btnSubmitForm.textContent = "Reenviar para Homologação";
  } else {
    el.modalFormTitle.textContent = "Cadastrar Novo Atributo";
    el.atributoEditId.value = "";
    el.grupoObservacao.classList.add("hidden");
    el.btnSubmitForm.textContent = "Submeter para Homologação";
  }
  el.modalFormBackdrop.classList.remove("hidden");
}

function fecharModalCadastro(): void {
  el.modalFormBackdrop.classList.add("hidden");
}

async function abrirDetalhesAtributo(id: number): Promise<void> {
  try {
    const detalhe = await api.detalharAtributo(id);
    estado.atributoSelecionado = detalhe;

    el.detailNome.textContent = detalhe.nome;
    el.detailStatusBadge.className = `status-badge status-${detalhe.status_atual}`;
    el.detailStatusBadge.textContent = rotuloStatus(detalhe.status_atual);
    el.detailMeta.textContent = `Cadastrado em ${formatarData(detalhe.criado_em)} • Avaliações realizadas: ${detalhe.total_avaliacoes}`;
    el.detailDescricao.innerHTML = detalhe.descricao;

    const ehHomologador = estado.usuario?.perfil === "homologador";
    el.homologacaoPanel.classList.toggle("hidden", !ehHomologador);
    el.homologacaoForm.reset();

    el.detailTimeline.innerHTML = detalhe.historico
      .map(
        (ev) => `
        <div class="timeline-item">
          <div class="timeline-top">
            <span>
              <strong>${ev.tipo_evento === "avaliacao" ? "Avaliação da Homologação" : "Submissão"}</strong>
              ${ev.avaliado_por_mim ? " (realizada por você)" : ""}
            </span>
            <div>
              <span class="status-badge status-${ev.status}">${rotuloStatus(ev.status)}</span>
              <span style="margin-left: 0.4rem;">${formatarData(ev.homologado_em)}</span>
            </div>
          </div>
          <div class="timeline-parecer">${ev.parecer || "Sem observações."}</div>
        </div>
      `
      )
      .join("");

    el.detailOwnerActions.innerHTML = "";
    if (detalhe.eh_proprietario) {
      el.detailOwnerActions.classList.remove("hidden");

      if (detalhe.status_atual === "rejeitado") {
        const btnRessubmeter = document.createElement("button");
        btnRessubmeter.type = "button";
        btnRessubmeter.className = "btn btn-primary";
        btnRessubmeter.textContent = "Ajustar e Ressubmeter";
        btnRessubmeter.addEventListener("click", () => {
          fecharModalDetalhes();
          abrirModalCadastro(detalhe);
        });
        el.detailOwnerActions.appendChild(btnRessubmeter);
      }

      const btnExcluir = document.createElement("button");
      btnExcluir.type = "button";
      btnExcluir.className = "btn btn-danger";
      btnExcluir.textContent = "Excluir Atributo";
      btnExcluir.addEventListener("click", async () => {
        try {
          await api.excluirAtributo(detalhe.id);
          fecharModalDetalhes();
          mostrarToast("Atributo excluído com sucesso.", "success");
          void carregarListaAtributos();
        } catch (erro) {
          mostrarToast(extrairMensagemErro(erro), "error");
        }
      });
      el.detailOwnerActions.appendChild(btnExcluir);
    } else {
      el.detailOwnerActions.classList.add("hidden");
    }

    el.modalDetailBackdrop.classList.remove("hidden");
  } catch (erro) {
    mostrarToast(extrairMensagemErro(erro), "error");
  }
}

function fecharModalDetalhes(): void {
  el.modalDetailBackdrop.classList.add("hidden");
  estado.atributoSelecionado = null;
}

/* Eventos */
el.tabLogin.addEventListener("click", () => alternarAbaAuth("login"));
el.tabRegister.addEventListener("click", () => alternarAbaAuth("register"));

el.loginForm.addEventListener("submit", async (e: SubmitEvent) => {
  e.preventDefault();
  definirAlertaAuth("");
  const email = buscarElemento<HTMLInputElement>("login-email").value.trim();
  const senha = buscarElemento<HTMLInputElement>("login-password").value;

  try {
    const resp = await api.login(email, senha);
    salvarToken(resp.access_token);
    configurarSessao(resp.usuario);
    mostrarToast("Bem-vindo ao Homologador de Atributos!", "success");
  } catch (erro) {
    definirAlertaAuth(extrairMensagemErro(erro));
  }
});

el.registerForm.addEventListener("submit", async (e: SubmitEvent) => {
  e.preventDefault();
  definirAlertaAuth("");
  const email = buscarElemento<HTMLInputElement>("register-email").value.trim();
  const senha = buscarElemento<HTMLInputElement>("register-password").value;
  const confirmar = buscarElemento<HTMLInputElement>("register-confirm").value;

  if (senha !== confirmar) {
    definirAlertaAuth("As senhas informadas não coincidem.");
    return;
  }

  try {
    const resp = await api.cadastrar(email, senha);
    salvarToken(resp.access_token);
    configurarSessao(resp.usuario);
    mostrarToast("Conta criada com sucesso!", "success");
  } catch (erro) {
    definirAlertaAuth(extrairMensagemErro(erro));
  }
});

buscarElemento<HTMLButtonElement>("btn-logout").addEventListener("click", () => {
  encerrarSessao();
  mostrarToast("Sessão encerrada.");
});

buscarElemento<HTMLButtonElement>("btn-novo-atributo").addEventListener("click", () => {
  abrirModalCadastro(null);
});

buscarElemento<HTMLButtonElement>("btn-close-form-modal").addEventListener("click", fecharModalCadastro);
buscarElemento<HTMLButtonElement>("btn-cancel-form").addEventListener("click", fecharModalCadastro);
buscarElemento<HTMLButtonElement>("btn-close-detail-modal").addEventListener("click", fecharModalDetalhes);

document.querySelectorAll<HTMLButtonElement>(".view-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    const visao = (tab.dataset.view as VisaoApp | undefined) ?? "meus";
    mudarVisao(visao);
  });
});

document.querySelectorAll<HTMLButtonElement>(".filter-pill").forEach((pill) => {
  pill.addEventListener("click", () => {
    estado.filtroStatus = pill.dataset.status ?? "";
    atualizarBotoesFiltro();
    void carregarListaAtributos();
  });
});

el.searchForm.addEventListener("submit", (e: SubmitEvent) => {
  e.preventDefault();
  estado.termoBusca = el.searchInput.value.trim();
  el.btnLimparBusca.classList.toggle("hidden", !estado.termoBusca);
  void carregarListaAtributos();
});

el.btnLimparBusca.addEventListener("click", () => {
  el.searchInput.value = "";
  estado.termoBusca = "";
  el.btnLimparBusca.classList.add("hidden");
  void carregarListaAtributos();
});

el.atributoForm.addEventListener("submit", async (e: SubmitEvent) => {
  e.preventDefault();
  const idEdicao = el.atributoEditId.value;
  const nome = el.atributoNome.value.trim();
  const descricao = el.atributoDescricao.value.trim();
  const observacao = el.atributoObservacao.value.trim();

  try {
    if (idEdicao) {
      await api.ressubmeterAtributo(Number(idEdicao), { nome, descricao, observacao });
      mostrarToast("Atributo ajustado e ressubmetido para homologação!", "success");
    } else {
      await api.criarAtributo({ nome, descricao });
      mostrarToast("Atributo cadastrado e enviado para homologação!", "success");
    }
    fecharModalCadastro();
    void carregarListaAtributos();
  } catch (erro) {
    mostrarToast(extrairMensagemErro(erro), "error");
  }
});

el.homologacaoForm.addEventListener("submit", async (e: SubmitEvent) => {
  e.preventDefault();
  if (!estado.atributoSelecionado) return;

  const selecionado = document.querySelector<HTMLInputElement>('input[name="decisao-status"]:checked');
  const statusDecisao: StatusHomologacaoNome =
    selecionado?.value === "rejeitado" ? "rejeitado" : "aprovado";
  const parecer = el.homologacaoParecer.value.trim();

  try {
    await api.homologarAtributo(estado.atributoSelecionado.id, {
      status: statusDecisao,
      parecer,
    });
    mostrarToast(
      `Atributo ${statusDecisao === "aprovado" ? "aprovado" : "rejeitado"} com sucesso!`,
      "success"
    );
    await abrirDetalhesAtributo(estado.atributoSelecionado.id);
    void carregarListaAtributos();
  } catch (erro) {
    mostrarToast(extrairMensagemErro(erro), "error");
  }
});

async function inicializar(): Promise<void> {
  if (!obterToken()) return;
  try {
    const usuario = await api.me();
    configurarSessao(usuario);
  } catch {
    encerrarSessao();
  }
}

void inicializar();
