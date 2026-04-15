import fs from 'fs';
import path from 'path';

// Directories to process
const DIRS = ['app', 'components'];
const EXTENSIONS = ['.tsx', '.ts'];

// Skip these files (already manually updated)
const SKIP_FILES = new Set([
  'app/globals.css',
  'app/layout.tsx',
  'components/app-sidebar.tsx',
  'components/navbar-v2.tsx',
  'components/footer-v2.tsx',
  'components/mobile-header.tsx',
  'components/live-servers.tsx',
  'components/latest-news-banner.tsx',
  'components/weapon-gods.tsx',
]);

// Replacement rules - order matters (more specific first)
const REPLACEMENTS = [
  // Gold color -> dark accent
  ['#c9a961', '#1a1a1e'],
  
  // Gold variants
  ['#dac07a', '#333338'],
  ['#a88a4a', '#0a0a0c'],
  ['#e8cc80', '#444450'],
  ['#d4b574', '#444450'],
  
  // rgba gold patterns -> dark equivalents
  [/rgba\(201,\s*169,\s*97,\s*0\.03\)/g, 'rgba(0,0,0,0.02)'],
  [/rgba\(201,\s*169,\s*97,\s*0\.04\)/g, 'rgba(0,0,0,0.03)'],
  [/rgba\(201,\s*169,\s*97,\s*0\.05\)/g, 'rgba(0,0,0,0.04)'],
  [/rgba\(201,\s*169,\s*97,\s*0\.06\)/g, 'rgba(0,0,0,0.05)'],
  [/rgba\(201,\s*169,\s*97,\s*0\.08\)/g, 'rgba(0,0,0,0.06)'],
  [/rgba\(201,\s*169,\s*97,\s*0\.1\b\)/g, 'rgba(0,0,0,0.06)'],
  [/rgba\(201,\s*169,\s*97,\s*0\.12\)/g, 'rgba(0,0,0,0.08)'],
  [/rgba\(201,\s*169,\s*97,\s*0\.15\)/g, 'rgba(0,0,0,0.08)'],
  [/rgba\(201,\s*169,\s*97,\s*0\.2\b\)/g, 'rgba(0,0,0,0.1)'],
  [/rgba\(201,\s*169,\s*97,\s*0\.25\)/g, 'rgba(0,0,0,0.12)'],
  [/rgba\(201,\s*169,\s*97,\s*0\.3\b\)/g, 'rgba(0,0,0,0.15)'],
  [/rgba\(201,\s*169,\s*97,\s*0\.4\b\)/g, 'rgba(0,0,0,0.2)'],
  [/rgba\(201,\s*169,\s*97,\s*0\.5\b\)/g, 'rgba(0,0,0,0.25)'],
  [/rgba\(201,\s*169,\s*97,\s*0\.6\b\)/g, 'rgba(0,0,0,0.3)'],
  [/rgba\(201,\s*169,\s*97,\s*0\.7\b\)/g, 'rgba(0,0,0,0.35)'],
  [/rgba\(201,\s*169,\s*97,\s*0\.8\b\)/g, 'rgba(0,0,0,0.4)'],
  
  // text-white/XX -> text-[#1a1a1e]/XX (content area text)
  // But NOT inside sidebar/dark-bg contexts (we can't easily detect context, 
  // so we replace all - sidebar files are in SKIP_FILES)
  ['text-white/90', 'text-[#1a1a1e]/90'],
  ['text-white/85', 'text-[#1a1a1e]/85'],
  ['text-white/80', 'text-[#1a1a1e]/80'],
  ['text-white/70', 'text-[#1a1a1e]/70'],
  ['text-white/65', 'text-[#1a1a1e]/65'],
  ['text-white/60', 'text-[#1a1a1e]/60'],
  ['text-white/55', 'text-[#1a1a1e]/55'],
  ['text-white/50', 'text-[#1a1a1e]/50'],
  ['text-white/45', 'text-[#1a1a1e]/45'],
  ['text-white/40', 'text-[#1a1a1e]/40'],
  ['text-white/35', 'text-[#1a1a1e]/35'],
  ['text-white/30', 'text-[#1a1a1e]/30'],
  ['text-white/25', 'text-[#1a1a1e]/25'],
  ['text-white/20', 'text-[#1a1a1e]/20'],
  ['text-white/15', 'text-[#1a1a1e]/15'],
  ['text-white/10', 'text-[#1a1a1e]/10'],
  // Plain text-white (used as bright text on dark) -> text-[#1a1a1e] on light
  // Be careful with this - only in certain contexts
  
  // bg-white/[0.XX] -> bg-black/[0.XX] (hover/active overlays)  
  ['bg-white/[0.02]', 'bg-black/[0.02]'],
  ['bg-white/[0.03]', 'bg-black/[0.02]'],
  ['bg-white/[0.04]', 'bg-black/[0.03]'],
  ['bg-white/[0.05]', 'bg-black/[0.03]'],
  ['bg-white/[0.06]', 'bg-black/[0.04]'],
  ['bg-white/[0.07]', 'bg-black/[0.04]'],
  ['bg-white/[0.08]', 'bg-black/[0.05]'],
  ['bg-white/[0.10]', 'bg-black/[0.05]'],
  ['bg-white/[0.15]', 'bg-black/[0.06]'],
  
  // border-white/[0.XX] -> border-black/[0.XX]
  ['border-white/[0.04]', 'border-black/[0.04]'],
  ['border-white/[0.05]', 'border-black/[0.05]'],
  ['border-white/[0.06]', 'border-black/[0.06]'],
  ['border-white/[0.08]', 'border-black/[0.06]'],
  ['border-white/[0.10]', 'border-black/[0.06]'],
  ['border-white/[0.12]', 'border-black/[0.08]'],
  ['border-white/[0.15]', 'border-black/[0.08]'],
  
  // hover:text-white -> hover:text-[#1a1a1e]
  ['hover:text-white ', 'hover:text-[#1a1a1e] '],
  ['hover:text-white"', 'hover:text-[#1a1a1e]"'],
  
  // bg-black/40 and bg-black/50 (used for image placeholders) -> lighter
  ['bg-black/40', 'bg-[#e8e8ec]'],
  ['bg-black/50', 'bg-[#e8e8ec]'],
  ['bg-black/30', 'bg-[#e8e8ec]'],
  ['bg-black/20', 'bg-[#f0f0f2]'],
  
  // bg-[var(--qc-bg-dark)] and similar dark bg vars
  ['bg-[var(--qc-bg-dark)]', 'bg-white'],
  ['bg-[var(--qc-bg-medium)]', 'bg-white'],
  ['bg-[var(--qc-bg-pure)]', 'bg-[#f5f5f7]'],
  ['bg-[var(--qc-bg-darkest)]', 'bg-[#1a1a1e]'],
  ['bg-[var(--qc-bg-elevated)]', 'bg-white'],
  
  // text-shadow-sm removal (not needed on light theme)
  [' text-shadow-sm', ''],
  
  // via-white -> via-black for gradient overlays
  ['via-white/[0.06]', 'via-black/[0.04]'],
  ['via-white/[0.08]', 'via-black/[0.06]'],
  
  // Shadow adjustments
  ['shadow-[0_8px_32px_rgba(0,0,0,0.5)]', 'shadow-[0_8px_32px_rgba(0,0,0,0.08)]'],
  ['shadow-[0_8px_32px_rgba(0,0,0,0.4)]', 'shadow-[0_8px_32px_rgba(0,0,0,0.08)]'],
  ['shadow-[0_8px_32px_rgba(0,0,0,0.6)]', 'shadow-[0_8px_32px_rgba(0,0,0,0.08)]'],
  ['shadow-[0_16px_48px_rgba(0,0,0,0.4)]', 'shadow-[0_8px_32px_rgba(0,0,0,0.06)]'],
  ['shadow-[0_16px_48px_rgba(0,0,0,0.6)]', 'shadow-[0_8px_32px_rgba(0,0,0,0.08)]'],
  ['shadow-[0_4px_32px_rgba(0,0,0,0.4)]', 'shadow-[0_2px_16px_rgba(0,0,0,0.06)]'],
  ['shadow-[0_4px_32px_rgba(0,0,0,0.5)]', 'shadow-[0_2px_16px_rgba(0,0,0,0.06)]'],
  
  // ring-white -> ring-black on light bg
  ['ring-white/[0.08]', 'ring-black/[0.06]'],
  ['ring-white/[0.10]', 'ring-black/[0.06]'],
  ['ring-white/[0.12]', 'ring-black/[0.08]'],
  
  // hover:bg-white/[0.XX] -> hover:bg-black/[0.XX]
  ['hover:bg-white/[0.03]', 'hover:bg-black/[0.02]'],
  ['hover:bg-white/[0.04]', 'hover:bg-black/[0.03]'],
  ['hover:bg-white/[0.05]', 'hover:bg-black/[0.03]'],
  ['hover:bg-white/[0.06]', 'hover:bg-black/[0.04]'],
  ['hover:bg-white/[0.08]', 'hover:bg-black/[0.05]'],
  ['hover:bg-white/[0.10]', 'hover:bg-black/[0.06]'],
  
  // active:bg-white/[0.XX] -> active:bg-black/[0.XX]
  ['active:bg-white/[0.06]', 'active:bg-black/[0.04]'],
  ['active:bg-white/[0.08]', 'active:bg-black/[0.05]'],
  
  // hover:border patterns
  ['hover:border-white/[0.10]', 'hover:border-black/[0.08]'],
  ['hover:border-white/[0.15]', 'hover:border-black/[0.1]'],
  ['hover:border-white/[0.20]', 'hover:border-black/[0.12]'],
  
  // divide-white -> divide-black
  ['divide-white/[0.06]', 'divide-black/[0.06]'],
  ['divide-white/[0.08]', 'divide-black/[0.06]'],
  ['divide-white/[0.10]', 'divide-black/[0.06]'],
  
  // from/to gradients
  ['from-white/[0.02]', 'from-black/[0.02]'],
  ['to-white/[0.01]', 'to-black/[0.01]'],
];

function getAllFiles(dir, files = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      getAllFiles(fullPath, files);
    } else if (EXTENSIONS.some(ext => entry.name.endsWith(ext))) {
      files.push(fullPath);
    }
  }
  return files;
}

// Project root
const PROJECT_ROOT = process.cwd();
console.log('Project root:', PROJECT_ROOT);
console.log('Contents:', fs.readdirSync(PROJECT_ROOT));

let totalFiles = 0;
let totalReplacements = 0;

for (const dir of DIRS) {
  const dirPath = path.join(PROJECT_ROOT, dir);
  console.log('Scanning directory:', dirPath);
  if (!fs.existsSync(dirPath)) { console.log('  -> NOT FOUND'); continue; }
  
  const files = getAllFiles(dirPath);
  
  for (const filePath of files) {
    const relativePath = path.relative(PROJECT_ROOT, filePath);
    
    // Skip already-updated files
    if (SKIP_FILES.has(relativePath)) continue;
    
    let content = fs.readFileSync(filePath, 'utf-8');
    const original = content;
    let fileReplacements = 0;
    
    for (const [search, replace] of REPLACEMENTS) {
      if (search instanceof RegExp) {
        const matches = content.match(search);
        if (matches) {
          fileReplacements += matches.length;
          content = content.replace(search, replace);
        }
      } else {
        const count = content.split(search).length - 1;
        if (count > 0) {
          fileReplacements += count;
          content = content.replaceAll(search, replace);
        }
      }
    }
    
    if (content !== original) {
      fs.writeFileSync(filePath, content, 'utf-8');
      totalFiles++;
      totalReplacements += fileReplacements;
      console.log(`Updated ${relativePath} (${fileReplacements} replacements)`);
    }
  }
}

console.log(`\nDone! Updated ${totalFiles} files with ${totalReplacements} total replacements.`);
