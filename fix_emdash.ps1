$wikiDir = 'c:\Taxones\Taxones\wiki'

$files = @(
    'taxon-zancudos.html',
    'taxon-cucarachas.html',
    'taxon-avispas.html',
    'taxon-garrapatas.html',
    'taxon-chinches.html',
    'taxon-mariposas.html',
    'taxon-aranas.html',
    'taxon-escorpiones.html',
    'taxon-vinchucas.html',
    'taxon-moscas.html',
    'taxon-sanguijuelas.html',
    'taxon-polillas.html',
    'taxon-pulgas.html',
    'taxon-tipulas.html',
    'taxon-escarabajos.html',
    'taxon-grillos.html',
    'taxon-mantis.html'
)

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$emdash = [char]0x2014

foreach ($file in $files) {
    $filePath = Join-Path $wikiDir $file
    if (-not (Test-Path $filePath)) { continue }
    
    $content = [System.IO.File]::ReadAllText($filePath, $utf8NoBom)
    
    # The corrupted sequence when UTF8 em-dash bytes are read as latin1
    $corrupted = [char]0x00C3 + [string][char]0x00A2 + [string][char]0x00E2 + [string][char]0x0082 + [string][char]0x00AC + [string][char]0x00E2 + [string][char]0x0080 + [string][char]0x009C
    
    $changed = $false
    
    # Try simple string replace for common mojibake pattern
    if ($content.Contains('Concept art ')) {
        # Find and replace the corrupted em-dash between 'art ' and ' Pre-Alfa'
        $badPattern = 'Concept art .{1,10} Pre-Alfa'
        $goodText = 'Concept art ' + $emdash + ' Pre-Alfa'
        $regex = [regex]::new('Concept art [^\n]{1,10} Pre-Alfa')
        $match = $regex.Match($content)
        if ($match.Success -and $match.Value -ne $goodText) {
            $content = $content.Remove($match.Index, $match.Length).Insert($match.Index, $goodText)
            $changed = $true
        }
    }
    
    if ($changed) {
        [System.IO.File]::WriteAllText($filePath, $content, $utf8NoBom)
        Write-Host ('FIXED: ' + $file)
    } else {
        Write-Host ('OK: ' + $file)
    }
}
