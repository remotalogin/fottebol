<!doctype html>
<html lang="pt-br">
  <head>
    <title>Catalogador - Football Studio</title>
    <meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">
<link rel="stylesheet" href="css/style.css">

<link rel="stylesheet" href="https://stackpath.bootstrapcdn.com/bootstrap/4.3.1/css/bootstrap.min.css" integrity="sha384-ggOyR0iXCbMQv3Xipma34MD+dH/1fQ784/j6cY/iJTQUOhcWr7x9JvoRxT2MZw1T" crossorigin="anonymous">

<script async src="https://www.googletagmanager.com/gtag/js?id=G-FWE8WDS9LP"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());

  gtag('config', 'G-FWE8WDS9LP');
</script>  </head>
  <body>
    <div class="header">
        <script>
setInterval(() => {
    fetch('../verificaChaveAcesso.php')
        .then(response => response.json())
        .then(data => {
            if (data.status === 'logout') {
                // Redireciona para logout.php ou outra página de saída
                window.location.href = 'logoff.php';
            }
        });
}, 10000); // 10 segundos
</script>
<div class="container">
    <div class="row align-items-center">
        <div class="col-md-4 col-8 logo">
            <img src="img/logo.png" alt="">
        </div>
        <div class="col-md-4 col-4 navbar" id="menu">
            <button class="menu-toggle" onclick="toggleMenu()">☰</button>
            <nav class="nav-links" id="navLinks">
                <a  href="logoff.php" class="d-md-none d-sm-block">Sair</a>
            </nav>
        </div>
        <div class="col-md-4 col-4 d-md-block d-none sair">
            <a href="logoff.php">
                Sair
                <img src="img/icon-logout.png" alt="">
            </a>
        </div>
    </div>
</div>      <div class="sugestao">
            <div class="container">
                <div class="row justify-content-center">
                    <div class="col-auto" id="martingale-result">
                        🎯 Sugestão Cores: <strong>Buscando Padrão...</strong>
                    </div>
                    <div class="col-auto" id="martingale-resultCarta">
                        🎯 Sugestão Cartas: <strong>Buscando Padrão...</strong>
                    </div>
                    <div class="col-auto" id="martingale-resultIA">
                        🎯 Sugestão IA: <strong>Buscando Padrão...</strong>
                    </div>
                </div>
            </div>
        </div>
    </div>
    <div class="container">
        <div class="row mt-5">
            <div class="col-12">
                <h1>Football Studio - Evolution</h1>
            </div>
        </div>
    </div>
    <div class="containerGeral">
        <div class="container bg mt-3 form">
            <div class="row justify-content-around aling-items-center">
                <div class="col-md-auto col-12">
                    <label for="quantidade">Resultados:</label>
                    <input type="number" id="quantidade" value="1000" min="10" max="3000" step="10">
                </div>
                <div class="col-md-auto col-12">
                    <label for="tamanho-padrao">Nº de Cartas:</label>
                    <input type="number" id="tamanho-padrao" value="4" min="2" max="30">
                </div>
                <div class="col-md-auto col-12">
                    <label for="percentualAcerto">% de Acerto:</label>
                    <input type="number" id="percentualAcerto" value="90" min="1" max="100">
                </div>
                <div class="col-md-auto col-12">
                    <label for="minOcorrencias">Ocorrências Mín.:</label>
                    <input type="number" id="minOcorrencias" value="15" min="1">
                </div>
                </div>
        </div>
        <div class="container mt-3 mb-4">
            <div class="row maximas justify-content-between">
                <div class="col-xl-3 col-md-6 result-box bg" id="result-v">Máxima de 🔴 <i class="fa-solid fa-arrow-right">-></i> <strong>0</strong></div>
                <div class="col-xl-3 col-md-6 result-box bg" id="result-a">Máxima de 🔵 <i class="fa-solid fa-arrow-right">-></i> <strong>0</strong></div>
                <div class="col-xl-3 col-md-6 result-box bg" id="result-t">Máxima de 🟠 <i class="fa-solid fa-arrow-right">-></i> <strong>0</strong></div>
                <div class="col-xl-3 col-md-6 result-box bg" id="result-no-t">Máxima sem 🟠 <i class="fa-solid fa-arrow-right">-></i> <strong>0</strong></div>
            </div>
        </div>
        
        <div class="container sinal bg" id="pattern-result">
        Aguardando possibilidades
        </div>

        <div class="container mt-5">
            <h2>Análises de Cartas</h2>
        </div>
        
        <div class="container sinal sinalCartas bg" id="sinalCartas">
            Aguardando possibilidades
        </div>

        <div class="container mt-5 mb-3">
            <h2 class="mb-0">Estratégias IA</h2>
        </div>

        <div class="container sinal bg estrategiasIA mb-3">
            <div id="padroes-visuais" class="mt-4"></div>
        </div>
        <div class="container mt-5 mb-3">
            <div class="row align-items-center">
                <div class="col-md-6">
                    <h2 class="mb-0">Cartas Recentes</h2>
                </div>
                <div class="col-md-6 botaoAtt text-right">
                    <button onclick="carregarDados()">Limpar Marcação</button>
                </div>
            </div>
            
        </div>
        <div class="container sinal bg mb-3">
            <div class="data-container" id="dados"></div>
        </div>
    </div>

    <div class="footer text-center mt-5">
    <div class="container-fluid bg pt-3 pb-3">
        <div class="row">
            <div class="col-12">
                <p>+18 | Jogue com responsabilidade</p>
            </div>
        </div>
    </div>
</div>

<script src="https://code.jquery.com/jquery-3.3.1.slim.min.js" integrity="sha384-q8i/X+965DzO0rT7abK41JStQIAqVgRVzpbzo5smXKp4YfRvH+8abtTE1Pi6jizo" crossorigin="anonymous"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/popper.js/1.14.7/umd/popper.min.js" integrity="sha384-UO2eT0CpHqdSJQ6hJty5KVphtPhzWj9WO1clHTMGa3JDZwrnQq4sF86dIHNDz0W1" crossorigin="anonymous"></script>
<script src="https://stackpath.bootstrapcdn.com/bootstrap/4.3.1/js/bootstrap.min.js" integrity="sha384-JjSmVgyd0p3pXB1rRibZUAYoIIy6OrQ6VrjIEaFf/nJGzIxFDsf4x0xIM+B07jRM" crossorigin="anonymous"></script>

<script>
    function toggleMenu() {
        document.getElementById('navLinks').classList.toggle('active');
    }
</script>    
<script src="footballstudio-brbet.php"></script>
  </body>
</html>
