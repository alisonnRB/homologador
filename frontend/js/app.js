import { api, limparToken, obterToken, salvarToken } from "./api.js";

const estado = {
  usuario: null,
  visaoAtual: "meus", // 'meus' | 'catalogo' | 'fila'
  filtroStatus: "",
  termoBusca: "",
  atributoSelecionado: null,
};

const el = {
  authScreen: document.getElementById("auth-screen"),
  appScreen: document.getElementById("app-screen"),
  tabLogin: document.getElementById("tab-login"),
  tabRegister: document.getElementById("tab-register"),
  loginForm: document.getElementById("login-form"),
  registerForm: document.getElementById("register-form"),
  authAlert: document.getElementById("auth-alert"),
  userEmailDisplay: document.getElementById("user-email-display"),
  userRoleBadge: document.getElementById("user-role-badge"),
  navFila: document.getElementById("nav-fila-homologacao"),
  viewTitle: document.getElementById("view-title"),
  viewDescription: document.getElementById("view-description"),
  statTotal: document.getElementById("stat-total"),
  statPendentes: document.getElementById("stat-pendentes"),
  statAprovados: document.getElementById("stat-aprovados"),
  statRejeitados: document.getElementById("stat-rejeitados"),
  searchForm: document.getElementById("search-form"),
  searchInput: document.getElementById("search-input"),
  btnLimparBusca: document.getElementById("btn-limpar-busca"),
  attributesList: document.getElementById("attributes-list"),
  modalFormBackdrop: document.getElementById("modal-form-backdrop"),
  modalFormTitle: document.getElementById("modal-form-title"),
  atributoForm: document.getElementById("atributo-form"),
  atributoEditId: document.getElementById("atributo-edit-id"),
  atributoNome: document.getElementById("atributo-nome"),
  atributoDescricao: document.getElementById("atributo-descricao"),
  grupoObservacao: document.getElementById("grupo-observacao-ressubmissao"),
  atributoObservacao: document.getElementById("atributo-observacao"),
  btnSubmitForm: document.getElementById("btn-submit-form"),
  modalDetailBackdrop: document.getElementById("modal-detail-backdrop"),
  detailNome: document.getElementById("detail-nome"),
  detailStatusBadge: document.getElementById("detail-status-badge"),
  detailMeta: document.getElementById("detail-meta"),
  detailDescricao: document.getElementById("detail-descricao"),
  homologacaoPanel: document.getElementById("homologacao-panel"),
  homologacaoForm: document.getElementById("homologacao-form"),
  homologacaoParecer: document.getElementById("homologacao-parecer"),
  detailTimeline: document.getElementById("detail-timeline"),
  detailOwnerActions: document.getElementById("detail-owner-actions"),
  toastContainer: document.getElementById("toast-container"),
};

function mostrarToast(mensagem, tipo = "info") {
  const toast = document.createElement("div");
  toast.className = `toast ${tipo}`;
  toast.textContent = mensagem;
  el.toastContainer.appendChild(toast);
  setTimeout(() => toast.remove(), 3600);
}

function escaparTexto(valor) {
  const div = document.createElement("div");
  div.textContent = valor ?? "";
  return div.innerHTML;
}

function formatarData(isoString) {
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

function rotuloStatus(status) {
  const mapa = {
    pendente: "Pendente",
    aprovado: "Aprovado",
    rejeitado: "Rejeitado",
  };
  return mapa[status] || status;
}

function definirAlertaAuth(mensagem = "") {
  if (!mensagem) {
    el.authAlert.classList.add("hidden");
    el.authAlert.textContent = "";
    return;
  }
  el.authAlert.textContent = mensagem;
  el.authAlert.classList.remove("hidden");
}

function alternarAbaAuth(modo) {
  definirAlertaAuth("");
  const ehLogin = modo === "login";
  el.tabLogin.classList.toggle("active", ehLogin);
  el.tabRegister.classList.toggle("active", !ehLogin);
  el.loginForm.classList.toggle("hidden", !ehLogin);
  el.registerForm.classList.toggle("hidden", ehLogin);
}

function configurarSessao(usuario) {
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

function encerrarSessao() {
  limparToken();
  estado.usuario = null;
  el.appScreen.classList.add("hidden");
  el.authScreen.classList.remove("hidden");
  el.loginForm.reset();
  el.registerForm.reset();
}

function atualizarCabecalhoVisao() {
  document.querySelectorAll(".view-tab").forEach((btn) => {
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

function mudarVisao(novaVisao) {
  estado.visaoAtual = novaVisao;
  if (novaVisao === "fila") {
    estado.filtroStatus = "pendente";
  } else {
    estado.filtroStatus = "";
  }
  atualizarBotoesFiltro();
  atualizarCabecalhoVisao();
  carregarListaAtributos();
}

function atualizarBotoesFiltro() {
  document.querySelectorAll(".filter-pill").forEach((pill) => {
    pill.classList.toggle("active", pill.dataset.status === estado.filtroStatus);
  });
}

function atualizarResumo(resumo) {
  el.statTotal.textContent = resumo.total;
  el.statPendentes.textContent = resumo.pendentes;
  el.statAprovados.textContent = resumo.aprovados;
  el.statRejeitados.textContent = resumo.rejeitados;
}

function renderizarLista(itens) {
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

    card.querySelector(".btn-detalhe").addEventListener("click", () => {
      abrirDetalhesAtributo(item.id);
    });

    el.attributesList.appendChild(card);
  });
}

async function carregarListaAtributos() {
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
    if (erro.status === 401) {
      encerrarSessao();
      return;
    }
    mostrarToast(erro.message, "error");
  }
}

function abrirModalCadastro(atributoParaRessubmeter = null) {
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

function fecharModalCadastro() {
  el.modalFormBackdrop.classList.add("hidden");
}

async function abrirDetalhesAtributo(id) {
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
          carregarListaAtributos();
        } catch (erro) {
          mostrarToast(erro.message, "error");
        }
      });
      el.detailOwnerActions.appendChild(btnExcluir);
    } else {
      el.detailOwnerActions.classList.add("hidden");
    }

    el.modalDetailBackdrop.classList.remove("hidden");
  } catch (erro) {
    mostrarToast(erro.message, "error");
  }
}

function fecharModalDetalhes() {
  el.modalDetailBackdrop.classList.add("hidden");
  estado.atributoSelecionado = null;
}

/* Eventos */
el.tabLogin.addEventListener("click", () => alternarAbaAuth("login"));
el.tabRegister.addEventListener("click", () => alternarAbaAuth("register"));

el.loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  definirAlertaAuth("");
  const email = document.getElementById("login-email").value.trim();
  const senha = document.getElementById("login-password").value;

  try {
    const resp = await api.login(email, senha);
    salvarToken(resp.access_token);
    configurarSessao(resp.usuario);
    mostrarToast("Bem-vindo ao Homologador de Atributos!", "success");
  } catch (erro) {
    definirAlertaAuth(erro.message);
  }
});

el.registerForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  definirAlertaAuth("");
  const email = document.getElementById("register-email").value.trim();
  const senha = document.getElementById("register-password").value;
  const confirmar = document.getElementById("register-confirm").value;

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
    definirAlertaAuth(erro.message);
  }
});

document.getElementById("btn-logout").addEventListener("click", () => {
  encerrarSessao();
  mostrarToast("Sessão encerrada.");
});

document.getElementById("btn-novo-atributo").addEventListener("click", () => {
  abrirModalCadastro(null);
});

document.getElementById("btn-close-form-modal").addEventListener("click", fecharModalCadastro);
document.getElementById("btn-cancel-form").addEventListener("click", fecharModalCadastro);
document.getElementById("btn-close-detail-modal").addEventListener("click", fecharModalDetalhes);

document.querySelectorAll(".view-tab").forEach((tab) => {
  tab.addEventListener("click", () => mudarVisao(tab.dataset.view));
});

document.querySelectorAll(".filter-pill").forEach((pill) => {
  pill.addEventListener("click", () => {
    estado.filtroStatus = pill.dataset.status;
    atualizarBotoesFiltro();
    carregarListaAtributos();
  });
});

el.searchForm.addEventListener("submit", (e) => {
  e.preventDefault();
  estado.termoBusca = el.searchInput.value.trim();
  el.btnLimparBusca.classList.toggle("hidden", !estado.termoBusca);
  carregarListaAtributos();
});

el.btnLimparBusca.addEventListener("click", () => {
  el.searchInput.value = "";
  estado.termoBusca = "";
  el.btnLimparBusca.classList.add("hidden");
  carregarListaAtributos();
});

el.atributoForm.addEventListener("submit", async (e) => {
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
    carregarListaAtributos();
  } catch (erro) {
    mostrarToast(erro.message, "error");
  }
});

el.homologacaoForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!estado.atributoSelecionado) return;

  const selecionado = document.querySelector('input[name="decisao-status"]:checked');
  const statusDecisao = selecionado ? selecionado.value : "aprovado";
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
    carregarListaAtributos();
  } catch (erro) {
    mostrarToast(erro.message, "error");
  }
});

async function inicializar() {
  if (!obterToken()) return;
  try {
    const usuario = await api.me();
    configurarSessao(usuario);
  } catch {
    encerrarSessao();
  }
}

inicializar();
