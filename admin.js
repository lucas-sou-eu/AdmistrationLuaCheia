const DEFAULT_API_URL = "https://frog-trade-animals-contacting.trycloudflare.com/api";
let API_URL = localStorage.getItem('LUA_CHEIA_API_URL') || DEFAULT_API_URL;

let produtos = [];
let categorias = [];
let relatorios = JSON.parse(localStorage.getItem('LUA_CHEIA_ADMIN_LOGS')) || [];

// Identidade do Administrador
let adminId = localStorage.getItem('LUA_CHEIA_ADMIN_ID') || "ADM-001";
let adminNome = localStorage.getItem('LUA_CHEIA_ADMIN_NOME') || "Mestre Lucas";

// Preservação do estado da navegação
let abaAtiva = localStorage.getItem('LUA_CHEIA_ABA_ATIVA') || 'dashboard';
let subAbaAtiva = localStorage.getItem('LUA_CHEIA_SUB_ABA_ATIVA') || 'produtos';

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('inputApiUrlConfig').value = API_URL;
    document.getElementById('inputAdminId').value = adminId;
    document.getElementById('inputAdminNome').value = adminNome;
    document.getElementById('adminInfoTag').textContent = `ID: ${adminId} | ${adminNome}`;

    switchTab(abaAtiva, false);
    mudarSubAbaCatalogo(subAbaAtiva, false);

    carregarDadosDoBanco();
});

function registrarRelatorio(acao, detalhes) {
    const novoLog = {
        id: Date.now(),
        adminId: adminId,
        adminNome: adminNome,
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

    const sections = ['dashboard', 'catalogo', 'relatorios', 'configuracoes'];

    sections.forEach(s => {
        const secEl = document.getElementById(`section-${s}`);
        const navBtn = document.getElementById(`nav-${s}`);

        if (s === tab) {
            secEl.classList.remove('hidden');
            if (navBtn) navBtn.classList.add('active');
        } else {
            secEl.classList.add('hidden');
            if (navBtn) navBtn.classList.remove('active');
        }
    });

    const titulos = {
        dashboard: 'Visão Geral & Dashboard',
        catalogo: 'Gestão de Cardápio & Categorias',
        relatorios: 'Relatórios de Atividades dos Administradores',
        configuracoes: 'Configurações do Sistema'
    };

    document.getElementById('pageTitle').textContent = titulos[tab] || 'Painel';

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
    document.getElementById('subsect-produtos').classList.toggle('hidden', !isProd);
    document.getElementById('subsect-categorias').classList.toggle('hidden', isProd);

    document.getElementById('subnav-produtos').className = isProd ? "pb-3 text-sm font-semibold text-amber-400 border-b-2 border-amber-500 transition" : "pb-3 text-sm font-semibold text-slate-400 hover:text-slate-200 transition";
    document.getElementById('subnav-categorias').className = !isProd ? "pb-3 text-sm font-semibold text-amber-400 border-b-2 border-amber-500 transition" : "pb-3 text-sm font-semibold text-slate-400 hover:text-slate-200 transition";
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

        badgeDot.className = "w-2 h-2 rounded-full bg-emerald-500 animate-pulse";
        badgeText.textContent = "Banco Conectado (Django)";
        badgeText.className = "text-emerald-400 font-semibold";

        if (manual) showToast("Dados sincronizados com sucesso!", "success");

        renderizarTudo();
    } catch (error) {
        badgeDot.className = "w-2 h-2 rounded-full bg-rose-500";
        badgeText.textContent = "Erro de Conexão com o Banco";
        badgeText.className = "text-rose-400 font-medium";
        if (manual) showToast("Não foi possível conectar ao banco.", "error");
    }
}

function renderizarTudo() {
    renderizarDashboard();
    renderizarProdutos();
    renderizarCategorias();
    renderizarRelatorios();
    preencherSelectCategorias();
}

function renderizarDashboard() {
    document.getElementById('dashTotalProdutos').textContent = produtos.length;

    // Conta produtos onde o estoque (ou quantidade_estoque) é menor ou igual a 3
    const estoqueBaixoCount = produtos.filter(p => {
        const qtd = p.estoque !== undefined ? p.estoque : (p.quantidade_estoque !== undefined ? p.quantidade_estoque : 0);
        return qtd <= 3;
    }).length;

    document.getElementById('dashStockBaixo').textContent = estoqueBaixoCount;
    document.getElementById('dashTotalCategorias').textContent = categorias.length;
    document.getElementById('dashTotalLogs').textContent = relatorios.length;
}

function renderizarProdutos(lista = produtos) {
    const body = document.getElementById('tableProdutosBody');
    body.innerHTML = lista.map(p => {
        let imagemSrc = 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=100&q=80';

        if (p.imagem) {
            if (p.imagem.startsWith('http')) {
                imagemSrc = p.imagem;
            } else {
                // Pega a URL base correta (remove o /api do final de forma segura)
                const baseUrlServer = API_URL.replace(/\/api\/?$/, "");
                // Garante que p.imagem comece com barra
                const caminhoImagem = p.imagem.startsWith('/') ? p.imagem : `/${p.imagem}`;
                imagemSrc = `${baseUrlServer}${caminhoImagem}`;
            }
        } else if (p.imagem_url) {
            imagemSrc = p.imagem_url;
        }

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
}

function filtrarProdutos() {
    const busca = document.getElementById('inputSearchProduto').value.toLowerCase();
    const filtrados = produtos.filter(p => p.nome.toLowerCase().includes(busca));
    renderizarProdutos(filtrados);
}

function renderizarCategorias() {
    const grid = document.getElementById('gridCategorias');
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
    select.innerHTML = categorias.map(c => `<option value="${c.id}">${c.nome}</option>`).join('') || `<option value="">Selecione uma categoria</option>`;
}

// SALVAR PRODUTO COM SUPORTE A ARQUIVO OU URL
async function salvarProduto(e) {
    e.preventDefault();
    const id = document.getElementById('prodId').value;
    const nome = document.getElementById('prodNome').value;

    const formData = new FormData();
    formData.append('nome', nome);
    formData.append('preco', document.getElementById('prodPreco').value);
    formData.append('estoque', document.getElementById('prodEstoque').value);
    formData.append('categoria', document.getElementById('prodCategoria').value);
    formData.append('descricao', document.getElementById('prodDescricao').value);
    formData.append('disponivel', 'true');

    const urlInput = document.getElementById('prodImagemUrl').value.trim();
    if (urlInput) {
        formData.append('imagem_url', urlInput);
    }

    const arquivoInput = document.getElementById('prodImagemFile');
    if (arquivoInput.files[0]) {
        formData.append('imagem', arquivoInput.files[0]);
    }

    const url = id ? `${API_URL}/produtos/${id}/` : `${API_URL}/produtos/`;
    const method = id ? 'PATCH' : 'POST';

    try {
        const res = await fetch(url, { method, body: formData });
        if (res.ok) {
            registrarRelatorio(id ? 'EDITAR PRODUTO' : 'CRIAR PRODUTO', `Produto: ${nome}`);
            showToast("Produto guardado com sucesso!", "success");
            fecharModalProduto();
            await carregarDadosSilencioso();
        } else {
            const errJson = await res.json();
            console.error(errJson);
            showToast("Erro de validação no produto.", "error");
        }
    } catch (err) {
        showToast("Erro de comunicação com o servidor.", "error");
    }
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

// SALVAR CATEGORIA
async function salvarCategoria(e) {
    e.preventDefault();
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

function salvarPerfilAdmin() {
    adminId = document.getElementById('inputAdminId').value.trim() || "ADM-001";
    adminNome = document.getElementById('inputAdminNome').value.trim() || "Mestre Lucas";
    localStorage.setItem('LUA_CHEIA_ADMIN_ID', adminId);
    localStorage.setItem('LUA_CHEIA_ADMIN_NOME', adminNome);
    document.getElementById('adminInfoTag').textContent = `ID: ${adminId} | ${adminNome}`;
    showToast("Identidade de Administrador atualizada!", "success");
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
    document.getElementById('formProduto').reset();
    document.getElementById('prodId').value = '';
    document.getElementById('prodImagemUrl').value = '';
    document.getElementById('prodImagemFile').value = '';
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

    document.getElementById('modalProdutoTitulo').textContent = 'Editar Produto';
    document.getElementById('modalProduto').classList.remove('hidden');
}

function fecharModalProduto() { document.getElementById('modalProduto').classList.add('hidden'); }

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

function fecharModalCategoria() { document.getElementById('modalCategoria').classList.add('hidden'); }

function toggleMobileSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    if (sidebar) sidebar.classList.toggle('-translate-x-full');
    if (overlay) overlay.classList.toggle('hidden');
}

function showToast(msg, tipo = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    const cores = { success: 'bg-emerald-950 text-emerald-300', error: 'bg-rose-950 text-rose-300', info: 'bg-slate-900 text-slate-200' };
    toast.className = `px-4 py-3 rounded-xl border border-slate-700 text-xs font-medium shadow-xl ${cores[tipo]}`;
    toast.textContent = msg;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}