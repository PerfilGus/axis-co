# Embute as imagens da pasta dentro do index.html como data URI.
# Rode de novo sempre que trocar axis-logo-icon.png ou correios-seeklogo.png:
#   powershell -ExecutionPolicy Bypass -File .\tools\embed-assets.ps1
#
# ATENCAO: este arquivo e' ASCII de proposito. O Windows PowerShell 5.1 le .ps1
# sem BOM como ANSI, e qualquer acento/travessao aqui vira lixo nos marcadores.

# O script vive em tools/; a raiz do projeto e' um nivel acima.
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$html = Join-Path $root 'index.html'

function To-DataUri($file) {
  $path = Join-Path $root $file
  if (-not (Test-Path $path)) { throw "Asset nao encontrado: $path" }
  $bytes = [System.IO.File]::ReadAllBytes($path)
  return 'data:image/png;base64,' + [Convert]::ToBase64String($bytes)
}

# O bloco gerado fica entre marcadores INICIO/FIM: a substituicao casa exatamente
# esse intervalo, sem risco de avancar por cima do codigo que vem depois.
$inicio = '/* ==== imagens embutidas (embed-assets.ps1) - INICIO ==== */'
$fim    = '/* ==== imagens embutidas - FIM ==== */'

$block = @"
$inicio
const ASSETS = {
  logo: '$(To-DataUri 'assets/brand/axis-logo-icon.png')',
  correios: '$(To-DataUri 'assets/carriers/correios-seeklogo.png')'
};
$fim
"@

$text = [System.IO.File]::ReadAllText($html, [System.Text.Encoding]::UTF8)

$padrao = [regex]::Escape($inicio) + '.*?' + [regex]::Escape($fim)
if ($text -match "(?s)$padrao") {
  $text = [regex]::Replace($text, "(?s)$padrao", { param($m) $block })
} else {
  # primeira vez: insere logo antes da config de status
  $marker = '/* ---------------- config de status ---------------- */'
  if (-not $text.Contains($marker)) { throw "Marcador nao encontrado no index.html: $marker" }
  $text = $text.Replace($marker, $block + "`r`n`r`n" + $marker)
}

# travas de seguranca: o arquivo tem que continuar inteiro e sem bloco duplicado
foreach ($obrigatorio in @('const STATUS', 'const SECTION_ORDER', 'const ASSETS', 'function renderGrid')) {
  if (-not $text.Contains($obrigatorio)) { throw "Abortado: '$obrigatorio' sumiu do arquivo. Nada foi gravado." }
}
if (([regex]::Matches($text, [regex]::Escape('const ASSETS'))).Count -ne 1) {
  throw "Abortado: o bloco ASSETS ficaria duplicado. Nada foi gravado."
}

[System.IO.File]::WriteAllText($html, $text, (New-Object System.Text.UTF8Encoding($false)))
Write-Output "Imagens embutidas em index.html ($([math]::Round((Get-Item $html).Length / 1KB)) KB)"
