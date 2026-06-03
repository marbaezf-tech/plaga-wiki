$wikiDir = 'c:\Taxones\Taxones\wiki'

$mapping = @(
    @{ file='taxon-zancudos.html'; img='img/taxon_zancudo_v4.png'; alt='Zancudo' },
    @{ file='taxon-cucarachas.html'; img='img/taxon_cucaracha_v4.png'; alt='Cucaracha' },
    @{ file='taxon-avispas.html'; img='img/taxon_avispa_v5.png'; alt='Avispa' },
    @{ file='taxon-garrapatas.html'; img='img/taxon_garrapata_v5.png'; alt='Garrapata' },
    @{ file='taxon-chinches.html'; img='img/taxon_chinche_v4.png'; alt='Chinche' },
    @{ file='taxon-mariposas.html'; img='img/taxon_mariposa_v5.png'; alt='Mariposa' },
    @{ file='taxon-aranas.html'; img='img/taxon_arana_v4.png'; alt='Araña' },
    @{ file='taxon-escorpiones.html'; img='img/taxon_escorpion_v4.png'; alt='Escorpión' },
    @{ file='taxon-vinchucas.html'; img='img/taxon_vinchuca_v4.png'; alt='Vinchuca' },
    @{ file='taxon-moscas.html'; img='img/taxon_mosca_v5.png'; alt='Mosca' },
    @{ file='taxon-sanguijuelas.html'; img='img/taxon_sanguijuela_v4.png'; alt='Sanguijuela' },
    @{ file='taxon-polillas.html'; img='img/taxon_polilla_v4.png'; alt='Polilla' },
    @{ file='taxon-pulgas.html'; img='img/taxon_pulga_v5.png'; alt='Pulga' },
    @{ file='taxon-tipulas.html'; img='img/taxon_tipula_v6.png'; alt='Típula' },
    @{ file='taxon-escarabajos.html'; img='img/taxon_escarabajo_v6.png'; alt='Escarabajo' },
    @{ file='taxon-grillos.html'; img='img/taxon_grillo_v4.png'; alt='Grillo' },
    @{ file='taxon-mantis.html'; img='img/taxon_mantis_v4.png'; alt='Mantis' }
)

$mobileCSS = '    <style>@media (max-width: 768px) { div[style*="float:right"] { float:none !important; max-width:100% !important; margin:0 0 16px 0 !important; } }</style>'

foreach ($item in $mapping) {
    $filePath = Join-Path $wikiDir $item.file
    if (-not (Test-Path $filePath)) {
        Write-Host "SKIP: $($item.file) not found"
        continue
    }
    
    $content = [System.IO.File]::ReadAllText($filePath, [System.Text.Encoding]::UTF8)
    
    # Check if infobox already added (look for our specific pattern)
    if ($content -match 'Concept art — Pre-Alfa v0\.8') {
        Write-Host "ALREADY: $($item.file)"
        continue
    }
    
    # Add mobile CSS before </head>
    if ($content -notmatch 'float:none') {
        $content = $content.Replace('</head>', "$mobileCSS`n</head>")
    }
    
    # Build infobox HTML
    $infobox = @"
<div style="float:right; margin:0 0 16px 16px; max-width:280px; border:1px solid var(--border); border-radius:8px; overflow:hidden; background:var(--bg-card);">
    <img src="$($item.img)" alt="$($item.alt)" style="width:100%; display:block;">
    <p style="text-align:center; font-size:0.75em; color:var(--text-muted); padding:8px; margin:0;">Concept art — Pre-Alfa v0.8</p>
</div>
"@
    
    # Find main content h1 (inside <article>)
    # Match pattern: <article>\n            <h1>...</h1>
    $pattern = '(<article>\s*<h1>[^<]*</h1>)'
    if ($content -match $pattern) {
        $h1Match = $Matches[0]
        $indentedInfobox = "            " + ($infobox -replace "`n", "`n            ")
        $replacement = $h1Match + "`n" + $indentedInfobox
        $content = $content.Replace($h1Match, $replacement)
        Write-Host "OK: $($item.file)"
    } else {
        Write-Host "WARN: No article>h1 in $($item.file)"
    }
    
    [System.IO.File]::WriteAllText($filePath, $content, [System.Text.Encoding]::UTF8)
}
