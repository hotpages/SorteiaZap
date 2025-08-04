document.addEventListener('DOMContentLoaded', () => {
    // ------------------ CONFIGURAÇÃO DO FIREBASE ------------------
    // COLE AQUI O OBJETO firebaseConfig QUE VOCÊ PEGOU NO SEU PROJETO
    const firebaseConfig = {
      apiKey: "AIza...",
      authDomain: "seu-projeto.firebaseapp.com",
      projectId: "seu-projeto",
      // ...resto das chaves
    };
    // ----------------------------------------------------------------

    // Inicialização
    firebase.initializeApp(firebaseConfig);
    const db = firebase.firestore();
    const functions = firebase.functions();

    // Referências aos elementos do DOM
    const sections = {
        creation: document.getElementById('creation-section'),
        join: document.getElementById('join-section'),
        game: document.getElementById('game-section'),
        admin: document.getElementById('admin-section'),
    };
    
    const createBtn = document.getElementById('create-draw-btn');
    const joinForm = document.getElementById('join-form');
    const drawNumberBtn = document.getElementById('draw-number-btn');
    const newDrawLinksEl = document.getElementById('new-draw-links');
    const playerLinkEl = document.getElementById('player-link');
    const adminLinkEl = document.getElementById('admin-link');
    const bingoCardEl = document.getElementById('bingo-card');
    const drawnNumbersListEl = document.getElementById('drawn-numbers-list');
    const adminDrawnNumbersListEl = document.getElementById('admin-drawn-numbers-list');

    let currentDrawId = null;
    let currentAdminKey = null;
    let unsubscribeFromDraw = null; // Para parar de ouvir as atualizações

    // Função para mostrar apenas uma seção
    const showSection = (sectionName) => {
        Object.values(sections).forEach(section => section.classList.add('hidden'));
        if (sections[sectionName]) {
            sections[sectionName].classList.remove('hidden');
        }
    };

    // Função para renderizar a cartela
    const renderCard = (card) => {
        bingoCardEl.innerHTML = '';
        const letters = ['B', 'I', 'N', 'G', 'O'];
        
        letters.forEach(letter => {
            const cell = document.createElement('div');
            cell.className = 'card-cell header';
            cell.textContent = letter;
            bingoCardEl.appendChild(cell);
        });

        for (const letter of letters) {
            card[letter].forEach(number => {
                const cell = document.createElement('div');
                cell.className = 'card-cell';
                cell.textContent = number;
                cell.dataset.number = number;
                bingoCardEl.appendChild(cell);
            });
        }
    };

    // Função para renderizar a lista de números sorteados
    const renderDrawnNumbers = (numbers) => {
        const listHTML = numbers.map(num => `<div class="drawn-number">${num}</div>`).join('');
        drawnNumbersListEl.innerHTML = listHTML;
        adminDrawnNumbersListEl.innerHTML = listHTML;

        // Marca os números na cartela
        document.querySelectorAll('#bingo-card .card-cell').forEach(cell => {
            const num = cell.dataset.number;
            if (num && numbers.includes(parseInt(num))) {
                cell.classList.add('marked');
            }
        });
    };
    
    // Função para ouvir as atualizações de um sorteio
    const listenToDraw = (drawId) => {
        if (unsubscribeFromDraw) unsubscribeFromDraw(); // Cancela listener anterior

        unsubscribeFromDraw = db.collection('draws').doc(drawId).onSnapshot((doc) => {
            if (doc.exists) {
                const data = doc.data();
                renderDrawnNumbers(data.drawnNumbers || []);
            } else {
                alert('Este sorteio não existe mais.');
                window.location.href = window.location.pathname;
            }
        });
    };

    // Lógica de "roteamento" baseada na URL
    const handleRouting = () => {
        const params = new URLSearchParams(window.location.search);
        const drawId = params.get('drawId');
        const adminKey = params.get('adminKey');
        
        if (adminKey) {
            // É um administrador
            currentDrawId = drawId;
            currentAdminKey = adminKey;
            showSection('admin');
            listenToDraw(drawId);
        } else if (drawId) {
            // É um jogador
            currentDrawId = drawId;
            const playerData = JSON.parse(localStorage.getItem(`bingo_player_${drawId}`));
            if (playerData) {
                showSection('game');
                renderCard(playerData.card);
                listenToDraw(drawId);
            } else {
                showSection('join');
            }
        } else {
            // Página inicial
            showSection('creation');
        }
    };

    // ---------- EVENT LISTENERS ----------

    // Criar Sorteio
    createBtn.addEventListener('click', async () => {
        createBtn.disabled = true;
        createBtn.textContent = 'Criando...';

        try {
            const createDrawFunc = functions.httpsCallable('createDraw');
            const result = await createDrawFunc({ centerImageUrl: null }); // Futuramente, pegar de um input de imagem
            const { drawId, adminKey } = result.data;
            
            const baseUrl = window.location.origin + window.location.pathname;
            playerLinkEl.value = `${baseUrl}?drawId=${drawId}`;
            adminLinkEl.value = `${baseUrl}?drawId=${drawId}&adminKey=${adminKey}`;
            
            newDrawLinksEl.classList.remove('hidden');

        } catch (error) {
            console.error("Erro ao criar sorteio:", error);
            alert(`Erro: ${error.message}`);
        } finally {
            createBtn.disabled = false;
            createBtn.textContent = 'Criar Sorteio';
        }
    });

    // Entrar no sorteio
    joinForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('player-name').value;
        const phone = document.getElementById('player-phone').value;
        const submitBtn = joinForm.querySelector('button');

        submitBtn.disabled = true;
        submitBtn.textContent = 'Gerando cartela...';

        try {
            const registerPlayerFunc = functions.httpsCallable('registerPlayer');
            const result = await registerPlayerFunc({ drawId: currentDrawId, name, phone });
            const playerData = result.data;

            localStorage.setItem(`bingo_player_${currentDrawId}`, JSON.stringify(playerData));
            
            showSection('game');
            renderCard(playerData.card);
            listenToDraw(currentDrawId);

        } catch (error) {
            console.error("Erro ao registrar jogador:", error);
            alert(`Erro: ${error.message}`);
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Pegar minha cartela';
        }
    });
    
    // Sortear Número (Admin)
    drawNumberBtn.addEventListener('click', async () => {
        drawNumberBtn.disabled = true;
        drawNumberBtn.textContent = 'Sorteando...';
        
        try {
            const drawNumberFunc = functions.httpsCallable('drawNumber');
            await drawNumberFunc({ drawId: currentDrawId, adminKey: currentAdminKey });
            // O listener onSnapshot vai cuidar de atualizar a UI
        } catch (error) {
            console.error("Erro ao sortear número:", error);
            alert(`Erro: ${error.message}`);
        } finally {
            drawNumberBtn.disabled = false;
            drawNumberBtn.textContent = 'Sortear Próximo Número';
        }
    });

    // Inicia a aplicação
    handleRouting();
});
