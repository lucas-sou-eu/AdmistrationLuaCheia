const DEFAULT_API_URL = "https://ports-phoenix-sacramento-subscribe.trycloudflare.com/api";
let API_URL = localStorage.getItem('LUA_CHEIA_API_URL') || DEFAULT_API_URL;

let produtos = [];
let categorias = [];
let relatorios = JSON.parse(localStorage.getItem('LUA_CHEIA_ADMIN_LOGS')) || [];

// Gestão de Vendas
let pedidosPendentes = JSON.parse(localStorage.getItem('LUA_CHEIA_PEDIDOS_PENDENTES')) || [];
let vendasConfirmadas = JSON.parse(localStorage.getItem('LUA_CHEIA_VENDAS_CONFIRMADAS')) || [];
let vendasEntregues = JSON.parse(localStorage.getItem('LUA_CHEIA_VENDAS_ENTREGUES')) || [];

// Modo Teste e Histórico
let modoTesteAtivo = localStorage.getItem('LUA_CHEIA_MODO_TESTE') === 'true';

let abaAtiva = localStorage.getItem('LUA_CHEIA_ABA_ATIVA') || 'dashboard';
let subAbaAtiva = localStorage.getItem('LUA_CHEIA_SUB_ABA_ATIVA') || 'produtos';
let subAbaVendasAtiva = localStorage.getItem('LUA_CHEIA_SUB_ABA_VENDAS') || 'pendentes';

document.addEventListener('DOMContentLoaded', () => {
    const inputApi = document.getElementById('inputApiUrlConfig');
    if (inputApi) inputApi.value = API_URL;

    const toggleTeste = document.getElementById('toggleModoTeste');
    if (toggleTeste) toggleTeste.checked = modoTesteAtivo;

    limparHistoricoAntigoAutomatico();

    switchTab(abaAtiva, false);
    mudarSubAbaCatalogo(subAbaAtiva, false);
    mudarSubAbaVendas(subAbaVendasAtiva, false);

    // Carrega diretamente do banco sem restrição de autenticação
    carregarDadosDoBanco();

    const formProdutoEl = document.getElementById('formProduto');
    if (formProdutoEl) {
        formProdutoEl.addEventListener('submit', function (e) {
            e.preventDefault();
            salvarProduto(e);
        });
    }

    const modaisCategoriaForms = document.querySelectorAll('#modalCategoria form');
    modaisCategoriaForms.forEach(form => {
        form.addEventListener('submit', function (e) {
            e.preventDefault();
            salvarCategoria(e);
        });
    });

    setInterval(() => {
        verificarNovosPedidosBackground();
    }, 3000);
});

function verificarNovosPedidosBackground() {
    const pedidosSalvos = JSON.parse(localStorage.getItem('LUA_CHEIA_PEDIDOS_PENDENTES')) || [];
    if (JSON.stringify(pedidosSalvos) !== JSON.stringify(pedidosPendentes)) {
        pedidosPendentes = pedidosSalvos;
        renderizarGestaoVendas();
    }
}

function alternarModoTeste(checkbox) {
    modoTesteAtivo = checkbox.checked;
    localStorage.setItem('LUA_CHEIA_MODO_TESTE', modoTesteAtivo);
    if (modoTesteAtivo) {
        showToast("Modo Teste ATIVADO: O histórico de entregues não será alimentado.", "info");
    } else {
        showToast("Modo Teste DESATIVADO: O histórico voltou ao normal.", "success");
    }
}

function limparHistoricoAntigoAutomatico() {
    let entregues = JSON.parse(localStorage.getItem('LUA_CHEIA_VENDAS_ENTREGUES')) || [];
    if (entregues.length === 0) return;

    const agora = Date.now();
    const doisDiasEmMs = 2 * 24 * 60 * 60 * 1000;

    const filtrados = entregues.filter(item => {
        const timestampPedido = item.timestamp || (typeof item.id === 'number' ? item.id : parseInt(item.id)) || agora;
        return (agora - timestampPedido) < doisDiasEmMs;
    });

    if (filtrados.length !== entregues.length) {
        vendasEntregues = filtrados;
        localStorage.setItem('LUA_CHEIA_VENDAS_ENTREGUES', JSON.stringify(vendasEntregues));
    }
}

function registrarRelatorio(acao, detalhes) {
    const novoLog = {
        id: Date.now(),
        adminId: "ADMIN",
        adminNome: "@sistema",
        acao: acao,
        detalhes: detalhes,
        data: new Date().toLocaleString('pt-BR')
    };
    relatorios.unshift(novoLog);
    localStorage.setItem('LUA_CHEIA_ADMIN_LOGS', JSON.stringify(relatorios));
    renderizarRelatorios();
    renderizarDashboard();
}

function switchTab(tab, salvarEstado = true) {
    if (salvarEstado) {
        abaAtiva = tab;
        localStorage.setItem('LUA_CHEIA_ABA_ATIVA', tab);
    }

    const sections = ['dashboard', 'catalogo', 'vendas', 'relatorios', 'configuracoes'];

    sections.forEach(s => {
        const secEl = document.getElementById(`section-${s}`);
        const navBtn = document.getElementById(`nav-${s}`);

        if (secEl) {
            if (s === tab) {
                secEl.classList.remove('hidden');
                if (navBtn) navBtn.classList.add('active');
            } else {
                secEl.classList.add('hidden');
                if (navBtn) navBtn.classList.remove('active');
            }
        }
    });

    const titulos = {
        dashboard: 'Visão Geral & Dashboard',
        catalogo: 'Gestão de Cardápio & Categorias',
        vendas: 'Gestão de Vendas & Pedidos',
        relatorios: 'Relatórios de Atividades',
        configuracoes: 'Configurações'
    };

    const titleEl = document.getElementById('pageTitle');
    if (titleEl) titleEl.textContent = titulos[tab] || 'Painel';

    const sidebar = document.getElementById('sidebar');
    if (sidebar && !sidebar.classList.contains('-translate-x-full') && window.innerWidth < 768) {
        toggleMobileSidebar();
    }
}

function mudarSubAbaCatalogo(sub, salvarEstado = true) {
    if (salvarEstado) {
        subAbaAtiva = sub;
        localStorage.setItem('LUA_CHEIA_SUB_ABA_ATIVA', sub);
    }

    const isProd = sub === 'produtos';
    const subProd = document.getElementById('subsect-produtos');
    const subCat = document.getElementById('subsect-categorias');
    if (subProd) subProd.classList.toggle('hidden', !isProd);
    if (subCat) subCat.classList.toggle('hidden', isProd);

    const navProd = document.getElementById('subnav-produtos');
    const navCat = document.getElementById('subnav-categorias');
    if (navProd) navProd.className = isProd ? "pb-3 text-sm font-semibold text-amber-400 border-b-2 border-amber-500 transition" : "pb-3 text-sm font-semibold text-slate-400 hover:text-slate-200 transition";
    if (navCat) navCat.className = !isProd ? "pb-3 text-sm font-semibold text-amber-400 border-b-2 border-amber-500 transition" : "pb-3 text-sm font-semibold text-slate-400 hover:text-slate-200 transition";
}

function mudarSubAbaVendas(sub, salvarEstado = true) {
    if (salvarEstado) {
        subAbaVendasAtiva = sub;
        localStorage.setItem('LUA_CHEIA_SUB_ABA_VENDAS', sub);
    }

    ['pendentes', 'confirmadas', 'entregues'].forEach(s => {
        const isTarget = s === sub;
        const targetEl = document.getElementById(`subsect-vendas-${s}`);
        const navEl = document.getElementById(`subnav-${s}`);
        if (targetEl) targetEl.classList.toggle('hidden', !isTarget);
        if (navEl) {
            navEl.className = isTarget
                ? "pb-3 text-sm font-semibold text-amber-400 border-b-2 border-amber-500 transition relative"
                : "pb-3 text-sm font-semibold text-slate-400 hover:text-slate-200 transition";
        }
    });
}

function renderizarGestaoVendas() {
    const badgeCount = document.getElementById('badgePendentesCount');
    if (badgeCount) badgeCount.textContent = pedidosPendentes.length;

    const gridPendentes = document.getElementById('gridPedidosPendentes');
    if (gridPendentes) {
        gridPendentes.innerHTML = pedidosPendentes.map(p => `
            <div class="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
                <div class="flex justify-between items-start">
                    <div>
                        <span class="text-[10px] font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">${p.id}</span>
                        <h4 class="font-bold text-slate-100 text-sm mt-1">Pedido #${p.id}</h4>
                        <p class="text-xs font-semibold text-amber-400 mt-0.5"><i class="fa-solid fa-user text-[10px] mr-1"></i>${p.cliente || 'Cliente não identificado'}</p>
                        <p class="text-xs text-slate-400">${p.dataHora || ''}</p>
                    </div>
                    <span class="font-bold text-amber-400 text-sm">R$ ${parseFloat(p.total).toFixed(2).replace('.', ',')}</span>
                </div>
                <div class="flex gap-2 pt-2 border-t border-slate-800">
                    <button onclick="abrirDetalhesVenda('pendente', '${p.id}')" class="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold">Ver Itens</button>
                    <button onclick="confirmarPedidoBanco('${p.id}')" class="flex-1 py-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 rounded-xl text-xs font-bold">Aprovar & Descontar</button>
                    <button onclick="recusarPedido('${p.id}')" class="px-3 py-2 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 rounded-xl text-xs"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>
        `).join('') || `<p class="text-slate-500 text-xs col-span-2 text-center py-6">Nenhum pedido pendente no momento.</p>`;
    }

    const gridConfirmadas = document.getElementById('gridVendasConfirmadas');
    if (gridConfirmadas) {
        gridConfirmadas.innerHTML = vendasConfirmadas.map(v => `
            <div class="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
                <div class="flex justify-between items-start">
                    <div>
                        <span class="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">CONFIRMADO</span>
                        <h4 class="font-bold text-slate-100 text-sm mt-1">Pedido #${v.id}</h4>
                        <p class="text-xs font-semibold text-emerald-400 mt-0.5"><i class="fa-solid fa-user text-[10px] mr-1"></i>${v.cliente || 'Cliente não identificado'}</p>
                        <p class="text-xs text-slate-400">${v.dataHora || ''}</p>
                    </div>
                    <span class="font-bold text-amber-400 text-sm">R$ ${parseFloat(v.total).toFixed(2).replace('.', ',')}</span>
                </div>
                <div class="flex gap-2 pt-2 border-t border-slate-800">
                    <button onclick="abrirDetalhesVenda('confirmada', '${v.id}')" class="flex-1 py-2 bg-slate-800 text-slate-200 rounded-xl text-xs font-semibold">Ver Itens</button>
                    <button onclick="marcarComoEntregue('${v.id}')" class="flex-1 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl text-xs font-bold">Marcar como Entregue</button>
                </div>
            </div>
        `).join('') || `<p class="text-slate-500 text-xs col-span-2 text-center py-6">Nenhuma venda confirmada ativa.</p>`;
    }

    const gridEntregues = document.getElementById('gridVendasEntregues');
    if (gridEntregues) {
        gridEntregues.innerHTML = vendasEntregues.map(e => `
            <div class="bg-slate-900/60 border border-slate-800/60 rounded-2xl p-5 space-y-3">
                <div class="flex justify-between items-start">
                    <div>
                        <span class="text-[10px] font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded">ENTREGUE</span>
                        <h4 class="font-bold text-slate-300 text-sm mt-1">Pedido #${e.id}</h4>
                        <p class="text-xs font-semibold text-slate-400 mt-0.5"><i class="fa-solid fa-user text-[10px] mr-1"></i>${e.cliente || 'Cliente não identificado'}</p>
                        <p class="text-xs text-slate-500">${e.dataHora || ''}</p>
                    </div>
                    <span class="font-semibold text-slate-300 text-sm">R$ ${parseFloat(e.total).toFixed(2).replace('.', ',')}</span>
                </div>
                <button onclick="abrirDetalhesVenda('entregue', '${e.id}')" class="w-full py-1.5 bg-slate-800 text-slate-400 hover:text-slate-200 rounded-xl text-xs">Ver Detalhes</button>
            </div>
        `).join('') || `<p class="text-slate-500 text-xs col-span-2 text-center py-6">Nenhum histórico de entrega registrado.</p>`;
    }
}

async function confirmarPedidoBanco(id) {
    const idStr = String(id);
    const index = pedidosPendentes.findIndex(p => String(p.id) === idStr);

    if (index === -1) {
        showToast("Pedido não encontrado na lista.", "error");
        return;
    }

    if (!confirm(`Aprovar pedido #${id}? Isso irá abater o estoque dos produtos no banco de dados.`)) return;

    const [pedidoAprovado] = pedidosPendentes.splice(index, 1);
    vendasConfirmadas.unshift(pedidoAprovado);

    localStorage.setItem('LUA_CHEIA_PEDIDOS_PENDENTES', JSON.stringify(pedidosPendentes));
    localStorage.setItem('LUA_CHEIA_VENDAS_CONFIRMADAS', JSON.stringify(vendasConfirmadas));

    renderizarGestaoVendas();
    showToast(`Pedido #${id} aprovado e movido para Vendas Confirmadas!`, "success");

    if (Array.isArray(pedidoAprovado.itens)) {
        for (const item of pedidoAprovado.itens) {
            try {
                const prodIdAlvo = item.produtoId || item.id || item.codigo;
                if (prodIdAlvo) {
                    const produtoAtual = produtos.find(p => String(p.id) === String(prodIdAlvo));
                    if (produtoAtual) {
                        const estoqueAtual = produtoAtual.estoque ?? produtoAtual.quantidade_estoque ?? 10;
                        const qtdComprada = Number(item.quantidade || item.qtd || 1);
                        const novoEstoque = Math.max(0, estoqueAtual - qtdComprada);

                        produtoAtual.estoque = novoEstoque;

                        await fetch(`${API_URL}/produtos/${produtoAtual.id}/`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                estoque: novoEstoque,
                                quantidade_estoque: novoEstoque
                            })
                        });
                    }
                }
            } catch (errItem) {
                console.warn("Aviso ao abater estoque no servidor:", errItem);
            }
        }
    }

    carregarDadosSilencioso();
}

function recusarPedido(id) {
    if (!confirm("Deseja recusar este pedido?")) return;
    const idStr = String(id);
    pedidosPendentes = pedidosPendentes.filter(p => String(p.id) !== idStr);
    localStorage.setItem('LUA_CHEIA_PEDIDOS_PENDENTES', JSON.stringify(pedidosPendentes));
    renderizarGestaoVendas();
    showToast("Pedido recusado.", "info");
}

function marcarComoEntregue(id) {
    const idStr = String(id);
    const venda = vendasConfirmadas.find(v => String(v.id) === idStr);
    if (!venda) return;

    vendasConfirmadas = vendasConfirmadas.filter(v => String(v.id) !== idStr);
    localStorage.setItem('LUA_CHEIA_VENDAS_CONFIRMADAS', JSON.stringify(vendasConfirmadas));

    if (!modoTesteAtivo) {
        venda.timestamp = Date.now();
        vendasEntregues.unshift(venda);
        localStorage.setItem('LUA_CHEIA_VENDAS_ENTREGUES', JSON.stringify(vendasEntregues));
        showToast("Venda movida para o histórico de entregues!", "success");
    } else {
        showToast("Venda concluída (Modo Teste: ignorada no histórico).", "info");
    }

    renderizarGestaoVendas();
}

function abrirDetalhesVenda(tipo, id) {
    const lista = tipo === 'pendente' ? pedidosPendentes : (tipo === 'confirmada' ? vendasConfirmadas : vendasEntregues);
    const p = lista.find(item => String(item.id) === String(id));
    if (!p) return;

    const tituloEl = document.getElementById('modalVendaTitulo');
    const totalEl = document.getElementById('modalVendaTotal');
    const conteudo = document.getElementById('modalVendaConteudo');
    const modal = document.getElementById('modalDetalhesVenda');

    if (tituloEl) tituloEl.textContent = `Detalhes do Pedido #${p.id}`;
    if (totalEl) totalEl.textContent = `R$ ${parseFloat(p.total).toFixed(2).replace('.', ',')}`;

    if (conteudo) {
        let htmlCliente = `
            <div class="p-3 bg-slate-800/60 border border-slate-700/60 rounded-xl mb-3">
                <span class="text-[11px] text-slate-400 uppercase font-semibold block">Cliente</span>
                <span class="text-sm font-bold text-amber-400"><i class="fa-solid fa-user mr-1.5"></i>${p.cliente || 'Cliente não identificado'}</span>
            </div>
        `;

        let htmlItens = p.itens.map(i => `
            <div class="flex justify-between items-center py-2 border-b border-slate-800">
                <div>
                    <p class="font-bold text-slate-200">${i.nome}</p>
                    <p class="text-[10px] text-slate-400">Quantidade: ${i.quantidade} un</p>
                </div>
                <span class="font-semibold text-amber-400">R$ ${(i.preco * i.quantidade).toFixed(2).replace('.', ',')}</span>
            </div>
        `).join('');

        conteudo.innerHTML = htmlCliente + htmlItens;
    }

    if (modal) modal.classList.remove('hidden');
}

function fecharModalDetalhesVenda() {
    const modal = document.getElementById('modalDetalhesVenda');
    if (modal) modal.classList.add('hidden');
}

async function carregarDadosDoBanco(manual = false) {
    const badgeDot = document.getElementById('apiStatusDot');
    const badgeText = document.getElementById('apiStatusText');

    try {
        const [resProd, resCat] = await Promise.all([
            fetch(`${API_URL}/produtos/`),
            fetch(`${API_URL}/categorias/`)
        ]);

        if (!resProd.ok || !resCat.ok) throw new Error("Erro ao aceder ao banco");

        produtos = await resProd.json();
        categorias = await resCat.json();

        if (badgeDot && badgeText) {
            badgeDot.className = "w-2 h-2 rounded-full bg-emerald-500 animate-pulse";
            badgeText.textContent = "Banco Conectado";
            badgeText.className = "text-emerald-400 font-semibold";
        }

        if (manual) showToast("Dados sincronizados com sucesso!", "success");

        renderizarTudo();
    } catch (error) {
        if (badgeDot && badgeText) {
            badgeDot.className = "w-2 h-2 rounded-full bg-rose-500";
            badgeText.textContent = "Erro de Conexão";
            badgeText.className = "text-rose-400 font-medium";
        }
        if (manual) showToast("Não foi possível conectar ao banco.", "error");
    }
}

function renderizarTudo() {
    renderizarDashboard();
    renderizarProdutos();
    renderizarCategorias();
    renderizarGestaoVendas();
    renderizarRelatorios();
    preencherSelectCategorias();
}

function renderizarDashboard() {
    const totalProd = document.getElementById('dashTotalProdutos');
    const stockBaixo = document.getElementById('dashStockBaixo');
    const totalCat = document.getElementById('dashTotalCategorias');
    const totalLogs = document.getElementById('dashTotalLogs');

    if (totalProd) totalProd.textContent = produtos.length;

    const estoqueBaixoCount = produtos.filter(p => {
        const qtd = p.estoque !== undefined ? p.estoque : (p.quantidade_estoque !== undefined ? p.quantidade_estoque : 0);
        return qtd <= 3;
    }).length;

    if (stockBaixo) stockBaixo.textContent = estoqueBaixoCount;
    if (totalCat) totalCat.textContent = categorias.length;
    if (totalLogs) totalLogs.textContent = relatorios.length;
}

function renderizarProdutos(lista = produtos) {
    const body = document.getElementById('tableProdutosBody');
    if (!body) return;

    body.innerHTML = lista.map(p => {
        const imagemSrc = obterUrlImagemProduto(p);
        const qtdEstoque = p.estoque ?? p.quantidade_estoque ?? 0;

        return `
        <tr class="hover:bg-slate-800/40">
            <td class="p-4 flex items-center gap-3">
                <img src="${imagemSrc}" class="w-10 h-10 rounded-xl object-cover border border-slate-700" onerror="this.src='https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=100&q=80'">
                <div>
                    <h4 class="font-bold text-slate-200">${p.nome}</h4>
                    <p class="text-xs text-slate-400">${p.descricao || ''}</p>
                </div>
            </td>
            <td class="p-4 text-xs text-slate-300">${p.categoria_nome || 'Geral'}</td>
            <td class="p-4 font-semibold text-amber-400">R$ ${parseFloat(p.preco).toFixed(2).replace('.', ',')}</td>
            <td class="p-4 font-bold ${qtdEstoque <= 3 ? 'text-amber-400' : 'text-slate-300'}">${qtdEstoque} un</td>
            <td class="p-4 text-right space-x-2">
                <button onclick="editarProduto(${p.id})" class="p-2 bg-slate-800 hover:bg-amber-500/10 text-amber-400 rounded-lg"><i class="fa-solid fa-pen-to-square"></i></button>
                <button onclick="excluirProduto(${p.id})" class="p-2 bg-slate-800 hover:bg-rose-500/10 text-rose-400 rounded-lg"><i class="fa-solid fa-trash"></i></button>
            </td>
        </tr>
    `}).join('') || `<tr><td colspan="5" class="p-8 text-center text-slate-500">Nenhum produto encontrado.</td></tr>`;

    const mobileList = document.getElementById('mobileProdutosList');
    if (mobileList) {
        mobileList.innerHTML = lista.map(p => `
            <div class="p-4 flex items-center justify-between gap-3 bg-slate-900/60">
                <span class="font-bold text-slate-100 text-sm truncate">${p.nome}</span>
                <div class="flex items-center gap-2 flex-shrink-0">
                    <button onclick="editarProduto(${p.id})" class="p-2 bg-slate-800 hover:bg-amber-500/10 text-amber-400 rounded-lg text-xs flex items-center gap-1.5 px-3">
                        <i class="fa-solid fa-pen-to-square"></i> Editar
                    </button>
                    <button onclick="excluirProduto(${p.id})" class="p-2 bg-slate-800 hover:bg-rose-500/10 text-rose-400 rounded-lg text-xs">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('') || `<p class="p-6 text-center text-slate-500 text-xs">Nenhum produto cadastrado.</p>`;
    }
}

function obterUrlImagemProduto(p) {
    if (p.imagem) {
        if (p.imagem.startsWith('http')) return p.imagem;
        const baseUrlServer = API_URL.replace(/\/api\/?$/, "");
        const caminhoImagem = p.imagem.startsWith('/') ? p.imagem : `/${p.imagem}`;
        return `${baseUrlServer}${caminhoImagem}`;
    } else if (p.imagem_url) {
        return p.imagem_url;
    }
    return 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=100&q=80';
}

function filtrarProdutos() {
    const inputSearch = document.getElementById('inputSearchProduto');
    const busca = inputSearch ? inputSearch.value.toLowerCase() : '';
    const filtrados = produtos.filter(p => p.nome.toLowerCase().includes(busca));
    renderizarProdutos(filtrados);
}

function renderizarCategorias() {
    const grid = document.getElementById('gridCategorias');
    if (!grid) return;

    grid.innerHTML = categorias.map(c => `
        <div class="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex justify-between items-center">
            <div class="flex items-center gap-3">
                <div class="p-3 bg-amber-500/10 text-amber-400 rounded-xl"><i class="fa-solid fa-tag"></i></div>
                <div>
                    <h4 class="font-bold text-slate-200">${c.nome}</h4>
                    <p class="text-xs text-slate-400">${produtos.filter(p => p.categoria === c.id || p.categoria_nome === c.nome).length} produtos</p>
                </div>
            </div>
            <div class="space-x-1">
                <button onclick="editarCategoria(${c.id}, '${c.nome}')" class="p-2 bg-slate-800 hover:bg-amber-500/10 text-amber-400 rounded-lg"><i class="fa-solid fa-pen-to-square"></i></button>
                <button onclick="excluirCategoria(${c.id})" class="p-2 bg-slate-800 hover:bg-rose-500/10 text-rose-400 rounded-lg"><i class="fa-solid fa-trash"></i></button>
            </div>
        </div>
    `).join('') || `<p class="text-slate-500 text-center col-span-3 py-4">Nenhuma categoria cadastrada.</p>`;
}

function renderizarRelatorios() {
    const body = document.getElementById('tableRelatoriosBody');
    if (!body) return;

    body.innerHTML = relatorios.map(r => `
        <tr class="hover:bg-slate-800/40 text-xs">
            <td class="p-4 font-mono text-amber-400">${r.adminId} - ${r.adminNome}</td>
            <td class="p-4 font-bold text-slate-200">${r.acao}</td>
            <td class="p-4 text-slate-300">${r.detalhes}</td>
            <td class="p-4 text-right text-slate-400">${r.data}</td>
        </tr>
    `).join('') || `<tr><td colspan="4" class="p-8 text-center text-slate-500">Nenhum relatório de ação registado.</td></tr>`;
}

function preencherSelectCategorias() {
    const select = document.getElementById('prodCategoria');
    if (!select) return;
    select.innerHTML = categorias.map(c => `<option value="${c.id}">${c.nome}</option>`).join('') || `<option value="">Selecione uma categoria</option>`;
}

function atualizarPreviewPorUrl() {
    const url = document.getElementById('prodImagemUrl').value.trim();
    const imgPreview = document.getElementById('prodImgPreview');
    const previewText = document.getElementById('previewText');

    if (url && imgPreview && previewText) {
        imgPreview.src = url;
        previewText.textContent = "Imagem da URL informada.";

        // Limpa o campo de arquivo local para evitar conflitos
        const fileInput = document.getElementById('prodImagemFile');
        if (fileInput) fileInput.value = '';
    } else if (imgPreview && previewText) {
        imgPreview.src = 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=100&q=80';
        previewText.textContent = "Nenhuma imagem selecionada.";
    }
}

function atualizarPreviewPorArquivo(input) {
    const file = input.files[0];
    const imgPreview = document.getElementById('prodImgPreview');
    const previewText = document.getElementById('previewText');

    if (file && imgPreview && previewText) {
        // Limpa o campo de URL para evitar conflitos
        const urlInput = document.getElementById('prodImagemUrl');
        if (urlInput) urlInput.value = '';

        const reader = new FileReader();
        reader.onload = function (e) {
            imgPreview.src = e.target.result;
            previewText.textContent = `Arquivo local: ${file.name}`;
        };
        reader.readAsDataURL(file);
    }
}

// Variável de controle para impedir duplo envio
let salvandoProdutoEmAndamento = false;

async function salvarProduto(e) {
    if (e) e.preventDefault();

    // Se já estiver a salvar, ignora cliques adicionais imediatamente
    if (salvandoProdutoEmAndamento) return false;
    salvandoProdutoEmAndamento = true;

    const form = document.getElementById('formProduto');
    const overlay = document.getElementById('loadingOverlayProduto');
    const btnSalvar = document.getElementById('btnSalvarProduto');
    const btnSalvarTexto = document.getElementById('btnSalvarProdutoTexto');
    const btnCancelar = document.getElementById('btnCancelarProduto');

    const id = document.getElementById('prodId').value;
    const nome = document.getElementById('prodNome').value;

    const formData = new FormData();
    formData.append('nome', nome);
    formData.append('preco', document.getElementById('prodPreco').value);
    formData.append('estoque', document.getElementById('prodEstoque').value);
    formData.append('categoria', document.getElementById('prodCategoria').value);
    formData.append('descricao', document.getElementById('prodDescricao').value);
    formData.append('disponivel', 'true');

    // Tratamento exclusivo para evitar duplicação ou conflito de imagens
    const urlInput = document.getElementById('prodImagemUrl').value.trim();
    const arquivoInput = document.getElementById('prodImagemFile');

    if (arquivoInput && arquivoInput.files && arquivoInput.files[0]) {
        formData.append('imagem', arquivoInput.files[0]);
    } else if (urlInput) {
        formData.append('imagem_url', urlInput);
    }

    const url = id ? `${API_URL}/produtos/${id}/` : `${API_URL}/produtos/`;
    const method = id ? 'PATCH' : 'POST';

    // ATIVA O LOADING E BLOQUEIA A INTERFACE
    if (overlay) overlay.classList.remove('hidden');
    if (btnSalvar) btnSalvar.disabled = true;
    if (btnCancelar) btnCancelar.disabled = true;
    if (btnSalvarTexto) {
        btnSalvarTexto.innerHTML = `<i class="fa-solid fa-spinner animate-spin"></i> A salvar...`;
    }

    const inputs = form.querySelectorAll('input, select, textarea, button');
    inputs.forEach(input => input.disabled = true);

    try {
        const res = await fetch(url, { method, body: formData });
        if (res.ok) {
            registrarRelatorio(id ? 'EDITAR PRODUTO' : 'CRIAR PRODUTO', `Produto: ${nome}`);
            showToast("Produto guardado com sucesso!", "success");
            fecharModalProduto();
            await carregarDadosSilencioso();
        } else {
            showToast("Erro de validação no produto.", "error");
        }
    } catch (err) {
        showToast("Erro de comunicação com o servidor.", "error");
    } finally {
        // LIBERA O CONTROLE APÓS O FIM DA REQUISIÇÃO
        salvandoProdutoEmAndamento = false;

        if (overlay) overlay.classList.add('hidden');
        if (btnSalvar) btnSalvar.disabled = false;
        if (btnCancelar) btnCancelar.disabled = false;
        if (btnSalvarTexto) btnSalvarTexto.textContent = "Salvar no Banco";

        inputs.forEach(input => input.disabled = false);
    }
    return false;
}

async function excluirProduto(id) {
    const prod = produtos.find(p => p.id == id);
    if (!confirm(`Tem certeza que deseja apagar o produto "${prod ? prod.nome : id}"?`)) return;

    try {
        const res = await fetch(`${API_URL}/produtos/${id}/`, { method: 'DELETE' });
        if (res.ok) {
            registrarRelatorio('EXCLUIR PRODUTO', `Removido ID: ${id} (${prod ? prod.nome : ''})`);
            showToast("Produto removido!", "success");
            await carregarDadosSilencioso();
        }
    } catch (err) {
        showToast("Erro ao excluir produto.", "error");
    }
}

async function salvarCategoria(e) {
    if (e) e.preventDefault();
    const id = document.getElementById('catId').value;
    const nome = document.getElementById('catNome').value;
    const slug = nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, '-');

    const payload = { nome, slug };
    const url = id ? `${API_URL}/categorias/${id}/` : `${API_URL}/categorias/`;
    const method = id ? 'PUT' : 'POST';

    try {
        const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (res.ok) {
            registrarRelatorio(id ? 'EDITAR CATEGORIA' : 'CRIAR CATEGORIA', `Categoria: ${nome}`);
            showToast("Categoria guardada com sucesso!", "success");
            fecharModalCategoria();
            await carregarDadosSilencioso();
        }
    } catch (err) {
        showToast("Erro ao guardar categoria.", "error");
    }
    return false;
}

async function excluirCategoria(id) {
    const cat = categorias.find(c => c.id == id);
    if (!confirm(`Tem certeza que deseja apagar a categoria "${cat ? cat.nome : id}"?`)) return;

    try {
        const res = await fetch(`${API_URL}/categorias/${id}/`, { method: 'DELETE' });
        if (res.ok) {
            registrarRelatorio('EXCLUIR CATEGORIA', `Removida ID: ${id} (${cat ? cat.nome : ''})`);
            showToast("Categoria removida!", "success");
            await carregarDadosSilencioso();
        }
    } catch (err) {
        showToast("Erro ao excluir categoria.", "error");
    }
}

async function carregarDadosSilencioso() {
    try {
        const [resProd, resCat] = await Promise.all([
            fetch(`${API_URL}/produtos/`),
            fetch(`${API_URL}/categorias/`)
        ]);

        if (resProd.ok && resCat.ok) {
            produtos = await resProd.json();
            categorias = await resCat.json();
            renderizarTudo();
        }
    } catch (e) {
        console.error("Erro na atualização silenciosa", e);
    }
}

function salvarNovaApiUrl() {
    const val = document.getElementById('inputApiUrlConfig').value.trim();
    if (val) {
        API_URL = val.replace(/\/$/, "");
        localStorage.setItem('LUA_CHEIA_API_URL', API_URL);
        showToast("URL da API atualizada!", "success");
        carregarDadosDoBanco(true);
    }
}

function limparRelatorios() {
    if (!confirm("Deseja apagar todos os relatórios de auditoria?")) return;
    relatorios = [];
    localStorage.removeItem('LUA_CHEIA_ADMIN_LOGS');
    renderizarRelatorios();
    renderizarDashboard();
    showToast("Relatórios limpos.", "info");
}

function abrirModalProduto() {
    const form = document.getElementById('formProduto');
    if (form) form.reset();
    document.getElementById('prodId').value = '';
    document.getElementById('prodImagemUrl').value = '';
    document.getElementById('prodImagemFile').value = '';
    document.getElementById('prodImgPreview').src = 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=100&q=80';
    document.getElementById('previewText').textContent = 'Cole uma URL ou selecione um arquivo abaixo.';
    document.getElementById('modalProdutoTitulo').textContent = 'Novo Produto';
    document.getElementById('modalProduto').classList.remove('hidden');
}

function editarProduto(id) {
    const p = produtos.find(item => item.id == id);
    if (!p) return;

    document.getElementById('prodId').value = p.id;
    document.getElementById('prodNome').value = p.nome;
    document.getElementById('prodPreco').value = p.preco;
    document.getElementById('prodEstoque').value = p.estoque ?? p.quantidade_estoque ?? 0;
    document.getElementById('prodCategoria').value = p.categoria || '';
    document.getElementById('prodDescricao').value = p.descricao || '';
    document.getElementById('prodImagemUrl').value = p.imagem_url || '';
    document.getElementById('prodImagemFile').value = '';

    const imgSrc = obterUrlImagemProduto(p);
    document.getElementById('prodImgPreview').src = imgSrc;
    document.getElementById('previewText').textContent = 'Imagem cadastrada do produto.';

    document.getElementById('modalProdutoTitulo').textContent = 'Editar Produto';
    document.getElementById('modalProduto').classList.remove('hidden');
}

function fecharModalProduto() {
    const modal = document.getElementById('modalProduto');
    if (modal) modal.classList.add('hidden');
}

function abrirModalCategoria() {
    document.getElementById('catNome').value = '';
    document.getElementById('catId').value = '';
    document.getElementById('modalCategoriaTitulo').textContent = 'Nova Categoria';
    document.getElementById('modalCategoria').classList.remove('hidden');
}

function editarCategoria(id, nome) {
    document.getElementById('catId').value = id;
    document.getElementById('catNome').value = nome;
    document.getElementById('modalCategoriaTitulo').textContent = 'Editar Categoria';
    document.getElementById('modalCategoria').classList.remove('hidden');
}

function fecharModalCategoria() {
    const modal = document.getElementById('modalCategoria');
    if (modal) modal.classList.add('hidden');
}

function toggleMobileSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    if (sidebar) sidebar.classList.toggle('-translate-x-full');
    if (overlay) overlay.classList.toggle('hidden');
}

function showToast(msg, tipo = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    const cores = { success: 'bg-emerald-950 text-emerald-300', error: 'bg-rose-950 text-rose-300', info: 'bg-slate-900 text-slate-200' };
    toast.className = `px-4 py-3 rounded-xl border border-slate-700 text-xs font-medium shadow-xl ${cores[tipo] || cores.info}`;
    toast.textContent = msg;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}