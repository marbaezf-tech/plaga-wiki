$wikiDir = 'c:\Taxones\Taxones\wiki'
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

$fixes = @(
    @{ file='taxon-aranas.html'; bad='alt="AraÃ±a"'; good='alt="Araña"' },
    @{ file='taxon-tipulas.html'; bad='alt="TÃ­pula"'; good='alt="Típula"' },
    @{ file='taxon-escorpiones.html'; bad='alt="EscorpiÃ³n"'; good='alt="Escorpión"' }
)

foreach ($fix in $fixes) {
    $filePath = Join-Path $wikiDir $fix.file
    if (-not (Test-Path $filePath)) { continue }
    
    $content = [System.IO.File]::ReadAllText($filePath, $utf8NoBom)
    
    if ($content.Contains($fix.bad)) {
        $content = $content.Replace($fix.bad, $fix.good)
        [System.IO.File]::WriteAllText($filePath, $content, $utf8NoBom)
        Write-Host ('FIXED: ' + $fix.file)
    } else {
        Write-Host ('OK: ' + $fix.file + ' - pattern not found')
    }
}
