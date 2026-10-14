// Aguarda o carregamento da página para injetar o jogo
window.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('jogo-container') || document.body;
    
    // Configuração do Canvas
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    canvas.style.display = 'block';
    canvas.style.margin = '0 auto';
    canvas.style.background = '#000';
    canvas.style.border = '4px solid #333';
    container.appendChild(canvas);
    
    const ctx = canvas.getContext('2d');

    // Estado do Jogo
    const estado = {
        velocidade: 0,
        maxVelocidade: 12,
        aceleracao: 0.1,
        desaceleracao: 0.05,
        posicaoX: 0, // Posição lateral do jogador (-1 a 1)
        distancia: 0,
        ultrapassagens: 0,
        carrosPassados: 0,
        metaUltrapassagens: 50,
        gameOver: false,
        vitoria: false,
        tempoOriginal: Date.now()
    };

    // Controles
    const teclas = { Left: false, Right: false, Up: false, Down: false };
    
    window.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft' || e.key === 'a') teclas.Left = true;
        if (e.key === 'ArrowRight' || e.key === 'd') teclas.Right = true;
        if (e.key === 'ArrowUp' || e.key === 'w') teclas.Up = true;
        if (e.key === 'ArrowDown' || e.key === 's') teclas.Down = true;
    });

    window.addEventListener('keyup', (e) => {
        if (e.key === 'ArrowLeft' || e.key === 'a') teclas.Left = false;
        if (e.key === 'ArrowRight' || e.key === 'd') teclas.Right = false;
        if (e.key === 'ArrowUp' || e.key === 'w') teclas.Up = false;
        if (e.key === 'ArrowDown' || e.key === 's') teclas.Down = false;
    });

    // Classe para os Carros Adversários
    class Inimigo {
        constructor() {
            this.reset();
            // Começa em distâncias variadas na pista
            this.z = Math.random() * 200 + 50; 
        }

        reset() {
            this.x = (Math.random() * 1.4) - 0.7; // Posição na pista (-0.7 a 0.7)
            this.z = 250; // Distância do horizonte
            this.cor = ['#e74c3c', '#f1c40f', '#3498db', '#9b59b6'][Math.floor(Math.random() * 4)];
            this.velocidadeRelativa = Math.random() * 2 + 3;
        }

        update(velocidadeJogador) {
            // O carro se aproxima com base na velocidade do jogador menos a dele
            this.z -= (velocidadeJogador - this.velocidadeRelativa) * 0.5;

            // Se o jogador passar o carro
            if (this.z <= 0) {
                if (Math.abs(this.x - estado.posicaoX) < 0.25) {
                    // Colisão!
                    estado.velocidade = 1; // Reduz drasticamente a velocidade
                    this.z = 40; // Empurra o inimigo um pouco para frente
                } else {
                    // Ultrapassagem limpa
                    estado.carrosPassados++;
                    if (estado.carrosPassados >= estado.metaUltrapassagens) {
                        estado.vitoria = true;
                    }
                    this.reset();
                }
            }
            
            // Se o inimigo sumir no horizonte por estar mais rápido (caso o jogador pare)
            if (this.z > 260) {
                this.reset();
                this.z = 240;
            }
        }

        draw() {
            if (this.z <= 0 || this.z > 250) return;

            // Projeção 3D simples para 2D
            const fov = 150;
            const escala = fov / (fov + this.z);
            const numPistaX = canvas.width / 2 + (this.x - estado.posicaoX) * canvas.width * escala;
            const numPistaY = canvas.height / 2 + 60 + (canvas.height / 2) * escala;
            
            const w = 120 * escala;
            const h = 60 * escala;

            if (numPistaY < canvas.height / 2 + 50) return;

            // Desenho do Carro Adversário estilo pixel/Atari
            ctx.fillStyle = this.cor;
            ctx.fillRect(numPistaX - w / 2, numPistaY - h, w, h * 0.7); // Corpo
            ctx.fillStyle = '#000';
            ctx.fillRect(numPistaX - w * 0.6, numPistaY - h * 0.4, w * 0.2, h * 0.4); // Roda L
            ctx.fillRect(numPistaX + w * 0.4, numPistaY - h * 0.4, w * 0.2, h * 0.4); // Roda R
            ctx.fillStyle = '#fff';
            ctx.fillRect(numPistaX - w * 0.3, numPistaY - h * 0.8, w * 0.6, h * 0.2); // Aerofólio
        }
    }

    // Inicializa 3 carros inimigos
    const inimigos = [new Inimigo(), new Inimigo(), new Inimigo()];

    // Loop Principal do Jogo
    function loop() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (!estado.gameOver && !estado.vitoria) {
            // 1. Atualizar Física do Jogador
            if (teclas.Up) {
                estado.velocidade = Math.min(estado.velocidade + estado.aceleracao, estado.maxVelocidade);
            } else if (teclas.Down) {
                estado.velocidade = Math.max(estado.velocidade - estado.aceleracao * 2, 0);
            } else {
                estado.velocidade = Math.max(estado.velocidade - estado.desaceleracao, 0);
            }

            if (teclas.Left && estado.velocidade > 0) estado.posicaoX -= 0.025 * (estado.velocidade / 10);
            if (teclas.Right && estado.velocidade > 0) estado.posicaoX += 0.025 * (estado.velocidade / 10);

            // Limitar o jogador nas bordas da pista
            estado.posicaoX = Math.max(Math.min(estado.posicaoX, 0.8), -0.8);
            estado.distancia += estado.velocidade * 0.1;

            // 2. Atualizar Inimigos
            inimigos.forEach(inimigo => inimigo.update(estado.velocidade));
            // Ordena os inimigos por distância (z) para renderizar os do fundo primeiro
            inimigos.sort((a, b) => b.z - a.z);
        }

        // 3. Renderização do Cenário (Perspectiva)
        // Céu e Horizonte (Estilo Entardecer do Enduro)
        ctx.fillStyle = '#1a0033';
        ctx.fillRect(0, 0, canvas.width, canvas.height / 2 + 50);
        ctx.fillStyle = '#d35400';
        ctx.fillRect(0, canvas.height / 2 + 30, canvas.width, 20);

        // Chão (Laterais da pista)
        ctx.fillStyle = '#27ae60';
        ctx.fillRect(0, canvas.height / 2 + 50, canvas.width, canvas.height / 2);

        // Pista (Desenhada linha por linha para criar o efeito 3D)
        for (let i = 0; i < canvas.height / 2 - 50; i++) {
            const y = canvas.height / 2 + 50 + i;
            const z = 100 / (y - (canvas.height / 2 + 45)); // Profundidade invertida
            
            // Largura da pista diminui em direção ao horizonte
            const larguraPista = 120 + (i * 2.2); 
            // Curvatura simulada baseada na distância percorrida
            const curvatura = Math.sin(estado.distancia * 0.005) * 40 * (i / 100);
            const centroX = canvas.width / 2 + curvatura - (estado.posicaoX * i * 2);

            ctx.fillStyle = '#7f8c8d'; // Cor do asfalto
            ctx.fillRect(centroX - larguraPista / 2, y, larguraPista, 1);

            // Linhas laterais brancas
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(centroX - larguraPista / 2, y, 4, 1);
            ctx.fillRect(centroX + larguraPista / 2 - 4, y, 4, 1);

            // Linhas tracejadas centrais
            if (Math.floor((z + estado.distancia * 0.5) % 20) < 10) {
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(centroX - 1, y, 2, 1);
            }
        }

        // 4. Desenhar Inimigos
        inimigos.forEach(inimigo => inimigo.draw());

        // 5. Desenhar o Carro do Jogador (Posição fixa na parte inferior)
        const jogadorX = canvas.width / 2;
        const jogadorY = canvas.height - 40;
        
        ctx.fillStyle = '#2c3e50'; // Rodas jogador
        ctx.fillRect(jogadorX - 45, jogadorY - 5, 15, 25);
        ctx.fillRect(jogadorX + 30, jogadorY - 5, 15, 25);
        
        ctx.fillStyle = '#ffffff'; // Chassi do jogador (Carro Branco clássico)
        ctx.fillRect(jogadorX - 30, jogadorY, 60, 20); // Corpo principal
        ctx.fillRect(jogadorX - 15, jogadorY - 15, 30, 15); // Cabine
        ctx.fillStyle = '#e74c3c'; 
        ctx.fillRect(jogadorX - 25, jogadorY - 2, 10, 5); // Lanternas traseiras
        ctx.fillRect(jogadorX + 15, jogadorY - 2, 10, 5);

        // 6. Interface de Usuário (HUD) - Estilo Placar Atari
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 20px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(`VEL: ${Math.floor(estado.velocidade * 15)} KM/H`, 20, 40);
        
        ctx.textAlign = 'right';
        ctx.fillText(`RESTA: ${Math.max(0, estado.metaUltrapassagens - estado.carrosPassados)} CARROS`, canvas.width - 20, 40);

        // Telas de Fim de Jogo ou Vitória
        if (estado.vitoria) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#2ecc71';
            ctx.font = 'bold 40px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('CONCLUÍDO!', canvas.width / 2, canvas.height / 2);
            ctx.font = '20px monospace';
            ctx.fillStyle = '#fff';
            ctx.fillText('Você passou todos os carros do dia!', canvas.width / 2, canvas.height / 2 + 40);
        }

        requestAnimationFrame(loop);
    }

    // Inicia o loop
    loop();
});
