#!/bin/bash
# macOS-compatible color replacement – terracotta → teal design system
# Run from project root: bash replace_colors.sh ./src

TARGET="${1:-./src}"

r() {
  local from="$1" to="$2"
  find "$TARGET" \( -name "*.tsx" -o -name "*.ts" -o -name "*.css" -o -name "*.js" \) \
    -exec grep -l "$from" {} \; \
    | while read -r file; do
        sed -i '' "s|$from|$to|g" "$file" 2>/dev/null && echo "  ✓ $file"
      done
}

echo "🎨 Replacing colors in: $TARGET"

echo ""
echo "── Hex ─────────────────────────────────────────────────"
r '#C4673A'  'var(--terra)'
r '#c4673a'  'var(--terra)'
r '#2C1A0E'  'var(--terra-dark)'
r '#2c1a0e'  'var(--terra-dark)'
r '#9C7B65'  'var(--terra-mid)'
r '#9c7b65'  'var(--terra-mid)'
r '#6B4226'  '#1A3542'
r '#6b4226'  '#1a3542'
r '#1F4E5C'  '#163d4a'
r '#7A5540'  'var(--terra-mid)'
r '#E8DDD0'  'var(--glass-border)'
r '#e8ddd0'  'var(--glass-border)'
# Warm whites/beiges → cool equivalents
r '#FAF7F2'  'var(--glass-bg-heavy)'
r '#faf7f2'  'var(--glass-bg-heavy)'
r '#F5F0EB'  'var(--glass-bg)'
r '#f5f0eb'  'var(--glass-bg)'
r '#FFF8F3'  'var(--glass-bg)'
r '#fff8f3'  'var(--glass-bg)'
r '#FFF0E6'  'var(--glass-bg)'
r '#fff0e6'  'var(--glass-bg)'
r '#F1EFE8'  'var(--glass-bg)'
r '#f1efe8'  'var(--glass-bg)'
r '#F5EDE4'  'var(--glass-bg)'
r '#FDE8D8'  'var(--glass-bg)'

echo ""
echo "── rgba terracotta 196,103,58 → teal 46,98,113 ─────────"
for alpha in 0.04 0.05 0.06 0.07 0.08 0.1 0.10 0.12 0.15 0.16 0.18 0.2 0.20 0.25 0.3 0.30 0.35 0.4 0.40 0.45 0.5 0.50 0.55 0.6 0.60 0.65 0.7 0.70 0.75 0.8 0.80 0.85 0.9 0.90 1; do
  r "rgba(196,103,58,$alpha)"    "rgba(46,98,113,$alpha)"
  r "rgba(196, 103, 58, $alpha)" "rgba(46,98,113,$alpha)"
done

echo ""
echo "── rgba warm white 255,248,243 → cool white 252,254,255 ─"
for alpha in 0.4 0.5 0.6 0.65 0.7 0.70 0.75 0.8 0.80 0.85 0.9 0.90 0.92 0.95 1; do
  r "rgba(255,248,243,$alpha)"    "rgba(252,254,255,$alpha)"
  r "rgba(255, 248, 243, $alpha)" "rgba(252,254,255,$alpha)"
done

echo ""
echo "── rgba warm beige 255,240,230 → cool 225,240,245 ───────"
for alpha in 0.7 0.8 0.9 0.90 1; do
  r "rgba(255,240,230,$alpha)"    "rgba(225,240,245,$alpha)"
  r "rgba(255, 240, 230, $alpha)" "rgba(225,240,245,$alpha)"
done

echo ""
echo "── rgba beige 232,221,208 → cool glass 225,232,235 ──────"
for alpha in 0.5 0.6 0.65 0.7 0.70 0.75 0.8 0.9 1; do
  r "rgba(232,221,208,$alpha)"    "rgba(225,232,235,$alpha)"
  r "rgba(232, 221, 208, $alpha)" "rgba(225,232,235,$alpha)"
done

echo ""
echo "── rgba brown-gray 156,123,101 → teal-mid 107,122,130 ───"
for alpha in 0.1 0.15 0.2 0.20 0.25 0.3 0.30 0.35 0.4 0.5; do
  r "rgba(156,123,101,$alpha)"    "rgba(107,122,130,$alpha)"
  r "rgba(156, 123, 101, $alpha)" "rgba(107,122,130,$alpha)"
done

echo ""
echo "── rgba dark brown 44,26,14 → teal-dark 26,37,48 ────────"
for alpha in 0.04 0.06 0.08 0.10 0.12 0.15 0.18 0.2 0.20 0.25 0.30 0.82; do
  r "rgba(44,26,14,$alpha)"    "rgba(26,37,48,$alpha)"
  r "rgba(44, 26, 14, $alpha)" "rgba(26,37,48,$alpha)"
done

echo ""
echo "── CSS var() fallbacks ──────────────────────────────────"
r 'var(--terra, #C4673A)'       'var(--terra)'
r 'var(--terra, #c4673a)'       'var(--terra)'
r 'var(--terra-dark, #2C1A0E)'  'var(--terra-dark)'
r 'var(--terra-dark, #2c1a0e)'  'var(--terra-dark)'
r 'var(--terra-dark,#2C1A0E)'   'var(--terra-dark)'
r 'var(--terra-mid, #9C7B65)'   'var(--terra-mid)'
r 'var(--terra-mid, #9c7b65)'   'var(--terra-mid)'
r 'var(--terra-mid,#9C7B65)'    'var(--terra-mid)'

echo ""
echo "── Tailwind arbitrary classes ───────────────────────────"
r 'bg-\[#C4673A\]'           'bg-[var(--terra)]'
r 'bg-\[#FAF7F2\]'           'bg-[var(--glass-bg-heavy)]'
r 'bg-\[#F5F0EB\]'           'bg-[var(--glass-bg)]'
r 'bg-\[#FFF0E6\]'           'bg-[var(--glass-bg)]'
r 'text-\[#C4673A\]'         'text-[var(--terra)]'
r 'text-\[#2C1A0E\]'         'text-[var(--terra-dark)]'
r 'text-\[#9C7B65\]'         'text-[var(--terra-mid)]'
r 'border-\[#C4673A\]'       'border-[var(--terra)]'
r 'border-\[#E8DDD0\]'       'border-[var(--glass-border)]'
r 'focus:border-\[#C4673A\]' 'focus:border-[var(--terra)]'
r 'hover:border-\[#C4673A\]' 'hover:border-[var(--terra)]'
r 'hover:text-\[#C4673A\]'   'hover:text-[var(--terra)]'
r 'ring-\[#C4673A\]'         'ring-[var(--terra)]'

echo ""
echo "── Gradients ────────────────────────────────────────────"
r 'linear-gradient(135deg, rgba(255,240,230,0.9) 0%, rgba(232,221,208,0.7) 100%)' \
  'linear-gradient(135deg, rgba(225,240,245,0.9) 0%, rgba(200,218,225,0.7) 100%)'
r 'linear-gradient(135deg, #C4673A, #E8A87C)' \
  'linear-gradient(135deg, var(--terra), #4a8fa3)'
r 'linear-gradient(160deg, #2C1A0E 0%, #6B4226 55%, #C4673A 100%)' \
  'linear-gradient(160deg, #0D1E25 0%, #1A3542 50%, #2E6271 100%)'

echo ""
echo "✅ Done!"
echo "   Review:  git diff src/"
echo "   Undo:    git checkout src/"
